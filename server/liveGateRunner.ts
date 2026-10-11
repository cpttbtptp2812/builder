/** Node 端办事技能门禁 — 直接 runSkillManifestOnServer，不经 HTTP */

import { gateQueryWithSampleData } from "../src/lib/productSkillInputs.ts";
import { mustRunServerProcessSkill } from "../src/lib/customerSkillKernel.ts";
import { matchTrace, type SkillTraceCase } from "../src/lib/provingGround.ts";
import type { SkillManifest } from "../src/lib/skillMarkdown.ts";
import type { MockGateResult } from "../src/lib/mockGateRunner.ts";
import { runSkillManifestOnServer, type SkillTraceStep } from "./skills.ts";

function expectStepsForCase(skill: SkillManifest, traceCase: SkillTraceCase) {
  if (traceCase.expect.steps.length) return traceCase.expect.steps;
  return skill.steps.map((s) => ({ stepId: s.id, tool: s.tool, ok: true }));
}

async function runLiveTrace(skill: SkillManifest, traceCase: SkillTraceCase): Promise<SkillTraceStep[]> {
  const q = gateQueryWithSampleData(skill.id, traceCase.query);
  const { trace } = await runSkillManifestOnServer(skill as import("./skills.ts").AgentSkill, q, "skill-gate", {
    productWorkbench: true,
  });
  return trace;
}

export async function runLiveGateComparisonOnServer(
  baseline: SkillManifest,
  candidate: SkillManifest,
  cases: SkillTraceCase[],
): Promise<MockGateResult> {
  if (!mustRunServerProcessSkill(candidate.id)) {
    throw new Error(`runLiveGateComparisonOnServer 仅用于办事技能：${candidate.id}`);
  }

  const skillCases =
    cases.length > 0
      ? cases
      : [
          {
            id: `${candidate.id}-smoke`,
            skillId: candidate.id,
            query: candidate.triggers[0] ?? candidate.description ?? candidate.name,
            expect: { steps: candidate.steps.map((s) => ({ stepId: s.id, tool: s.tool })) },
          } satisfies SkillTraceCase,
        ];

  const failedCases: MockGateResult["failedCases"] = [];
  let tracePass = 0;
  let baselinePassCount = 0;
  let candidatePassCount = 0;

  for (const traceCase of skillCases) {
    const expect = expectStepsForCase(candidate, traceCase);
    const [baselineTrace, candidateTrace] = await Promise.all([
      runLiveTrace(baseline, traceCase),
      runLiveTrace(candidate, traceCase),
    ]);
    const match = matchTrace(candidateTrace, expect);
    if (match.pass) tracePass += 1;
    else failedCases.push({ id: traceCase.id, query: traceCase.query, detail: match.detail });
    if (baselineTrace.every((t) => t.ok)) baselinePassCount += 1;
    if (candidateTrace.every((t) => t.ok)) candidatePassCount += 1;
  }

  const total = candidate.steps.length;
  return {
    tracePass,
    traceTotal: skillCases.length,
    deltaSuccess: candidatePassCount - baselinePassCount,
    pivotalStepId: failedCases.length ? candidate.steps[0]?.id ?? null : null,
    pivotalTool: failedCases.length ? candidate.steps[0]?.tool ?? null : null,
    failedCases,
    coverage: {
      exact: total,
      total,
      exactPct: total ? 100 : 0,
      missingTools: [],
      incomplete: skillCases.length === 0,
    },
  };
}
