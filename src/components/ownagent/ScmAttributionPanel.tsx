import { useEffect, useMemo, useState } from "react";
import {
  analyzePivotalSteps,
  consequenceDeltaForCompare,
  skillForkDelta,
  type CompareConsequence,
  type ForkDeltaReport,
  type PivotalReport,
} from "../../lib/deterministicScm";
import { getSkill, type SkillTraceStep } from "../../lib/agentSkills";
import { clauseText } from "../../lib/skillHost";
import { computeScmCoverage } from "../../lib/scmCoverage";
import { ScmCaseEditor } from "./ScmCaseEditor";
import {
  ScmCompareViz,
  ScmForkViz,
  ScmImpactBars,
  ScmOutcomeFlip,
  ScmPipelineViz,
} from "./ScmVisuals";

type Props = {
  skillId: string;
  autoOpen?: boolean;
  /** 默认展开（成功/失败路径均可见） */
  defaultExpanded?: boolean;
  observedTrace?: SkillTraceStep[];
  liveTrace?: boolean;
  compare?: {
    query: string;
    baselineTrace: SkillTraceStep[];
    candidateTrace: SkillTraceStep[];
  };
  forkPeerId?: string;
  /** 发版检查折叠区：隐藏实验室用语 */
  customerMode?: boolean;
};

type Tab = "viz" | "detail" | "cases";

function interventionLabel(r: PivotalReport["rows"][0], stepLabel?: string, customer?: boolean): string {
  const quoted = stepLabel ? `「${stepLabel}」` : r.stepId;
  if (customer) {
    if (r.intervention === "skip") return `假设：跳过 ${quoted}`;
    if (r.intervention === "swap_tool") return `假设：${quoted} 换一种做法`;
    if (r.intervention === "fix") return `假设：修好 ${quoted}`;
    return `假设：${quoted} 这步出错`;
  }
  if (r.intervention === "skip") return `跳过${quoted}`;
  if (r.intervention === "swap_tool") return `把${quoted}换成别的`;
  if (r.intervention === "fix") return `修好${quoted}`;
  return `弄坏${quoted}`;
}

export function ScmAttributionPanel({
  skillId,
  autoOpen,
  defaultExpanded = true,
  observedTrace,
  liveTrace,
  compare,
  forkPeerId,
  customerMode,
}: Props) {
  const skill = getSkill(skillId);
  const [open, setOpen] = useState(defaultExpanded || Boolean(autoOpen));
  const [tab, setTab] = useState<Tab>("viz");
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [caseTick, setCaseTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pivotal, setPivotal] = useState<PivotalReport | null>(null);
  const [consequence, setConsequence] = useState<CompareConsequence | null>(null);
  const [fork, setFork] = useState<ForkDeltaReport | null>(null);

  const supported = Boolean(skill?.runnable && skill.steps.length);
  const traceKey = useMemo(
    () => observedTrace?.map((t) => `${t.stepId}:${t.ok}`).join("|") ?? "",
    [observedTrace],
  );
  const compareKey = useMemo(
    () =>
      compare
        ? `${compare.query}|${compare.baselineTrace.map((t) => t.stepId).join(",")}|${compare.candidateTrace.map((t) => t.stepId).join(",")}`
        : "",
    [compare],
  );

  const filteredRows = useMemo(() => {
    if (!pivotal) return [];
    if (!selectedStepId) return pivotal.rows;
    return pivotal.rows.filter((r) => r.stepId === selectedStepId);
  }, [pivotal, selectedStepId]);

  useEffect(() => {
    if (autoOpen) {
      setOpen(true);
      setTab("viz");
    }
  }, [autoOpen]);

  useEffect(() => {
    if (pivotal?.rootCause) setSelectedStepId(pivotal.rootCause.stepId);
  }, [pivotal?.rootCause?.stepId]);

  const shouldRun = open || Boolean(autoOpen);

  useEffect(() => {
    if (!shouldRun || !supported) return;
    let alive = true;
    setLoading(true);
    void (async () => {
      try {
        const [p, c, f] = await Promise.all([
          analyzePivotalSteps(skillId, {
            observedTrace,
            liveTrace: liveTrace ?? Boolean(observedTrace?.length),
            includeActions: true,
          }),
          compare
            ? consequenceDeltaForCompare(skillId, compare.baselineTrace, compare.candidateTrace, compare.query)
            : Promise.resolve(null),
          forkPeerId ? skillForkDelta(skillId, forkPeerId, compare?.query) : Promise.resolve(null),
        ]);
        if (!alive) return;
        setPivotal(p);
        setConsequence(c);
        setFork(f);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [shouldRun, skillId, traceKey, compareKey, forkPeerId, supported, observedTrace, compare, liveTrace, caseTick]);

  if (!supported || !skill) return null;

  const rootId = pivotal?.rootCause?.stepId ?? null;
  const pivotalN = pivotal?.rows.filter((r) => r.pivotal).length ?? 0;
  const coverage = useMemo(
    () => computeScmCoverage(skillId, { observedTrace, liveTrace: liveTrace ?? Boolean(observedTrace?.length) }),
    [skillId, observedTrace, liveTrace],
  );

  return (
    <section className={`own-evo own-scm${autoOpen ? " own-scm--auto" : ""}`}>
      <button type="button" className="own-evo-head" onClick={() => setOpen((v) => !v)}>
        <span className="own-evo-dot own-scm-dot" />
        <strong>{customerMode ? "详细排查" : "因果归因 SCM"}</strong>
        <span className="own-evo-sub">
          {customerMode ? (
            "点开看每一步做了什么、哪一步出了问题"
          ) : autoOpen && rootId ? (
            <>
              <span className="own-scm-badge warn">根因 {rootId}</span>
              {pivotalN ? ` · ${pivotalN} 个 pivotal` : ""}
            </>
          ) : (
            "管道 · 影响图 · do(obs|action)"
          )}
        </span>
        <span className="own-evo-toggle">{open ? "收起" : "展开"}</span>
      </button>

      {open ? (
        <div className="own-evo-body">
          <nav className="own-scm-tabs" aria-label="SCM 视图">
            <button type="button" className={tab === "viz" ? "on" : ""} onClick={() => setTab("viz")}>
              {customerMode ? "处理流程" : "概览图"}
            </button>
            <button type="button" className={tab === "detail" ? "on" : ""} onClick={() => setTab("detail")}>
              {customerMode ? "逐步分析" : "干预明细"}
              {pivotalN ? <em>{pivotalN}</em> : null}
            </button>
            {!customerMode ? (
              <button type="button" className={tab === "cases" ? "on" : ""} onClick={() => setTab("cases")}>
                测试 case
              </button>
            ) : null}
            {selectedStepId ? (
              <button type="button" className="own-scm-clear-filter" onClick={() => setSelectedStepId(null)}>
                {customerMode ? "看全部步骤" : `取消筛选 · ${selectedStepId}`}
              </button>
            ) : null}
          </nav>

          {loading ? (
            <div className="own-scm-skeleton" aria-busy>
              <div className="own-scm-skeleton-pipe" />
              <div className="own-scm-skeleton-bars" />
            </div>
          ) : null}

          {!loading && coverage && !customerMode ? (
            <div className="own-scm-coverage">
              <div className="own-scm-coverage-head">
                <span>传播覆盖率</span>
                <strong>{coverage.exactPct}% exact</strong>
                <small>{coverage.exact}/{coverage.total} 步 · {coverage.sample} sample</small>
              </div>
              <div className="own-scm-coverage-bar" role="progressbar" aria-valuenow={coverage.exactPct}>
                <span style={{ width: `${coverage.exactPct}%` }} />
              </div>
              {coverage.mockHints.length ? (
                <p className="own-scm-note">提升精确度：{coverage.mockHints.join("；")}</p>
              ) : null}
            </div>
          ) : null}

          {!loading && tab === "viz" && pivotal ? (
            <>
              <ScmPipelineViz
                skill={skill}
                trace={observedTrace ?? pivotal.actualTrace}
                rootStepId={rootId}
                missingSteps={pivotal.missingSteps}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
              />

              {pivotal.rootCause ? (
                <ScmOutcomeFlip
                  baselinePass={pivotal.baseline.pass}
                  counterfactualPass={pivotal.rootCause.counterfactualPass}
                  customerMode={customerMode}
                  rootLabel={interventionLabel(
                    pivotal.rootCause,
                    clauseText(skill.steps.find((step) => step.id === pivotal.rootCause?.stepId)?.label ?? pivotal.rootCause.stepId),
                    customerMode,
                  )}
                />
              ) : (
                <div className="own-scm-flip own-scm-flip--solo">
                  <div className={`own-scm-flip-node${pivotal.baseline.pass ? " pass" : " fail"}`}>
                    <small>{customerMode ? "检查结果" : `baseline · ${pivotal.baseline.grader}`}</small>
                    <strong>{pivotal.baseline.pass ? (customerMode ? "能正常回答" : "PASS") : (customerMode ? "回答不了" : "FAIL")}</strong>
                  </div>
                  {!customerMode ? (
                    <span className="own-scm-meta">
                      {pivotal.allExact ? "全 exact" : "含 sample"} · {pivotal.liveTrace ? "live" : "mock"}
                    </span>
                  ) : null}
                </div>
              )}

              <ScmImpactBars
                rows={pivotal.rows}
                steps={skill.steps}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
                baselinePass={pivotal.baseline.pass}
                customerMode={customerMode}
              />

              {pivotal.missingSteps?.length ? (
                <p className="own-scm-root own-scm-warn">
                  缺步：{pivotal.missingSteps.join(" → ")} — 点击管道里灰色节点查看
                </p>
              ) : null}
            </>
          ) : null}

          {!loading && tab === "detail" && pivotal ? (
            <>
              {filteredRows.length ? (
                <table className="own-scm-table">
                  <thead>
                    <tr>
                      <th>步</th>
                      <th>干预</th>
                      <th>ΔP</th>
                      <th>翻转</th>
                      <th>模式</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((r, i) => (
                      <tr
                        key={`${r.stepId}-${r.intervention}-${i}`}
                        className={r.pivotal ? "is-pivotal" : ""}
                        onClick={() => setSelectedStepId(r.stepId)}
                      >
                        <td>
                          <code>{r.stepId}</code>
                          <small>{r.tool}</small>
                        </td>
                        <td>{interventionLabel(r, clauseText(skill.steps.find((step) => step.id === r.stepId)?.label ?? r.stepId), customerMode)}</td>
                        <td className={r.deltaSuccess > 0 ? "up" : r.deltaSuccess < 0 ? "down" : ""}>
                          {r.deltaSuccess > 0 ? "+" : ""}
                          {r.deltaSuccess}
                        </td>
                        <td>{r.pivotal ? "是" : "—"}</td>
                        <td>
                          <span className={`own-scm-mode ${r.mode}`}>{r.mode}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="own-scm-note">无匹配干预记录。</p>
              )}
            </>
          ) : null}

          {!loading && tab === "cases" ? (
            <ScmCaseEditor
              skillId={skillId}
              onChanged={() => setCaseTick((n) => n + 1)}
              fromTrace={
                observedTrace?.length && compare?.query
                  ? { query: compare.query, trace: observedTrace }
                  : observedTrace?.length
                    ? { query: pivotal?.query ?? "", trace: observedTrace }
                    : undefined
              }
            />
          ) : null}

          {!loading && consequence && compare ? (
            <div className="own-scm-compare">
              <h4>发版后果</h4>
              <ScmCompareViz consequence={consequence} />
            </div>
          ) : null}

          {!loading && fork && forkPeerId ? (
            <div className="own-scm-fork">
              <h4>分叉 ΔP · vs {forkPeerId}</h4>
              <ScmForkViz fork={fork} />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
