/** Platform-neutral causal comparison used by browser, CLI, API and OEM adapters. */

import { evaluateOutcome, type ScmOutcome } from "./scmOutcome";
import type { SkillTraceCase } from "./provingGround";

export type GateTraceStep = {
  stepId: string;
  label: string;
  tool: string;
  ms: number;
  ok: boolean;
  result?: unknown;
};

export type GateTraceRun = {
  query: string;
  traceCase: SkillTraceCase;
  baselineTrace: GateTraceStep[];
  candidateTrace: GateTraceStep[];
};

export type CausalPivotal = {
  stepIndex: number;
  stepId: string;
  tool: string;
  deltaSuccess: number;
  exact: boolean;
  detail: string;
};

export type CausalRunResult = {
  query: string;
  baseline: ScmOutcome;
  candidate: ScmOutcome;
  deltaSuccess: number;
  pivotal: CausalPivotal | null;
};

export type CausalGateSummary = {
  baselineSuccessRate: number;
  candidateSuccessRate: number;
  deltaSuccess: number;
  pivotalStepId: string | null;
  pivotalTool: string | null;
  perQuery: CausalRunResult[];
};

export type ReplayObservation = (
  run: GateTraceRun,
  stepIndex: number,
  donorValue: unknown,
  target: "baseline" | "candidate",
) => Promise<{ trace: GateTraceStep[]; exact: boolean }>;

function sameObservation(a: GateTraceStep | undefined, b: GateTraceStep | undefined): boolean {
  if (!a || !b) return false;
  if (a.stepId !== b.stepId || a.tool !== b.tool || a.ok !== b.ok) return false;
  return JSON.stringify(a.result) === JSON.stringify(b.result);
}

function replaceObservation(trace: GateTraceStep[], stepIndex: number, donor: GateTraceStep): GateTraceStep[] {
  return trace.map((row, index) =>
    index === stepIndex
      ? { ...row, tool: donor.tool, ok: donor.ok, result: donor.result }
      : row,
  );
}

export async function analyzeCausalRun(
  run: GateTraceRun,
  replayObservation?: ReplayObservation,
): Promise<CausalRunResult> {
  const baseline = evaluateOutcome(run.baselineTrace, run.traceCase);
  const candidate = evaluateOutcome(run.candidateTrace, run.traceCase);
  const targetTrace = candidate.score <= baseline.score ? run.candidateTrace : run.baselineTrace;
  const donorTrace = candidate.score <= baseline.score ? run.baselineTrace : run.candidateTrace;
  const targetSide = candidate.score <= baseline.score ? "candidate" : "baseline";
  const targetOutcome = candidate.score <= baseline.score ? candidate : baseline;
  const donorOutcome = candidate.score <= baseline.score ? baseline : candidate;
  let pivotal: CausalPivotal | null = null;

  if (targetOutcome.pass !== donorOutcome.pass || targetOutcome.score !== donorOutcome.score) {
    for (let index = 0; index < targetTrace.length; index += 1) {
      const target = targetTrace[index];
      const donor = donorTrace.find((row) => row.stepId === target?.stepId) ?? donorTrace[index];
      if (!target || !donor || sameObservation(target, donor)) continue;
      const replayed = replayObservation
        ? await replayObservation(run, index, donor.result, targetSide)
        : { trace: replaceObservation(targetTrace, index, donor), exact: false };
      const outcome = evaluateOutcome(replayed.trace, run.traceCase);
      if (outcome.pass === donorOutcome.pass && outcome.pass !== targetOutcome.pass) {
        const row: CausalPivotal = {
          stepIndex: index,
          stepId: target.stepId,
          tool: target.tool,
          deltaSuccess: outcome.score - targetOutcome.score,
          exact: replayed.exact,
          detail: outcome.detail,
        };
        if (!pivotal || Math.abs(row.deltaSuccess) > Math.abs(pivotal.deltaSuccess)) pivotal = row;
      }
    }
  }

  return {
    query: run.query,
    baseline,
    candidate,
    deltaSuccess: candidate.score - baseline.score,
    pivotal,
  };
}

export async function analyzeCausalGate(
  runs: GateTraceRun[],
  replayObservation?: ReplayObservation,
): Promise<CausalGateSummary | null> {
  if (!runs.length) return null;
  const perQuery: CausalRunResult[] = [];
  for (const run of runs) perQuery.push(await analyzeCausalRun(run, replayObservation));
  const baselineSuccessRate = perQuery.filter((row) => row.baseline.pass).length / perQuery.length;
  const candidateSuccessRate = perQuery.filter((row) => row.candidate.pass).length / perQuery.length;
  const pivotal = perQuery
    .map((row) => row.pivotal)
    .filter((row): row is CausalPivotal => Boolean(row))
    .sort((a, b) => Number(b.exact) - Number(a.exact) || Math.abs(b.deltaSuccess) - Math.abs(a.deltaSuccess))[0] ?? null;
  return {
    baselineSuccessRate,
    candidateSuccessRate,
    deltaSuccess: Number((candidateSuccessRate - baselineSuccessRate).toFixed(4)),
    pivotalStepId: pivotal?.stepId ?? null,
    pivotalTool: pivotal?.tool ?? null,
    perQuery,
  };
}
