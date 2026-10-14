/**
 * 报销对账办事程序 — 多阶段、守卫、分支、多交付表。
 * SKILL steps 只调 __sheet_* 工具；列数/拦截/升级由本模块按用户表算出。
 */

import {
  applySheetPatches,
  scopeSheetToDept,
  sheetDeptFromQuery,
  sheetPatchesFromQuery,
  sheetRecipeFromArgs,
  tableFromQuery,
  type SheetRecipe,
  type SheetRow,
  type SheetTable,
  type TableFromQueryOpts,
  type WorkGrid,
} from "./sheetEngine";
import { ProductDataMissingError } from "./productDataStore";

export type SheetEscalationPolicy = {
  /** 超过则进部门负责人队列 */
  leadAt: number;
  /** 超过则进总监队列 */
  directorAt: number;
  /** 超过则强制财务复核（与发票差额无关） */
  financeReviewAt: number;
};

export type SheetProgramRecipe = SheetRecipe & {
  escalation: SheetEscalationPolicy;
  /** 单行金额硬顶，超过直接拦截 */
  maxSingleAmount: number;
  /** -schema 守卫：缺列则 fail */
  requireColumns: string[];
};

export type RowFlag = {
  person: string;
  dept: string;
  kind: "拦截" | "警告";
  reason: string;
  code: string;
};

export type EscalationRow = {
  person: string;
  dept: string;
  amount: number;
  queue: "出纳" | "部门负责人" | "总监" | "财务复核";
  reason: string;
};

export type SheetProgramState = {
  table: SheetTable;
  recipe: SheetProgramRecipe;
  schemaOk: boolean;
  schemaIssues: string[];
  rowIssues: RowFlag[];
  priced: {
    row: SheetRow;
    gross: number;
    booked: number;
    invoice: number | null;
    gap: number | null;
  }[];
  deptTotals: { dept: string; sum: number; rows: number }[];
  reconcileFlags: RowFlag[];
  escalations: EscalationRow[];
  duplicateHits: string[];
  blocked: boolean;
  summary: string;
  detailGrid: WorkGrid;
  deptGrid: WorkGrid;
  escalationGrid: WorkGrid;
  exceptionGrid: WorkGrid;
};

const DEFAULT_ESCALATION: SheetEscalationPolicy = {
  leadAt: 5000,
  directorAt: 10000,
  financeReviewAt: 8000,
};

export function sheetProgramRecipeFromArgs(args: Record<string, unknown> | undefined): SheetProgramRecipe {
  const base = sheetRecipeFromArgs(args);
  const leadAt = Number(args?.leadAt ?? DEFAULT_ESCALATION.leadAt);
  const directorAt = Number(args?.directorAt ?? DEFAULT_ESCALATION.directorAt);
  const financeReviewAt = Number(args?.financeReviewAt ?? DEFAULT_ESCALATION.financeReviewAt);
  const maxSingleAmount = Number(args?.maxSingleAmount ?? 200000);
  const requireRaw = args?.requireColumns;
  const requireColumns = Array.isArray(requireRaw)
    ? requireRaw.map(String)
    : typeof requireRaw === "string"
      ? requireRaw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
      : ["部门", "申请人", "金额"];
  return {
    ...base,
    escalation: {
      leadAt: Number.isFinite(leadAt) ? leadAt : DEFAULT_ESCALATION.leadAt,
      directorAt: Number.isFinite(directorAt) ? directorAt : DEFAULT_ESCALATION.directorAt,
      financeReviewAt: Number.isFinite(financeReviewAt) ? financeReviewAt : DEFAULT_ESCALATION.financeReviewAt,
    },
    maxSingleAmount: Number.isFinite(maxSingleAmount) ? maxSingleAmount : 200000,
    requireColumns,
  };
}

function num(row: SheetRow, key: string): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function money(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function colNames(table: SheetTable): Set<string> {
  return new Set(table.columns.map((c) => c.name));
}

function validateSchema(table: SheetTable, requireColumns: string[]): { ok: boolean; issues: string[] } {
  const have = colNames(table);
  const issues: string[] = [];
  for (const need of requireColumns) {
    if (!have.has(need)) issues.push(`缺列「${need}」`);
  }
  if (!table.rows.length) issues.push("没有数据行");
  return { ok: issues.length === 0, issues };
}

function findDuplicates(table: SheetTable): string[] {
  const seen = new Map<string, number>();
  const hits: string[] = [];
  for (const row of table.rows) {
    const person = String(row["申请人"] ?? row["姓名"] ?? "");
    const amount = num(row, "金额");
    const key = `${person}|${amount ?? "?"}`;
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    if (n === 2) hits.push(`${person} 金额 ${amount ?? "?"}`);
  }
  return hits;
}

function validateRows(table: SheetTable, maxSingle: number): RowFlag[] {
  const flags: RowFlag[] = [];
  for (const row of table.rows) {
    const person = String(row["申请人"] ?? row["姓名"] ?? "未点名");
    const dept = String(row["部门"] ?? "");
    const amount = num(row, "金额");
    if (amount == null) {
      flags.push({ person, dept, kind: "拦截", reason: "金额不是有效数字", code: "BAD_AMOUNT" });
      continue;
    }
    if (amount < 0) {
      flags.push({ person, dept, kind: "拦截", reason: "金额为负", code: "NEGATIVE" });
    }
    if (amount > maxSingle) {
      flags.push({ person, dept, kind: "拦截", reason: `超过单行上限 ${maxSingle}`, code: "CAP" });
    }
    const tax = num(row, "税额");
    if (tax != null && tax < 0) {
      flags.push({ person, dept, kind: "警告", reason: "税额为负", code: "TAX_WARN" });
    }
  }
  return flags;
}

function priceRows(table: SheetTable, recipe: SheetProgramRecipe) {
  const groupName = table.columns.some((c) => c.name === recipe.groupBy) ? recipe.groupBy : table.columns[0]?.name ?? "部门";
  const amountKey = table.columns.some((c) => c.name === "金额") ? "金额" : table.columns.find((c) => c.type === "number")?.name ?? "";
  const taxKey = table.columns.some((c) => c.name === "税额") ? "税额" : "";
  const invoiceKey = table.columns.some((c) => c.name === "发票额") ? "发票额" : "";
  const whoKey = table.columns.some((c) => c.name === "申请人") ? "申请人" : groupName;

  const priced = table.rows.map((row) => {
    const gross = amountKey ? num(row, amountKey) ?? 0 : 0;
    const tax = taxKey ? num(row, taxKey) ?? 0 : 0;
    const booked = recipe.tax === "exclude" ? gross - tax : gross;
    const invoice = invoiceKey ? num(row, invoiceKey) : null;
    const gap = invoice == null ? null : Math.round(Math.abs(gross - invoice) * 100) / 100;
    return { row, gross, booked, invoice, gap, whoKey, groupName, taxKey, invoiceKey, amountKey };
  });

  const deptMap = new Map<string, { sum: number; rows: number }>();
  for (const item of priced) {
    const dept = String(item.row[item.groupName] ?? "未分组");
    const prev = deptMap.get(dept) ?? { sum: 0, rows: 0 };
    deptMap.set(dept, { sum: prev.sum + item.booked, rows: prev.rows + 1 });
  }
  const deptTotals = [...deptMap.entries()].map(([dept, v]) => ({ dept, sum: v.sum, rows: v.rows }));

  return { priced, deptTotals, whoKey, groupName, amountKey, taxKey, invoiceKey };
}

function reconcile(priced: ReturnType<typeof priceRows>["priced"], recipe: SheetProgramRecipe, whoKey: string): RowFlag[] {
  const flags: RowFlag[] = [];
  for (const item of priced) {
    const person = String(item.row[whoKey] ?? "未点名");
    const dept = String(item.row[item.groupName] ?? "");
    if (item.invoice == null) {
      flags.push({
        person,
        dept,
        kind: recipe.missing === "block" ? "拦截" : "警告",
        reason: "缺票",
        code: "MISSING_INVOICE",
      });
      continue;
    }
    const gap = item.gap ?? 0;
    if (gap > recipe.tolerance) {
      flags.push({ person, dept, kind: "拦截", reason: `发票差额 ${money(gap)}`, code: "INVOICE_GAP" });
    }
  }
  return flags;
}

function buildEscalations(
  priced: ReturnType<typeof priceRows>["priced"],
  recipe: SheetProgramRecipe,
  whoKey: string,
  reconcileFlags: RowFlag[],
): EscalationRow[] {
  const blocked = new Set(reconcileFlags.filter((f) => f.kind === "拦截").map((f) => f.person));
  const out: EscalationRow[] = [];
  const { leadAt, directorAt, financeReviewAt } = recipe.escalation;
  for (const item of priced) {
    const person = String(item.row[whoKey] ?? "未点名");
    const dept = String(item.row[item.groupName] ?? "");
    if (blocked.has(person)) {
      out.push({ person, dept, amount: item.gross, queue: "财务复核", reason: "对账未通过，不得升级" });
      continue;
    }
    if (item.gross >= financeReviewAt) {
      out.push({ person, dept, amount: item.gross, queue: "财务复核", reason: `达到财务复核线 ${financeReviewAt}` });
    } else if (item.gross >= directorAt) {
      out.push({ person, dept, amount: item.gross, queue: "总监", reason: `达到总监线 ${directorAt}` });
    } else if (item.gross >= leadAt) {
      out.push({ person, dept, amount: item.gross, queue: "部门负责人", reason: `达到负责人线 ${leadAt}` });
    } else {
      out.push({ person, dept, amount: item.gross, queue: "出纳", reason: `低于负责人线 ${leadAt}` });
    }
  }
  return out;
}

function buildGrids(
  state: Omit<SheetProgramState, "summary" | "detailGrid" | "deptGrid" | "escalationGrid" | "exceptionGrid">,
  pricedMeta: ReturnType<typeof priceRows>,
): Pick<SheetProgramState, "detailGrid" | "deptGrid" | "escalationGrid" | "exceptionGrid"> {
  const { priced, whoKey, groupName, taxKey } = pricedMeta;
  const flagByPerson = new Map<string, RowFlag>();
  for (const f of [...state.rowIssues, ...state.reconcileFlags]) {
    flagByPerson.set(f.person, f);
  }
  const detailGrid: WorkGrid = {
    columns: ["部门", "申请人", "金额", "税额", "入账", "发票额", "差额", "对账", "升级队列"],
    rows: priced.map((item) => {
      const person = String(item.row[whoKey] ?? "");
      const flag = flagByPerson.get(person);
      const esc = state.escalations.find((e) => e.person === person);
      return [
        String(item.row[groupName] ?? ""),
        person,
        money(item.gross),
        money(taxKey ? num(item.row, taxKey) ?? 0 : 0),
        money(item.booked),
        item.invoice == null ? "空" : money(item.invoice),
        item.gap == null ? "—" : money(item.gap),
        flag ? `${flag.kind} ${flag.reason}` : "通过",
        esc?.queue ?? "—",
      ];
    }),
  };
  const deptGrid: WorkGrid = {
    columns: ["部门", "行数", "入账合计", "占总额"],
    rows: state.deptTotals.map((d) => {
      const total = state.deptTotals.reduce((s, x) => s + x.sum, 0);
      const pct = total ? `${Math.round((d.sum / total) * 1000) / 10}%` : "—";
      return [d.dept, String(d.rows), money(d.sum), pct];
    }),
  };
  const escalationGrid: WorkGrid = {
    columns: ["申请人", "部门", "金额", "队列", "原因"],
    rows: state.escalations.map((e) => [e.person, e.dept, money(e.amount), e.queue, e.reason]),
  };
  const exceptions = [...state.rowIssues, ...state.reconcileFlags];
  const exceptionGrid: WorkGrid = {
    columns: ["级别", "申请人", "部门", "原因", "代码"],
    rows: exceptions.map((e) => [e.kind, e.person, e.dept, e.reason, e.code]),
  };
  return { detailGrid, deptGrid, escalationGrid, exceptionGrid };
}

function composeSummary(state: Omit<SheetProgramState, "summary">): string {
  const total = state.deptTotals.reduce((s, d) => s + d.sum, 0);
  const taxLabel = state.recipe.tax === "exclude" ? "不含税" : "含税";
  const blocked = [...state.rowIssues, ...state.reconcileFlags].filter((f) => f.kind === "拦截");
  const warned = [...state.rowIssues, ...state.reconcileFlags].filter((f) => f.kind === "警告");
  const dup = state.duplicateHits.length ? `重复 ${state.duplicateHits.length} 组` : "无重复";
  const queues = new Map<string, number>();
  for (const e of state.escalations) queues.set(e.queue, (queues.get(e.queue) ?? 0) + 1);
  const queueText = [...queues.entries()].map(([q, n]) => `${q}${n}单`).join("、") || "无";
  return [
    `${taxLabel}合计 ${money(total)}，${state.table.rows.length} 行。`,
    dup,
    blocked.length ? `拦截 ${blocked.length} 条` : "无拦截",
    warned.length ? `警告 ${warned.length} 条` : "",
    `升级分布：${queueText}。`,
  ]
    .filter(Boolean)
    .join(" ");
}

function failedSheetState(table: SheetTable, recipe: SheetProgramRecipe, issue: string): SheetProgramState {
  const empty: WorkGrid = { columns: [], rows: [] };
  return {
    table,
    recipe,
    schemaOk: false,
    schemaIssues: [issue],
    rowIssues: [],
    priced: [],
    deptTotals: [],
    reconcileFlags: [],
    escalations: [],
    duplicateHits: [],
    blocked: true,
    detailGrid: empty,
    deptGrid: empty,
    escalationGrid: empty,
    exceptionGrid: empty,
    summary: issue,
  };
}

export function buildSheetProgramState(
  query: string,
  recipe: SheetProgramRecipe,
  tableOpts?: TableFromQueryOpts,
): SheetProgramState {
  const loaded = applySheetPatches(tableFromQuery(query, tableOpts), sheetPatchesFromQuery(query));
  const scoped = scopeSheetToDept(loaded, sheetDeptFromQuery(query));
  if ("error" in scoped) return failedSheetState(loaded, recipe, scoped.error);
  const table = scoped;
  const schema = validateSchema(table, recipe.requireColumns);
  const rowIssues = schema.ok ? validateRows(table, recipe.maxSingleAmount) : [];
  const duplicates = schema.ok ? findDuplicates(table) : [];
  const pricedMeta = priceRows(table, recipe);
  const reconcileFlags = schema.ok ? reconcile(pricedMeta.priced, recipe, pricedMeta.whoKey) : [];
  const escalations = schema.ok
    ? buildEscalations(pricedMeta.priced, recipe, pricedMeta.whoKey, reconcileFlags)
    : [];
  const blocked =
    !schema.ok ||
    rowIssues.some((f) => f.kind === "拦截") ||
    reconcileFlags.some((f) => f.kind === "拦截");

  const partial: Omit<SheetProgramState, "detailGrid" | "deptGrid" | "escalationGrid" | "exceptionGrid" | "summary"> = {
    table,
    recipe,
    schemaOk: schema.ok,
    schemaIssues: schema.issues,
    rowIssues,
    priced: pricedMeta.priced.map(({ row, gross, booked, invoice, gap }) => ({ row, gross, booked, invoice, gap })),
    deptTotals: pricedMeta.deptTotals,
    reconcileFlags,
    escalations,
    duplicateHits: duplicates,
    blocked,
  };
  const grids = buildGrids(partial, pricedMeta);
  const scope = sheetDeptFromQuery(query);
  const summary = schema.ok
    ? `${scope ? `只看${scope}。` : ""}${composeSummary({ ...partial, ...grids })}`
    : `表结构未通过：${schema.issues.join("；")}`;
  return { ...partial, ...grids, summary };
}

export type SheetProgramPhaseId =
  | "intake"
  | "validate_schema"
  | "validate_rows"
  | "normalize"
  | "aggregate"
  | "duplicate_scan"
  | "reconcile"
  | "missing_guard"
  | "escalation"
  | "exception_queue"
  | "dept_rollup"
  | "cross_foot"
  | "deliver_detail"
  | "deliver_dept"
  | "deliver_escalation"
  | "report"
  | "parse"
  | "price"
  | "check";

function phasePayload(state: SheetProgramState, phase: SheetProgramPhaseId): {
  detail: string;
  grid?: WorkGrid;
  guardFailed?: boolean;
  markdown?: string;
} {
  const r = state.recipe;
  const taxLabel = r.tax === "exclude" ? "不含税" : "含税";
  switch (phase) {
    case "intake":
    case "parse":
      return {
        detail: `读入「${state.table.title}」共 ${state.table.rows.length} 行，${state.table.columns.length} 列。`,
      };
    case "validate_schema":
      return {
        detail: state.schemaOk
          ? `契约通过：必需列 ${r.requireColumns.join("、")} 齐全。`
          : `契约失败：${state.schemaIssues.join("；")}。`,
        guardFailed: !state.schemaOk,
      };
    case "validate_rows":
      return {
        detail: state.rowIssues.length
          ? `行级校验 ${state.rowIssues.length} 条：${state.rowIssues.map((f) => `${f.person}${f.reason}(${f.kind})`).join("；")}。`
          : "行级校验通过：金额与上限规则均未触发。",
        grid: state.exceptionGrid,
      };
    case "normalize":
      return {
        detail: `${taxLabel}入账规则已套用；缺票策略 ${r.missing === "block" ? "拦截" : "警告"}；容差 ${r.tolerance} 元。`,
      };
    case "aggregate":
    case "price":
      return {
        detail: `按「${r.groupBy}」汇总：${state.deptTotals.map((d) => `${d.dept} ${money(d.sum)}(${d.rows}行)`).join("、")}。`,
        grid: state.deptGrid,
      };
    case "duplicate_scan":
      return {
        detail: state.duplicateHits.length
          ? `发现疑似重复报销 ${state.duplicateHits.length} 组：${state.duplicateHits.join("、")}。`
          : "未发现申请人+金额完全重复的行。",
      };
    case "reconcile":
    case "check":
      return {
        detail: state.reconcileFlags.length
          ? `发票对账：${state.reconcileFlags.map((f) => `${f.person} ${f.reason}(${f.kind})`).join("；")}。`
          : "发票与金额均在容差内。",
        grid: state.detailGrid,
      };
    case "missing_guard":
      return {
        detail:
          r.missing === "block" && state.reconcileFlags.some((f) => f.code === "MISSING_INVOICE" && f.kind === "拦截")
            ? "缺票拦截策略生效：存在缺票行，整批不得进入出纳/负责人队列。"
            : r.missing === "pass" && state.reconcileFlags.some((f) => f.code === "MISSING_INVOICE")
              ? "缺票警告策略：缺票行已标记，允许继续升级。"
              : "无缺票或缺票已处理。",
        guardFailed: r.missing === "block" && state.reconcileFlags.some((f) => f.code === "MISSING_INVOICE" && f.kind === "拦截"),
      };
    case "escalation":
      return {
        detail: `按负责人线 ${r.escalation.leadAt}、总监线 ${r.escalation.directorAt}、财务复核线 ${r.escalation.financeReviewAt} 排队：${state.escalations.map((e) => `${e.person}→${e.queue}`).join("；")}。`,
        grid: state.escalationGrid,
      };
    case "exception_queue":
      return {
        detail:
          state.rowIssues.length + state.reconcileFlags.length
            ? `异常队列 ${state.rowIssues.length + state.reconcileFlags.length} 条待处理。`
            : "异常队列为空。",
        grid: state.exceptionGrid,
      };
    case "dept_rollup":
      return { detail: `部门汇总表已生成，共 ${state.deptTotals.length} 个部门。`, grid: state.deptGrid };
    case "cross_foot": {
      const detailSum = state.priced.reduce((s, p) => s + p.booked, 0);
      const deptSum = state.deptTotals.reduce((s, d) => s + d.sum, 0);
      const ok = Math.abs(detailSum - deptSum) < 0.01;
      return {
        detail: ok
          ? `交叉校验：明细入账 ${money(detailSum)} 与部门合计 ${money(deptSum)} 一致。`
          : `交叉校验失败：明细 ${money(detailSum)} ≠ 部门 ${money(deptSum)}。`,
        guardFailed: !ok,
      };
    }
    case "deliver_detail":
      return { detail: "交付物：逐行对账明细表。", grid: state.detailGrid };
    case "deliver_dept":
      return { detail: "交付物：部门汇总表。", grid: state.deptGrid };
    case "deliver_escalation":
      return { detail: "交付物：升级审批队列表。", grid: state.escalationGrid };
    case "report":
      return { detail: state.summary, markdown: `结论：${state.summary}`, grid: state.detailGrid };
    default:
      return { detail: state.summary };
  }
}

const TOOL_PHASE: Record<string, SheetProgramPhaseId> = {
  __sheet_intake__: "intake",
  __sheet_validate_schema__: "validate_schema",
  __sheet_validate_rows__: "validate_rows",
  __sheet_normalize__: "normalize",
  __sheet_aggregate__: "aggregate",
  __sheet_duplicate_scan__: "duplicate_scan",
  __sheet_reconcile__: "reconcile",
  __sheet_missing_guard__: "missing_guard",
  __sheet_escalation__: "escalation",
  __sheet_exception_queue__: "exception_queue",
  __sheet_dept_rollup__: "dept_rollup",
  __sheet_cross_foot__: "cross_foot",
  __sheet_deliver_detail__: "deliver_detail",
  __sheet_deliver_dept__: "deliver_dept",
  __sheet_deliver_escalation__: "deliver_escalation",
  __sheet_report__: "report",
  __sheet_parse__: "parse",
  __sheet_price__: "price",
  __sheet_check__: "check",
};

export function runSheetTool(name: string, args: Record<string, unknown>): { content: unknown; isError?: boolean } | null {
  return runSheetProgramTool(name, args);
}

export function runSheetProgramTool(
  name: string,
  args: Record<string, unknown>,
): { content: unknown; isError?: boolean } | null {
  const phaseId = TOOL_PHASE[name];
  if (!phaseId) return null;
  const productWorkbench = args.__productWorkbench === true;
  const failFast = args.failFast === true || args.guard === "fail";
  try {
    const recipe = sheetProgramRecipeFromArgs(args);
    const state = buildSheetProgramState(String(args.query ?? ""), recipe, {
      productWorkbench,
      sessionId: typeof args.__sessionId === "string" ? args.__sessionId : undefined,
      dataSlot: "expense-ledger",
      allowLabSample: args.__allowLabSample === true,
    });
    const payload = phasePayload(state, phaseId);
    if (payload.guardFailed && failFast) {
      return {
        content: {
          error: payload.detail,
          code: "SHEET_GUARD",
          detail: payload.detail,
          meta: { skill: "sheet-desk", phase: phaseId },
        },
        isError: true,
      };
    }
    const isReport = name === "__sheet_report__";
    return {
      content: {
        markdown: isReport ? payload.markdown ?? payload.detail : payload.detail,
        detail: payload.detail,
        summary: state.summary,
        blocked: state.blocked,
        dashboard: {
          sheet: {
            phase: phaseId,
            rows: state.table.rows.length,
            blocked: state.blocked,
            summary: state.summary,
          },
        },
        meta: { skill: "sheet-desk", phase: phaseId, deliverables: ["detail", "dept", "escalation", "exception"] },
        grid: payload.grid ?? (isReport ? state.detailGrid : undefined),
        grids: {
          detail: state.detailGrid,
          dept: state.deptGrid,
          escalation: state.escalationGrid,
          exception: state.exceptionGrid,
        },
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
