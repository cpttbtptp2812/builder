/** 发版门禁 — PASS / WARN / BLOCK + 原因 + JSON 报告 */

import type { SkillFullCompareReport } from "./skillCompareReport";

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
  const level = gateFromVerdict(report.verdict.level);
  const reasons: string[] = [];

  for (const r of report.risks.filter((x) => x.level === "high" || x.level === "medium")) {
    reasons.push(`${r.title}：${r.detail}`);
  }
  if (!reasons.length && report.verdict.bullets.length) {
    reasons.push(...report.verdict.bullets);
  }
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
  return {
    schema: "ownagent-skill-gate/1",
    generatedAt: report.generatedAt,
    skillId: report.skillId,
    skillName: report.skillName,
    baselineVersion: report.baselineVersion,
    candidateVersion: report.candidateVersion,
    gate,
    verdict: report.verdict,
    scm: report.scm,
    risks: report.risks,
    structural: report.structural,
    compile: report.compile,
    queryResults: report.queryResults,
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
