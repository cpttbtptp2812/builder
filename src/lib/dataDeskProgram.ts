/**
 * 额度测算办事程序 — 流水契约、月数守卫、波动/趋势、公式链、上限分支、多表交付。
 */

import { dataRecipeFromArgs, monthlyFromCashflowQuery, type DataRecipe } from "./dataEngine";
import { ProductDataMissingError } from "./productDataStore";
import { tableFromEmbedded, type SheetTable, type WorkGrid } from "./sheetEngine";
import { workbenchSheetTable } from "./workbenchDataset";

export type DataProgramRecipe = DataRecipe & {
  requireColumns: string[];
  minMonths: number;
  /** 月环比波动超过此比例（0-1）触发警告 */
  volatilityWarn: number;
  /** 加权平均：最近一月权重 */
  recentWeight: number;
  /** 低于此核定值 failFast（万元） */
  minApproved: number;
  /** 超过 policyCap 此比例转 committee */
  committeeRatio: number;
};

export type CashflowMonth = { label: string; inflow: number };

export type DataProgramState = {
  recipe: DataProgramRecipe;
  months: CashflowMonth[];
  schemaOk: boolean;
  schemaIssues: string[];
  monthsOk: boolean;
  monthly: number;
  weightedMonthly: number;
  volatility: number;
  trend: "升" | "降" | "平";
  cash: number;
  adjusted: number;
  finalAmount: number;
  capped: boolean;
  committee: boolean;
  blocked: boolean;
  summary: string;
  trendGrid: WorkGrid;
  formulaGrid: WorkGrid;
  decisionGrid: WorkGrid;
};

function wan(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function dataProgramRecipeFromArgs(args: Record<string, unknown> | undefined): DataProgramRecipe {
  const base = dataRecipeFromArgs(args);
  const requireRaw = args?.requireColumns;
  const requireColumns = Array.isArray(requireRaw)
    ? requireRaw.map(String)
    : typeof requireRaw === "string"
      ? requireRaw.split(/[,，、]/).map((s) => s.trim()).filter(Boolean)
      : ["月份", "流入万元"];
  const minMonths = Number(args?.minMonths ?? 3);
  const volatilityWarn = Number(args?.volatilityWarn ?? 0.35);
  const recentWeight = Number(args?.recentWeight ?? 0.45);
  const minApproved = Number(args?.minApproved ?? 0);
  const committeeRatio = Number(args?.committeeRatio ?? 0.95);
  return {
    ...base,
    requireColumns,
    minMonths: Number.isFinite(minMonths) ? minMonths : 3,
    volatilityWarn: Number.isFinite(volatilityWarn) ? volatilityWarn : 0.35,
    recentWeight: Number.isFinite(recentWeight) ? Math.min(1, Math.max(0, recentWeight)) : 0.45,
    minApproved: Number.isFinite(minApproved) ? minApproved : 0,
    committeeRatio: Number.isFinite(committeeRatio) ? committeeRatio : 0.95,
  };
}

function loadCashflowTable(productWorkbench: boolean, query: string, sessionId?: string): SheetTable | null {
  if (productWorkbench) {
    const fromSlot = workbenchSheetTable(sessionId, "cashflow-monthly");
    if (fromSlot?.rows.length) return fromSlot;
    const embedded = tableFromEmbedded(query);
    if (embedded?.rows.length) return embedded;
    throw new ProductDataMissingError("cashflow-monthly", "请先导入按月经营流水后再做额度测算。");
  }
  const embedded = tableFromEmbedded(query);
  if (embedded?.rows.length) return embedded;
  return null;
}

function monthsFromTable(table: SheetTable): CashflowMonth[] {
  const monthCol =
    table.columns.find((c) => /月|month|period/i.test(c.name)) ?? table.columns[0];
  const inflowCol =
    table.columns.find((c) => /流入|inflow|金额|流水/i.test(c.name)) ??
    table.columns.find((c) => c.type === "number");
  if (!inflowCol) throw new Error("流水表需包含数值列（如「流入万元」）。");
  return table.rows
    .map((row, i) => ({
      label: String(row[monthCol!.name] ?? `第${i + 1}月`),
      inflow: typeof row[inflowCol.name] === "number" ? (row[inflowCol.name] as number) : NaN,
    }))
    .filter((m) => Number.isFinite(m.inflow));
}

function validateSchema(table: SheetTable | null, requireColumns: string[]): string[] {
  if (!table?.rows.length) return ["没有流水数据"];
  const issues: string[] = [];
  const names = table.columns.map((c) => c.name);
  for (const need of requireColumns) {
    if (!names.some((n) => n.includes(need) || need.includes(n))) issues.push(`缺列「${need}」`);
  }
  return issues;
}

function computeVolatility(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;
  return avg ? Math.sqrt(variance) / avg : 0;
}

function computeTrend(values: number[]): "升" | "降" | "平" {
  if (values.length < 2) return "平";
  const first = values.slice(0, Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0);
  const second = values.slice(Math.ceil(values.length / 2)).reduce((a, b) => a + b, 0);
  const diff = second - first;
  if (Math.abs(diff) < 0.01 * (first + second)) return "平";
  return diff > 0 ? "升" : "降";
}

function computeWeightedMonthly(months: CashflowMonth[], recentWeight: number): number {
  if (!months.length) return 0;
  if (months.length === 1) return months[0]!.inflow;
  const rest = months.slice(0, -1);
  const last = months[months.length - 1]!.inflow;
  const avgRest = rest.reduce((s, m) => s + m.inflow, 0) / rest.length;
  return Math.round((last * recentWeight + avgRest * (1 - recentWeight)) * 100) / 100;
}

export function dataProgramRecipeFromSteps(
  steps: { tool: string; args?: Record<string, unknown> }[],
): DataProgramRecipe | null {
  const mine = steps.filter((step) => step.tool.startsWith("__data_"));
  if (!mine.length) return null;
  return mine.reduce(
    (acc, step) => ({ ...acc, ...dataProgramRecipeFromArgs(step.args) }),
    dataProgramRecipeFromArgs(mine[0]?.args),
  );
}

export function buildDataProgramState(
  query: string,
  recipe: DataProgramRecipe,
  opts: { productWorkbench: boolean; allowLabSample?: boolean; sessionId?: string },
): DataProgramState {
  let table: SheetTable | null = null;
  try {
    table = loadCashflowTable(opts.productWorkbench, query, opts.sessionId);
  } catch (e) {
    if (e instanceof ProductDataMissingError) throw e;
    table = null;
  }

  if (!table) {
    const fromQuery = monthlyFromCashflowQuery(query);
    if (fromQuery != null) {
      table = tableFromEmbedded(query);
    } else if (opts.productWorkbench) {
      throw new ProductDataMissingError("cashflow-monthly", "请先导入按月经营流水。");
    } else if (opts.allowLabSample) {
      /* lab keeps args monthly */
    } else {
      throw new ProductDataMissingError("cashflow-monthly", "请先导入按月经营流水。");
    }
  }

  const schemaIssues = validateSchema(table, recipe.requireColumns);
  const schemaOk = schemaIssues.length === 0;
  const months = schemaOk && table ? monthsFromTable(table) : [];
  const monthsOk = months.length >= recipe.minMonths;

  let monthly = recipe.monthly;
  if (months.length) {
    monthly = Math.round((months.reduce((s, m) => s + m.inflow, 0) / months.length) * 100) / 100;
  } else {
    const fromQuery = monthlyFromCashflowQuery(query);
    if (fromQuery != null) monthly = fromQuery;
  }

  const weightedMonthly = months.length ? computeWeightedMonthly(months, recipe.recentWeight) : monthly;
  const values = months.map((m) => m.inflow);
  const volatility = computeVolatility(values);
  const trend = computeTrend(values);

  const cash = weightedMonthly * recipe.stability * recipe.debtRatio;
  const adjusted = cash * recipe.credit * recipe.industry * recipe.years;
  const capped = adjusted > recipe.policyCap;
  const finalAmount = Math.round(Math.min(adjusted, recipe.policyCap) * 10) / 10;
  const committee = capped && adjusted / recipe.policyCap >= recipe.committeeRatio;
  const blocked = !schemaOk || !monthsOk || finalAmount < recipe.minApproved;

  const summary = !schemaOk
    ? `流水契约失败：${schemaIssues.join("；")}。`
    : !monthsOk
      ? `有效月数 ${months.length}，低于最少 ${recipe.minMonths} 月。`
      : `核定 ${wan(finalAmount)} 万元（加权月均 ${wan(weightedMonthly)}，${months.length} 月，趋势${trend}）。现金流 ${wan(cash)}，风险调整 ${wan(adjusted)}${capped ? "，触顶" : ""}${committee ? "，转委员会" : ""}。`;

  const trendGrid: WorkGrid = {
    columns: ["月份", "流入(万元)", "备注"],
    rows: months.map((m, i) => [
      m.label,
      wan(m.inflow),
      i === months.length - 1 ? "最近月" : volatility > recipe.volatilityWarn ? "波动偏高" : "",
    ]),
  };
  const formulaGrid: WorkGrid = {
    columns: ["步骤", "公式", "代入", "结果(万元)"],
    rows: [
      ["加权月均", "近月×权重 + 其余均值", `${wan(weightedMonthly)}`, wan(weightedMonthly)],
      ["现金流", "月均 × 稳定 × 偿债", `${wan(weightedMonthly)}×${recipe.stability}×${recipe.debtRatio}`, wan(cash)],
      ["风险调整", "×信用×行业×年限", `${wan(cash)}×${recipe.credit}×${recipe.industry}×${recipe.years}`, wan(adjusted)],
      ["政策上限", `cap ${wan(recipe.policyCap)}`, capped ? "触顶" : "未触顶", wan(recipe.policyCap)],
      ["核定", "min(调整, cap)", "", wan(finalAmount)],
    ],
  };
  const decisionGrid: WorkGrid = {
    columns: ["项", "值"],
    rows: [
      ["月数", String(months.length)],
      ["波动率", `${Math.round(volatility * 1000) / 10}%`],
      ["波动警告线", `${Math.round(recipe.volatilityWarn * 100)}%`],
      ["最低核定", `${recipe.minApproved} 万`],
      ["委员会", committee ? "是" : "否"],
      ["结论", blocked ? "不通过" : "通过"],
    ],
  };

  return {
    recipe,
    months,
    schemaOk,
    schemaIssues,
    monthsOk,
    monthly,
    weightedMonthly,
    volatility,
    trend,
    cash,
    adjusted,
    finalAmount,
    capped,
    committee,
    blocked,
    summary,
    trendGrid,
    formulaGrid,
    decisionGrid,
  };
}

type DataPhaseId =
  | "intake"
  | "validate_schema"
  | "validate_months"
  | "load"
  | "weighted"
  | "volatility"
  | "trend"
  | "formula"
  | "adjust"
  | "cap_compare"
  | "committee"
  | "min_guard"
  | "deliver_trend"
  | "deliver_formula"
  | "deliver_decision"
  | "report";

function phasePayload(state: DataProgramState, phase: DataPhaseId): {
  detail: string;
  grid?: WorkGrid;
  guardFailed?: boolean;
  markdown?: string;
} {
  const r = state.recipe;
  switch (phase) {
    case "intake":
      return { detail: `读入流水表，有效月 ${state.months.length} 条。` };
    case "validate_schema":
      return {
        detail: state.schemaOk ? `契约通过：${r.requireColumns.join("、")}。` : state.schemaIssues.join("；"),
        guardFailed: !state.schemaOk,
      };
    case "validate_months":
      return {
        detail: state.monthsOk
          ? `月数 ${state.months.length} ≥ 最少 ${r.minMonths}。`
          : `仅 ${state.months.length} 月，低于 ${r.minMonths}。`,
        guardFailed: !state.monthsOk,
      };
    case "load":
      return { detail: `算术月均 ${wan(state.monthly)} 万元；加权月均 ${wan(state.weightedMonthly)} 万元。` };
    case "weighted":
      return { detail: `近月权重 ${r.recentWeight} → 加权月均 ${wan(state.weightedMonthly)} 万元。` };
    case "volatility":
      return {
        detail: `波动率 ${Math.round(state.volatility * 1000) / 10}%${state.volatility > r.volatilityWarn ? "，超过警告线" : ""}。`,
        guardFailed: state.volatility > r.volatilityWarn && r.volatilityWarn > 0,
      };
    case "trend":
      return { detail: `近段趋势：${state.trend}。`, grid: state.trendGrid };
    case "formula":
      return {
        detail: `${wan(state.weightedMonthly)} × ${r.stability} × ${r.debtRatio} = ${wan(state.cash)} 万元（现金流）。`,
        grid: state.formulaGrid,
      };
    case "adjust":
      return {
        detail: `${wan(state.cash)} × ${r.credit} × ${r.industry} × ${r.years} = ${wan(state.adjusted)} 万元。`,
      };
    case "cap_compare":
      return {
        detail: state.capped
          ? `风险调整 ${wan(state.adjusted)} 超过政策上限 ${wan(r.policyCap)}，取 min。`
          : `未触政策上限 ${wan(r.policyCap)}。`,
      };
    case "committee":
      return {
        detail: state.committee ? "触顶比例达 committeeRatio，转委员会审批。" : "无需委员会。",
      };
    case "min_guard":
      return {
        detail:
          state.finalAmount < r.minApproved
            ? `核定 ${wan(state.finalAmount)} 低于最低 ${r.minApproved} 万。`
            : `核定 ${wan(state.finalAmount)} 满足最低线。`,
        guardFailed: state.finalAmount < r.minApproved && r.minApproved > 0,
      };
    case "deliver_trend":
      return { detail: "交付：逐月流水表。", grid: state.trendGrid };
    case "deliver_formula":
      return { detail: "交付：公式链。", grid: state.formulaGrid };
    case "deliver_decision":
      return { detail: "交付：决策摘要。", grid: state.decisionGrid };
    case "report":
      return { detail: state.summary, markdown: `结论：${state.summary}`, grid: state.formulaGrid };
    default:
      return { detail: state.summary };
  }
}

const TOOL_PHASE: Record<string, DataPhaseId> = {
  __data_intake__: "intake",
  __data_validate_schema__: "validate_schema",
  __data_validate_months__: "validate_months",
  __data_load__: "load",
  __data_weighted__: "weighted",
  __data_volatility__: "volatility",
  __data_trend__: "trend",
  __data_formula__: "formula",
  __data_adjust__: "adjust",
  __data_cap_compare__: "cap_compare",
  __data_committee__: "committee",
  __data_min_guard__: "min_guard",
  __data_deliver_trend__: "deliver_trend",
  __data_deliver_formula__: "deliver_formula",
  __data_deliver_decision__: "deliver_decision",
  __data_report__: "report",
};

export function runDataTool(name: string, args: Record<string, unknown>): { content: unknown; isError?: boolean } | null {
  const phaseId = TOOL_PHASE[name];
  if (!phaseId) return null;
  const productWorkbench = args.__productWorkbench === true;
  const failFast = args.failFast === true || args.guard === "fail";
  try {
    const recipe = dataProgramRecipeFromArgs(args);
    const state = buildDataProgramState(String(args.query ?? ""), recipe, {
      productWorkbench,
      sessionId: typeof args.__sessionId === "string" ? args.__sessionId : undefined,
      allowLabSample: args.__allowLabSample === true,
    });
    const payload = phasePayload(state, phaseId);
    if (payload.guardFailed && failFast) {
      return {
        content: { error: payload.detail, code: "DATA_GUARD", detail: payload.detail, meta: { skill: "data-desk" } },
        isError: true,
      };
    }
    const isReport = name === "__data_report__";
    return {
      content: {
        markdown: isReport ? payload.markdown ?? payload.detail : payload.detail,
        detail: payload.detail,
        summary: state.summary,
        blocked: state.blocked,
        dashboard: {
          data: { phase: phaseId, finalAmount: state.finalAmount, summary: state.summary, months: state.months.length },
        },
        meta: { skill: "data-desk", phase: phaseId },
        grid: payload.grid ?? (isReport ? state.formulaGrid : undefined),
        grids: { trend: state.trendGrid, formula: state.formulaGrid, decision: state.decisionGrid },
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
