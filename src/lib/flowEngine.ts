/** 流程技能：单据对上节点，守卫决定停在哪一关。门槛和拦截策略一变，落点就变。 */

import { tableFromQuery, type SheetRow, type WorkGrid } from "./sheetEngine";

export type FlowPolicy = {
  directorAt: number;
  leadAt: number;
  mismatch: "block" | "warn";
  missing: "return" | "later";
};

export type FlowPhase = { id: string; label: string; detail: string };

export type FlowExecution = {
  policy: FlowPolicy;
  phases: FlowPhase[];
  summary: string;
  markdown: string;
  halt: string;
  grid: WorkGrid;
};

const DEFAULT_POLICY: FlowPolicy = { directorAt: 10000, leadAt: 5000, mismatch: "block", missing: "return" };

export function flowPolicyFromArgs(args: Record<string, unknown> | undefined): FlowPolicy {
  const directorAt = Number(args?.directorAt ?? DEFAULT_POLICY.directorAt);
  const leadAt = Number(args?.leadAt ?? DEFAULT_POLICY.leadAt);
  return {
    directorAt: Number.isFinite(directorAt) ? directorAt : DEFAULT_POLICY.directorAt,
    leadAt: Number.isFinite(leadAt) ? leadAt : DEFAULT_POLICY.leadAt,
    mismatch: args?.mismatch === "warn" ? "warn" : "block",
    missing: args?.missing === "later" ? "later" : "return",
  };
}

export function flowPolicyFromSteps(steps: { tool: string; args?: Record<string, unknown> }[]): FlowPolicy | null {
  const mine = steps.filter((step) => step.tool.startsWith("__flow_"));
  if (!mine.length) return null;
  return mine.reduce((policy, step) => ({ ...policy, ...flowPolicyFromArgs(step.args) }), { ...DEFAULT_POLICY });
}

function num(row: SheetRow, key: string): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pickCase(query: string): { dept: string; person: string; amount: number; invoice: number | null } {
  const table = tableFromQuery(query);
  const amountHit = query.match(/(\d{3,})/);
  const asked = amountHit ? Number(amountHit[1]) : null;
  const dept = query.includes("研发") ? "研发" : query.includes("财务") ? "财务" : query.includes("市场") ? "市场" : "";
  const rows = table.rows.filter((row) => {
    if (dept && String(row["部门"] ?? "") !== dept) return false;
    if (asked != null && num(row, "金额") !== asked) return false;
    return true;
  });
  const row = rows[0] ?? table.rows.find((item) => (asked != null ? num(item, "金额") === asked : false)) ?? table.rows[0];
  return {
    dept: String(row?.["部门"] ?? (dept || "未填")),
    person: String(row?.["申请人"] ?? "未点名"),
    amount: num(row ?? {}, "金额") ?? asked ?? 0,
    invoice: row ? num(row, "发票额") : null,
  };
}

export function executeFlow(query: string, policy: FlowPolicy = DEFAULT_POLICY): FlowExecution {
  const bill = pickCase(query);
  const gap = bill.invoice == null ? null : Math.abs(bill.amount - bill.invoice);
  const phases: FlowPhase[] = [];
  let halt = "";

  phases.push({
    id: "intake",
    label: "收单",
    detail: `收单：${bill.dept} ${bill.person}，金额 ${bill.amount}。`,
  });

  if (bill.invoice == null && policy.missing === "return") {
    halt = "退回补票";
    phases.push({ id: "invoice", label: "核发票", detail: "没有发票。缺票要退回，流程停在这里。" });
  } else if (bill.invoice == null) {
    phases.push({ id: "invoice", label: "核发票", detail: "没有发票。这一版允许后补，先往下走。" });
  } else {
    phases.push({ id: "invoice", label: "核发票", detail: `发票额 ${bill.invoice}。` });
  }

  if (halt) {
    phases.push({ id: "reconcile", label: "对账", detail: `已经停在${halt}，不再对账。` });
  } else if (gap != null && gap > 0 && policy.mismatch === "block") {
    halt = "财务复核";
    phases.push({ id: "reconcile", label: "对账", detail: `差额 ${gap}。对不平就拦截，停在财务复核。` });
  } else if (gap != null && gap > 0) {
    phases.push({ id: "reconcile", label: "对账", detail: `差额 ${gap}。这一版只警告，不拦截。` });
  } else {
    phases.push({ id: "reconcile", label: "对账", detail: bill.invoice == null ? "缺票已放过，跳过对平。" : "金额和发票一致。" });
  }

  if (halt) {
    phases.push({ id: "route", label: "升级", detail: `已经停在${halt}，不再按金额升级。` });
  } else if (bill.amount >= policy.directorAt) {
    halt = "总监";
    phases.push({ id: "route", label: "升级", detail: `金额 ${bill.amount} 达到总监线 ${policy.directorAt}，停在总监。` });
  } else if (bill.amount >= policy.leadAt) {
    halt = "部门负责人";
    phases.push({ id: "route", label: "升级", detail: `金额 ${bill.amount} 过了 ${policy.leadAt}，未到总监线 ${policy.directorAt}，停在部门负责人。` });
  } else {
    halt = "出纳";
    phases.push({ id: "route", label: "升级", detail: `金额 ${bill.amount} 低于 ${policy.leadAt}，停在出纳。` });
  }

  const summary = halt === "财务复核"
    ? `停在财务复核。${bill.dept}${bill.person} ${bill.amount}，发票少 ${gap}，对平之前不往下走。`
    : halt === "退回补票"
      ? `停在退回补票。${bill.dept}${bill.person} ${bill.amount} 没有发票。`
      : halt === "部门负责人"
        ? `停在部门负责人。差额 ${gap ?? 0} 只警告，总监要到 ${policy.directorAt} 才升级。`
        : `停在${halt}。${bill.dept}${bill.person} ${bill.amount}。`;

  phases.push({ id: "report", label: "落点", detail: summary });
  const walked = phases.slice(0, 4);
  const grid: WorkGrid = {
    columns: ["顺序", "关卡", "本单", "结果"],
    rows: walked.map((phase, index) => [
      String(index + 1),
      phase.label,
      phase.detail.replace(/\s+/g, " "),
      index === walked.length - 1 || phase.detail.includes("停在") ? (halt || "继续") : "通过",
    ]),
  };
  const markdown = `结论：${summary}`;
  return { policy, phases, summary, markdown, halt, grid };
}

const PHASE_INDEX: Record<string, number> = {
  __flow_intake__: 0,
  __flow_invoice__: 1,
  __flow_reconcile__: 2,
  __flow_route__: 3,
  __flow_report__: 4,
};

export function runFlowTool(name: string, args: Record<string, unknown>): { content: unknown; isError?: boolean } | null {
  const index = PHASE_INDEX[name];
  if (index == null) return null;
  const ran = executeFlow(String(args.query ?? ""), flowPolicyFromArgs(args));
  const phase = ran.phases[index]!;
  return {
    content: {
      markdown: name === "__flow_report__" ? ran.markdown : phase.detail,
      detail: phase.detail,
      summary: ran.summary,
      dashboard: { flow: { phase: phase.id, halt: ran.halt, summary: ran.summary } },
      meta: { skill: "flow-desk" },
    },
  };
}
