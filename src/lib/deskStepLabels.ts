/** 办事技能步骤 — 给人看的标题来自「工具+参数+运行结果」，不是 SKILL 里写死的演示文案 */

import { contractProgramPolicyFromArgs } from "./contractDeskProgram";
import { dataProgramRecipeFromArgs } from "./dataDeskProgram";
import { imageProgramPolicyFromArgs } from "./imageDeskProgram";
import { flowPolicyFromArgs } from "./flowEngine";
import { sheetProgramRecipeFromArgs } from "./sheetDeskProgram";
import { sheetRecipeFromArgs } from "./sheetEngine";
import { deskToolLabel } from "./deskProgramMeta";

export type DeskStepLike = {
  id: string;
  label?: string;
  tool: string;
  args?: Record<string, unknown>;
};

function sheetRuleLine(args?: Record<string, unknown>): string {
  const r = sheetProgramRecipeFromArgs(args);
  const tax = r.tax === "exclude" ? "不含税入账" : "含税入账";
  const miss = r.missing === "block" ? "缺票拦截" : "缺票可过";
  const esc = r.escalation;
  return `${tax} · 按「${r.groupBy}」汇总 · 容差 ${r.tolerance} 元 · ${miss} · 升级线 ${esc.leadAt}/${esc.directorAt}/${esc.financeReviewAt}`;
}

function contractRuleLine(args?: Record<string, unknown>): string {
  const p = contractProgramPolicyFromArgs(args);
  return `利率容差 ${p.rateTolerance}% · 评估 ${p.appraisalDays} 天 · ${p.strict ? "严格" : "一般"} · 高风险${p.blockOnHigh ? "禁签" : "可附条件"}`;
}

function dataRuleLine(args?: Record<string, unknown>): string {
  const r = dataProgramRecipeFromArgs(args);
  return `稳定 ${r.stability} · 偿债 ${r.debtRatio} · 上限 ${r.policyCap} 万 · ≥${r.minMonths} 月 · 加权 ${r.recentWeight}`;
}

function flowRuleLine(args?: Record<string, unknown>): string {
  const p = flowPolicyFromArgs(args);
  const miss = p.missing === "return" ? "缺票退回" : "缺票暂挂";
  const mm = p.mismatch === "block" ? "差额拦截" : "差额提醒";
  return `${p.leadAt} 元→负责人 · ${p.directorAt} 元→总监 · ${miss} · ${mm}`;
}

function imageRuleLine(args?: Record<string, unknown>): string {
  const p = imageProgramPolicyFromArgs(args);
  return `置信线 ${p.minConfidence.toFixed(2)} · 必填 ${p.requiredFields.join("、") || "—"}`;
}

/** 技能页 / 列表：静态展示（未跑 process 时） */
export function deskStepCaption(step: DeskStepLike): string {
  switch (step.tool) {
    case "__sheet_intake__":
    case "__sheet_parse__":
      return "读入您导入的报销明细";
    case "__sheet_validate_schema__":
      return "校验必需列契约（缺列可 failFast 终止）";
    case "__sheet_validate_rows__":
      return "行级金额/上限/税额校验";
    case "__sheet_normalize__":
      return `套用入账与缺票策略（${sheetRuleLine(step.args)}）`;
    case "__sheet_duplicate_scan__":
      return "扫描申请人+金额重复";
    case "__sheet_aggregate__":
      return `按维度汇总（${sheetRuleLine(step.args)}）`;
    case "__sheet_cross_foot__":
      return "明细合计与部门汇总交叉校验";
    case "__sheet_reconcile__":
      return `发票容差对账（${sheetRuleLine(step.args)}）`;
    case "__sheet_missing_guard__":
      return "缺票策略守卫（block 时可终止流程）";
    case "__sheet_escalation__":
      return "按金额线写入出纳/负责人/总监/财务队列";
    case "__sheet_exception_queue__":
      return "汇总拦截与警告清单";
    case "__sheet_dept_rollup__":
    case "__sheet_deliver_dept__":
      return "交付部门汇总表";
    case "__sheet_deliver_detail__":
      return "交付逐行对账明细表";
    case "__sheet_deliver_escalation__":
      return "交付升级审批队列表";
    case "__sheet_report__":
      return "结论与四表打包";
    case "__llm_product_brief__":
      return "大模型读材料摘要，在引擎锁数下写办结说明";
    case "__contract_read__":
      return "从您导入的条款表读出要素";
    case "__contract_diff__":
      return `合同 ↔ 审批模板对照（${contractRuleLine(step.args)}）`;
    case "__contract_risk__":
      return "按规则标高/中/低与修改建议";
    case "__contract_report__":
      return "出具审查结论与条款表";
    case "__data_load__":
      return "按您导入的按月流水算月均流入";
    case "__data_formula__":
      return `现金流额度（${dataRuleLine(step.args)}）`;
    case "__data_adjust__":
      return "乘信用、行业、年限系数";
    case "__data_report__":
      return "与政策上限比较后给出核定额度";
    case "__flow_batch_scan__":
      return "扫描本批单据与对账拦截数";
    case "__flow_sheet_sync__":
      return "同步 sheet-desk 对账/拦截结论";
    case "__flow_dept_cap__":
      return "部门月度累计 cap 守卫";
    case "__flow_dual_sign__":
      return "大额双签要求";
    case "__flow_intake__":
      return "定位焦点单（部门、金额、申请人）";
    case "__flow_invoice__":
      return `核发票（${flowRuleLine(step.args)}）`;
    case "__flow_reconcile__":
      return "核对金额与发票差额";
    case "__flow_route__":
      return `按金额决定下一审批节点（${flowRuleLine(step.args)}）`;
    case "__flow_report__":
      return "写出当前停在哪一关";
    case "__image_crop__":
      return "凭证影像分块（块数随影像结构，非写死）";
    case "__image_ocr__":
      return "逐块识别文字与置信度";
    case "__image_accept__":
      return `按置信度取舍（${imageRuleLine(step.args)}）`;
    case "__image_report__":
      return "输出采用的字段表";
    default:
      return step.label?.trim() || deskToolLabel(step.tool) || step.id;
  }
}

/** 对话 / process 进度条：优先用引擎跑出来的 detail */
export function traceStepDisplayLabel(step: DeskStepLike, result?: unknown): string {
  if (result && typeof result === "object") {
    const r = result as { detail?: string; dashboard?: Record<string, { phase?: string }> };
    if (typeof r.detail === "string" && r.detail.length >= 4) {
      const first = r.detail.split(/[。；]/)[0]?.trim();
      if (first && first.length <= 56) return first;
      if (first) return `${first.slice(0, 53)}…`;
    }
  }
  const tool = step.tool;
  if (tool.startsWith("__sheet_")) {
    const phase =
      tool === "__sheet_parse__"
        ? "认列"
        : tool === "__sheet_aggregate__"
          ? "汇总"
          : tool === "__sheet_reconcile__"
            ? "对账"
            : "结论";
    return phase;
  }
  if (tool.startsWith("__contract_")) {
    const phase =
      tool === "__contract_read__"
        ? "读条款"
        : tool === "__contract_diff__"
          ? "对照"
          : tool === "__contract_risk__"
            ? "标风险"
            : "审查意见";
    return phase;
  }
  return deskStepCaption(step);
}

function ticketRuleLine(steps: DeskStepLike[]): string {
  const sla = (steps.find((s) => s.tool === "__ticket_sla__")?.args?.targets ?? {}) as Record<string, Record<string, unknown>>;
  const levels = ["P1", "P2", "P3"]
    .filter((p) => sla[p])
    .map((p) => `${p} 首响 ${sla[p]!.firstResponseMinutes ?? "—"} 分/解决 ${sla[p]!.resolveHours ?? "—"} 时`);
  const dedupe = steps.some((s) => s.tool === "__ticket_dedupe__") ? "合并重复" : "不合并重复";
  return [...levels, dedupe].join(" · ");
}

function shiftRuleLine(steps: DeskStepLike[]): string {
  const a = steps.find((s) => s.tool === "__shift_rules__")?.args ?? {};
  const repair = steps.some((s) => s.tool === "__shift_repair__") ? "调换补缺" : "不调换";
  return `休息 ≥ ${a.minRestHours ?? 11} 时 · 每天 ≤ ${a.maxDailyHours ?? 10} 时 · 连上 ≤ ${a.maxConsecutiveDays ?? 6} 天 · ${repair}`;
}

export function deskSkillRuleSummary(skillId: string, steps: DeskStepLike[]): string {
  if (skillId === "ticket-desk") return ticketRuleLine(steps);
  if (skillId === "shift-desk") return shiftRuleLine(steps);
  const first = steps.find((s) => s.tool.startsWith("__"));
  if (!first) return "";
  switch (skillId) {
    case "ledger-desk":
    case "sheet-desk":
      return sheetRuleLine(first.args);
    case "contract-desk":
      return contractRuleLine(first.args);
    case "data-desk":
      return dataRuleLine(first.args);
    case "flow-desk":
      return flowRuleLine(first.args);
    case "image-desk":
      return imageRuleLine(first.args);
    default:
      return "";
  }
}

export function isDeskProcessTool(tool: string): boolean {
  return (
    tool.startsWith("__sheet_") ||
    tool === "__llm_product_brief__" ||
    tool.startsWith("__contract_") ||
    tool.startsWith("__data_") ||
    tool.startsWith("__flow_") ||
    tool.startsWith("__image_") ||
    deskToolLabel(tool) !== undefined
  );
}
