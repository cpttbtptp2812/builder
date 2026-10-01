/** One Skill Gate decision for the browser, CLI, and API. */

import { applyGatePolicy, resolveGatePolicy, type GatePolicy } from "./gatePolicy";
import { runMockGateComparison } from "./mockGateRunner";
import type { OwnAgentCheckResultV2 } from "./ownagentProtocol";
import type { SkillTraceCase } from "./provingGround";
import type { SkillManifest } from "./skillMarkdown";

export type SkillGateEvaluation = OwnAgentCheckResultV2 & {
  tracePass: number;
  traceTotal: number;
  pivotalStepId: string | null;
  pivotalTool: string | null;
  incomplete: boolean;
};

export function canonicalGateSummary(decision: SkillGateEvaluation) {
  const level = decision.gate === "PASS" ? "pass" : decision.gate === "WARN" ? "warn" : "block";
  return {
    level,
    gate: decision.gate,
    reasons: decision.reasons.slice(0, 8),
    deltaSuccess: decision.deltaSuccess,
    pivotalStepId: decision.pivotalStepId,
    pivotalTool: decision.pivotalTool,
  };
}

export function mergeSkillGateCases(
  skillId: string,
  custom: readonly SkillTraceCase[],
  builtin: readonly SkillTraceCase[],
): SkillTraceCase[] {
  const rows = custom.filter((row) => row.skillId === skillId);
  const ids = new Set(rows.map((row) => row.id));
  return [...rows, ...builtin.filter((row) => row.skillId === skillId && !ids.has(row.id))];
}

export async function evaluateSkillGate(input: {
  baseline: SkillManifest;
  candidate: SkillManifest;
  cases: readonly SkillTraceCase[];
  policy: GatePolicy;
  environment: string;
  baselineVersion?: string;
  candidateVersion?: string;
}): Promise<SkillGateEvaluation> {
  const skillId = input.candidate.id;
  const errors = (input.candidate.diagnostics ?? []).filter((item) => item.level === "error");
  const comparison = await runMockGateComparison(input.baseline, input.candidate, [...input.cases]);
  const rule = resolveGatePolicy(input.policy, skillId, input.environment);
  const decision = applyGatePolicy({
    compileOk: errors.length === 0,
    deltaSuccess: comparison.deltaSuccess,
    failedCaseCount: comparison.failedCases.length,
    caseCount: comparison.traceTotal,
    exactPct: comparison.coverage.exactPct,
    rule,
  });
  const reasons: string[] = [];
  if (errors.length) reasons.push(...errors.map((item) => `[compile] ${item.message}`));
  if (input.baseline.manifest.trim() !== input.candidate.manifest.trim()) {
    reasons.push("相对 baseline 有内容变更");
  }
  if (comparison.deltaSuccess < 0) {
    reasons.push(
      `[causal] ΔP(pass)=${comparison.deltaSuccess}${
        comparison.pivotalStepId ? `；Pivotal=${comparison.pivotalStepId} (${comparison.pivotalTool ?? "unknown"})` : ""
      }`,
    );
  }
  for (const failed of comparison.failedCases) reasons.push(`[trace] ${failed.id}: ${failed.detail}`);
  if (comparison.coverage.exactPct < rule.minExactPct) {
    reasons.push(
      `[coverage] exact ${comparison.coverage.exactPct}%（未覆盖：${comparison.coverage.missingTools.join("、") || "unknown"}）`,
    );
  }
  for (const reason of decision.reasons) {
    if (!reasons.includes(reason)) reasons.push(reason);
  }
  if (!reasons.length) reasons.push("compile + trace 全通过");

  return {
    skillId,
    environment: input.environment,
    gate: decision.gate,
    compileOk: errors.length === 0,
    baseline: { version: input.baselineVersion ?? "baseline" },
    candidate: { version: input.candidateVersion ?? "candidate" },
    deltaSuccess: comparison.deltaSuccess,
    pivotalStepId: comparison.pivotalStepId,
    pivotalTool: comparison.pivotalTool,
    pivotal: comparison.pivotalStepId
      ? { stepId: comparison.pivotalStepId, tool: comparison.pivotalTool, exact: !comparison.coverage.incomplete }
      : null,
    failedCases: comparison.failedCases,
    coverage: comparison.coverage,
    policy: {
      risk: rule.risk,
      minExactPct: rule.minExactPct,
      requireCases: rule.requireCases,
      requiresApproval: decision.requiresApproval,
    },
    reasons,
    tracePass: comparison.tracePass,
    traceTotal: comparison.traceTotal,
    incomplete: decision.incomplete,
  };
}
