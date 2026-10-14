/**
 * 报销对账规则的单行决策模型。
 * 同一份 rowOutcome 既用具体数字求值（与 sheetDeskProgram 对拍），也交给 Z3 生成约束（server/ruleProver.ts）。
 * 只覆盖与单据数值有关的决策；分组列、必需列等结构参数不在模型内，由调用方单独报告。
 */

import { sheetProgramRecipeFromArgs, type SheetProgramRecipe } from "./sheetDeskProgram";

export type RuleAlgebra<N, B> = {
  num(value: number): N;
  add(a: N, b: N): N;
  sub(a: N, b: N): N;
  ge(a: N, b: N): B;
  gt(a: N, b: N): B;
  lt(a: N, b: N): B;
  eq(a: N, b: N): B;
  and(...xs: B[]): B;
  or(...xs: B[]): B;
  not(x: B): B;
  ite(c: B, a: N, b: N): N;
  iteB(c: B, a: B, b: B): B;
  bool(value: boolean): B;
};

/** 金额以 1/scale 元为单位的整数 */
export type LedgerRowVars<N, B> = { gross: N; tax: N; invoice: N; hasInvoice: B };

export const RECON_CODES = ["通过", "缺票拦截", "缺票警告", "发票差额拦截"] as const;
export const QUEUE_CODES = ["出纳", "部门负责人", "总监", "财务复核（达线）", "财务复核（对账未通过）"] as const;

export type LedgerRowOutcome<N, B> = {
  /** 超过单行上限 */
  cap: B;
  /** 入账额 */
  booked: N;
  /** RECON_CODES 下标 */
  recon: N;
  /** QUEUE_CODES 下标 */
  queue: N;
  /** 整批被拦（行级或对账拦截） */
  blocked: B;
  /** 本步守卫失败、流程中止 */
  guardStop: B;
};

export const OUTCOME_FIELDS = ["cap", "booked", "recon", "queue", "blocked", "guardStop"] as const;
export type OutcomeField = (typeof OUTCOME_FIELDS)[number];

export const OUTCOME_LABEL: Record<OutcomeField, string> = {
  cap: "单行上限拦截",
  booked: "入账金额",
  recon: "对账结论",
  queue: "审批队列",
  blocked: "整批是否拦截",
  guardStop: "流程是否中止",
};

/** 进入模型的规则参数（金额已换算成 1/scale 元的整数） */
export type LedgerRuleParams = {
  taxExclude: boolean;
  missingBlock: boolean;
  tolerance: number;
  leadAt: number;
  directorAt: number;
  financeReviewAt: number;
  maxSingleAmount: number;
  /** 只有缺票守卫步且 guard=fail 时为 true */
  missingGuardStops: boolean;
};

export type LedgerStepRule = {
  stepId: string;
  label: string;
  tool: string;
  args: Record<string, unknown>;
  recipe: SheetProgramRecipe;
  failFast: boolean;
};

const SHEET_TOOL = /^__sheet_/;

export function ledgerStepRules(steps: { id: string; label?: string; tool: string; args?: Record<string, unknown> }[]): LedgerStepRule[] {
  return steps
    .filter((step) => SHEET_TOOL.test(step.tool))
    .map((step) => ({
      stepId: step.id,
      label: step.label || step.id,
      tool: step.tool,
      args: step.args ?? {},
      recipe: sheetProgramRecipeFromArgs(step.args),
      failFast: step.args?.failFast === true || step.args?.guard === "fail",
    }));
}

/** 让所有金额参数在 1/scale 元下是整数；最多到 0.0001 元 */
export function amountScale(recipes: SheetProgramRecipe[]): number {
  const values = recipes.flatMap((r) => [
    r.tolerance,
    r.escalation.leadAt,
    r.escalation.directorAt,
    r.escalation.financeReviewAt,
    r.maxSingleAmount,
  ]);
  for (const scale of [100, 1000, 10000]) {
    if (values.every((v) => Math.abs(v * scale - Math.round(v * scale)) < 1e-6)) return scale;
  }
  return 10000;
}

export function ruleParams(rule: LedgerStepRule, scale: number): LedgerRuleParams {
  const r = rule.recipe;
  const s = (v: number) => Math.round(v * scale);
  return {
    taxExclude: r.tax === "exclude",
    missingBlock: r.missing === "block",
    tolerance: s(r.tolerance),
    leadAt: s(r.escalation.leadAt),
    directorAt: s(r.escalation.directorAt),
    financeReviewAt: s(r.escalation.financeReviewAt),
    maxSingleAmount: s(r.maxSingleAmount),
    missingGuardStops: rule.failFast && rule.tool === "__sheet_missing_guard__",
  };
}

/** 规则参数可以是常量，也可以是求解器里的未知数（反事实、例子反推用） */
export type RuleParamsOf<N, B> = {
  taxExclude: B;
  missingBlock: B;
  tolerance: N;
  leadAt: N;
  directorAt: N;
  financeReviewAt: N;
  maxSingleAmount: N;
  missingGuardStops: B;
};

export function liftParams<N, B>(alg: RuleAlgebra<N, B>, p: LedgerRuleParams): RuleParamsOf<N, B> {
  return {
    taxExclude: alg.bool(p.taxExclude),
    missingBlock: alg.bool(p.missingBlock),
    tolerance: alg.num(p.tolerance),
    leadAt: alg.num(p.leadAt),
    directorAt: alg.num(p.directorAt),
    financeReviewAt: alg.num(p.financeReviewAt),
    maxSingleAmount: alg.num(p.maxSingleAmount),
    missingGuardStops: alg.bool(p.missingGuardStops),
  };
}

/** 与 sheetDeskProgram 的 validateRows / priceRows / reconcile / buildEscalations 同一语义（单行、金额为数字） */
export function rowOutcomeOf<N, B>(alg: RuleAlgebra<N, B>, p: RuleParamsOf<N, B>, row: LedgerRowVars<N, B>): LedgerRowOutcome<N, B> {
  const n = alg.num;
  const cap = alg.gt(row.gross, p.maxSingleAmount);
  const negative = alg.lt(row.gross, n(0));
  const booked = alg.ite(p.taxExclude, alg.sub(row.gross, row.tax), row.gross);
  const diff = alg.sub(row.gross, row.invoice);
  const gap = alg.ite(alg.ge(diff, n(0)), diff, alg.sub(n(0), diff));
  const gapBlock = alg.gt(gap, p.tolerance);
  const recon = alg.ite(
    alg.not(row.hasInvoice),
    alg.ite(p.missingBlock, n(1), n(2)),
    alg.ite(gapBlock, n(3), n(0)),
  );
  const reconBlocked = alg.or(
    alg.and(alg.not(row.hasInvoice), p.missingBlock),
    alg.and(row.hasInvoice, gapBlock),
  );
  const queue = alg.ite(
    reconBlocked,
    n(4),
    alg.ite(
      alg.ge(row.gross, p.financeReviewAt),
      n(3),
      alg.ite(alg.ge(row.gross, p.directorAt), n(2), alg.ite(alg.ge(row.gross, p.leadAt), n(1), n(0))),
    ),
  );
  const blocked = alg.or(cap, negative, reconBlocked);
  const guardStop = alg.and(p.missingGuardStops, alg.not(row.hasInvoice), p.missingBlock);
  return { cap, booked, recon, queue, blocked, guardStop };
}

export function rowOutcome<N, B>(alg: RuleAlgebra<N, B>, p: LedgerRuleParams, row: LedgerRowVars<N, B>): LedgerRowOutcome<N, B> {
  return rowOutcomeOf(alg, liftParams(alg, p), row);
}

export const concreteAlgebra: RuleAlgebra<number, boolean> = {
  num: (v) => v,
  add: (a, b) => a + b,
  sub: (a, b) => a - b,
  ge: (a, b) => a >= b,
  gt: (a, b) => a > b,
  lt: (a, b) => a < b,
  eq: (a, b) => a === b,
  and: (...xs) => xs.every(Boolean),
  or: (...xs) => xs.some(Boolean),
  not: (x) => !x,
  ite: (c, a, b) => (c ? a : b),
  iteB: (c, a, b) => (c ? a : b),
  bool: (v) => v,
};

/** 结构参数（不进模型）是否一致 */
export function unmodeledDiff(a: SheetProgramRecipe, b: SheetProgramRecipe): string[] {
  const out: string[] = [];
  if (a.groupBy !== b.groupBy) out.push(`分组列「${a.groupBy}」→「${b.groupBy}」`);
  if (a.requireColumns.join("|") !== b.requireColumns.join("|")) {
    out.push(`必需列「${a.requireColumns.join("、")}」→「${b.requireColumns.join("、")}」`);
  }
  return out;
}

export type LedgerArgPatch = Partial<{
  tolerance: number;
  missing: "block" | "pass";
  tax: "include" | "exclude";
  maxSingleAmount: number;
  leadAt: number;
  directorAt: number;
  financeReviewAt: number;
}>;

/** 把参数写进每个报销规则步骤的 args（已有则改值，没有则补一行），生成草稿原文 */
export function patchLedgerArgs(raw: string, patch: LedgerArgPatch): string {
  const entries = Object.entries(patch).filter(([, v]) => v !== undefined) as [string, string | number][];
  if (!entries.length) return raw;
  const lines = raw.split("\n");
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!/^\s*-\s+id:\s*/.test(line)) {
      out.push(line);
      i += 1;
      continue;
    }
    const stepIndent = line.match(/^(\s*)-/)![1]!.length;
    const block = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!;
      const indent = next.match(/^(\s*)/)![1]!.length;
      if (next.trim() && (indent <= stepIndent || /^---\s*$/.test(next))) break;
      block.push(next);
      i += 1;
    }
    const isSheet = block.some((l) => /^\s*tool:\s*__sheet_/.test(l));
    const argsAt = block.findIndex((l) => /^\s*args:\s*$/.test(l));
    if (!isSheet || argsAt < 0) {
      out.push(...block);
      continue;
    }
    const argLine = block.slice(argsAt + 1).find((l) => l.trim());
    const argIndent = argLine ? argLine.match(/^([ \t]*)/)![1]! : " ".repeat(stepIndent + 4);
    const eol = block[argsAt]!.endsWith("\r") ? "\r" : "";
    const missingKeys: string[] = [];
    for (const [key, value] of entries) {
      const re = new RegExp(`^([ \\t]*)${key}:[^\\r]*(\\r?)$`);
      const at = block.findIndex((l, idx) => idx > argsAt && re.test(l));
      if (at >= 0) block[at] = block[at]!.replace(re, `$1${key}: ${value}$2`);
      else missingKeys.push(`${argIndent}${key}: ${value}${eol}`);
    }
    block.splice(argsAt + 1, 0, ...missingKeys);
    out.push(...block);
  }
  return out.join("\n");
}

/* ---------- 反事实与例子反推 ---------- */

export type LabRow = { index: number; person: string; dept: string; gross: number; tax: number; invoice: number | null };

export type RuleChange = { key: "tolerance" | "missing" | "maxSingleAmount" | "leadAt" | "directorAt" | "financeReviewAt"; label: string; from: string; to: string };

export type RowFix = {
  row: LabRow;
  reason: string;
  ruleFix: RuleChange[] | null;
  dataFix: { gross: number; invoice: number | null; note: string } | null;
};

export type CounterfactualReport = {
  ok: boolean;
  error?: string;
  title: string;
  rows: number;
  blockedRows: LabRow[];
  unfixable: { row: LabRow; reason: string }[];
  global: {
    changes: RuleChange[];
    provedMinimal: boolean;
    minimalNote: string;
    patchedRaw: string;
    engine: { before: string; after: string; stillBlocked: number; queueShifts: number };
  } | null;
  perRow: RowFix[];
  solver: { version: string; ms: number; queries: number };
};

export type SynthExample = {
  gross: number;
  tax: number;
  invoice: number | null;
  expect: { queue?: string; blocked?: boolean };
  label?: string;
};

export type SynthReport = {
  ok: boolean;
  error?: string;
  status: "sat" | "unsat" | "unknown";
  changes: RuleChange[];
  params: Record<string, string>;
  patchedRaw: string | null;
  verified: { example: SynthExample; engineQueue: string; engineBlocked: boolean; pass: boolean }[];
  conflict: { index: number; example: SynthExample }[];
  impact: { headline: string; counterexamples: number } | null;
  solver: { version: string; ms: number; queries: number };
};

/* ---------- 证明结果（服务端产出、前端展示） ---------- */

export type RuleProofRow = { gross: number; tax: number; invoice: number | null };

export type RuleProofSide = {
  cap: boolean;
  booked: number;
  recon: string;
  queue: string;
  blocked: boolean;
  guardStop: boolean;
};

export type RuleCounterexample = {
  field: OutcomeField;
  fieldLabel: string;
  steps: string[];
  row: RuleProofRow;
  baseline: RuleProofSide;
  candidate: RuleProofSide;
  /** 真实引擎复跑两版后同样不一致 */
  engineConfirmed: boolean;
  engineNote: string;
  /** 出现该差异的金额上下界（求解器最优化得到；null 表示在建模范围内不封顶） */
  grossRange: { min: number | null; max: number | null } | null;
  csv: string;
};

export type RuleDeadBranch = {
  version: "baseline" | "candidate" | "both";
  steps: string[];
  target: string;
  explanation: string;
  /** 用真实引擎在边界金额上复跑佐证 */
  engineEvidence: string;
};

export type RuleProofReport = {
  supported: boolean;
  reason?: string;
  verdict: "equivalent" | "different" | "partial" | "unknown";
  headline: string;
  solver: { name: string; version: string; ms: number; queries: number; assertions: number };
  scale: number;
  stepsCompared: number;
  stepsChanged: string[];
  structuralChanges: string[];
  unmodeled: string[];
  counterexamples: RuleCounterexample[];
  deadBranches: RuleDeadBranch[];
  smtlib: string;
};
