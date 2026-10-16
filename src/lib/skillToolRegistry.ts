/** MCP + Internal 工具注册表 — Semcompiler 与运行时环境能力校验 */

import { MCP_TOOLS, getMcpTool, type McpTool } from "./mcpBridgeLab";
import { DESK_METAS } from "./deskProgramMeta";

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
  { name: "__compose_agent_copilot__", label: "Agent Copilot 联合面板", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__answer_faq__", label: "产品问答", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__compose_steps__", label: "汇总各步结果", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__say__", label: "直接回答", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_intake__", label: "表格读入", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_validate_schema__", label: "表格契约", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_validate_rows__", label: "表格行检", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_normalize__", label: "表格入账", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_duplicate_scan__", label: "表格去重", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_parse__", label: "表格认列", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_aggregate__", label: "表格汇总", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_cross_foot__", label: "表格交叉", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_reconcile__", label: "表格对账", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_missing_guard__", label: "缺票守卫", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_escalation__", label: "升级队列", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_exception_queue__", label: "异常队列", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_dept_rollup__", label: "部门汇总", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_deliver_detail__", label: "交付明细", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_deliver_dept__", label: "交付部门表", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_deliver_escalation__", label: "交付队列表", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__sheet_report__", label: "表格结论", effect: "pure", availableIn: ["browser", "server"] },
  {
    name: "__llm_product_brief__",
    label: "模型办结说明",
    effect: "read_remote",
    availableIn: ["browser", "server"],
  },
  { name: "__flow_batch_scan__", label: "流程批量", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_sheet_sync__", label: "对账同步", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_intake__", label: "流程收单", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_invoice__", label: "流程核票", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_reconcile__", label: "流程对账", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_dept_cap__", label: "部门cap", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_dual_sign__", label: "双签", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_route__", label: "流程升级", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__flow_report__", label: "流程落点", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_intake__", label: "流水读入", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_validate_schema__", label: "流水契约", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_validate_months__", label: "月数守卫", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_load__", label: "取流水", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_weighted__", label: "加权月均", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_volatility__", label: "波动率", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_trend__", label: "趋势", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_formula__", label: "现金流测算", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_adjust__", label: "风险调整", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_cap_compare__", label: "上限比较", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_committee__", label: "委员会", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_min_guard__", label: "最低额度", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_deliver_trend__", label: "交付流水", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_deliver_formula__", label: "交付公式", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_deliver_decision__", label: "交付决策", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__data_report__", label: "额度核定", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_intake__", label: "条款读入", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_validate_schema__", label: "条款契约", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_validate_kinds__", label: "类型守卫", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_read__", label: "合同抽要素", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_normalize__", label: "条款规范", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_diff__", label: "条款对照", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_rate_pass__", label: "利率容差", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_appraisal_pass__", label: "评估时效", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_risk__", label: "条款风险", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_block_sign__", label: "签批守卫", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_deliver_clauses__", label: "交付对照表", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_deliver_risk__", label: "交付风险矩阵", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_deliver_remediation__", label: "交付整改", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_deliver_signoff__", label: "交付签批", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__contract_report__", label: "审查意见", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_intake__", label: "影像读入", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_validate_schema__", label: "影像契约", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_validate_blocks__", label: "区块数守卫", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_crop__", label: "影像切块", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_ocr__", label: "影像识别", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_histogram__", label: "置信分布", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_accept__", label: "影像取舍", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_required_guard__", label: "必填字段", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_deliver_fields__", label: "交付字段表", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_deliver_accepted__", label: "交付采用", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_deliver_rejected__", label: "交付弃用", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_deliver_qa__", label: "交付复核", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__image_report__", label: "影像结论", effect: "pure", availableIn: ["browser", "server"] },
  { name: "__credit_flow_turn__", label: "信贷流程推进一步", effect: "pure", availableIn: ["browser", "server"] },
];

for (const meta of DESK_METAS) {
  for (const tool of meta.tools) {
    INTERNAL_TOOLS.push({ name: tool.name, label: tool.label, effect: "pure", availableIn: ["browser", "server"] });
  }
}

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
