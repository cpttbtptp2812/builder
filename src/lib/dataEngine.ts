/** 额度测算：月均流水 × 稳定系数 × 偿债比例，再乘信用、行业、年限，最后卡政策上限。 */

import type { WorkGrid } from "./sheetEngine";

export type DataRecipe = {
  monthly: number;
  stability: number;
  debtRatio: number;
  credit: number;
  industry: number;
  years: number;
  policyCap: number;
};

export type DataPhase = { id: string; label: string; detail: string };

export type DataExecution = {
  recipe: DataRecipe;
  phases: DataPhase[];
  summary: string;
  markdown: string;
  grid: WorkGrid;
  finalAmount: number;
};

const DEFAULT_RECIPE: DataRecipe = {
  monthly: 85,
  stability: 0.7,
  debtRatio: 0.2,
  credit: 1.15,
  industry: 0.9,
  years: 1.1,
  policyCap: 50,
};

export function dataRecipeFromArgs(args: Record<string, unknown> | undefined): DataRecipe {
  const num = (key: keyof DataRecipe) => {
    const value = Number(args?.[key] ?? DEFAULT_RECIPE[key]);
    return Number.isFinite(value) ? value : DEFAULT_RECIPE[key];
  };
  return {
    monthly: num("monthly"),
    stability: num("stability"),
    debtRatio: num("debtRatio"),
    credit: num("credit"),
    industry: num("industry"),
    years: num("years"),
    policyCap: num("policyCap"),
  };
}

export function dataRecipeFromSteps(steps: { tool: string; args?: Record<string, unknown> }[]): DataRecipe | null {
  const mine = steps.filter((step) => step.tool.startsWith("__data_"));
  if (!mine.length) return null;
  return mine.reduce((recipe, step) => ({ ...recipe, ...dataRecipeFromArgs(step.args) }), { ...DEFAULT_RECIPE });
}

function wan(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function executeData(recipe: DataRecipe = DEFAULT_RECIPE): DataExecution {
  const cash = recipe.monthly * recipe.stability * recipe.debtRatio;
  const adjusted = cash * recipe.credit * recipe.industry * recipe.years;
  const capped = adjusted > recipe.policyCap;
  const finalAmount = Math.round(Math.min(adjusted, recipe.policyCap) * 10) / 10;
  const grid: WorkGrid = {
    columns: ["步骤", "公式", "代入", "结果(万元)", "采用"],
    rows: [
      ["月均经营流入", "近 6 个月对公流入", `${wan(recipe.monthly)} 万`, wan(recipe.monthly), "是"],
      ["现金流测算", "月均 × 稳定系数 × 偿债比例", `${wan(recipe.monthly)} × ${recipe.stability} × ${recipe.debtRatio}`, wan(cash), "是"],
      ["信用系数", "征信与履约", String(recipe.credit), wan(recipe.credit), "是"],
      ["行业系数", "客群行业折算", String(recipe.industry), wan(recipe.industry), "是"],
      ["年限系数", "经营年限", String(recipe.years), wan(recipe.years), "是"],
      ["风险调整", "现金流 × 信用 × 行业 × 年限", `${wan(cash)} × ${recipe.credit} × ${recipe.industry} × ${recipe.years}`, wan(adjusted), capped ? "超上限" : "是"],
      ["政策上限", "客群额度区间", `不超过 ${wan(recipe.policyCap)}`, wan(recipe.policyCap), capped ? "卡住" : "未触及"],
      ["核定额度", "min(风险调整, 政策上限)", `${wan(adjusted)} 与 ${wan(recipe.policyCap)}`, wan(finalAmount), "结论"],
    ],
  };
  const summary = `核定 ${wan(finalAmount)} 万元。现金流 ${wan(cash)}，风险调整 ${wan(adjusted)}${capped ? `，超过政策上限 ${wan(recipe.policyCap)}` : ""}。`;
  const phases: DataPhase[] = [
    { id: "load", label: "取流水", detail: `月均经营流入 ${wan(recipe.monthly)} 万元。` },
    { id: "formula", label: "现金流", detail: `${wan(recipe.monthly)} × ${recipe.stability} × ${recipe.debtRatio} = ${wan(cash)} 万元。` },
    { id: "adjust", label: "风险调整", detail: `${wan(cash)} × ${recipe.credit} × ${recipe.industry} × ${recipe.years} = ${wan(adjusted)} 万元。` },
    { id: "report", label: "核定", detail: summary },
  ];
  const markdown = `结论：${summary}`;
  return { recipe, phases, summary, markdown, grid, finalAmount };
}

const PHASE_INDEX: Record<string, number> = {
  __data_load__: 0,
  __data_formula__: 1,
  __data_adjust__: 2,
  __data_report__: 3,
};

export function runDataTool(name: string, args: Record<string, unknown>): { content: unknown } | null {
  const index = PHASE_INDEX[name];
  if (index == null) return null;
  const ran = executeData(dataRecipeFromArgs(args));
  const phase = ran.phases[index]!;
  return {
    content: {
      markdown: name === "__data_report__" ? ran.markdown : phase.detail,
      detail: phase.detail,
      summary: ran.summary,
      dashboard: { data: { phase: phase.id, finalAmount: ran.finalAmount, summary: ran.summary } },
      meta: { skill: "data-desk" },
    },
  };
}
