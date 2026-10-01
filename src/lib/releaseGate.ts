/** 发版门禁 — PASS / WARN / BLOCK + 原因 + JSON 报告 */

import type { SkillFullCompareReport } from "./skillCompareReport";
import policyRaw from "../../.ownagent/policy.yml?raw";
import { applyGatePolicy, parseGatePolicy, resolveGatePolicy } from "./gatePolicy";
import { OWNAGENT_CHECK_SCHEMA } from "./ownagentProtocol";

export type GateLevel = "pass" | "warn" | "block";

export type ReleaseGateSummary = {
  level: GateLevel;
  label: string;
  gate: "PASS" | "WARN" | "BLOCK";
  reasons: string[];
  deltaSuccess: number | null;
  pivotalStepId: string | null;
  pivotalTool: string | null;
  baselinePass: boolean | null;
  candidatePass: boolean | null;
};

export function gateFromVerdict(level: SkillFullCompareReport["verdict"]["level"]): GateLevel {
  if (level === "approve") return "pass";
  if (level === "warn") return "warn";
  return "block";
}

export function gateLabel(level: GateLevel): "PASS" | "WARN" | "BLOCK" {
  if (level === "pass") return "PASS";
  if (level === "warn") return "WARN";
  return "BLOCK";
}

export function buildReleaseGateSummary(report: SkillFullCompareReport): ReleaseGateSummary {
  const originalLevel = gateFromVerdict(report.verdict.level);
  const rule = resolveGatePolicy(parseGatePolicy(policyRaw), report.skillId, "prod");
  const failedCaseCount = report.queryResults.filter((row) => row.verdictLevel === "reject").length;
  const decision = applyGatePolicy({
    compileOk: report.compile.candidateOk,
    deltaSuccess: report.scm?.deltaSuccess ?? 0,
    failedCaseCount,
    caseCount: report.queryResults.length,
    exactPct: report.coverage.exactPct,
    rule,
  });
  const policyLevel = decision.gate === "BLOCK" ? "block" : decision.gate === "WARN" ? "warn" : "pass";
  const rank: Record<GateLevel, number> = { pass: 0, warn: 1, block: 2 };
  const level = rank[policyLevel] > rank[originalLevel] ? policyLevel : originalLevel;
  const reasons: string[] = [];

  for (const r of report.risks.filter((x) => x.level === "high" || x.level === "medium")) {
    reasons.push(`${r.title}：${r.detail}`);
  }
  if (!reasons.length && report.verdict.bullets.length) {
    reasons.push(...report.verdict.bullets);
  }
  reasons.push(...decision.reasons.filter((reason) => !reasons.includes(reason)));
  if (report.scm?.pivotalStepId && report.scm.baselinePass !== report.scm.candidatePass) {
    reasons.unshift(
      `因果 flip：步骤 \`${report.scm.pivotalStepId}\`${report.scm.pivotalTool ? `（${report.scm.pivotalTool}）` : ""} 干预后结果翻转`,
    );
  }

  return {
    level,
    label: report.verdict.title,
    gate: gateLabel(level),
    reasons: reasons.slice(0, 8),
    deltaSuccess: report.scm?.deltaSuccess ?? null,
    pivotalStepId: report.scm?.pivotalStepId ?? null,
    pivotalTool: report.scm?.pivotalTool ?? null,
    baselinePass: report.scm?.baselinePass ?? null,
    candidatePass: report.scm?.candidatePass ?? null,
  };
}

export function reportToJson(report: SkillFullCompareReport) {
  const gate = buildReleaseGateSummary(report);
  const rule = resolveGatePolicy(parseGatePolicy(policyRaw), report.skillId, "prod");
  const failedCases = report.queryResults
    .filter((row) => row.verdictLevel === "reject")
    .map((row, index) => ({ id: `query-${index + 1}`, query: row.query, detail: row.note }));
  return {
    schema: OWNAGENT_CHECK_SCHEMA,
    generatedAt: report.generatedAt,
    environment: "prod",
    results: [{
      skillId: report.skillId,
      skillName: report.skillName,
      environment: "prod",
      gate: gate.gate,
      compileOk: report.compile.candidateOk,
      baseline: { version: report.baselineVersion },
      candidate: { version: report.candidateVersion },
      deltaSuccess: gate.deltaSuccess ?? 0,
      pivotal: gate.pivotalStepId
        ? { stepId: gate.pivotalStepId, tool: gate.pivotalTool, exact: report.coverage.exactPct === 100 }
        : null,
      failedCases,
      coverage: {
        ...report.coverage,
        missingTools: report.coverage.steps.filter((step) => step.mode === "sample").map((step) => step.tool),
        incomplete: report.queryResults.length === 0 || report.coverage.exactPct < 100,
      },
      policy: {
        risk: rule.risk,
        minExactPct: rule.minExactPct,
        requireCases: rule.requireCases,
        requiresApproval: gate.gate === "WARN" && rule.requireApprovalOnWarn,
      },
      reasons: gate.reasons,
      evidence: {
        verdict: report.verdict,
        scm: report.scm,
        risks: report.risks,
        structural: report.structural,
        queryResults: report.queryResults,
      },
    }],
  };
}

export function downloadReportJson(report: SkillFullCompareReport, filename?: string) {
  const blob = new Blob([JSON.stringify(reportToJson(report), null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename ?? `${report.skillId}-v${report.baselineVersion}-to-v${report.candidateVersion}-gate.json`;
  a.click();
  URL.revokeObjectURL(url);
}
