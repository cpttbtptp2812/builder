/** 表格技能：认列、类型、分组聚合、发票对账。同一份表，配方不同结果就不同。 */

export type ColumnType = "text" | "number" | "empty";

export type SheetColumn = { name: string; type: ColumnType };

export type SheetRow = Record<string, string | number | null>;

export type SheetTable = { title: string; columns: SheetColumn[]; rows: SheetRow[] };

export type SheetRecipe = {
  tax: "include" | "exclude";
  tolerance: number;
  missing: "block" | "pass";
  groupBy: string;
};

export type SheetPhase = { id: string; label: string; detail: string };

export type WorkGrid = { columns: string[]; rows: string[][] };

export function markdownTable(title: string, grid: WorkGrid): string {
  const head = `| ${grid.columns.join(" | ")} |`;
  const sep = `| ${grid.columns.map(() => "---").join(" | ")} |`;
  const body = grid.rows.map((row) => `| ${row.map((cell) => cell.replace(/\|/g, "/")).join(" | ")} |`).join("\n");
  return `${title}\n\n${head}\n${sep}\n${body}`;
}

export type SheetExecution = {
  table: SheetTable;
  recipe: SheetRecipe;
  phases: SheetPhase[];
  summary: string;
  markdown: string;
  grid: WorkGrid;
};

type Expense = {
  部门: string;
  申请人: string;
  金额: number;
  税额: number;
  发票额: number | null;
  状态: string;
};

const EXPENSE_ROWS: Expense[] = [
  { 部门: "研发", 申请人: "王旭", 金额: 12800, 税额: 1664, 发票额: 12800, 状态: "待审" },
  { 部门: "研发", 申请人: "李明", 金额: 860, 税额: 0, 发票额: null, 状态: "缺票" },
  { 部门: "市场", 申请人: "周宁", 金额: 4200, 税额: 546, 发票额: 4200, 状态: "待审" },
  { 部门: "市场", 申请人: "赵琪", 金额: 9600, 税额: 1248, 发票额: 8000, 状态: "金额不符" },
  { 部门: "财务", 申请人: "陈可", 金额: 300, 税额: 39, 发票额: 300, 状态: "已过" },
];

const DEFAULT_RECIPE: SheetRecipe = { tax: "include", tolerance: 0, missing: "block", groupBy: "部门" };

export function sheetRecipeFromArgs(args: Record<string, unknown> | undefined): SheetRecipe {
  const tax = args?.tax === "exclude" ? "exclude" : "include";
  const missing = args?.missing === "pass" ? "pass" : "block";
  const tolerance = Number(args?.tolerance ?? 0);
  const groupBy = String(args?.groupBy ?? "部门") || "部门";
  return {
    tax,
    missing,
    tolerance: Number.isFinite(tolerance) ? tolerance : 0,
    groupBy,
  };
}

export function sheetRecipeFromSteps(steps: { tool: string; args?: Record<string, unknown> }[]): SheetRecipe | null {
  const mine = steps.filter((step) => step.tool.startsWith("__sheet_"));
  if (!mine.length) return null;
  return mine.reduce((recipe, step) => ({ ...recipe, ...sheetRecipeFromArgs(step.args) }), { ...DEFAULT_RECIPE });
}

/** 问句里改配方：不含税、容差、缺票策略（对话优化表格时用） */
export function sheetRecipeFromQuery(query: string, base: SheetRecipe): SheetRecipe {
  const recipe = { ...base };
  if (/不含税|去税|税后/.test(query)) recipe.tax = "exclude";
  if (/含税/.test(query) && !/不含税/.test(query)) recipe.tax = "include";
  const tol = query.match(/容差[^\d]*(\d+)/);
  if (tol) recipe.tolerance = Number(tol[1]) || recipe.tolerance;
  if (/缺票.*(警告|先过|放过)|先警告.*缺票|缺票先警/.test(query)) recipe.missing = "pass";
  if (/缺票.*拦截|缺票直接拦/.test(query)) recipe.missing = "block";
  const group = query.match(/按([^\s，,。]{1,8})汇总/);
  if (group?.[1]) recipe.groupBy = group[1];
  return recipe;
}

function looksNumber(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function parseDelimited(text: string, delimiter: string): SheetTable | null {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !/^\|?\s*-{3,}/.test(line));
  const rows = lines
    .map((line) => line.replace(/^\|/, "").replace(/\|$/, "").split(delimiter).map((cell) => cell.trim()))
    .filter((cells) => cells.length > 1 && cells.some(Boolean));
  if (rows.length < 2) return null;
  const width = rows[0]!.length;
  if (rows.some((cells) => cells.length !== width)) return null;
  const header = rows[0]!.map((name, index) => name || `列${index + 1}`);
  const body = rows.slice(1).map((cells) => {
    const row: SheetRow = {};
    header.forEach((name, index) => {
      const raw = cells[index] ?? "";
      if (!raw || raw === "—" || raw === "-" || raw === "空") row[name] = null;
      else if (looksNumber(raw)) row[name] = Number(raw);
      else row[name] = raw;
    });
    return row;
  });
  const columns = header.map((name) => {
    const values = body.map((row) => row[name]).filter((value) => value != null);
    const type: ColumnType = !values.length ? "empty" : values.every((value) => typeof value === "number") ? "number" : "text";
    return { name, type };
  });
  return { title: "问句里的表", columns, rows: body };
}

export type SheetRowPatch = { person: string; invoice?: number; amount?: number };

/** 对话里改某人的发票额 / 金额（补票、对齐后再对账） */
export function sheetPatchesFromQuery(query: string): SheetRowPatch[] {
  const patches: SheetRowPatch[] = [];
  const push = (person: string, invoice?: number, amount?: number) => {
    if (!person) return;
    const prev = patches.find((p) => p.person === person);
    if (prev) {
      if (invoice != null) prev.invoice = invoice;
      if (amount != null) prev.amount = amount;
    } else patches.push({ person, invoice, amount });
  };

  const m1 = query.match(/([\u4e00-\u9fff]{2,4})这条报销[^，,。]*发票额按(\d+)/);
  if (m1) push(m1[1]!, Number(m1[2]));

  const m2 = query.match(/([\u4e00-\u9fff]{2,4})[^，,。]{0,24}发票[^0-9]{0,8}(\d{2,})/);
  if (m2) push(m2[1]!, Number(m2[2]));

  const m3 = query.match(/发票额?[改为调到为]?(\d{2,})/);
  const who = query.match(/([\u4e00-\u9fff]{2,4})[^，,。]{0,12}(报销|这条)/);
  if (m3 && who) push(who[1]!, Number(m3[1]));

  return patches;
}

export function applySheetPatches(table: SheetTable, patches: SheetRowPatch[]): SheetTable {
  if (!patches.length) return table;
  return {
    ...table,
    rows: table.rows.map((row) => {
      const name = String(row["申请人"] ?? row["姓名"] ?? "");
      const patch = patches.find((p) => name.includes(p.person) || p.person.includes(name));
      if (!patch) return row;
      const next: SheetRow = { ...row };
      if (patch.amount != null) next["金额"] = patch.amount;
      if (patch.invoice != null) {
        next["发票额"] = patch.invoice;
        next["状态"] = "待审";
      }
      return next;
    }),
  };
}

/** 问句里夹着表格就用那张表，否则用内置的 5 行报销明细。 */
export function tableFromQuery(query: string): SheetTable {
  const fenced = query.match(/```(?:csv|tsv)?\n([\s\S]+?)```/);
  const source = fenced?.[1] ?? query;
  if (source.includes("|")) {
    const parsed = parseDelimited(source, "|");
    if (parsed) return parsed;
  }
  if (source.includes("\t")) {
    const parsed = parseDelimited(source, "\t");
    if (parsed) return parsed;
  }
  if (/,/.test(source) && source.includes("\n")) {
    const parsed = parseDelimited(source, ",");
    if (parsed) return parsed;
  }
  const columns: SheetColumn[] = [
    { name: "部门", type: "text" },
    { name: "申请人", type: "text" },
    { name: "金额", type: "number" },
    { name: "税额", type: "number" },
    { name: "发票额", type: "number" },
    { name: "状态", type: "text" },
  ];
  return {
    title: "内置报销明细 5 行",
    columns,
    rows: EXPENSE_ROWS.map((row) => ({ ...row })),
  };
}

function num(row: SheetRow, key: string): number | null {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function money(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function executeSheet(query: string, recipe: SheetRecipe = DEFAULT_RECIPE): SheetExecution {
  const table = applySheetPatches(tableFromQuery(query), sheetPatchesFromQuery(query));
  const groupName = table.columns.some((column) => column.name === recipe.groupBy) ? recipe.groupBy : table.columns[0]?.name ?? "部门";
  const amountKey = table.columns.some((column) => column.name === "金额") ? "金额" : table.columns.find((column) => column.type === "number")?.name ?? "";
  const taxKey = table.columns.some((column) => column.name === "税额") ? "税额" : "";
  const invoiceKey = table.columns.some((column) => column.name === "发票额") ? "发票额" : "";
  const whoKey = table.columns.some((column) => column.name === "申请人") ? "申请人" : groupName;

  const schema = table.columns.map((column) => `${column.name}(${column.type === "number" ? "数字" : column.type === "empty" ? "空" : "文本"})`).join("、");
  const priced = table.rows.map((row) => {
    const gross = amountKey ? num(row, amountKey) ?? 0 : 0;
    const tax = taxKey ? num(row, taxKey) ?? 0 : 0;
    const booked = recipe.tax === "exclude" ? gross - tax : gross;
    return { row, booked, gross, invoice: invoiceKey ? num(row, invoiceKey) : null };
  });

  const groups = new Map<string, number>();
  for (const item of priced) {
    const key = String(item.row[groupName] ?? "未分组");
    groups.set(key, (groups.get(key) ?? 0) + item.booked);
  }
  const groupLines = [...groups.entries()].map(([name, sum]) => `${name} ${money(sum)}`);
  const total = [...groups.values()].reduce((sum, value) => sum + value, 0);

  const flags = priced.flatMap((item) => {
    const name = String(item.row[whoKey] ?? "未点名");
    if (item.invoice == null) {
      return [{ name, kind: recipe.missing === "block" ? "拦截" : "警告", reason: "缺票" }];
    }
    const gap = Math.abs(item.gross - item.invoice);
    if (gap > recipe.tolerance) {
      return [{ name, kind: "拦截", reason: `差额 ${money(gap)}` }];
    }
    return [];
  });
  const blocked = flags.filter((flag) => flag.kind === "拦截");

  const taxLabel = recipe.tax === "exclude" ? "不含税" : "含税";
  const missingLabel = recipe.missing === "pass" ? "缺票先过" : "缺票拦截";
  const blockedText = blocked.map((flag) => `${flag.name}${flag.reason}`).join("、");
  const warned = flags.filter((flag) => flag.kind === "警告");
  const warnedText = warned.map((flag) => `${flag.name}${flag.reason}`).join("、");
  const tail = [
    missingLabel,
    blocked.length ? `拦截 ${blockedText}` : "没有拦截",
    warned.length ? `警告 ${warnedText}` : "",
  ].filter(Boolean).join("，");
  const summary = `${taxLabel}合计 ${money(total)}。${groupLines.join("、")}。${tail}。`;

  const phases: SheetPhase[] = [
    { id: "parse", label: "认列", detail: `${table.title}，${table.rows.length} 行。${schema}。` },
    { id: "price", label: "汇总", detail: `${taxLabel}，按${groupName}：${groupLines.join("、")}。合计 ${money(total)}。` },
    {
      id: "check",
      label: "对账",
      detail: `容差 ${recipe.tolerance}，${missingLabel}。${flags.length ? flags.map((flag) => `${flag.name} ${flag.reason}（${flag.kind}）`).join("；") : "每一行都在容差内"}。`,
    },
    { id: "report", label: "结论", detail: summary },
  ];

  const grid: WorkGrid = {
    columns: ["部门", "申请人", "金额", "税额", "入账", "发票额", "差额", "判定"],
    rows: priced.map((item) => {
      const name = String(item.row[whoKey] ?? "");
      const flag = flags.find((row) => row.name === name);
      const gap = item.invoice == null ? "—" : money(Math.abs(item.gross - item.invoice));
      return [
        String(item.row[groupName] ?? ""),
        name,
        money(item.gross),
        money(taxKey ? num(item.row, taxKey) ?? 0 : 0),
        money(item.booked),
        item.invoice == null ? "空" : money(item.invoice),
        gap,
        flag ? `${flag.kind} ${flag.reason}` : "通过",
      ];
    }),
  };
  const markdown = `结论：${summary}`;

  return { table, recipe, phases, summary, markdown, grid };
}

const PHASE_INDEX: Record<string, number> = {
  __sheet_parse__: 0,
  __sheet_aggregate__: 1,
  __sheet_reconcile__: 2,
  __sheet_report__: 3,
};

export function runSheetTool(name: string, args: Record<string, unknown>): { content: unknown; isError?: boolean } | null {
  const index = PHASE_INDEX[name];
  if (index == null) return null;
  const ran = executeSheet(String(args.query ?? ""), sheetRecipeFromArgs(args));
  const phase = ran.phases[index]!;
  return {
    content: {
      markdown: name === "__sheet_report__" ? ran.markdown : phase.detail,
      detail: phase.detail,
      summary: ran.summary,
      dashboard: { sheet: { phase: phase.id, rows: ran.table.rows.length, summary: ran.summary } },
      meta: { skill: "sheet-desk" },
    },
  };
}
