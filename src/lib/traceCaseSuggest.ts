/** 从生产 trace 回流 → 建议 case */

import type { SkillTraceStep } from "./agentSkills";
import { caseFromSkillSteps, saveCustomCase, type CustomSkillTraceCase } from "./skillTraceCaseStore";

export type TraceCaseSuggestion = {
  query: string;
  steps: { id: string; tool: string }[];
  grader: CustomSkillTraceCase["grader"];
  reason: string;
};

export function suggestCaseFromTrace(
  skillId: string,
  query: string,
  trace: SkillTraceStep[],
): TraceCaseSuggestion | null {
  const okSteps = trace.filter((t) => t.ok);
  if (!okSteps.length || !query.trim()) return null;

  const allOk = trace.every((t) => t.ok);
  return {
    query: query.trim(),
    steps: okSteps.map((t) => ({ id: t.stepId, tool: t.tool })),
    grader: allOk ? { kind: "all_ok" } : { kind: "skeleton" },
    reason: allOk ? "trace 全 ok，建议 all_ok grader" : "trace 部分失败，建议 skeleton 骨架 case",
  };
}

export function applyTraceSuggestion(skillId: string, suggestion: TraceCaseSuggestion): CustomSkillTraceCase {
  const row = caseFromSkillSteps(skillId, suggestion.query, suggestion.steps, { grader: suggestion.grader });
  return saveCustomCase(row);
}
