/** 确定性 Agent SCM — do(obs|action) 精确传播 + live trace + 自定义 case */

import {
  getSkill,
  runSkill,
  runSkillFromIndex,
  seedContextFromTrace,
  type AgentSkill,
  type SkillTraceStep,
} from "./agentSkills";
import { applyStepVarWrites } from "./skillVarBindings";
import { resolveTool } from "./skillToolRegistry";
import {
  COUNTERFACTUAL_OBS,
  MOCK_PROFILES,
  SKILL_TRACE_CASES,
  type SkillTraceCase,
} from "./provingGround";
import {
  caseFromSkillSteps,
  listAllCasesForSkill,
  type CustomSkillTraceCase,
} from "./skillTraceCaseStore";
import { evaluateOutcome, type OutcomeGrader, type ScmOutcome } from "./scmOutcome";

export type { ScmOutcome, OutcomeGrader };
export type PropagationMode = "exact" | "sample";

export type ScmIntervention =
  | { kind: "observation"; stepIndex: number; value: unknown }
  | { kind: "skip"; stepIndex: number }
  | { kind: "swap_tool"; stepIndex: number; tool: string };

export type PivotalStepRow = {
  stepIndex: number;
  stepId: string;
  tool: string;
  mode: PropagationMode;
  baselinePass: boolean;
  counterfactualPass: boolean;
  deltaSuccess: number;
  pivotal: boolean;
  intervention: "fix" | "break" | "skip" | "swap_tool";
  interventionDetail?: string;
  detail: string;
};

export type PivotalReport = {
  skillId: string;
  caseId: string;
  query: string;
  baseline: ScmOutcome;
  rows: PivotalStepRow[];
  rootCause: PivotalStepRow | null;
  allExact: boolean;
  liveTrace: boolean;
  actualTrace: SkillTraceStep[];
  missingSteps?: string[];
};

export type ForkDeltaReport = {
  query: string;
  skillA: { id: string; name: string; outcome: ScmOutcome };
  skillB: { id: string; name: string; outcome: ScmOutcome };
  deltaSuccess: number;
  exact: boolean;
};

export type CompareConsequence = {
  baselinePass: boolean;
  candidatePass: boolean;
  deltaSuccess: number;
  pivotalOnBaseline: PivotalStepRow | null;
};

export type ScmQueryRow = {
  query: string;
  baselinePass: boolean;
  candidatePass: boolean;
  deltaSuccess: number;
  pivotalStepId: string | null;
};

export type ScmCompareSummary = {
  deltaSuccess: number;
  baselinePass: boolean;
  candidatePass: boolean;
  pivotalStepId: string | null;
  pivotalTool: string | null;
  perQuery: ScmQueryRow[];
};

export type AnalyzeOpts = {
  observedTrace?: SkillTraceStep[];
  traceCase?: SkillTraceCase & { grader?: OutcomeGrader };
  useMock?: boolean;
  liveTrace?: boolean;
  includeActions?: boolean;
};

export function resolveTraceCase(
  skillId: string,
  caseId?: string,
): (SkillTraceCase & { grader?: OutcomeGrader }) | null {
  const all = listAllCasesForSkill(skillId, SKILL_TRACE_CASES);
  if (caseId) return all.find((c) => c.id === caseId) ?? null;
  return all[0] ?? null;
}

export function identifyStepModes(
  skill: AgentSkill,
  opts: { hasMock: boolean; liveTrace?: boolean; observedTrace?: SkillTraceStep[] },
): PropagationMode[] {
  return skill.steps.map((step, i) => {
    if (opts.liveTrace && opts.observedTrace?.[i]?.result != null) {
      const hasMock = opts.hasMock && Boolean(MOCK_PROFILES[skill.id]?.[step.tool]);
      if (hasMock) return "exact";
      const resolved = resolveTool(step.tool);
      if (resolved.kind !== "unknown" && resolved.effect === "pure") return "exact";
      return "sample";
    }
    if (opts.hasMock && MOCK_PROFILES[skill.id]?.[step.tool]) return "exact";
    const resolved = resolveTool(step.tool);
    if (resolved.kind !== "unknown" && resolved.effect === "pure") return "exact";
    return opts.hasMock ? "exact" : "sample";
  });
}

function observationOk(result: unknown): boolean {
  if (result && typeof result === "object") {
    const o = result as { ok?: boolean; error?: string };
    if (o.ok === false || o.error) return false;
  }
  return true;
}

/** 统一 do(obs|skip|swap_tool) 传播 */
export async function exactDoIntervention(
  skill: AgentSkill,
  query: string,
  observedTrace: SkillTraceStep[],
  intervention: ScmIntervention,
  opts?: {
    probeUrl?: string;
    mockProfile?: Record<string, (args: Record<string, unknown>) => unknown>;
    snapshotRoot?: Element | null;
  },
): Promise<SkillTraceStep[]> {
  const k = intervention.stepIndex;
  const prefix = observedTrace.slice(0, k);
  const ctx = seedContextFromTrace(skill, query, observedTrace, k);

  if (intervention.kind === "skip") {
    const { trace: tail } = await runSkillFromIndex(skill, ctx, k + 1, undefined, {
      ...opts,
      skipIndices: [k],
    });
    return [...prefix, ...tail];
  }

  if (intervention.kind === "observation") {
    const step = skill.steps[k];
    if (!step) return observedTrace;
    const injectRow: SkillTraceStep = {
      stepId: step.id,
      label: step.label,
      tool: step.tool,
      ms: 0,
      ok: observationOk(intervention.value),
      result: intervention.value,
    };
    applyStepVarWrites(ctx.vars, step.id, step.tool, intervention.value);
    const { trace: tail } = await runSkillFromIndex(skill, ctx, k + 1, undefined, opts);
    return [...prefix, injectRow, ...tail];
  }

  const { trace: swapped } = await runSkillFromIndex(skill, ctx, k, undefined, {
    ...opts,
    toolAt: { [k]: intervention.tool },
  });
  return [...prefix, ...swapped];
}

export async function analyzePivotalSteps(
  skillId: string,
  opts: AnalyzeOpts = {},
): Promise<PivotalReport | null> {
  const skill = getSkill(skillId);
  if (!skill?.runnable) return null;

  let tc =
    opts.traceCase ??
    resolveTraceCase(skillId) ??
    caseFromSkillSteps(
      skillId,
      opts.observedTrace ? "live" : skill.triggers[0] ?? "测试",
      skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
    );
  if (skillId === "release-inspector" && (!tc.grader || tc.grader.kind === "skeleton")) {
    tc = { ...tc, grader: { kind: "release_overall", min: "pass" } };
  }

  const useMock = opts.useMock ?? !opts.liveTrace;
  const mockProfile = useMock ? MOCK_PROFILES[skillId] : undefined;
  const liveTrace = Boolean(opts.liveTrace || (opts.observedTrace?.length && !mockProfile));

  let trace = opts.observedTrace;
  if (!trace?.length) {
    const out = await runSkill(skill, tc.query, undefined, {
      probeUrl: tc.probeUrl,
      mockProfile,
    });
    trace = out.trace;
  }

  const baseline = evaluateOutcome(trace, tc);
  const cfObs = COUNTERFACTUAL_OBS[skillId] ?? {};
  const modes = identifyStepModes(skill, { hasMock: Boolean(mockProfile), liveTrace, observedTrace: trace });
  const rows: PivotalStepRow[] = [];

  for (let k = 0; k < trace.length; k += 1) {
    const row = trace[k]!;
    const cf = cfObs[row.stepId];
    const runOpts = { probeUrl: tc.probeUrl, mockProfile };

    if (cf) {
      const useFix = !baseline.pass;
      const interventionValue = useFix ? cf.fix : cf.break;
      if (interventionValue !== undefined) {
        const cfTrace = await exactDoIntervention(
          skill,
          tc.query,
          trace,
          { kind: "observation", stepIndex: k, value: interventionValue },
          runOpts,
        );
        const cfOutcome = evaluateOutcome(cfTrace, tc);
        rows.push({
          stepIndex: k,
          stepId: row.stepId,
          tool: row.tool,
          mode: modes[k] ?? "sample",
          baselinePass: baseline.pass,
          counterfactualPass: cfOutcome.pass,
          deltaSuccess: cfOutcome.score - baseline.score,
          pivotal: baseline.pass !== cfOutcome.pass,
          intervention: useFix ? "fix" : "break",
          detail: cfOutcome.detail,
        });
      }
    }

    if (opts.includeActions !== false) {
      const skipTrace = await exactDoIntervention(skill, tc.query, trace, { kind: "skip", stepIndex: k }, runOpts);
      const skipOutcome = evaluateOutcome(skipTrace, tc);
      if (baseline.pass !== skipOutcome.pass || skipOutcome.score !== baseline.score) {
        rows.push({
          stepIndex: k,
          stepId: row.stepId,
          tool: row.tool,
          mode: modes[k] ?? "exact",
          baselinePass: baseline.pass,
          counterfactualPass: skipOutcome.pass,
          deltaSuccess: skipOutcome.score - baseline.score,
          pivotal: baseline.pass !== skipOutcome.pass,
          intervention: "skip",
          interventionDetail: `跳过 ${row.stepId}`,
          detail: skipOutcome.detail,
        });
      }

      const altTool = pickSwapTool(row.tool);
      if (altTool) {
        const swapTrace = await exactDoIntervention(
          skill,
          tc.query,
          trace,
          { kind: "swap_tool", stepIndex: k, tool: altTool },
          runOpts,
        );
        const swapOutcome = evaluateOutcome(swapTrace, tc);
        if (baseline.pass !== swapOutcome.pass || swapOutcome.score !== baseline.score) {
          rows.push({
            stepIndex: k,
            stepId: row.stepId,
            tool: row.tool,
            mode: modes[k] ?? "exact",
            baselinePass: baseline.pass,
            counterfactualPass: swapOutcome.pass,
            deltaSuccess: swapOutcome.score - baseline.score,
            pivotal: baseline.pass !== swapOutcome.pass,
            intervention: "swap_tool",
            interventionDetail: `${row.tool} → ${altTool}`,
            detail: swapOutcome.detail,
          });
        }
      }
    }
  }

  rows.sort((a, b) => Math.abs(b.deltaSuccess) - Math.abs(a.deltaSuccess));
  const pivotal = rows.filter((r) => r.pivotal);
  const missingSteps = skill.steps
    .filter((s) => !trace!.some((t) => t.stepId === s.id))
    .map((s) => s.id);

  return {
    skillId,
    caseId: tc.id,
    query: tc.query,
    baseline,
    rows,
    rootCause: pivotal[0] ?? null,
    allExact: modes.every((m) => m === "exact"),
    liveTrace,
    actualTrace: trace,
    missingSteps: missingSteps.length ? missingSteps : undefined,
  };
}

function pickSwapTool(current: string): string | null {
  if (current === "http_probe") return "knowledge_search";
  if (current === "knowledge_search") return "http_probe";
  if (current === "browser_snapshot") return "__perf_metrics__";
  return null;
}

export async function analyzeDemoSkill(
  skill: AgentSkill,
  query: string,
  observedTrace?: SkillTraceStep[],
): Promise<PivotalReport | null> {
  const tc = caseFromSkillSteps(
    skill.id,
    query,
    skill.steps.map((s) => ({ id: s.id, tool: s.tool })),
    { grader: { kind: "all_ok" } },
  );
  return analyzePivotalSteps(skill.id, {
    traceCase: tc,
    observedTrace,
    liveTrace: true,
    useMock: false,
    includeActions: true,
  });
}

export async function skillForkDelta(
  skillIdA: string,
  skillIdB: string,
  query?: string,
  grader?: OutcomeGrader,
): Promise<ForkDeltaReport | null> {
  const skillA = getSkill(skillIdA);
  const skillB = getSkill(skillIdB);
  if (!skillA || !skillB) return null;

  const caseA = resolveTraceCase(skillIdA);
  const caseB = resolveTraceCase(skillIdB);
  const q = query ?? caseA?.query ?? caseB?.query ?? "";
  if (!q) return null;

  const mockA = MOCK_PROFILES[skillIdA];
  const mockB = MOCK_PROFILES[skillIdB];

  const [outA, outB] = await Promise.all([
    runSkill(skillA, q, undefined, { probeUrl: caseA?.probeUrl, mockProfile: mockA }),
    runSkill(skillB, q, undefined, { probeUrl: caseB?.probeUrl, mockProfile: mockB }),
  ]);

  const tcA = caseA ?? caseFromSkillSteps(skillIdA, q, skillA.steps.map((s) => ({ id: s.id, tool: s.tool })), { grader });
  const tcB = caseB ?? caseFromSkillSteps(skillIdB, q, skillB.steps.map((s) => ({ id: s.id, tool: s.tool })), { grader });

  const outcomeA = evaluateOutcome(outA.trace, { ...tcA, grader: grader ?? tcA.grader });
  const outcomeB = evaluateOutcome(outB.trace, { ...tcB, grader: grader ?? tcB.grader });

  return {
    query: q,
    skillA: { id: skillIdA, name: skillA.name, outcome: outcomeA },
    skillB: { id: skillIdB, name: skillB.name, outcome: outcomeB },
    deltaSuccess: outcomeB.score - outcomeA.score,
    exact: Boolean(mockA && mockB),
  };
}

/** 共形 ambiguous top-2 分叉 ΔP */
export async function forkDeltaForAmbiguous(
  query: string,
  skillIds: string[],
): Promise<ForkDeltaReport | null> {
  const ids = skillIds.filter((id) => getSkill(id)).slice(0, 2);
  if (ids.length < 2) return null;
  return skillForkDelta(ids[0]!, ids[1]!, query);
}

export async function consequenceDeltaForCompare(
  skillId: string,
  baselineTrace: SkillTraceStep[],
  candidateTrace: SkillTraceStep[],
  query: string,
): Promise<CompareConsequence> {
  const tc =
    resolveTraceCase(skillId) ??
    caseFromSkillSteps(
      skillId,
      query,
      baselineTrace.map((t) => ({ id: t.stepId, tool: t.tool })),
    );

  const baseline = evaluateOutcome(baselineTrace, tc);
  const candidate = evaluateOutcome(candidateTrace, tc);

  let pivotalOnBaseline: PivotalStepRow | null = null;
  if (!baseline.pass) {
    const report = await analyzePivotalSteps(skillId, { observedTrace: baselineTrace, traceCase: tc, liveTrace: true });
    pivotalOnBaseline = report?.rootCause ?? null;
  }

  return {
    baselinePass: baseline.pass,
    candidatePass: candidate.pass,
    deltaSuccess: candidate.score - baseline.score,
    pivotalOnBaseline,
  };
}

export async function scmSummaryForCompare(
  skillId: string,
  runs: Array<{ query: string; baselineTrace: SkillTraceStep[]; candidateTrace: SkillTraceStep[] }>,
): Promise<ScmCompareSummary | null> {
  if (!runs.length) return null;

  const perQuery: ScmQueryRow[] = [];
  let pivotal: PivotalStepRow | null = null;

  for (const run of runs) {
    const row = await consequenceDeltaForCompare(skillId, run.baselineTrace, run.candidateTrace, run.query);
    perQuery.push({
      query: run.query,
      baselinePass: row.baselinePass,
      candidatePass: row.candidatePass,
      deltaSuccess: row.deltaSuccess,
      pivotalStepId: row.pivotalOnBaseline?.stepId ?? null,
    });
    if (!pivotal && row.pivotalOnBaseline) pivotal = row.pivotalOnBaseline;
  }

  const head = perQuery[0]!;
  return {
    deltaSuccess: head.deltaSuccess,
    baselinePass: head.baselinePass,
    candidatePass: head.candidatePass,
    pivotalStepId: pivotal?.stepId ?? perQuery.find((q) => q.pivotalStepId)?.pivotalStepId ?? null,
    pivotalTool: pivotal?.tool ?? null,
    perQuery,
  };
}

/** @deprecated 使用 exactDoIntervention */
export async function exactDoObservation(
  skill: AgentSkill,
  query: string,
  observedTrace: SkillTraceStep[],
  stepIndex: number,
  counterfactualResult: unknown,
  opts?: {
    probeUrl?: string;
    mockProfile?: Record<string, (args: Record<string, unknown>) => unknown>;
  },
): Promise<SkillTraceStep[]> {
  return exactDoIntervention(
    skill,
    query,
    observedTrace,
    { kind: "observation", stepIndex, value: counterfactualResult },
    opts,
  );
}

/** @deprecated 使用 evaluateOutcome */
export function evaluateTraceOutcome(trace: SkillTraceStep[], traceCase: SkillTraceCase): ScmOutcome {
  return evaluateOutcome(trace, traceCase);
}

export { evaluateOutcome } from "./scmOutcome";
export {
  caseFromSkillSteps,
  deleteCustomCase,
  listAllCasesForSkill,
  listCustomCases,
  saveCustomCase,
} from "./skillTraceCaseStore";
export type { CustomSkillTraceCase } from "./skillTraceCaseStore";
