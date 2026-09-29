import type { AgentSkill, SkillTraceStep } from "../../lib/agentSkills";
import type { CompareConsequence, ForkDeltaReport, PivotalReport, PivotalStepRow, ScmCompareSummary } from "../../lib/deterministicScm";
import type { SkillFullCompareReport } from "../../lib/skillCompareReport";
import { clauseText } from "../../lib/skillHost";

export type ReleaseGateLevel = "pass" | "warn" | "block";

export function releaseGateLevel(level: SkillFullCompareReport["verdict"]["level"]): ReleaseGateLevel {
  if (level === "approve") return "pass";
  if (level === "warn") return "warn";
  return "block";
}

/** 发版门禁首屏 — ΔP / Pivotal / Verdict 三指标 */
export function ReleaseGateHero({
  skillName,
  baselineVersion,
  candidateVersion,
  verdictLevel,
  verdictTitle,
  scm,
  caseCount,
  reasons,
}: {
  skillName: string;
  baselineVersion: string;
  candidateVersion: string;
  verdictLevel: SkillFullCompareReport["verdict"]["level"];
  verdictTitle: string;
  scm: ScmCompareSummary | null;
  caseCount?: number;
  reasons?: string[];
}) {
  const gate = releaseGateLevel(verdictLevel);
  const gateLabel = gate === "pass" ? "PASS" : gate === "warn" ? "WARN" : "BLOCK";
  const deltaPct =
    scm != null ? `${scm.deltaSuccess > 0 ? "+" : ""}${Math.round(scm.deltaSuccess * 100)}%` : "—";
  const pivotal = scm?.pivotalStepId
    ? `${scm.pivotalStepId}${scm.pivotalTool ? ` · ${scm.pivotalTool}` : ""}`
    : "无";

  return (
    <section className={`oa-release-gate oa-release-gate--${gate}`} aria-label="发版门禁">
      <header className="oa-release-gate-head">
        <div>
          <p className="oa-release-gate-eyebrow">发版门禁</p>
          <h3>
            {skillName}{" "}
            <span className="oa-release-gate-ver">
              v{baselineVersion} → v{candidateVersion}
            </span>
          </h3>
        </div>
        <div className={`oa-release-gate-verdict oa-release-gate-verdict--${gate}`}>
          <strong>{gateLabel}</strong>
          <span>{verdictTitle}</span>
        </div>
      </header>
      <div className="oa-release-gate-metrics">
        <div className="oa-release-gate-metric">
          <small>ΔP 成功率</small>
          <strong className={scm && scm.deltaSuccess < 0 ? "down" : scm && scm.deltaSuccess > 0 ? "up" : ""}>
            {deltaPct}
          </strong>
          <span>相对现用版</span>
        </div>
        <div className="oa-release-gate-metric">
          <small>根因步骤</small>
          <strong className="oa-release-gate-pivotal">{pivotal}</strong>
          <span>因果归因</span>
        </div>
        <div className="oa-release-gate-metric">
          <small>基线 / 候选</small>
          <strong className="oa-release-gate-passpair">
            {scm ? (
              <>
                <em className={scm.baselinePass ? "pass" : "fail"}>{scm.baselinePass ? "PASS" : "FAIL"}</em>
                <span aria-hidden>→</span>
                <em className={scm.candidatePass ? "pass" : "fail"}>{scm.candidatePass ? "PASS" : "FAIL"}</em>
              </>
            ) : (
              "—"
            )}
          </strong>
          <span>{caseCount != null ? `${caseCount} 条 case` : "SCM case"}</span>
        </div>
      </div>
      {reasons?.length ? (
        <ul className="oa-release-gate-reasons">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** 工具链管道 — 标出 ok / fail / 缺步 / 根因 */
export function ScmPipelineViz({
  skill,
  trace,
  rootStepId,
  missingSteps,
  selectedStepId,
  onSelectStep,
}: {
  skill: AgentSkill;
  trace?: SkillTraceStep[];
  rootStepId?: string | null;
  missingSteps?: string[];
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
}) {
  return (
    <div className="own-scm-pipe" role="list" aria-label="工具链管道">
      {skill.steps.map((step, i) => {
        const row = trace?.find((t) => t.stepId === step.id);
        const missing = missingSteps?.includes(step.id);
        const pivotal = step.id === rootStepId;
        const selected = step.id === selectedStepId;
        let state: "ok" | "fail" | "miss" | "idle" = "idle";
        if (missing) state = "miss";
        else if (row) state = row.ok ? "ok" : "fail";

        return (
          <div key={step.id} className="own-scm-pipe-wrap" role="listitem">
            {i > 0 ? <span className="own-scm-pipe-arrow" aria-hidden /> : null}
            <button
              type="button"
              className={`own-scm-pipe-node own-scm-pipe-node--${state}${pivotal ? " is-root" : ""}${selected ? " is-selected" : ""}`}
              onClick={() => onSelectStep?.(step.id)}
              title={`${step.label} · ${step.tool}`}
            >
              <span className="own-scm-pipe-id">{step.id}</span>
              <span className="own-scm-pipe-tool">{step.tool.replace(/^__|__$/g, "").slice(0, 14)}</span>
              {pivotal ? <em className="own-scm-pipe-tag">根因</em> : null}
              {state === "miss" ? <em className="own-scm-pipe-tag warn">缺步</em> : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

const BOARD_ACTIONS = [
  { key: "break", label: "弄坏" },
  { key: "skip", label: "跳过" },
  { key: "swap_tool", label: "换成别的" },
] as const;

function cellWord(row: PivotalStepRow | undefined): { text: string; tone: "bad" | "good" | "same" | "empty" } {
  if (!row) return { text: "没试", tone: "empty" };
  if (row.baselinePass !== row.counterfactualPass) {
    return row.counterfactualPass ? { text: "变好了", tone: "good" } : { text: "会挂", tone: "bad" };
  }
  return { text: "没变", tone: "same" };
}

function boardLead(rows: PivotalStepRow[]): string {
  const tried = rows.filter((row) => row.intervention !== "fix");
  const hung = tried.filter((row) => row.baselinePass && !row.counterfactualPass);
  const saved = tried.filter((row) => !row.baselinePass && row.counterfactualPass);
  if (!tried.length) return "还没有试过单独改某一步。";
  if (hung.length === tried.length) return "每一种改法都会让结果从能过变成不过，看不出单独哪一步是原因。";
  if (!hung.length && !saved.length) return "这些改法都不会改变能不能过。";
  if (hung.length && !saved.length) return "标红的改法会把结果弄挂，其余改了也还过。";
  if (saved.length && !hung.length) return "标绿的改法能把不过变成能过。";
  return "红色会弄挂，绿色能救回来。";
}

/** 按步骤看：弄坏 / 跳过 / 换成别的，会不会把结果弄挂 */
export function ScmImpactBars({
  rows,
  steps,
  selectedStepId,
  onSelectStep,
}: {
  rows: PivotalReport["rows"];
  steps?: AgentSkill["steps"];
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
}) {
  const order = steps?.map((step) => step.id) ?? [];
  const stepIds = [...new Set([...order, ...rows.map((row) => row.stepId)])];
  const labelOf = (stepId: string) => {
    const step = steps?.find((item) => item.id === stepId);
    return step ? clauseText(step.label) : stepId;
  };
  const visible = stepIds.filter((stepId) => rows.some((row) => row.stepId === stepId && row.intervention !== "fix"));

  if (!visible.length) {
    return <p className="own-scm-note">还没有试过单独改某一步。</p>;
  }

  return (
    <div className="own-scm-board" role="img" aria-label="动哪一步会挂">
      <p className="own-scm-board-lead">{boardLead(rows)}</p>
      <div className="own-scm-board-grid">
        <span />
        {BOARD_ACTIONS.map((action) => (
          <span key={action.key} className="own-scm-board-col">
            {action.label}
          </span>
        ))}
        {visible.map((stepId) => (
          <button
            key={stepId}
            type="button"
            className={`own-scm-board-step${selectedStepId === stepId ? " is-selected" : ""}`}
            style={{ gridColumn: "1 / -1" }}
            onClick={() => onSelectStep?.(stepId)}
          >
            <span className="own-scm-board-name">{labelOf(stepId)}</span>
            {BOARD_ACTIONS.map((action) => {
              const row = rows.find((item) => item.stepId === stepId && item.intervention === action.key);
              const cell = cellWord(row);
              return (
                <span key={action.key} className={`own-scm-board-cell is-${cell.tone}`}>
                  {cell.text}
                </span>
              );
            })}
          </button>
        ))}
      </div>
    </div>
  );
}

/** baseline → 反事实 双态对比 */
export function ScmOutcomeFlip({
  baselinePass,
  counterfactualPass,
  rootLabel,
}: {
  baselinePass: boolean;
  counterfactualPass?: boolean;
  rootLabel?: string;
}) {
  return (
    <div className="own-scm-flip">
      <div className={`own-scm-flip-node${baselinePass ? " pass" : " fail"}`}>
        <small>现在</small>
        <strong>{baselinePass ? "能过" : "不过"}</strong>
      </div>
      {counterfactualPass != null && rootLabel ? (
        <>
          <div className="own-scm-flip-arrow">
            <span>{rootLabel}</span>
            <svg viewBox="0 0 80 24" aria-hidden>
              <path d="M4 12 H68 M58 6 L68 12 L58 18" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className={`own-scm-flip-node${counterfactualPass ? " pass" : " fail"}`}>
            <small>动过之后</small>
            <strong>{counterfactualPass ? "能过" : "不过"}</strong>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** 分叉 ΔP 双 skill 对比 */
export function ScmForkViz({ fork }: { fork: ForkDeltaReport }) {
  const a = fork.skillA;
  const b = fork.skillB;
  const delta = fork.deltaSuccess;
  return (
    <div className="own-scm-fork-viz">
      <div className={`own-scm-fork-card${a.outcome.pass ? " pass" : " fail"}`}>
        <small>{a.name}</small>
        <strong>{a.outcome.pass ? "PASS" : "FAIL"}</strong>
        <span>{Math.round(a.outcome.score * 100)}%</span>
      </div>
      <div className="own-scm-fork-mid">
        <div className={`own-scm-fork-delta${delta > 0 ? " up" : delta < 0 ? " down" : ""}`}>
          ΔP {delta > 0 ? "+" : ""}
          {delta}
        </div>
        <svg viewBox="0 0 48 24" className="own-scm-fork-svg" aria-hidden>
          <path d="M4 12 H44 M36 7 L44 12 L36 17" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {fork.exact ? <em>exact</em> : <em>sample</em>}
      </div>
      <div className={`own-scm-fork-card${b.outcome.pass ? " pass" : " fail"}`}>
        <small>{b.name}</small>
        <strong>{b.outcome.pass ? "PASS" : "FAIL"}</strong>
        <span>{Math.round(b.outcome.score * 100)}%</span>
      </div>
    </div>
  );
}

/** 发版前后 pass 对比 */
export function ScmCompareViz({ consequence }: { consequence: CompareConsequence }) {
  return (
    <div className="own-scm-compare-viz">
      <div className={`own-scm-compare-node${consequence.baselinePass ? " pass" : " fail"}`}>
        <small>现用版</small>
        <strong>{consequence.baselinePass ? "能过" : "不过"}</strong>
      </div>
      <div className={`own-scm-compare-delta${consequence.candidatePass === consequence.baselinePass ? "" : consequence.candidatePass ? " up" : " down"}`}>
        {consequence.candidatePass === consequence.baselinePass
          ? "还是一样"
          : consequence.candidatePass
            ? "变成能过"
            : "变成不过"}
      </div>
      <div className={`own-scm-compare-node${consequence.candidatePass ? " pass" : " fail"}`}>
        <small>新版</small>
        <strong>{consequence.candidatePass ? "能过" : "不过"}</strong>
      </div>
    </div>
  );
}
