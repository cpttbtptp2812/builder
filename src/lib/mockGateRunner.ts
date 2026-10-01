/** Deterministic mock runner shared by CLI and server Skill Gate. */

import { analyzeCausalGate, type GateTraceRun, type GateTraceStep } from "./causalGateCore";
import { applyStepVarWrites } from "./skillVarBindings";
import { resolveStepArgs, type SkillManifest } from "./skillMarkdown";
import { matchTrace, MOCK_PROFILES, type SkillTraceCase } from "./provingGround";

export type MockGateResult = {
  tracePass: number;
  traceTotal: number;
  deltaSuccess: number;
  pivotalStepId: string | null;
  pivotalTool: string | null;
  failedCases: Array<{ id: string; query: string; detail: string }>;
  coverage: {
    exact: number;
    total: number;
    exactPct: number;
    missingTools: string[];
    incomplete: boolean;
  };
};

type ExactTraceStep = GateTraceStep & { exact: boolean };

async function runMockTrace(
  skill: SkillManifest,
  traceCase: SkillTraceCase,
  injection?: { stepIndex: number; value: unknown },
): Promise<ExactTraceStep[]> {
  const mocks = MOCK_PROFILES[traceCase.skillId] ?? {};
  const vars: Record<string, unknown> = {};
  const trace: ExactTraceStep[] = [];
  for (let index = 0; index < skill.steps.length; index += 1) {
    const step = skill.steps[index]!;
    const mock = mocks[step.tool];
    const args = resolveStepArgs(step.args, {
      query: traceCase.query,
      probeUrl: traceCase.probeUrl ?? "https://example.com",
      vars,
    });
    const injected = injection?.stepIndex === index;
    const result = injected ? injection.value : mock ? mock(args) : { error: `no mock: ${step.tool}` };
    applyStepVarWrites(vars, step.id, step.tool, result);
    trace.push({
      stepId: step.id,
      label: step.label,
      tool: step.tool,
      ms: 1,
      ok: (injected || Boolean(mock)) && !(result && typeof result === "object" && "error" in result),
      result,
      exact: injected || Boolean(mock),
    });
  }
  return trace;
}

export async function runMockGateComparison(
  baseline: SkillManifest,
  candidate: SkillManifest,
  cases: SkillTraceCase[],
): Promise<MockGateResult> {
  const runs: GateTraceRun[] = [];
  const failedCases: MockGateResult["failedCases"] = [];
  let tracePass = 0;
  for (const traceCase of cases) {
    const [baselineTrace, candidateTrace] = await Promise.all([
      runMockTrace(baseline, traceCase),
      runMockTrace(candidate, traceCase),
    ]);
    const match = matchTrace(candidateTrace, traceCase.expect.steps);
    if (match.pass) tracePass += 1;
    else failedCases.push({ id: traceCase.id, query: traceCase.query, detail: match.detail });
    runs.push({ query: traceCase.query, traceCase, baselineTrace, candidateTrace });
  }
  const causal = await analyzeCausalGate(runs, async (run, stepIndex, donorValue, target) => {
    const trace = await runMockTrace(target === "candidate" ? candidate : baseline, run.traceCase, {
      stepIndex,
      value: donorValue,
    });
    return { trace, exact: trace.every((step) => step.exact) };
  });
  const mocks = MOCK_PROFILES[candidate.id] ?? {};
  const missingTools = [...new Set(candidate.steps.filter((step) => !mocks[step.tool]).map((step) => step.tool))];
  const exact = candidate.steps.filter((step) => Boolean(mocks[step.tool])).length;
  const total = candidate.steps.length;
  const exactPct = cases.length > 0 && total ? Math.round((exact / total) * 100) : 0;
  return {
    tracePass,
    traceTotal: cases.length,
    deltaSuccess: causal?.deltaSuccess ?? 0,
    pivotalStepId: causal?.pivotalStepId ?? null,
    pivotalTool: causal?.pivotalTool ?? null,
    failedCases,
    coverage: { exact, total, exactPct, missingTools, incomplete: cases.length === 0 || total === 0 || exactPct < 100 },
  };
}
