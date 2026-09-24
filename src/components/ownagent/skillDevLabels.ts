/** 开发者模式 — 把 Semcompiler 术语翻成人话 */

import type { SkillManifest } from "../../lib/skillMarkdown";

export const DIAG_LABELS: Record<string, string> = {
  TRIGGER_OVERLAP: "触发词冲突",
  UNDEF_VAR: "变量未定义",
  UNDEF_SLOT: "占位符未定义",
  UNKNOWN_TOOL: "工具不存在",
  ENV_UNSUPPORTED: "当前环境不支持",
  SCHEMA_MISMATCH: "参数格式",
  TOOL_NOT_DECLARED: "未在 tools 声明",
  DEAD_SKILL: "无执行步骤",
  PARSE: "解析",
};

export function diagLabel(code: string): string {
  return DIAG_LABELS[code] ?? code;
}

export function flowEdgeText(from: string, stepId: string): string {
  const fromLabel = from.startsWith("$") ? from : from === "query" ? "用户问句" : from === "probeUrl" ? "目标 URL" : from;
  return `${fromLabel} → 步骤「${stepId}」`;
}

export function devIssueCount(skill: SkillManifest): number {
  return skill.diagnostics.filter((d) => d.level === "error" || d.level === "warning").length;
}

export function compileSummary(skill: SkillManifest): string {
  const errors = skill.diagnostics.filter((d) => d.level === "error");
  const warns = skill.diagnostics.filter((d) => d.level === "warning");
  if (errors.length) return `${errors.length} 个错误待修复`;
  if (warns.length) return `${warns.length} 条提醒，可运行`;
  return "静态检查通过";
}
