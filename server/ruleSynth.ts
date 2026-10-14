/**
 * 反事实最小改动与例子反推规则：把规则参数当作 Z3 未知数。
 * - 反事实：被拦的真实单据，最少改哪条规则 / 哪个数据才能通过；最优性由 Optimize 求得并再查一次更小改动不可行；
 * - 例子反推：给几张单据和期望结果，求离现用参数最近、且满足全部例子的参数；无解时给出最小冲突例子集。
 * 所有结论都写回草稿，用真实引擎复跑核对。
 */

import type { Model } from "z3-solver";
import type { Hono } from "hono";
import { parseSkillMarkdown } from "../src/lib/skillMarkdown.ts";
import { buildSheetProgramState } from "../src/lib/sheetDeskProgram.ts";
import {
  QUEUE_CODES,
  amountScale,
  concreteAlgebra,
  ledgerStepRules,
  liftParams,
  patchLedgerArgs,
  rowOutcome,
  rowOutcomeOf,
  ruleParams,
  type CounterfactualReport,
  type LabRow,
  type LedgerArgPatch,
  type LedgerRuleParams,
  type LedgerStepRule,
  type RowFix,
  type RuleChange,
  type RuleParamsOf,
  type SynthExample,
  type SynthReport,
} from "../src/lib/ledgerRuleModel.ts";
import {
  AMOUNT_BOUND_YUAN,
  QUERY_TIMEOUT_MS,
  absExpr,
  algebra,
  boolOf,
  engineSide,
  exclusive,
  intOf,
  proveLedgerRules,
  z3,
  type B,
  type N,
  type Z3,
} from "./ruleProver.ts";
import { currentSkillRaw, isLabSession } from "./labSession.ts";

const MAX_ROW_FIXES = 40;

function referenceRule(rules: LedgerStepRule[]): LedgerStepRule | null {
  return (
    rules.find((r) => r.tool === "__sheet_report__") ??
    rules.find((r) => r.tool === "__sheet_escalation__") ??
    rules.find((r) => r.tool === "__sheet_reconcile__") ??
    rules[0] ??
    null
  );
}

function money(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString("zh-CN") : v.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

function dataScale(values: number[], base: number): number {
  for (const s of [base, 1000, 10000]) {
    if (s < base) continue;
    if (values.every((v) => Math.abs(v * s - Math.round(v * s)) < 1e-6)) return s;
  }
  return 10000;
}

function sessionState(sessionId: string, rule: LedgerStepRule) {
  return buildSheetProgramState("", rule.recipe, { productWorkbench: true, sessionId, dataSlot: "expense-ledger" });
}

function labRows(state: ReturnType<typeof buildSheetProgramState>): { rows: LabRow[]; badAmount: LabRow[] } {
  const rows: LabRow[] = [];
  const badAmount: LabRow[] = [];
  const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
  state.table.rows.forEach((row, index) => {
    const amount = row["金额"];
    const inv = row["发票额"];
    const item: LabRow = {
      index,
      person: String(row["申请人"] ?? row["姓名"] ?? `第${index + 1}行`),
      dept: String(row["部门"] ?? ""),
      gross: isNum(amount) ? amount : 0,
      tax: isNum(row["税额"]) ? row["税额"] : 0,
      invoice: isNum(inv) ? inv : null,
    };
    (isNum(amount) ? rows : badAmount).push(item);
  });
  return { rows, badAmount };
}

type SymParams = RuleParamsOf<N, B> & { vars: { tol: N; cap: N; lead: N; dir: N; fr: N; mb: B } };

function symbolicParams(ctx: Z3, base: LedgerRuleParams, free: ("tol" | "cap" | "lines" | "mb")[], tag: string): SymParams {
  const lifted = liftParams(algebra(ctx), base);
  const vars = {
    tol: ctx.Int.const(`tolerance_${tag}`),
    cap: ctx.Int.const(`max_single_${tag}`),
    lead: ctx.Int.const(`lead_at_${tag}`),
    dir: ctx.Int.const(`director_at_${tag}`),
    fr: ctx.Int.const(`finance_review_at_${tag}`),
    mb: ctx.Bool.const(`missing_block_${tag}`),
  };
  return {
    ...lifted,
    tolerance: free.includes("tol") ? vars.tol : lifted.tolerance,
    maxSingleAmount: free.includes("cap") ? vars.cap : lifted.maxSingleAmount,
    leadAt: free.includes("lines") ? vars.lead : lifted.leadAt,
    directorAt: free.includes("lines") ? vars.dir : lifted.directorAt,
    financeReviewAt: free.includes("lines") ? vars.fr : lifted.financeReviewAt,
    missingBlock: free.includes("mb") ? vars.mb : lifted.missingBlock,
    vars,
  };
}

function bounds(ctx: Z3, p: SymParams, scale: number): B[] {
  const top = AMOUNT_BOUND_YUAN * scale;
  return [p.vars.tol, p.vars.cap, p.vars.lead, p.vars.dir, p.vars.fr].map((x) => ctx.And(x.ge(0), x.le(top)));
}

function rowConst(ctx: Z3, r: LabRow, scale: number) {
  return {
    gross: ctx.Int.val(Math.round(r.gross * scale)),
    tax: ctx.Int.val(Math.round(r.tax * scale)),
    invoice: ctx.Int.val(Math.round((r.invoice ?? 0) * scale)),
    hasInvoice: ctx.Bool.val(r.invoice != null),
  };
}

type ChangeTerms = { count: N; amount: N };

function changeTerms(ctx: Z3, p: SymParams, base: LedgerRuleParams, free: ("tol" | "cap" | "lines" | "mb")[]): ChangeTerms {
  const one = (c: B) => ctx.If(c, ctx.Int.val(1), ctx.Int.val(0)) as N;
  const counts: N[] = [];
  const amounts: N[] = [];
  const num = (x: N, v: number) => {
    counts.push(one(ctx.Not(x.eq(v))));
    amounts.push(absExpr(ctx, x.sub(v)));
  };
  if (free.includes("tol")) num(p.vars.tol, base.tolerance);
  if (free.includes("cap")) num(p.vars.cap, base.maxSingleAmount);
  if (free.includes("lines")) {
    num(p.vars.lead, base.leadAt);
    num(p.vars.dir, base.directorAt);
    num(p.vars.fr, base.financeReviewAt);
  }
  if (free.includes("mb")) counts.push(one(ctx.Not(p.vars.mb.eq(ctx.Bool.val(base.missingBlock)))));
  const sum = (xs: N[]) => xs.reduce((a, b) => a.add(b), ctx.Int.val(0) as N);
  return { count: sum(counts), amount: sum(amounts) };
}

function readChanges(ctx: Z3, model: Model<"main">, p: SymParams, base: LedgerRuleParams, scale: number, free: ("tol" | "cap" | "lines" | "mb")[]) {
  const y = (v: number) => v / scale;
  const changes: RuleChange[] = [];
  const patch: LedgerArgPatch = {};
  const after: LedgerRuleParams = { ...base };
  const numKey = (key: RuleChange["key"], label: string, x: N, cur: number, set: (v: number) => void) => {
    const v = intOf(model, x);
    if (v === cur) return;
    changes.push({ key, label, from: `${money(y(cur))} 元`, to: `${money(y(v))} 元` });
    (patch as Record<string, number>)[key] = y(v);
    set(v);
  };
  if (free.includes("tol")) numKey("tolerance", "发票容差", p.vars.tol, base.tolerance, (v) => (after.tolerance = v));
  if (free.includes("cap")) numKey("maxSingleAmount", "单行上限", p.vars.cap, base.maxSingleAmount, (v) => (after.maxSingleAmount = v));
  if (free.includes("lines")) {
    numKey("leadAt", "负责人线", p.vars.lead, base.leadAt, (v) => (after.leadAt = v));
    numKey("directorAt", "总监线", p.vars.dir, base.directorAt, (v) => (after.directorAt = v));
    numKey("financeReviewAt", "财务复核线", p.vars.fr, base.financeReviewAt, (v) => (after.financeReviewAt = v));
  }
  if (free.includes("mb")) {
    const mb = boolOf(ctx, model, p.vars.mb);
    if (mb !== base.missingBlock) {
      changes.push({ key: "missing", label: "缺票策略", from: base.missingBlock ? "拦截" : "放行并警告", to: mb ? "拦截" : "放行并警告" });
      patch.missing = mb ? "block" : "pass";
      after.missingBlock = mb;
    }
  }
  return { changes, patch, after };
}

function blockReason(o: ReturnType<typeof rowOutcome<number, boolean>>, r: LabRow): string {
  if (r.gross < 0) return "金额为负";
  if (o.cap) return "超过单行上限";
  if (o.recon === 1) return "缺票";
  if (o.recon === 3) return `发票差额 ${money(Math.abs(r.gross - (r.invoice ?? 0)))} 元`;
  return "被拦";
}

export async function counterfactualForSession(sessionId: string, raw: string): Promise<CounterfactualReport> {
  const started = Date.now();
  const rules = ledgerStepRules(parseSkillMarkdown(raw).steps);
  const ref = referenceRule(rules);
  const fail = (error: string): CounterfactualReport => ({
    ok: false,
    error,
    title: "",
    rows: 0,
    blockedRows: [],
    unfixable: [],
    global: null,
    perRow: [],
    solver: { version: "", ms: Date.now() - started, queries: 0 },
  });
  if (!ref) return fail("这项技能没有报销规则步骤。");
  let state;
  try {
    state = sessionState(sessionId, ref);
  } catch (err) {
    return fail(err instanceof Error ? err.message : "读不到材料");
  }
  if (!state.schemaOk) return fail(`材料结构不对：${state.schemaIssues.join("；")}`);
  const { rows, badAmount } = labRows(state);
  const scale = dataScale(rows.flatMap((r) => [r.gross, r.tax, r.invoice ?? 0]), amountScale([ref.recipe]));
  const base = ruleParams(ref, scale);
  const toInt = (r: LabRow) => ({
    gross: Math.round(r.gross * scale),
    tax: Math.round(r.tax * scale),
    invoice: Math.round((r.invoice ?? 0) * scale),
    hasInvoice: r.invoice != null,
  });
  const current = rows.map((r) => rowOutcome(concreteAlgebra, base, toInt(r)));
  const blockedRows = rows.filter((_, i) => current[i]!.blocked);
  const unfixable = [
    ...badAmount.map((row) => ({ row, reason: "金额不是有效数字，规则改不了，只能改数据" })),
    ...blockedRows.filter((r) => r.gross < 0).map((row) => ({ row, reason: "金额为负，规则改不了，只能改数据" })),
  ];
  const targets = blockedRows.filter((r) => r.gross >= 0);

  return exclusive(async (): Promise<CounterfactualReport> => {
    const { ctx, version } = await z3();
    const alg = algebra(ctx);
    let queries = 0;
    const free: ("tol" | "cap" | "mb")[] = ["tol", "cap", "mb"];

    const solveRule = async (subset: LabRow[], tag: string) => {
      const p = symbolicParams(ctx, base, free, tag);
      const opt = new ctx.Optimize();
      opt.set("timeout", QUERY_TIMEOUT_MS);
      opt.add(...bounds(ctx, p, scale));
      for (const r of subset) opt.add(ctx.Not(rowOutcomeOf(alg, p, rowConst(ctx, r, scale)).blocked));
      const terms = changeTerms(ctx, p, base, free);
      opt.minimize(terms.count);
      opt.minimize(terms.amount);
      queries += 1;
      if ((await opt.check()) !== "sat") return null;
      const model = opt.model();
      const best = { count: intOf(model, terms.count), amount: intOf(model, terms.amount) };
      const read = readChanges(ctx, model, p, base, scale, free);
      return { ...read, best, p, terms, subset };
    };

    let global: CounterfactualReport["global"] = null;
    if (targets.length) {
      const sol = await solveRule(targets, "all");
      if (sol) {
        const check = new ctx.Solver();
        check.set("timeout", QUERY_TIMEOUT_MS);
        check.add(...bounds(ctx, sol.p, scale));
        for (const r of targets) check.add(ctx.Not(rowOutcomeOf(alg, sol.p, rowConst(ctx, r, scale)).blocked));
        check.add(
          ctx.Or(
            sol.terms.count.lt(sol.best.count),
            ctx.And(sol.terms.count.eq(sol.best.count), sol.terms.amount.lt(sol.best.amount)),
          ),
        );
        queries += 1;
        const smaller = await check.check();
        const patchedRaw = patchLedgerArgs(raw, sol.patch);
        const patchedRef = referenceRule(ledgerStepRules(parseSkillMarkdown(patchedRaw).steps))!;
        const after = sessionState(sessionId, patchedRef);
        const stillBlocked = after.reconcileFlags.filter((f) => f.kind === "拦截").length + after.rowIssues.filter((f) => f.kind === "拦截").length;
        const queueShifts = after.escalations.filter((e, i) => state.escalations[i]?.queue !== e.queue).length;
        global = {
          changes: sol.changes,
          provedMinimal: smaller === "unsat",
          minimalNote:
            smaller === "unsat"
              ? `Z3 已证明：改动少于 ${sol.best.count} 条规则、或同样条数但改动幅度更小，都不可能让这 ${targets.length} 张单据全部通过。`
              : "求解器没能在时限内证明更小的改动不存在。",
          patchedRaw,
          engine: { before: state.summary, after: after.summary, stillBlocked, queueShifts },
        };
      }
    }

    const perRow: RowFix[] = [];
    for (const r of targets.slice(0, MAX_ROW_FIXES)) {
      const o = current[rows.indexOf(r)]!;
      const sol = await solveRule([r], `row${r.index}`);
      const g = ctx.Int.const(`gross_fix_${r.index}`);
      const inv = ctx.Int.const(`invoice_fix_${r.index}`);
      const p = liftParams(alg, base);
      const fixed = rowOutcomeOf(alg, p, { gross: g, tax: ctx.Int.val(Math.round(r.tax * scale)), invoice: inv, hasInvoice: ctx.Bool.val(true) });
      const opt = new ctx.Optimize();
      opt.set("timeout", QUERY_TIMEOUT_MS);
      opt.add(ctx.Not(fixed.blocked), g.ge(0), inv.ge(0));
      const g0 = Math.round(r.gross * scale);
      const i0 = Math.round((r.invoice ?? r.gross) * scale);
      opt.minimize(absExpr(ctx, g.sub(g0)));
      opt.minimize(absExpr(ctx, inv.sub(i0)));
      queries += 1;
      let dataFix: RowFix["dataFix"] = null;
      if ((await opt.check()) === "sat") {
        const m = opt.model();
        const ng = intOf(m, g) / scale;
        const ni = intOf(m, inv) / scale;
        const notes: string[] = [];
        if (r.invoice == null) notes.push(`补一张 ${money(ni)} 元的发票`);
        else if (ni !== r.invoice) notes.push(`发票额 ${money(r.invoice)} → ${money(ni)} 元`);
        if (ng !== r.gross) notes.push(`报销金额 ${money(r.gross)} → ${money(ng)} 元`);
        dataFix = { gross: ng, invoice: ni, note: notes.join("，") || "数据无需改动" };
      }
      perRow.push({ row: r, reason: blockReason(o, r), ruleFix: sol ? sol.changes : null, dataFix });
    }

    return {
      ok: true,
      title: state.table.title,
      rows: rows.length,
      blockedRows,
      unfixable,
      global,
      perRow,
      solver: { version, ms: Date.now() - started, queries },
    };
  });
}

function resolveRaw(body: { raw?: string; skillId?: string }): string | null {
  if (typeof body.raw === "string" && body.raw.trim()) return body.raw.length <= 200_000 ? body.raw : null;
  if (typeof body.skillId === "string") return currentSkillRaw(body.skillId)?.raw ?? null;
  return null;
}

export function registerRuleSynth(app: Hono) {
  app.post("/api/lab/counterfactual", async (c) => {
    const body = await c.req.json<{ sessionId?: string; raw?: string; skillId?: string }>().catch(() => null);
    if (!body || !isLabSession(body.sessionId)) return c.json({ error: "先导入一份报销台账" }, 400);
    const raw = resolveRaw(body);
    if (!raw) return c.json({ error: "找不到技能原文" }, 400);
    try {
      return c.json(await counterfactualForSession(body.sessionId, raw));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "求解失败" }, 500);
    }
  });
  app.post("/api/lab/synthesize", async (c) => {
    const body = await c.req.json<{ raw?: string; skillId?: string; examples?: SynthExample[] }>().catch(() => null);
    const raw = body ? resolveRaw(body) : null;
    if (!raw) return c.json({ error: "找不到技能原文" }, 400);
    if (!Array.isArray(body?.examples)) return c.json({ error: "examples 必填" }, 400);
    const examples = body.examples.map((e) => ({
      gross: Number(e?.gross),
      tax: Number(e?.tax ?? 0),
      invoice: e?.invoice == null || (e.invoice as unknown) === "" ? null : Number(e.invoice),
      expect: { queue: e?.expect?.queue || undefined, blocked: typeof e?.expect?.blocked === "boolean" ? e.expect.blocked : undefined },
      label: typeof e?.label === "string" ? e.label.slice(0, 40) : undefined,
    }));
    try {
      return c.json(await synthesizeRules(raw, examples));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "求解失败" }, 500);
    }
  });
}

function queueIndex(label: string): number {
  return QUEUE_CODES.findIndex((q) => q === label || q.startsWith(label));
}

export async function synthesizeRules(raw: string, examples: SynthExample[]): Promise<SynthReport> {
  const started = Date.now();
  const rules = ledgerStepRules(parseSkillMarkdown(raw).steps);
  const ref = referenceRule(rules);
  const fail = (error: string): SynthReport => ({
    ok: false,
    error,
    status: "unknown",
    changes: [],
    params: {},
    patchedRaw: null,
    verified: [],
    conflict: [],
    impact: null,
    solver: { version: "", ms: Date.now() - started, queries: 0 },
  });
  if (!ref) return fail("这项技能没有报销规则步骤。");
  if (!examples.length) return fail("至少给一个例子。");
  if (examples.length > 60) return fail("例子最多 60 个。");
  for (const ex of examples) {
    if (!Number.isFinite(ex.gross) || !Number.isFinite(ex.tax) || (ex.invoice != null && !Number.isFinite(ex.invoice))) return fail("例子里有不是数字的金额。");
    if (ex.expect.queue && queueIndex(ex.expect.queue) < 0) return fail(`不认识的队列：${ex.expect.queue}`);
    if (!ex.expect.queue && ex.expect.blocked === undefined) return fail("每个例子都要写期望结果。");
  }
  const scale = dataScale(examples.flatMap((e) => [e.gross, e.tax, e.invoice ?? 0]), amountScale([ref.recipe]));
  const base = ruleParams(ref, scale);
  const free: ("tol" | "cap" | "lines" | "mb")[] = ["tol", "cap", "lines", "mb"];

  return exclusive(async (): Promise<SynthReport> => {
    const { ctx, version } = await z3();
    const alg = algebra(ctx);
    let queries = 0;
    const p = symbolicParams(ctx, base, free, "synth");
    const rowOf = (ex: SynthExample, i: number): LabRow => ({ index: i, person: ex.label ?? `例子${i + 1}`, dept: "", gross: ex.gross, tax: ex.tax, invoice: ex.invoice });
    const want = examples.map((ex, i) => {
      const o = rowOutcomeOf(alg, p, rowConst(ctx, rowOf(ex, i), scale));
      const parts: B[] = [];
      if (ex.expect.queue) parts.push(o.queue.eq(queueIndex(ex.expect.queue)));
      if (ex.expect.blocked !== undefined) parts.push(ex.expect.blocked ? o.blocked : ctx.Not(o.blocked));
      return ctx.And(...parts);
    });
    const feasible = async (idx: number[]) => {
      const s = new ctx.Solver();
      s.set("timeout", QUERY_TIMEOUT_MS);
      s.add(...bounds(ctx, p, scale), ...idx.map((i) => want[i]!));
      queries += 1;
      return s.check();
    };
    const all = examples.map((_, i) => i);
    const first = await feasible(all);
    if (first === "unknown") return { ...fail("求解超时"), solver: { version, ms: Date.now() - started, queries } };
    if (first === "unsat") {
      let core = [...all];
      for (const i of all) {
        const without = core.filter((j) => j !== i);
        if ((await feasible(without)) === "unsat") core = without;
      }
      return {
        ok: true,
        status: "unsat",
        changes: [],
        params: {},
        patchedRaw: null,
        verified: [],
        conflict: core.map((i) => ({ index: i, example: examples[i]! })),
        impact: null,
        solver: { version, ms: Date.now() - started, queries },
      };
    }
    const opt = new ctx.Optimize();
    opt.set("timeout", QUERY_TIMEOUT_MS);
    opt.add(...bounds(ctx, p, scale), ...want);
    const terms = changeTerms(ctx, p, base, free);
    opt.minimize(terms.count);
    opt.minimize(terms.amount);
    queries += 1;
    if ((await opt.check()) !== "sat") return { ...fail("求解超时"), solver: { version, ms: Date.now() - started, queries } };
    const read = readChanges(ctx, opt.model(), p, base, scale, free);
    const patchedRaw = patchLedgerArgs(raw, read.patch);
    const patchedRef = referenceRule(ledgerStepRules(parseSkillMarkdown(patchedRaw).steps))!;
    const verified = examples.map((ex) => {
      const side = engineSide(patchedRef, { gross: ex.gross, tax: ex.tax, invoice: ex.invoice });
      const queueOk = !ex.expect.queue || side.queue.startsWith(ex.expect.queue) || side.queue === ex.expect.queue;
      const blockedOk = ex.expect.blocked === undefined || side.blocked === ex.expect.blocked;
      return { example: ex, engineQueue: side.queue, engineBlocked: side.blocked, pass: queueOk && blockedOk };
    });
    const y = (v: number) => `${money(v / scale)} 元`;
    const params = {
      发票容差: y(read.after.tolerance),
      单行上限: y(read.after.maxSingleAmount),
      负责人线: y(read.after.leadAt),
      总监线: y(read.after.directorAt),
      财务复核线: y(read.after.financeReviewAt),
      缺票策略: read.after.missingBlock ? "拦截" : "放行并警告",
    };
    return {
      ok: true,
      status: "sat",
      changes: read.changes,
      params,
      patchedRaw,
      verified,
      conflict: [],
      impact: null,
      solver: { version, ms: Date.now() - started, queries },
    };
  }).then(async (report) => {
    if (report.status !== "sat" || !report.patchedRaw || !report.changes.length) return report;
    const proof = await proveLedgerRules(raw, report.patchedRaw);
    return { ...report, impact: { headline: proof.headline, counterexamples: proof.counterexamples.length } };
  });
}
