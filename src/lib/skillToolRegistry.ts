/** MCP + Internal 工具注册表 — Semcompiler 与运行时环境能力校验 */

import { MCP_TOOLS, getMcpTool, type McpTool } from "./mcpBridgeLab";

export type SkillEffect = "pure" | "read_dom" | "read_remote" | "hitl" | "mutate";

export type RuntimeEnv = "browser" | "server";

export type InternalToolDef = {
  name: string;
  label: string;
  effect: SkillEffect;
  availableIn: RuntimeEnv[];
};

export const INTERNAL_TOOLS: InternalToolDef[] = [
  { name: "__perf_metrics__", label: "性能指标", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__compose_release_report__", label: "发布巡检报告", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__compose_site_audit__", label: "站点审计报告", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__analyze_dom_tree__", label: "DOM 分析", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__run_policy_desk__", label: "制度值班", effect: "hitl", availableIn: ["browser", "server"] },
  { name: "__compose_workflow_trace__", label: "Workflow 追踪", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__compose_knowledge__", label: "知识检索报告", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__answer_faq__", label: "产品问答", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__compose_steps__", label: "汇总各步结果", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__say__", label: "直接回答", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_parse__", label: "表格认列", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_aggregate__", label: "表格汇总", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_reconcile__", label: "表格对账", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_report__", label: "表格结论", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_intake__", label: "流程收单", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_invoice__", label: "流程核票", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_reconcile__", label: "流程对账", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_route__", label: "流程升级", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_report__", label: "流程落点", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_load__", label: "取流水", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_formula__", label: "现金流测算", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_adjust__", label: "风险调整", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_report__", label: "额度核定", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_read__", label: "合同抽要素", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_diff__", label: "条款对照", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_risk__", label: "条款风险", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_report__", label: "审查意见", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_crop__", label: "影像切块", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_ocr__", label: "影像识别", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_accept__", label: "影像取舍", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_report__", label: "影像字段表", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__credit_flow_turn__", label: "信贷流程推进一步", effect: "pure", availableIn: ["browser", "server"] },
];

const INTERNAL_BY_NAME = new Map(INTERNAL_TOOLS.map((t) => [t.name, t]));

export type ResolvedTool =
  | { kind: "mcp"; name: string; def: McpTool; effect: SkillEffect }
  | { kind: "internal"; name: string; def: InternalToolDef; effect: SkillEffect }
  | { kind: "unknown"; name: string };

const MCP_EFFECT: Record<string, SkillEffect> = {
  browser_navigate: "read_dom",
  browser_snapshot: "read_dom",
  knowledge_search: "read_remote",
  workflow_run: "mutate",
  http_probe: "read_remote",
  policy_search: "read_remote",
  ticket_draft: "hitl",
  ticket_commit: "mutate",
};

export function resolveTool(name: string): ResolvedTool {
  if (name.startsWith("__")) {
    const def = INTERNAL_BY_NAME.get(name);
    if (!def) return { kind: "unknown", name };
    return { kind: "internal", name, def, effect: def.effect };
  }
  const def = getMcpTool(name);
  if (!def) return { kind: "unknown", name };
  return { kind: "mcp", name, def, effect: MCP_EFFECT[name] ?? "read_remote" };
}

export function toolAvailableIn(name: string, env: RuntimeEnv): boolean {
  const resolved = resolveTool(name);
  if (resolved.kind === "unknown") return false;
  if (resolved.kind === "mcp") return true;
  return resolved.def.availableIn.includes(env);
}

export function allKnownToolNames(): string[] {
  return [...MCP_TOOLS.map((t) => t.name), ...INTERNAL_TOOLS.map((t) => t.name)];
}
