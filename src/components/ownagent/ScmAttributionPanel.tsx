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
  observedTrace?: SkillTraceStep[];
  liveTrace?: boolean;
  compare?: {
    query: string;
    baselineTrace: SkillTraceStep[];
    candidateTrace: SkillTraceStep[];
  };
  forkPeerId?: string;
};

type Tab = "viz" | "detail" | "cases";

function interventionLabel(r: PivotalReport["rows"][0]): string {
  if (r.intervention === "skip") return `skip ${r.stepId}`;
  if (r.intervention === "swap_tool") return r.interventionDetail ?? "swap";
  return r.intervention === "fix" ? "fix obs" : "break obs";
}

export function ScmAttributionPanel({
  skillId,
  autoOpen,
  observedTrace,
  liveTrace,
  compare,
  forkPeerId,
}: Props) {
  const skill = getSkill(skillId);
  const [open, setOpen] = useState(Boolean(autoOpen));
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

  return (
    <section className={`own-evo own-scm${autoOpen ? " own-scm--auto" : ""}`}>
      <button type="button" className="own-evo-head" onClick={() => setOpen((v) => !v)}>
        <span className="own-evo-dot own-scm-dot" />
        <strong>因果归因 SCM</strong>
        <span className="own-evo-sub">
          {autoOpen && rootId ? (
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
              概览图
            </button>
            <button type="button" className={tab === "detail" ? "on" : ""} onClick={() => setTab("detail")}>
              干预明细
              {pivotalN ? <em>{pivotalN}</em> : null}
            </button>
            <button type="button" className={tab === "cases" ? "on" : ""} onClick={() => setTab("cases")}>
              测试 case
            </button>
            {selectedStepId ? (
              <button type="button" className="own-scm-clear-filter" onClick={() => setSelectedStepId(null)}>
                取消筛选 · {selectedStepId}
              </button>
            ) : null}
          </nav>

          {loading ? (
            <div className="own-scm-skeleton" aria-busy>
              <div className="own-scm-skeleton-pipe" />
              <div className="own-scm-skeleton-bars" />
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
                  rootLabel={interventionLabel(pivotal.rootCause)}
                />
              ) : (
                <div className="own-scm-flip own-scm-flip--solo">
                  <div className={`own-scm-flip-node${pivotal.baseline.pass ? " pass" : " fail"}`}>
                    <small>baseline · {pivotal.baseline.grader}</small>
                    <strong>{pivotal.baseline.pass ? "PASS" : "FAIL"}</strong>
                  </div>
                  <span className="own-scm-meta">
                    {pivotal.allExact ? "全 exact" : "含 sample"} · {pivotal.liveTrace ? "live" : "mock"}
                  </span>
                </div>
              )}

              <ScmImpactBars
                rows={pivotal.rows}
                selectedStepId={selectedStepId}
                onSelectStep={setSelectedStepId}
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
                        <td>{interventionLabel(r)}</td>
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
            <ScmCaseEditor skillId={skillId} onChanged={() => setCaseTick((n) => n + 1)} />
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
