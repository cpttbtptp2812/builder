import { useEffect, useState, type ReactNode } from "react";
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

export function customerReason(raw: string): string {
  const splitAt = raw.indexOf("：");
  const title = splitAt >= 0 ? raw.slice(0, splitAt) : raw;
  const detail = splitAt >= 0 ? raw.slice(splitAt + 1) : "";
  if (title.includes("新增触发词")) {
    const names = detail.replace(/^新增：/, "").split("，")[0]?.trim();
    return names ? `新加了说法「${names}」，可能和别的技能抢同一句话。` : "新加的说法可能和别的技能抢同一句话。";
  }
  if (title.includes("进错技能")) return "有的话会交给别的技能。";
  if (title.includes("触发词被删除")) return detail.replace(/^用户可能再说/, "客户再说").replace(/时不再触发。?$/, "时，这个技能不再接。");
  if (title.includes("少了步骤")) return "回答少了步骤，可能漏掉内容。";
  if (title.includes("静态错误")) return "新版写得有问题，先改再发。";
  if (title.includes("换了工具")) return "有一步换成了别的做法。";
  if (title.includes("权限")) return "这版能动的范围和现在不一样。";
  if (title.includes("翻转") || title.includes("通过率")) return "有的问法，新版和现用版结果相反。";
  return detail || title;
}

export function gateLead(
  gate: ReleaseGateLevel,
  scm: ScmCompareSummary | null,
): { title: string; note: string } {
  const bothPass = !!(scm?.baselinePass && scm?.candidatePass);
  const flipped = !!(scm && scm.baselinePass !== scm.candidatePass);
  if (gate === "block") {
    return {
      title: "先别发",
      note: flipped && scm?.baselinePass ? "现用版这些问法答得上，新版有的答不上。" : "有问法过不了。",
    };
  }
  if (gate === "warn") {
    return {
      title: "先看一眼再发",
      note: bothPass ? "这些问法两边都答得上，和现用版一样。下面这一条，发之前看一眼。" : "有一处和现用版不一样。",
    };
  }
  return {
    title: "可以发",
    note: bothPass ? "这些问法两边都答得上，和现用版一样。" : "检查过了。",
  };
}

/** 检查过程：三步依次停住，结论最后用大字落下。 */
export function CheckSeal({
  phase,
  seen,
  total,
  title,
  note,
  baselineVersion,
  candidateVersion,
  tone,
}: {
  phase: "run" | "read" | "hold" | "done";
  seen: number;
  total: number;
  title?: string;
  note?: string;
  baselineVersion?: string;
  candidateVersion?: string;
  tone?: ReleaseGateLevel;
}) {
  const [prep, setPrep] = useState(0);
  useEffect(() => {
    if (phase !== "run") return;
    setPrep(0);
    const timer = window.setTimeout(() => setPrep(1), 1200);
    return () => window.clearTimeout(timer);
  }, [phase]);

  const asking = phase === "run";
  const reading = phase === "read";
  const closed = phase === "hold" || phase === "done";
  const steps: { label: string; state: "wait" | "now" | "done" }[] = [
    { label: "问现用版", state: asking ? (prep > 0 ? "done" : "now") : "done" },
    { label: "问新版", state: asking ? (prep > 0 ? "now" : "wait") : "done" },
    {
      label: reading ? `对着第 ${Math.min(seen + 1, Math.max(total, 1))} 句` : closed ? "这几句对完了" : "对着这几句",
      state: closed ? "done" : reading ? "now" : "wait",
    },
  ];

  return (
    <section className={`oa-pass oa-pass--${tone || "run"}`} aria-live="polite">
      <p className="oa-pass-ver">
        {baselineVersion && candidateVersion ? `v${baselineVersion} → v${candidateVersion}` : "现用版 → 新版"}
      </p>
      <ol className="oa-pass-steps">
        {steps.map((step, index) => (
          <li key={index} className={`is-${step.state}`}>
            <i />
            <span>{step.label}</span>
          </li>
        ))}
      </ol>
      {phase === "done" ? (
        <div className="oa-pass-end">
          <h3>{title || "可以发"}</h3>
          {note ? <p>{note}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

/** 发版检查的结论：一句话，加上现用版到新版的图。 */
export function ReleaseGateHero({
  baselineVersion,
  candidateVersion,
  verdictLevel,
  scm,
  reasons,
  caseCount,
  actions,
}: {
  skillName: string;
  baselineVersion: string;
  candidateVersion: string;
  verdictLevel: SkillFullCompareReport["verdict"]["level"];
  verdictTitle: string;
  scm: ScmCompareSummary | null;
  caseCount?: number;
  reasons?: string[];
  actions?: ReactNode;
}) {
  const gate = releaseGateLevel(verdictLevel);
  const lead = gateLead(gate, scm);
  const notes = gate === "pass" ? [] : [...new Set((reasons ?? []).map(customerReason))].slice(0, 3);
  const baseOk = scm ? scm.baselinePass : gate !== "block";
  const nextOk = scm ? scm.candidatePass : gate === "pass";
  const scmFlat = scm && scm.baselinePass === scm.candidatePass;

  return (
    <section className={`oa-release-gate oa-release-gate--${gate}`} aria-label="检查结果">
      <div className="oa-gate-top">
        <span className="oa-gate-badge">{gate === "pass" ? "PASS" : gate === "warn" ? "WARN" : "BLOCK"}</span>
        <span className="oa-gate-meta">
          v{baselineVersion} → v{candidateVersion}
          {typeof caseCount === "number" ? ` · ${caseCount} 条必问` : ""}
        </span>
        {actions ? <div className="oa-gate-actions">{actions}</div> : null}
      </div>
      <div className="oa-gate-stage">
        <div className="oa-gate-fig" aria-hidden>
          <div className={`oa-gate-disc${baseOk ? " is-ok" : " is-bad"}`}>
            <small>现用版</small>
            <strong>v{baselineVersion}</strong>
          </div>
          <svg className="oa-gate-bridge" viewBox="0 0 88 24">
            <path d="M2 12 H78" />
            <path d="M70 6 L80 12 L70 18" />
          </svg>
          <div className={`oa-gate-disc is-b${nextOk ? " is-ok" : " is-bad"}`}>
            <small>新版</small>
            <strong>v{candidateVersion}</strong>
          </div>
        </div>
        <div className="oa-gate-copy">
          <h3>{lead.title}</h3>
          <p>{lead.note}</p>
          {notes.length ? (
            <ul className="oa-gate-reasons">
              {notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          ) : scm && !scmFlat ? (
            <div className="oa-gate-scm-inline">
              <ScmCompareViz
                consequence={{
                  baselinePass: scm.baselinePass,
                  candidatePass: scm.candidatePass,
                  deltaSuccess: scm.deltaSuccess,
                  pivotalOnBaseline: null,
                }}
              />
            </div>
          ) : null}
        </div>
      </div>
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
  { key: "break", label: "这步出错" },
  { key: "skip", label: "跳过这步" },
  { key: "swap_tool", label: "换一种做法" },
] as const;

function cellWord(row: PivotalStepRow | undefined): { text: string; tone: "bad" | "good" | "same" | "empty" } {
  if (!row) return { text: "—", tone: "empty" };
  if (row.baselinePass !== row.counterfactualPass) {
    return row.counterfactualPass ? { text: "会变好", tone: "good" } : { text: "会出问题", tone: "bad" };
  }
  return { text: "没影响", tone: "same" };
}

function boardLead(rows: PivotalStepRow[], baselinePass: boolean): string {
  const tried = rows.filter((row) => row.intervention !== "fix");
  const flip = tried.filter((row) => row.baselinePass !== row.counterfactualPass);
  if (!tried.length) return "还没有测试过单独改某一步会怎样。";
  if (baselinePass) {
    return flip.length
      ? "正常情况能回答。下面看如果某一步出错，回答会不会受影响。"
      : "正常情况能回答，而且不管哪一步出问题，回答都不受影响。";
  }
  if (flip.length) return "目前回答不了。标红的那一步是关键——修好它就有可能正常。";
  return "目前回答不了，但没有找到单独一步是问题所在。";
}

/** 按步骤看：弄坏 / 跳过 / 换成别的，会不会把结果弄挂 */
export function ScmImpactBars({
  rows,
  steps,
  selectedStepId,
  onSelectStep,
  baselinePass = true,
  customerMode,
}: {
  rows: PivotalReport["rows"];
  steps?: AgentSkill["steps"];
  selectedStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  baselinePass?: boolean;
  customerMode?: boolean;
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
    <div className="own-scm-board" role="img" aria-label={customerMode ? "哪一步最关键" : "假如只改一步"}>
      <h4 className="own-scm-board-title">{customerMode ? "哪一步最关键（假设推演）" : "假如只改一步"}</h4>
      <p className="own-scm-board-lead">{boardLead(rows, baselinePass)}</p>
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
  customerMode,
}: {
  baselinePass: boolean;
  counterfactualPass?: boolean;
  rootLabel?: string;
  /** 客户视图：左=实测，右=假设推演，避免和发版结论「能过/不过」打架 */
  customerMode?: boolean;
}) {
  const leftSmall = customerMode ? "这次试句（实测）" : "现在";
  const leftStrong = customerMode
    ? baselinePass
      ? "答对了"
      : "答错了"
    : baselinePass
      ? "能过"
      : "不过";
  const rightSmall = customerMode ? "假设推演（不是实测）" : "动过之后";
  const rightStrong = customerMode
    ? counterfactualPass
      ? "仍能答对"
      : "会答不对"
    : counterfactualPass
      ? "能过"
      : "不过";
  const hypotheticalFail = customerMode && baselinePass && counterfactualPass === false;

  return (
    <div className={`own-scm-flip${customerMode ? " own-scm-flip--customer" : ""}`}>
      <div className={`own-scm-flip-node${baselinePass ? " pass" : " fail"}`}>
        <small>{leftSmall}</small>
        <strong>{leftStrong}</strong>
      </div>
      {counterfactualPass != null && rootLabel ? (
        <>
          <div className="own-scm-flip-arrow">
            <span>{rootLabel}</span>
            <svg viewBox="0 0 80 24" aria-hidden>
              <path d="M4 12 H68 M58 6 L68 12 L58 18" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </div>
          <div
            className={`own-scm-flip-node${hypotheticalFail ? " hypo" : counterfactualPass ? " pass" : " fail"}`}
          >
            <small>{rightSmall}</small>
            <strong>{rightStrong}</strong>
          </div>
        </>
      ) : null}
      {hypotheticalFail ? (
        <p className="own-scm-flip-note">
          发版检查结论不变：这版仍然能过。这里只是说明——若这一步真的出错，回答就会挂，所以这一步最关键。
        </p>
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
