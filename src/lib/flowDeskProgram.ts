/**
 * 报销流程办事程序 — 与对账结果联动、多守卫、多节点分支。
 */

import { buildSheetProgramState, sheetProgramRecipeFromArgs } from "./sheetDeskProgram";
import { flowPolicyFromArgs, type FlowPolicy } from "./flowEngine";
import { tableFromQuery, type WorkGrid } from "./sheetEngine";
import { ProductDataMissingError } from "./productDataStore";

export type FlowDeskPolicy = FlowPolicy & {
  /** 与 sheet 共用容差（问句可覆盖） */
  sheetTolerance: number;
  /** 部门月度累计上限（超过则 committee） */
  deptMonthlyCap: number;
  /** 需要双签的金额线 */
  dualSignAt: number;
  /** 缺票时是否同步 sheet 拦截结论 */
  syncSheetBlock: boolean;
};

export type FlowCase = {
  dept: string;
  person: string;
  amount: number;
  invoice: number | null;
  gap: number | null;
  sheetBlocked: boolean;
  sheetQueue: string;
};

export type FlowProgramState = {
  policy: FlowDeskPolicy;
  cases: FlowCase[];
  focus: FlowCase;
  halt: string;
  phases: { id: string; label: string; detail: string }[];
  summary: string;
  pathGrid: WorkGrid;
  caseGrid: WorkGrid;
};

function flowDeskPolicyFromArgs(args: Record<string, unknown> | undefined): FlowDeskPolicy {
  const base = flowPolicyFromArgs(args);
  const sheetTolerance = Number(args?.sheetTolerance ?? args?.tolerance ?? 0);
  const deptMonthlyCap = Number(args?.deptMonthlyCap ?? 50000);
  const dualSignAt = Number(args?.dualSignAt ?? 15000);
  return {
    ...base,
    sheetTolerance: Number.isFinite(sheetTolerance) ? sheetTolerance : 0,
    deptMonthlyCap: Number.isFinite(deptMonthlyCap) ? deptMonthlyCap : 50000,
    dualSignAt: Number.isFinite(dualSignAt) ? dualSignAt : 15000,
    syncSheetBlock: args?.syncSheetBlock !== false,
  };
}

function pickFocusCase(query: string, cases: FlowCase[]): FlowCase {
  const amountHit = query.match(/(\d{3,})/);
  const asked = amountHit ? Number(amountHit[1]) : null;
  const dept = query.includes("研发") ? "研发" : query.includes("财务") ? "财务" : query.includes("市场") ? "市场" : "";
  const personHit = query.match(/([\u4e00-\u9fff]{2,4})(?:的|这条|报销)/);
  const person = personHit?.[1] ?? "";
  const filtered = cases.filter((c) => {
    if (dept && c.dept !== dept) return false;
    if (person && !c.person.includes(person) && !person.includes(c.person)) return false;
    if (asked != null && c.amount !== asked) return false;
    return true;
  });
  return filtered[0] ?? cases[0]!;
}

function deptMonthlySum(cases: FlowCase[], dept: string): number {
  return cases.filter((c) => c.dept === dept).reduce((s, c) => s + c.amount, 0);
}

export function buildFlowProgramState(
  query: string,
  policy: FlowDeskPolicy,
  tableOpts?: import("./sheetEngine").TableFromQueryOpts,
): FlowProgramState {
  const sheetRecipe = sheetProgramRecipeFromArgs({
    ...policy,
    tolerance: policy.sheetTolerance,
    tax: "include",
    missing: policy.missing === "return" ? "block" : "pass",
    groupBy: "部门",
  });
  const sheet = buildSheetProgramState(query, sheetRecipe, tableOpts);
  const table = sheet.table;
  const cases: FlowCase[] = sheet.escalations.map((e) => {
    const priced = sheet.priced.find((p) => String(p.row["申请人"] ?? "").includes(e.person) || e.person.includes(String(p.row["申请人"] ?? "")));
    return {
      dept: e.dept,
      person: e.person,
      amount: e.amount,
      invoice: priced?.invoice ?? null,
      gap: priced?.gap ?? null,
      sheetBlocked: sheet.reconcileFlags.some((f) => f.person === e.person && f.kind === "拦截"),
      sheetQueue: e.queue,
    };
  });
  if (!cases.length && table.rows.length) {
    const row = table.rows[0]!;
    cases.push({
      dept: String(row["部门"] ?? ""),
      person: String(row["申请人"] ?? ""),
      amount: Number(row["金额"] ?? 0),
      invoice: typeof row["发票额"] === "number" ? row["发票额"] : null,
      gap: null,
      sheetBlocked: false,
      sheetQueue: "出纳",
    });
  }
  const focus = pickFocusCase(query, cases);
  const phases: FlowProgramState["phases"] = [];
  let halt = "";

  phases.push({
    id: "intake",
    label: "收单",
    detail: `本批 ${cases.length} 单；焦点单 ${focus.dept} ${focus.person} 金额 ${focus.amount}。`,
  });

  phases.push({
    id: "sheet_sync",
    label: "对账同步",
    detail: policy.syncSheetBlock
      ? sheet.blocked
        ? `对账程序判定本批存在拦截，流程默认不再放行。`
        : "对账程序未拦截，可进入发票关卡。"
      : "未强制同步对账拦截（syncSheetBlock=false）。",
  });

  if (policy.syncSheetBlock && focus.sheetBlocked) {
    halt = "对账拦截";
    phases.push({ id: "invoice", label: "核发票", detail: "焦点单在对账侧已拦截，不再核票。" });
    phases.push({ id: "reconcile", label: "对账", detail: "已停在对账拦截。" });
  } else if (focus.invoice == null && policy.missing === "return") {
    halt = "退回补票";
    phases.push({ id: "invoice", label: "核发票", detail: "焦点单缺票，按策略退回。" });
  } else if (focus.invoice == null) {
    phases.push({ id: "invoice", label: "核发票", detail: "缺票，策略允许后补，继续。" });
  } else {
    phases.push({ id: "invoice", label: "核发票", detail: `发票额 ${focus.invoice}。` });
  }

  if (!halt) {
    const gap = focus.gap ?? (focus.invoice != null ? Math.abs(focus.amount - focus.invoice) : 0);
    if (gap > policy.sheetTolerance && policy.mismatch === "block") {
      halt = "财务复核";
      phases.push({ id: "reconcile", label: "对账", detail: `差额 ${gap} 超过容差 ${policy.sheetTolerance}，停财务复核。` });
    } else if (gap > 0) {
      phases.push({ id: "reconcile", label: "对账", detail: `差额 ${gap}，策略 ${policy.mismatch === "block" ? "拦截" : "提醒"}。` });
    } else {
      phases.push({ id: "reconcile", label: "对账", detail: "金额与发票一致。" });
    }
  } else if (halt === "对账拦截") {
    /* already pushed */
  } else {
    phases.push({ id: "reconcile", label: "对账", detail: `因 ${halt} 跳过对平。` });
  }

  const deptSum = deptMonthlySum(cases, focus.dept);
  if (!halt && deptSum > policy.deptMonthlyCap) {
    halt = "委员会";
    phases.push({
      id: "dept_cap",
      label: "部门额度",
      detail: `${focus.dept} 本批合计 ${deptSum} 超过月 cap ${policy.deptMonthlyCap}，转委员会。`,
    });
  }

  if (!halt) {
    if (focus.amount >= policy.dualSignAt) {
      phases.push({
        id: "dual_sign",
        label: "双签",
        detail: `金额 ${focus.amount} ≥ 双签线 ${policy.dualSignAt}，需负责人+财务双签。`,
      });
    }
    if (focus.amount >= policy.directorAt) {
      halt = "总监";
      phases.push({ id: "route", label: "升级", detail: `金额达总监线 ${policy.directorAt}，队列 ${focus.sheetQueue}。` });
    } else if (focus.amount >= policy.leadAt) {
      halt = "部门负责人";
      phases.push({ id: "route", label: "升级", detail: `金额达负责人线 ${policy.leadAt}。` });
    } else {
      halt = focus.sheetQueue || "出纳";
      phases.push({ id: "route", label: "升级", detail: `落在 ${halt} 队列（与对账升级表一致）。` });
    }
  } else {
    phases.push({ id: "route", label: "升级", detail: `已停在 ${halt}，不再路由。` });
  }

  const summary =
    halt === "财务复核"
      ? `停在财务复核：${focus.person} 差额未消。`
      : halt === "退回补票"
        ? `退回补票：${focus.person}。`
        : halt === "委员会"
          ? `${focus.dept} 累计超 cap，转委员会。`
          : halt === "对账拦截"
            ? `对账拦截：${focus.person} 不得进入审批。`
            : `停在 ${halt}：${focus.dept} ${focus.person} ${focus.amount}。`;

  phases.push({ id: "report", label: "落点", detail: summary });

  const pathGrid: WorkGrid = {
    columns: ["顺序", "关卡", "说明", "状态"],
    rows: phases.slice(0, -1).map((p, i) => [
      String(i + 1),
      p.label,
      p.detail.replace(/\s+/g, " "),
      p.detail.includes("停") || p.id === "route" && halt ? halt : "通过",
    ]),
  };
  const caseGrid: WorkGrid = {
    columns: ["申请人", "部门", "金额", "对账", "升级队列"],
    rows: cases.map((c) => [
      c.person,
      c.dept,
      String(c.amount),
      c.sheetBlocked ? "拦截" : "通过",
      c.sheetQueue,
    ]),
  };

  return { policy, cases, focus, halt, phases, summary, pathGrid, caseGrid };
}

const FLOW_TOOL_PHASE_ID: Record<string, string> = {
  __flow_intake__: "intake",
  __flow_batch_scan__: "intake",
  __flow_sheet_sync__: "sheet_sync",
  __flow_invoice__: "invoice",
  __flow_reconcile__: "reconcile",
  __flow_dept_cap__: "dept_cap",
  __flow_dual_sign__: "dual_sign",
  __flow_route__: "route",
};

export function runFlowProgramTool(
  name: string,
  args: Record<string, unknown>,
): { content: unknown; isError?: boolean } | null {
  if (!(name in FLOW_TOOL_PHASE_ID) && name !== "__flow_report__") return null;
  const productWorkbench = args.__productWorkbench === true;
  try {
    const policy = flowDeskPolicyFromArgs(args);
    const state = buildFlowProgramState(String(args.query ?? ""), policy, {
      productWorkbench,
      sessionId: typeof args.__sessionId === "string" ? args.__sessionId : undefined,
      dataSlot: "expense-ledger",
      allowLabSample: args.__allowLabSample === true,
    });
    if (name === "__flow_report__") {
      const phase = state.phases[state.phases.length - 1]!;
      return {
        content: {
          markdown: `结论：${state.summary}`,
          detail: phase.detail,
          summary: state.summary,
          dashboard: { flow: { phase: "report", halt: state.halt, summary: state.summary } },
          meta: { skill: "flow-desk" },
          grid: state.pathGrid,
          grids: { path: state.pathGrid, cases: state.caseGrid },
        },
      };
    }
    if (name === "__flow_batch_scan__") {
      return {
        content: {
          detail: `批量扫描 ${state.cases.length} 单：${state.cases.filter((c) => c.sheetBlocked).length} 单对账拦截。`,
          summary: state.summary,
          grid: state.caseGrid,
          meta: { skill: "flow-desk", phase: "batch" },
        },
      };
    }
    const wantId = FLOW_TOOL_PHASE_ID[name]!;
    const phase =
      state.phases.find((p) => p.id === wantId) ??
      (name === "__flow_dual_sign__" ? state.phases.find((p) => p.id === "route") : undefined) ??
      state.phases[0]!;
    return {
      content: {
        markdown: phase.detail,
        detail: phase.detail,
        summary: state.summary,
        dashboard: { flow: { phase: phase.id, halt: state.halt, summary: state.summary } },
        meta: { skill: "flow-desk" },
        grid: name === "__flow_route__" || name === "__flow_intake__" ? state.pathGrid : state.caseGrid,
      },
    };
  } catch (err) {
    if (err instanceof ProductDataMissingError) {
      return { content: { error: err.message, code: "PRODUCT_DATA_MISSING", slot: err.slot }, isError: true };
    }
    if (err instanceof Error) {
      return { content: { error: err.message }, isError: true };
    }
    throw err;
  }
}
