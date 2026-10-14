/** 办事技能发版检查 — 与对话同源：服务端 runSkillManifest + 验收 CSV（如有） */

import type { SkillTraceStep } from "./agentSkills";
import { apiFetch } from "./apiClient";
import { mustRunServerProcessSkill } from "./customerSkillKernel";
import { gateQueryWithSampleData } from "./productSkillInputs";
import { expectStepsForCase, matchCase, type SkillTraceCase } from "./provingGround";
import type { SkillManifest } from "./skillMarkdown";
import type { MockGateResult } from "./mockGateRunner";

export async function fetchInlineSkillTrace(
  skill: SkillManifest,
  query: string,
): Promise<{ trace: SkillTraceStep[]; output: unknown; totalMs?: number } | null> {
  const q = gateQueryWithSampleData(skill.id, query);
  return apiFetch("/skills/run-inline", {
    method: "POST",
    body: JSON.stringify({
      skillId: skill.id,
      raw: skill.manifest,
      query: q,
      productWorkbench: true,
    }),
  });
}

async function runLiveTrace(skill: SkillManifest, traceCase: SkillTraceCase): Promise<SkillTraceStep[]> {
  const data = await fetchInlineSkillTrace(skill, traceCase.query);
  if (!data?.trace) {
    throw new Error("办事 API 未启动，无法用真实技能做发版检查（请 npm run dev:full）");
  }
  return data.trace;
}

export async function runLiveGateComparison(
  baseline: SkillManifest,
  candidate: SkillManifest,
  cases: SkillTraceCase[],
): Promise<MockGateResult> {
  if (!mustRunServerProcessSkill(candidate.id)) {
    throw new Error(`runLiveGateComparison 仅用于办事技能：${candidate.id}`);
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
    const match = matchCase(candidateTrace, expect, traceCase);
    if (match.pass) tracePass += 1;
    else failedCases.push({ id: traceCase.id, query: traceCase.query, detail: match.detail });
    if (baselineTrace.every((t) => t.ok)) baselinePassCount += 1;
    if (candidateTrace.every((t) => t.ok)) candidatePassCount += 1;
  }

  const total = candidate.steps.length;
  const exact = total;
  const exactPct = total ? 100 : 0;

  return {
    tracePass,
    traceTotal: skillCases.length,
    deltaSuccess: candidatePassCount - baselinePassCount,
    pivotalStepId: failedCases.length ? candidate.steps.find((s) => !s.tool.startsWith("__"))?.id ?? candidate.steps[0]?.id ?? null : null,
    pivotalTool: failedCases.length ? candidate.steps[0]?.tool ?? null : null,
    failedCases,
    coverage: {
      exact,
      total,
      exactPct,
      missingTools: [],
      incomplete: skillCases.length === 0,
    },
  };
}
