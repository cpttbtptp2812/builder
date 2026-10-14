/**
 * 规则证明器：用 Z3 SMT 求解器比较两版报销技能的规则参数。
 * - 等价：证明任何一张单据在两版下处理结果相同；
 * - 不等价：给出具体反例单据，并用真实引擎（runSheetProgramTool）复跑两版确认；
 * - 死规则：证明某个审批队列在当前参数下不可能被任何单据到达。
 */

import type { Hono } from "hono";
import type { Arith, Bool, Context, Model } from "z3-solver";
import { parseSkillMarkdown } from "../src/lib/skillMarkdown.ts";
import { buildSheetProgramState, runSheetProgramTool } from "../src/lib/sheetDeskProgram.ts";
import {
  OUTCOME_FIELDS,
  OUTCOME_LABEL,
  QUEUE_CODES,
  RECON_CODES,
  amountScale,
  concreteAlgebra,
  ledgerStepRules,
  rowOutcome,
  ruleParams,
  unmodeledDiff,
  type LedgerRowOutcome,
  type LedgerRowVars,
  type LedgerRuleParams,
  type LedgerStepRule,
  type OutcomeField,
  type RuleAlgebra,
  type RuleCounterexample,
  type RuleDeadBranch,
  type RuleProofReport,
  type RuleProofRow,
  type RuleProofSide,
} from "../src/lib/ledgerRuleModel.ts";

export type Z3 = Context<"main">;
export type N = Arith<"main">;
export type B = Bool<"main">;

/** 建模范围：单张金额、税额、发票额绝对值不超过一亿元 */
export const AMOUNT_BOUND_YUAN = 100_000_000;
export const QUERY_TIMEOUT_MS = 8000;
const SMTLIB_MAX = 60_000;

let z3Promise: Promise<{ ctx: Z3; version: string }> | null = null;
let queue: Promise<unknown> = Promise.resolve();

export async function z3(): Promise<{ ctx: Z3; version: string }> {
  z3Promise ??= (async () => {
    const { init } = await import("z3-solver");
    const api = await init();
    const ctx = api.Context("main");
    return { ctx, version: String(api.Z3.get_full_version?.() ?? "Z3") };
  })();
  return z3Promise;
}

/** Z3 的 wasm 上下文一次只跑一个查询 */
export function exclusive<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job, job);
  queue = next.catch(() => undefined);
  return next;
}

export function algebra(ctx: Z3): RuleAlgebra<N, B> {
  return {
    num: (v) => ctx.Int.val(v),
    add: (a, b) => a.add(b),
    sub: (a, b) => a.sub(b),
    ge: (a, b) => a.ge(b),
    gt: (a, b) => a.gt(b),
    lt: (a, b) => a.lt(b),
    eq: (a, b) => a.eq(b),
    and: (...xs) => ctx.And(...xs),
    or: (...xs) => ctx.Or(...xs),
    not: (x) => ctx.Not(x),
    ite: (c, a, b) => ctx.If(c, a, b) as N,
    iteB: (c, a, b) => ctx.If(c, a, b) as B,
    bool: (v) => ctx.Bool.val(v),
  };
}

type Vars = LedgerRowVars<N, B>;

function rowVars(ctx: Z3): Vars {
  return {
    gross: ctx.Int.const("gross"),
    tax: ctx.Int.const("tax"),
    invoice: ctx.Int.const("invoice"),
    hasInvoice: ctx.Bool.const("has_invoice"),
  };
}

function domain(ctx: Z3, v: Vars, scale: number): B[] {
  const bound = AMOUNT_BOUND_YUAN * scale;
  const inRange = (x: N) => ctx.And(x.ge(-bound), x.le(bound));
  return [inRange(v.gross), inRange(v.tax), inRange(v.invoice), ctx.Or(v.hasInvoice, v.invoice.eq(0))];
}

/** 整元：整数在浮点下精确，真实引擎复跑不会因舍入失真 */
function wholeYuan(v: Vars, scale: number): B[] {
  return [v.gross.mod(scale).eq(0), v.tax.mod(scale).eq(0), v.invoice.mod(scale).eq(0)];
}

/** 像一张正常单据：金额至少 1 元，税额、发票额不为负 */
function ordinary(v: Vars, scale: number): B[] {
  return [v.gross.ge(scale), v.tax.ge(0), v.invoice.ge(0)];
}

function differs(ctx: Z3, a: LedgerRowOutcome<N, B>, b: LedgerRowOutcome<N, B>, field: OutcomeField): B {
  const x = a[field] as N | B;
  const y = b[field] as N | B;
  return ctx.Not((x as N).eq(y as N));
}

export function absExpr(ctx: Z3, x: N): N {
  return ctx.If(x.ge(0), x, x.neg()) as N;
}

export function intOf(model: Model<"main">, x: N): number {
  const v = model.eval(x, true) as unknown as { value?: () => bigint };
  return typeof v.value === "function" ? Number(v.value()) : 0;
}

export function boolOf(ctx: Z3, model: Model<"main">, x: B): boolean {
  return ctx.isTrue(model.eval(x, true));
}

type Stats = { queries: number; assertions: number; smt: string[] };

function recordSmt(stats: Stats, title: string, scale: number, assertions: { length(): number; get(i: number): { sexpr(): string } }) {
  stats.queries += 1;
  stats.assertions += assertions.length();
  if (stats.smt.join("\n").length > SMTLIB_MAX) return;
  const lines = [
    `; ${title}（金额单位 1/${scale} 元）`,
    "(declare-const gross Int)",
    "(declare-const tax Int)",
    "(declare-const invoice Int)",
    "(declare-const has_invoice Bool)",
  ];
  for (let i = 0; i < assertions.length(); i++) lines.push(`(assert ${assertions.get(i).sexpr()})`);
  lines.push("(check-sat)", "(get-model)");
  stats.smt.push(lines.join("\n"));
}

type Witness = { gross: number; tax: number; invoice: number; hasInvoice: boolean };

async function findWitness(
  ctx: Z3,
  v: Vars,
  scale: number,
  goal: B[],
  stats: Stats,
  title: string,
): Promise<{ status: "sat"; witness: Witness } | { status: "unsat" | "unknown" }> {
  const tiers: B[][] = [[...ordinary(v, scale), ...wholeYuan(v, scale)], wholeYuan(v, scale), []];
  for (const [i, extra] of tiers.entries()) {
    const last = i === tiers.length - 1;
    try {
      const opt = new ctx.Optimize();
      opt.set("timeout", QUERY_TIMEOUT_MS);
      opt.add(...domain(ctx, v, scale), ...goal, ...extra);
      opt.minimize(absExpr(ctx, v.tax));
      opt.minimize(absExpr(ctx, v.gross));
      opt.minimize(absExpr(ctx, v.gross.sub(v.invoice)));
      const result = await opt.check();
      if (result === "sat" || last) recordSmt(stats, title, scale, opt.assertions());
      if (result === "sat") {
        const model = opt.model();
        return {
          status: "sat",
          witness: {
            gross: intOf(model, v.gross),
            tax: intOf(model, v.tax),
            invoice: intOf(model, v.invoice),
            hasInvoice: boolOf(ctx, model, v.hasInvoice),
          },
        };
      }
      if (result === "unknown") return { status: "unknown" };
    } catch {
      if (last) return { status: "unknown" };
    }
  }
  return { status: "unsat" };
}

/** 出现差异的金额上下界；优先在正常单据范围内求 */
async function grossRange(ctx: Z3, v: Vars, scale: number, goal: B[], stats: Stats): Promise<{ min: number | null; max: number | null }> {
  const bound = AMOUNT_BOUND_YUAN * scale;
  for (const extra of [ordinary(v, scale), []]) {
    const out: { min: number | null; max: number | null } = { min: null, max: null };
    let sat = true;
    for (const dir of ["min", "max"] as const) {
      const opt = new ctx.Optimize();
      opt.set("timeout", QUERY_TIMEOUT_MS);
      opt.add(...domain(ctx, v, scale), ...goal, ...extra);
      if (dir === "min") opt.minimize(v.gross);
      else opt.maximize(v.gross);
      stats.queries += 1;
      if ((await opt.check()) !== "sat") {
        sat = false;
        break;
      }
      const value = intOf(opt.model(), v.gross);
      out[dir] = Math.abs(value) >= bound ? null : value / scale;
    }
    if (sat) return out;
  }
  return { min: null, max: null };
}

/* ---------- 真实引擎复跑 ---------- */

function fmtAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function witnessRow(w: Witness, scale: number): RuleProofRow {
  return { gross: w.gross / scale, tax: w.tax / scale, invoice: w.hasInvoice ? w.invoice / scale : null };
}

function rowCsv(row: RuleProofRow): string {
  return [
    "部门,申请人,金额,税额,发票额",
    `证明器反例,反例单据,${fmtAmount(row.gross)},${fmtAmount(row.tax)},${row.invoice == null ? "空" : fmtAmount(row.invoice)}`,
  ].join("\n");
}

function sideFromModel(o: LedgerRowOutcome<number, boolean>, scale: number): RuleProofSide {
  return {
    cap: o.cap,
    booked: o.booked / scale,
    recon: RECON_CODES[o.recon] ?? "?",
    queue: QUEUE_CODES[o.queue] ?? "?",
    blocked: o.blocked,
    guardStop: o.guardStop,
  };
}

/** 用该步的真实工具和参数跑一行单据，读出与模型同口径的结果 */
export function engineSide(rule: LedgerStepRule, row: RuleProofRow): RuleProofSide {
  const query = "```csv\n" + rowCsv(row) + "\n```";
  const tool = runSheetProgramTool(rule.tool, { ...rule.args, query });
  const state = buildSheetProgramState(query, rule.recipe);
  const flag = state.reconcileFlags[0];
  const recon = !flag
    ? "通过"
    : flag.code === "MISSING_INVOICE"
      ? flag.kind === "拦截" ? "缺票拦截" : "缺票警告"
      : "发票差额拦截";
  const esc = state.escalations[0];
  const queueLabel = !esc
    ? "?"
    : esc.queue === "财务复核"
      ? esc.reason.startsWith("对账未通过") ? "财务复核（对账未通过）" : "财务复核（达线）"
      : esc.queue;
  return {
    cap: state.rowIssues.some((f) => f.code === "CAP"),
    booked: state.priced[0]?.booked ?? 0,
    recon,
    queue: queueLabel,
    blocked: state.blocked,
    guardStop: tool?.isError === true,
  };
}

function sameField(a: RuleProofSide, b: RuleProofSide, field: OutcomeField): boolean {
  if (field === "booked") return Math.abs(a.booked - b.booked) < 1e-9;
  return a[field] === b[field];
}

/* ---------- 主流程 ---------- */

type Pair = { key: string; steps: string[]; base: LedgerStepRule; cand: LedgerStepRule };

function paramsKey(p: LedgerRuleParams): string {
  return JSON.stringify(p);
}

function deadExplanation(p: LedgerRuleParams, target: number, scale: number): string {
  const y = (v: number) => fmtAmount(v / scale);
  if (target === 2 && p.financeReviewAt <= p.directorAt) {
    return `财务复核线 ${y(p.financeReviewAt)} 不高于总监线 ${y(p.directorAt)}，引擎先判财务复核，金额达到总监线的单据全部先被财务复核截走。`;
  }
  if (target === 1 && p.leadAt >= Math.min(p.directorAt, p.financeReviewAt)) {
    return `负责人线 ${y(p.leadAt)} 不低于更高一级的线 ${y(Math.min(p.directorAt, p.financeReviewAt))}，达到负责人线的单据都会被更高一级截走。`;
  }
  if (target === 0 && p.leadAt <= 0) {
    return `负责人线 ${y(p.leadAt)} 不大于 0，任何正常金额都至少进负责人队列。`;
  }
  return "求解器证明：在建模范围内没有任何正常单据能进入该队列。";
}

async function deadBranches(
  ctx: Z3,
  v: Vars,
  scale: number,
  rules: LedgerStepRule[],
  version: "baseline" | "candidate",
  stats: Stats,
): Promise<RuleDeadBranch[]> {
  const alg = algebra(ctx);
  const groups = new Map<string, { params: LedgerRuleParams; rule: LedgerStepRule; steps: string[] }>();
  for (const rule of rules) {
    if (rule.tool !== "__sheet_escalation__" && rule.tool !== "__sheet_deliver_escalation__" && rule.tool !== "__sheet_report__") continue;
    const params = ruleParams(rule, scale);
    const key = paramsKey({ ...params, missingGuardStops: false });
    const g = groups.get(key);
    if (g) g.steps.push(rule.label);
    else groups.set(key, { params, rule, steps: [rule.label] });
  }
  const out: RuleDeadBranch[] = [];
  for (const { params, rule, steps } of groups.values()) {
    const o = rowOutcome(alg, params, v);
    for (const target of [0, 1, 2, 3]) {
      const normal = [v.gross.gt(0), ctx.Not(o.cap), v.hasInvoice, v.invoice.eq(v.gross)];
      const res = await findWitness(ctx, v, scale, [...normal, o.queue.eq(target)], stats, `${version} 可达性：${QUEUE_CODES[target]}`);
      if (res.status !== "unsat") continue;
      const label = QUEUE_CODES[target]!;
      const probe =
        target === 2 ? params.directorAt : target === 1 ? params.leadAt : target === 3 ? params.financeReviewAt : Math.max(1, params.leadAt - scale);
      const row: RuleProofRow = { gross: probe / scale, tax: 0, invoice: probe / scale };
      const actual = probe > 0 && probe <= params.maxSingleAmount ? engineSide(rule, row).queue : null;
      out.push({
        version,
        steps,
        target: label,
        explanation: deadExplanation(params, target, scale),
        engineEvidence: actual
          ? `真实引擎复跑：金额正好 ${fmtAmount(probe / scale)} 元、发票相符的单据进入「${actual}」。`
          : "边界金额超出正常单据范围，未复跑。",
      });
    }
  }
  return out;
}

function stepSignature(steps: { id: string; tool: string }[]): string[] {
  return steps.map((s) => `${s.id}:${s.tool}`);
}

export async function proveLedgerRules(baselineRaw: string, candidateRaw: string): Promise<RuleProofReport> {
  const started = Date.now();
  const baseDoc = parseSkillMarkdown(baselineRaw);
  const candDoc = parseSkillMarkdown(candidateRaw);
  const baseRules = ledgerStepRules(baseDoc.steps);
  const candRules = ledgerStepRules(candDoc.steps);
  const empty = (reason: string): RuleProofReport => ({
    supported: false,
    reason,
    verdict: "unknown",
    headline: reason,
    solver: { name: "Z3", version: "", ms: Date.now() - started, queries: 0, assertions: 0 },
    scale: 100,
    stepsCompared: 0,
    stepsChanged: [],
    structuralChanges: [],
    unmodeled: [],
    counterexamples: [],
    deadBranches: [],
    smtlib: "",
  });
  if (!baseRules.length || !candRules.length) return empty("这项技能没有报销对账规则步骤，规则证明器暂不适用。");

  const scale = amountScale([...baseRules, ...candRules].map((r) => r.recipe));
  const baseById = new Map(baseRules.map((r) => [r.stepId, r]));
  const candById = new Map(candRules.map((r) => [r.stepId, r]));

  const structuralChanges: string[] = [];
  const bSig = stepSignature(baseDoc.steps);
  const cSig = stepSignature(candDoc.steps);
  for (const s of bSig) if (!cSig.includes(s)) structuralChanges.push(`删除或改动步骤 ${s}`);
  for (const s of cSig) if (!bSig.includes(s)) structuralChanges.push(`新增或改动步骤 ${s}`);

  const unmodeled = new Map<string, string[]>();
  const pairs = new Map<string, Pair>();
  const stepsChanged: string[] = [];
  let stepsCompared = 0;
  for (const cand of candRules) {
    const base = baseById.get(cand.stepId);
    if (!base || base.tool !== cand.tool) continue;
    stepsCompared += 1;
    const bp = ruleParams(base, scale);
    const cp = ruleParams(cand, scale);
    const structural = unmodeledDiff(base.recipe, cand.recipe);
    for (const s of structural) unmodeled.set(s, [...(unmodeled.get(s) ?? []), cand.label]);
    if (paramsKey(bp) === paramsKey(cp)) {
      if (structural.length) stepsChanged.push(cand.label);
      continue;
    }
    stepsChanged.push(cand.label);
    const key = `${paramsKey(bp)}→${paramsKey(cp)}`;
    const prev = pairs.get(key);
    if (prev) prev.steps.push(cand.label);
    else pairs.set(key, { key, steps: [cand.label], base, cand });
  }

  return exclusive(async () => {
    const { ctx, version } = await z3();
    const v = rowVars(ctx);
    const alg = algebra(ctx);
    const stats: Stats = { queries: 0, assertions: 0, smt: [] };
    const counterexamples: RuleCounterexample[] = [];
    let unknown = false;

    for (const pair of pairs.values()) {
      const bp = ruleParams(pair.base, scale);
      const cp = ruleParams(pair.cand, scale);
      const ob = rowOutcome(alg, bp, v);
      const oc = rowOutcome(alg, cp, v);
      for (const field of OUTCOME_FIELDS) {
        const goal = [differs(ctx, ob, oc, field)];
        const res = await findWitness(ctx, v, scale, goal, stats, `等价性：${pair.steps.join("、")} · ${OUTCOME_LABEL[field]}`);
        if (res.status !== "sat") {
          if (res.status === "unknown") unknown = true;
          continue;
        }
        const row = witnessRow(res.witness, scale);
        const mb = sideFromModel(rowOutcome(concreteAlgebra, bp, res.witness), scale);
        const mc = sideFromModel(rowOutcome(concreteAlgebra, cp, res.witness), scale);
        const eb = engineSide(pair.base, row);
        const ec = engineSide(pair.cand, row);
        const confirmed = !sameField(eb, ec, field);
        const modelMatchesEngine = sameField(mb, eb, field) && sameField(mc, ec, field);
        const range = await grossRange(ctx, v, scale, goal, stats);
        const same = counterexamples.find(
          (c) =>
            c.field === field &&
            JSON.stringify([c.baseline, c.candidate, c.grossRange]) === JSON.stringify([eb, ec, range]),
        );
        if (same) {
          same.steps.push(...pair.steps);
          continue;
        }
        counterexamples.push({
          field,
          fieldLabel: OUTCOME_LABEL[field],
          steps: [...pair.steps],
          row,
          baseline: eb,
          candidate: ec,
          engineConfirmed: confirmed && modelMatchesEngine,
          engineNote: confirmed && modelMatchesEngine
            ? "两版真实工具复跑结果与求解器一致。"
            : `真实引擎复跑未复现（模型：${describe(mb, field)} → ${describe(mc, field)}；引擎：${describe(eb, field)} → ${describe(ec, field)}）。`,
          grossRange: range,
          csv: rowCsv(row),
        });
      }
    }

    const deadBase = await deadBranches(ctx, v, scale, baseRules, "baseline", stats);
    const deadCand = pairs.size ? await deadBranches(ctx, v, scale, candRules, "candidate", stats) : deadBase;
    const dead: RuleDeadBranch[] = deadCand.map((d) => {
      const inBase = deadBase.some((b) => b.target === d.target && b.explanation === d.explanation);
      return { ...d, version: inBase ? "both" : "candidate" };
    });
    for (const b of deadBase) {
      if (!deadCand.some((d) => d.target === b.target && d.explanation === b.explanation)) dead.push(b);
    }

    const unmodeledList = [...unmodeled].map(([change, steps]) => `${change}（${steps.length} 步：${steps.slice(0, 4).join("、")}${steps.length > 4 ? "…" : ""}）`);
    const confirmed = counterexamples.filter((c) => c.engineConfirmed).length;
    const verdict: RuleProofReport["verdict"] = counterexamples.length
      ? "different"
      : unknown
        ? "unknown"
        : structuralChanges.length || unmodeledList.length
          ? "partial"
          : "equivalent";
    const headline =
      verdict === "different"
        ? `找到 ${counterexamples.length} 类会改变处理结果的单据，真实引擎复跑确认 ${confirmed} 类`
        : verdict === "unknown"
          ? "求解超时，没能给出结论"
          : verdict === "partial"
            ? `数值规则已证明等价；另有 ${structuralChanges.length + unmodeledList.length} 处结构改动不在证明范围内`
            : pairs.size
              ? `改了 ${stepsChanged.length} 步的参数，但已证明：任何单据在两版下处理结果完全相同`
              : "两版规则参数一致，处理结果相同";

    return {
      supported: true,
      verdict,
      headline,
      solver: { name: "Z3", version, ms: Date.now() - started, queries: stats.queries, assertions: stats.assertions },
      scale,
      stepsCompared,
      stepsChanged,
      structuralChanges,
      unmodeled: unmodeledList,
      counterexamples,
      deadBranches: dead,
      smtlib: stats.smt.join("\n\n"),
    };
  });
}

function describe(side: RuleProofSide, field: OutcomeField): string {
  const value = side[field];
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

export function registerRuleProof(app: Hono) {
  app.post("/api/rule-proof", async (c) => {
    const body = await c.req.json<{ baselineRaw?: string; candidateRaw?: string }>().catch(() => null);
    if (!body?.baselineRaw || !body?.candidateRaw) return c.json({ error: "baselineRaw and candidateRaw required" }, 400);
    if (body.baselineRaw.length > 200_000 || body.candidateRaw.length > 200_000) return c.json({ error: "skill too large" }, 413);
    try {
      return c.json(await proveLedgerRules(body.baselineRaw, body.candidateRaw));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "prover failed" }, 500);
    }
  });
}
