import type { AgentSkill, SkillTraceStep } from "../../lib/agentSkills";
import type { CompareConsequence, ForkDeltaReport, PivotalReport } from "../../lib/deterministicScm";

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

/** 逐步 ΔP 影响条 — 点击筛选详情表 */
export function ScmImpactBars({
  rows,
  selectedStepId,
  onSelectStep,
}: {
  rows: PivotalReport["rows"];
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
}) {
  const top = [...rows]
    .filter((r) => r.pivotal || Math.abs(r.deltaSuccess) > 0)
    .slice(0, 10);

  if (!top.length) {
    return <p className="own-scm-note">暂无显著干预影响。</p>;
  }

  return (
    <div className="own-scm-bars" role="img" aria-label="逐步干预 ΔP 影响">
      <div className="own-scm-bars-head">
        <span>干预影响 ΔP</span>
        <span className="own-scm-bars-legend">
          <i className="up" /> 翻转变过
          <i className="down" /> 翻转变挂
        </span>
      </div>
      {top.map((r, i) => {
        const w = Math.min(100, Math.abs(r.deltaSuccess) * 100);
        const up = r.deltaSuccess > 0;
        return (
          <button
            key={`${r.stepId}-${r.intervention}-${i}`}
            type="button"
            className={`own-scm-bar-row${r.pivotal ? " is-pivotal" : ""}${selectedStepId === r.stepId ? " is-selected" : ""}`}
            onClick={() => onSelectStep?.(r.stepId)}
          >
            <span className="own-scm-bar-label">
              <code>{r.stepId}</code>
              <small>{r.intervention}</small>
            </span>
            <span className="own-scm-bar-track">
              <span
                className={`own-scm-bar-fill ${up ? "up" : "down"}`}
                style={{ width: `${Math.max(w, r.pivotal ? 12 : 4)}%` }}
              />
            </span>
            <em className={up ? "up" : "down"}>
              {up ? "+" : ""}
              {r.deltaSuccess}
            </em>
          </button>
        );
      })}
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
        <small>baseline</small>
        <strong>{baselinePass ? "PASS" : "FAIL"}</strong>
      </div>
      {counterfactualPass != null && rootLabel ? (
        <>
          <div className="own-scm-flip-arrow">
            <span>do({rootLabel})</span>
            <svg viewBox="0 0 80 24" aria-hidden>
              <path d="M4 12 H68 M58 6 L68 12 L58 18" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div className={`own-scm-flip-node${counterfactualPass ? " pass" : " fail"}`}>
            <small>反事实</small>
            <strong>{counterfactualPass ? "PASS" : "FAIL"}</strong>
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
        <strong>{consequence.baselinePass ? "PASS" : "FAIL"}</strong>
      </div>
      <div className={`own-scm-compare-delta${consequence.deltaSuccess >= 0 ? " up" : " down"}`}>
        ΔP {consequence.deltaSuccess > 0 ? "+" : ""}
        {consequence.deltaSuccess}
      </div>
      <div className={`own-scm-compare-node${consequence.candidatePass ? " pass" : " fail"}`}>
        <small>新版</small>
        <strong>{consequence.candidatePass ? "PASS" : "FAIL"}</strong>
      </div>
    </div>
  );
}
