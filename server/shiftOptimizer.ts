/**
 * HiGHS 最优排班：与 shift-desk 引擎同一份材料、同一套规则。
 * 1) 真实引擎跑一遍（贪心初排 + 调换补缺）作对照；
 * 2) 用引擎解析出的员工、班次、规则建 0-1 整数规划，字典序：空缺最少 ≫ 开闭店无钥匙人最少 ≫ 全职工时差最小；
 * 3) 把最优解塞回引擎，后续复核、工时、缺口、开闭店、均衡、交付全部由引擎原样执行（复核不过就不算）；
 * 4) 排不满时，另建「允许放宽规则」的模型，求按代价加权最少要放宽哪几条，HiGHS 证明不存在更省的放宽。
 */

import type { Hono } from "hono";
import { parseSkillMarkdown } from "../src/lib/skillMarkdown.ts";
import {
  SHIFT_DESK_PROGRAM,
  conflictReason,
  fmtDay,
  isNightShift,
  seatLabel,
  staticReason,
  type Demand,
  type Rules,
  type Seat,
  type ShiftDeskState,
  type Staff,
} from "../src/lib/shiftDeskProgram.ts";
import { deskStateOf, fmtClock, runDeskTool, weekStartOf, weekdayOf, WEEKDAY_NAMES, type DeskArgs } from "../src/lib/deskProgramKit.ts";
import type { ShiftMatrixCell, ShiftOptimizeReport, ShiftPlanMetrics, ShiftRelaxation, ShiftSolveStage } from "../src/lib/shiftMilpTypes.ts";
import { currentSkillRaw, isLabSession } from "./labSession.ts";

type HighsApi = Awaited<ReturnType<typeof import("highs").default>>;
let highsPromise: Promise<HighsApi> | null = null;
function highs(): Promise<HighsApi> {
  highsPromise ??= import("highs").then((m) => m.default());
  return highsPromise;
}

const STAGE_TIME_LIMIT_S = 10;
const LP_MAX = 80_000;

/* ───────────── 通用 0-1 规划构造 ───────────── */

class Milp {
  names: string[] = [];
  lb: number[] = [];
  ub: number[] = [];
  int: (0 | 1)[] = [];
  rows: { name: string; idx: number[]; val: number[]; lo: number; hi: number }[] = [];
  bin(name: string): number {
    return this.add(name, 0, 1, 1);
  }
  add(name: string, lb: number, ub: number, int: 0 | 1): number {
    this.names.push(name);
    this.lb.push(lb);
    this.ub.push(ub);
    this.int.push(int);
    return this.names.length - 1;
  }
  row(name: string, terms: [number, number][], lo: number, hi: number) {
    const merged = new Map<number, number>();
    for (const [i, v] of terms) merged.set(i, (merged.get(i) ?? 0) + v);
    const idx = [...merged.keys()].sort((a, b) => a - b);
    this.rows.push({ name, idx, val: idx.map((i) => merged.get(i)!), lo, hi });
  }
}

type Solved = { status: string; proved: boolean; objective: number | null; bound: number | null; gap: number | null; values: Float64Array | null; ms: number; lp: string };

function solve(api: HighsApi, m: Milp, cost: Map<number, number>, opts: { exportLp?: boolean } = {}): Solved {
  const t0 = Date.now();
  const inf = api.infinity;
  const starts = [0];
  const indices: number[] = [];
  const values: number[] = [];
  for (const r of m.rows) {
    indices.push(...r.idx);
    values.push(...r.val);
    starts.push(indices.length);
  }
  const model = api.createModel({
    numCols: m.names.length,
    numRows: m.rows.length,
    colCost: m.names.map((_, i) => cost.get(i) ?? 0),
    colLower: m.lb,
    colUpper: m.ub.map((u) => (Number.isFinite(u) ? u : inf)),
    rowLower: m.rows.map((r) => (Number.isFinite(r.lo) ? r.lo : -inf)),
    rowUpper: m.rows.map((r) => (Number.isFinite(r.hi) ? r.hi : inf)),
    matrix: { format: "csr", numRows: m.rows.length, numCols: m.names.length, starts, indices, values },
    integrality: m.int,
    colNames: m.names,
    rowNames: m.rows.map((r) => r.name),
  });
  try {
    model.options.set({ output_flag: false, time_limit: STAGE_TIME_LIMIT_S, mip_rel_gap: 0, mip_abs_gap: 0 });
    const lp = opts.exportLp ? model.exportModel("lp") : "";
    model.run();
    const code = model.getModelStatus();
    const STATUS: Record<number, string> = { 7: "已证明最优", 8: "无解", 13: "到时限", 14: "到迭代上限", 16: "到解数上限", 17: "被中断" };
    const status = STATUS[code] ?? `状态 ${code}`;
    const feasible = Number(model.info.get("primal_solution_status")) === api.constants.solutionStatus.feasible;
    let bound: number | null = null;
    let gap: number | null = null;
    try {
      bound = Number(model.info.get("mip_dual_bound"));
      gap = Number(model.info.get("mip_gap"));
    } catch {
      /* 纯 LP 没有这两项 */
    }
    return {
      status,
      proved: code === 7,
      objective: feasible ? model.getObjectiveValue() : null,
      bound: bound !== null && Number.isFinite(bound) ? bound : null,
      gap: gap !== null && Number.isFinite(gap) ? gap : null,
      values: feasible ? Float64Array.from(model.getSolution().colValue) : null,
      ms: Date.now() - t0,
      lp,
    };
  } finally {
    model.dispose();
  }
}

/* ───────────── 引擎运行 ───────────── */

type EngineRun = { state: ShiftDeskState | null; stoppedAt: string | null; error: string | null };

function runEngine(steps: { id: string; tool: string; args?: DeskArgs }[], sessionId: string, inject?: (state: ShiftDeskState) => void): EngineRun {
  const vars: Record<string, unknown> = {};
  const env = { sessionId, productWorkbench: true, query: "" };
  for (const step of steps) {
    if (!SHIFT_DESK_PROGRAM.phases[step.tool]) continue;
    if (inject && (step.tool === "__shift_assign__" || step.tool === "__shift_repair__")) {
      if (step.tool === "__shift_assign__") inject(deskStateOf(SHIFT_DESK_PROGRAM, vars)!);
      continue;
    }
    const out = runDeskTool(SHIFT_DESK_PROGRAM, step.tool, { ...(step.args ?? {}), __sessionId: sessionId, __productWorkbench: true }, vars, env);
    if (out?.isError) {
      const content = out.content as { code?: string; error?: string };
      const state = deskStateOf(SHIFT_DESK_PROGRAM, vars);
      if (content.code === SHIFT_DESK_PROGRAM.guardCode) return { state, stoppedAt: step.id, error: null };
      return { state, stoppedAt: step.id, error: content.error ?? "引擎出错" };
    }
  }
  return { state: deskStateOf(SHIFT_DESK_PROGRAM, vars), stoppedAt: null, error: null };
}

function metricsOf(run: EngineRun): ShiftPlanMetrics | null {
  const st = run.state;
  if (!st?.seats) return null;
  const filled = st.seats.filter((s) => s.assignee).length;
  return {
    seats: st.seats.length,
    filled,
    unfilled: st.seats.length - filled,
    violations: st.violations?.length ?? 0,
    keyholderMisses: st.keyholderMisses?.length ?? 0,
    spread: st.fairness?.spread ?? null,
    cost: st.hours ? Math.round(st.hours.reduce((s, r) => s + r.cost, 0) * 100) / 100 : null,
    stoppedAt: run.stoppedAt,
    guardNotes: [...st.guardNotes],
  };
}

/* ───────────── 模型 ───────────── */

type Ctx = {
  staff: Staff[];
  demand: Demand[];
  rules: Rules;
  eligible: Map<number, string[]>;
  keySkills: string[];
  checkOpen: boolean;
  checkClose: boolean;
  compareType: string;
};

type Built = {
  m: Milp;
  x: Map<string, number>;
  u: Map<number, number>;
  km: number[];
  hmax: number | null;
  hmin: number | null;
  groups: Map<string, { col: number; info: Omit<ShiftRelaxation, "enables"> }>;
  staticGroup: Map<string, string>;
};

const xKey = (s: number, d: number) => `${s}:${d}`;

function restConflict(a: Demand, b: Demand, rules: Rules): "overlap" | "rest" | null {
  if (a.absStart < b.absEnd && b.absStart < a.absEnd) return "overlap";
  const gap = a.absEnd <= b.absStart ? b.absStart - a.absEnd : a.absStart - b.absEnd;
  const sameDaySplit = a.date === b.date && rules.maxShiftsPerDay > 1;
  if (!sameDaySplit && gap < rules.minRestHours * 60) return "rest";
  return null;
}

function staticGroupOf(s: Staff, d: Demand, reason: string): { id: string; kind: ShiftRelaxation["kind"]; label: string; weight: number } {
  if (reason.startsWith("不会")) return { id: `skill:${s.name}:${d.role}`, kind: "技能", label: `${s.name} 顶「${d.role}」岗（需培训或借调）`, weight: 3 };
  if (reason === "当天请假") return { id: `leave:${s.name}:${d.date}`, kind: "请假", label: `${s.name} ${fmtDay(d.date)} 销假上班`, weight: 4 };
  if (reason.endsWith("不上班")) {
    const wd = WEEKDAY_NAMES[weekdayOf(d.date)]!;
    return { id: `weekday:${s.name}:${wd}`, kind: "可上班", label: `${s.name} 加排${wd}`, weight: 1 };
  }
  if (reason.startsWith("最早")) return { id: `early:${s.name}`, kind: "可上班", label: `${s.name} 提早到岗`, weight: 1 };
  return { id: `late:${s.name}`, kind: "可上班", label: `${s.name} 延后下班`, weight: 1 };
}

function build(ctx: Ctx, mode: "plan" | "relax"): Built {
  const { staff, demand, rules } = ctx;
  const m = new Milp();
  const x = new Map<string, number>();
  const u = new Map<number, number>();
  const groups: Built["groups"] = new Map();
  const staticGroup = new Map<string, string>();
  const relax = mode === "relax";
  const group = (id: string, info: Omit<ShiftRelaxation, "enables">) => {
    if (!groups.has(id)) groups.set(id, { col: m.bin(`r_${groups.size}`), info });
    return groups.get(id)!.col;
  };

  demand.forEach((d, j) => {
    const ok = new Set(ctx.eligible.get(d.idx) ?? []);
    staff.forEach((s, i) => {
      if (ok.has(s.name)) {
        x.set(xKey(i, j), m.bin(`x_${i}_${j}`));
        return;
      }
      if (!relax) return;
      const reason = staticReason(s, d);
      if (!reason) return;
      const g = staticGroupOf(s, d, reason);
      const col = m.bin(`x_${i}_${j}`);
      x.set(xKey(i, j), col);
      const r = group(g.id, { id: g.id, kind: g.kind, person: s.name, label: g.label, weight: g.weight });
      staticGroup.set(xKey(i, j), g.id);
      m.row(`gate_${i}_${j}`, [[col, 1], [r, -1]], -Infinity, 0);
    });
  });

  demand.forEach((d, j) => {
    const terms: [number, number][] = [];
    staff.forEach((_, i) => {
      const c = x.get(xKey(i, j));
      if (c !== undefined) terms.push([c, 1]);
    });
    if (!relax) {
      const uc = m.add(`u_${j}`, 0, d.count, 1);
      u.set(j, uc);
      terms.push([uc, 1]);
    }
    m.row(`cover_${j}`, terms, d.count, d.count);
  });

  const weeksOf = new Map<number, number>();
  let wi = 0;
  for (const d of demand) if (!weeksOf.has(weekStartOf(d.date))) weeksOf.set(weekStartOf(d.date), wi++);

  staff.forEach((s, i) => {
    const mine = demand.map((d, j) => ({ d, j, c: x.get(xKey(i, j)) })).filter((e): e is { d: Demand; j: number; c: number } => e.c !== undefined);
    if (!mine.length) return;
    const ruleGroup = (key: string, label: string) =>
      relax ? group(`${key}:${s.name}`, { id: `${key}:${s.name}`, kind: "用工规则", person: s.name, label: `${s.name} ${label}`, weight: 5 }) : null;
    const withRelax = (terms: [number, number][], r: number | null, bigM: number): [number, number][] => (r === null ? terms : [...terms, [r, -bigM]]);

    const restR = ruleGroup("rest", `两班间休息少于 ${rules.minRestHours} 小时`);
    for (let a = 0; a < mine.length; a += 1) {
      for (let b = a + 1; b < mine.length; b += 1) {
        const kind = restConflict(mine[a]!.d, mine[b]!.d, rules);
        if (!kind) continue;
        const terms: [number, number][] = [[mine[a]!.c, 1], [mine[b]!.c, 1]];
        m.row(`pair_${i}_${mine[a]!.j}_${mine[b]!.j}`, kind === "rest" ? withRelax(terms, restR, 1) : terms, -Infinity, 1);
      }
    }

    const byDay = new Map<number, typeof mine>();
    for (const e of mine) byDay.set(e.d.date, [...(byDay.get(e.d.date) ?? []), e]);
    const dayCountR = ruleGroup("daycount", `一天上 ${rules.maxShiftsPerDay + 1} 个班`);
    const dailyR = ruleGroup("dailyhours", `单日工时超过 ${s.dailyCap} 小时`);
    const w = new Map<number, number>();
    for (const [day, list] of byDay) {
      const terms = list.map((e) => [e.c, 1] as [number, number]);
      if (list.length > rules.maxShiftsPerDay) m.row(`daycnt_${i}_${day}`, withRelax(terms, dayCountR, list.length), -Infinity, rules.maxShiftsPerDay);
      const paid = list.reduce((sum, e) => sum + e.d.paid, 0);
      if (paid > s.dailyCap + 1e-9) m.row(`dayhrs_${i}_${day}`, withRelax(list.map((e) => [e.c, e.d.paid]), dailyR, paid), -Infinity, s.dailyCap);
      const wc = m.bin(`w_${i}_${day}`);
      w.set(day, wc);
      for (const e of list) m.row(`work_${i}_${e.j}`, [[e.c, 1], [wc, -1]], -Infinity, 0);
    }

    const byWeek = new Map<number, typeof mine>();
    for (const e of mine) byWeek.set(weekStartOf(e.d.date), [...(byWeek.get(weekStartOf(e.d.date)) ?? []), e]);
    for (const [wk, list] of byWeek) {
      const n = weeksOf.get(wk)! + 1;
      const paid = list.reduce((sum, e) => sum + e.d.paid, 0);
      if (paid > s.weeklyCap + 1e-9) {
        const r = relax ? group(`weekhours:${s.name}:${wk}`, { id: `weekhours:${s.name}:${wk}`, kind: "用工规则", person: s.name, label: `${s.name} 第 ${n} 周工时超过 ${s.weeklyCap} 小时`, weight: 5 }) : null;
        m.row(`wkhrs_${i}_${wk}`, withRelax(list.map((e) => [e.c, e.d.paid]), r, paid), -Infinity, s.weeklyCap);
      }
      const days = [...new Set(list.map((e) => e.d.date))];
      const maxDays = 7 - rules.minRestDaysPerWeek;
      if (days.length > maxDays) {
        const r = relax ? group(`restdays:${s.name}:${wk}`, { id: `restdays:${s.name}:${wk}`, kind: "用工规则", person: s.name, label: `${s.name} 第 ${n} 周休息不足 ${rules.minRestDaysPerWeek} 天`, weight: 5 }) : null;
        m.row(`wkdays_${i}_${wk}`, withRelax(days.map((day) => [w.get(day)!, 1]), r, days.length), -Infinity, maxDays);
      }
      if (rules.maxNightShiftsPerWeek) {
        const nights = list.filter((e) => isNightShift(e.d, rules));
        if (nights.length > rules.maxNightShiftsPerWeek) {
          const r = relax ? group(`nights:${s.name}:${wk}`, { id: `nights:${s.name}:${wk}`, kind: "用工规则", person: s.name, label: `${s.name} 第 ${n} 周夜班超过 ${rules.maxNightShiftsPerWeek} 个`, weight: 5 }) : null;
          m.row(`nights_${i}_${wk}`, withRelax(nights.map((e) => [e.c, 1]), r, nights.length), -Infinity, rules.maxNightShiftsPerWeek);
        }
      }
    }

    const K = rules.maxConsecutiveDays;
    const dates = [...w.keys()].sort((a, b) => a - b);
    const consecR = ruleGroup("consec", `连续上班超过 ${K} 天`);
    for (const start of dates) {
      const window = dates.filter((day) => day >= start && day <= start + K);
      if (window.length <= K) continue;
      m.row(`consec_${i}_${start}`, withRelax(window.map((day) => [w.get(day)!, 1]), consecR, window.length), -Infinity, K);
    }
  });

  const km: number[] = [];
  let hmax: number | null = null;
  let hmin: number | null = null;
  if (!relax) {
    const holds = new Set(staff.filter((s) => s.skills.some((k) => ctx.keySkills.includes(k))).map((s) => s.name));
    const dates = [...new Set(demand.map((d) => d.date))].sort((a, b) => a - b);
    for (const day of dates) {
      const rows = demand.map((d, j) => ({ d, j })).filter((e) => e.d.date === day);
      const first = Math.min(...rows.map((e) => e.d.absStart));
      const last = Math.max(...rows.map((e) => e.d.absEnd));
      const edges: ["open" | "close", (d: Demand) => boolean][] = [];
      if (ctx.checkOpen) edges.push(["open", (d) => d.absStart === first]);
      if (ctx.checkClose) edges.push(["close", (d) => d.absEnd === last]);
      for (const [edge, at] of edges) {
        const miss = m.bin(`key_${edge}_${day}`);
        km.push(miss);
        const terms: [number, number][] = [[miss, 1]];
        for (const e of rows.filter((r) => at(r.d))) {
          staff.forEach((s, i) => {
            const c = x.get(xKey(i, e.j));
            if (c !== undefined && holds.has(s.name)) terms.push([c, 1]);
          });
        }
        m.row(`key_${edge}_${day}`, terms, 1, Infinity);
      }
    }
    const peers = staff
      .map((s, i) => ({ s, i }))
      .filter((p) => p.s.type.includes(ctx.compareType) && demand.some((_, j) => x.has(xKey(p.i, j))));
    if (peers.length >= 2) {
      const top = demand.reduce((sum, d) => sum + d.paid * d.count, 0);
      hmax = m.add("h_max", 0, top, 0);
      hmin = m.add("h_min", 0, top, 0);
      for (const p of peers) {
        const terms: [number, number][] = demand.flatMap((d, j) => {
          const c = x.get(xKey(p.i, j));
          return c === undefined ? [] : [[c, d.paid] as [number, number]];
        });
        m.row(`hmax_${p.i}`, [...terms, [hmax, -1]], -Infinity, 0);
        m.row(`hmin_${p.i}`, [...terms, [hmin, -1]], 0, Infinity);
      }
    }
  }
  return { m, x, u, km, hmax, hmin, groups, staticGroup };
}

function stage(name: string, s: Solved): ShiftSolveStage {
  return { name, status: s.status, objective: s.objective, bound: s.bound, gap: s.gap, ms: s.ms, proved: s.proved };
}

/* ───────────── 主流程 ───────────── */

export async function optimizeShifts(sessionId: string, raw: string): Promise<ShiftOptimizeReport> {
  const t0 = Date.now();
  const api = await highs();
  const fail = (error: string): ShiftOptimizeReport => ({
    ok: false,
    error,
    staffTitle: "",
    demandTitle: "",
    solver: { name: "HiGHS", version: "", vars: 0, rows: 0, ms: Date.now() - t0 },
    stages: [],
    greedy: null,
    optimal: null,
    matrix: { people: [], days: [], cells: {} },
    changedCells: 0,
    relax: null,
    lp: "",
    roster: null,
  });
  const steps = parseSkillMarkdown(raw).steps;
  if (!steps.some((s) => s.tool === "__shift_assign__")) return fail("这项技能没有排班步骤。");
  const argsOf = (tool: string) => (steps.find((s) => s.tool === tool)?.args ?? {}) as DeskArgs;

  const greedyRun = runEngine(steps, sessionId);
  if (greedyRun.error) return fail(greedyRun.error);
  const prefix = steps.slice(0, steps.findIndex((s) => s.tool === "__shift_assign__"));
  const prep = runEngine(prefix, sessionId);
  if (prep.error) return fail(prep.error);
  const st = prep.state;
  if (!st?.staff || !st.demand || !st.rules || !st.eligible) return fail(`材料没通过前置检查（停在「${prep.stoppedAt ?? "未知"}」步）。`);

  const keyArgs = argsOf("__shift_keyholder__");
  const ctx: Ctx = {
    staff: st.staff,
    demand: st.demand.filter((d) => d.valid),
    rules: st.rules,
    eligible: st.eligible,
    keySkills: Array.isArray(keyArgs.keySkills) ? keyArgs.keySkills.map(String) : ["店长", "值班长"],
    checkOpen: keyArgs.checkOpen !== false,
    checkClose: keyArgs.checkClose !== false,
    compareType: String(argsOf("__shift_fairness__").compareType ?? "全职"),
  };
  const hasKeyStep = steps.some((s) => s.tool === "__shift_keyholder__");
  if (!hasKeyStep) {
    ctx.checkOpen = false;
    ctx.checkClose = false;
  }

  const plan = build(ctx, "plan");
  const stages: ShiftSolveStage[] = [];
  const uCost = new Map([...plan.u.values()].map((c) => [c, 1]));
  const s1 = solve(api, plan.m, uCost, { exportLp: true });
  stages.push(stage("空缺人次最少", s1));
  if (!s1.values) return fail(`HiGHS 没找到可行解（${s1.status}）`);
  let best = s1.values;
  const U = Math.round(s1.objective ?? 0);
  plan.m.row("fix_unfilled", [...plan.u.values()].map((c) => [c, 1] as [number, number]), -Infinity, U);
  if (plan.km.length) {
    const s2 = solve(api, plan.m, new Map(plan.km.map((c) => [c, 1])));
    stages.push(stage("开闭店无钥匙人最少", s2));
    if (s2.values) {
      best = s2.values;
      plan.m.row("fix_key", plan.km.map((c) => [c, 1] as [number, number]), -Infinity, Math.round(s2.objective ?? 0));
    }
  }
  if (plan.hmax !== null && plan.hmin !== null) {
    const s3 = solve(api, plan.m, new Map([[plan.hmax, 1], [plan.hmin, -1]]));
    stages.push(stage(`${ctx.compareType}工时差最小`, s3));
    if (s3.values) best = s3.values;
  }

  const assigned = new Map<number, string[]>();
  ctx.demand.forEach((d, j) => {
    const who: string[] = [];
    ctx.staff.forEach((s, i) => {
      const c = plan.x.get(xKey(i, j));
      if (c !== undefined && best[c]! > 0.5) who.push(s.name);
    });
    assigned.set(d.idx, who);
  });
  const optimalRun = runEngine(steps, sessionId, (state) => {
    const seats: Seat[] = state.demand!
      .filter((d) => d.valid)
      .flatMap((d) => {
        const who = assigned.get(d.idx) ?? [];
        return Array.from({ length: d.count }, (_, k) => ({ key: `${d.idx}-${k}`, d, assignee: who[k] ?? null, via: (who[k] ? "最优解" : "") as Seat["via"] }));
      });
    state.seats = seats;
    state.assignDone = true;
  });
  if (optimalRun.error) return fail(`最优解交回引擎时出错：${optimalRun.error}`);

  const cellOf = (seats: Seat[] | null | undefined) => {
    const out = new Map<string, string[]>();
    for (const seat of seats ?? []) {
      if (!seat.assignee) continue;
      const key = `${seat.assignee}|${seat.d.date}`;
      out.set(key, [...(out.get(key) ?? []), `${seat.d.shift || fmtClock(seat.d.start)} ${seat.d.role}`]);
    }
    return out;
  };
  const g = cellOf(greedyRun.state?.seats);
  const o = cellOf(optimalRun.state?.seats);
  const days = [...new Set(ctx.demand.map((d) => d.date))].sort((a, b) => a - b);
  const cells: Record<string, ShiftMatrixCell> = {};
  let changed = 0;
  for (const s of ctx.staff) {
    for (const day of days) {
      const key = `${s.name}|${day}`;
      const cell = { greedy: (g.get(key) ?? []).join("、"), optimal: (o.get(key) ?? []).join("、") };
      if (cell.greedy || cell.optimal) cells[key] = cell;
      if (cell.greedy !== cell.optimal) changed += 1;
    }
  }

  let relax: ShiftOptimizeReport["relax"] = null;
  if (U > 0) relax = relaxation(api, ctx);
  else relax = { status: "full", proved: s1.proved, cost: 0, items: [], note: "已全部排满，不需要放宽任何规则。" };

  const roster = optimalRun.state?.tables.find((t) => t.id === "roster")?.grid ?? null;
  return {
    ok: true,
    staffTitle: st.staffTitle,
    demandTitle: st.demandTitle,
    solver: { name: "HiGHS", version: `${api.version.major}.${api.version.minor}.${api.version.patch}`, vars: plan.m.names.length, rows: plan.m.rows.length, ms: Date.now() - t0 },
    stages,
    greedy: metricsOf(greedyRun),
    optimal: metricsOf(optimalRun),
    matrix: { people: ctx.staff.map((s) => s.name), days: days.map((day) => ({ day, label: fmtDay(day) })), cells },
    changedCells: changed,
    relax,
    lp: s1.lp.length > LP_MAX ? `${s1.lp.slice(0, LP_MAX)}\n\\ …（共 ${s1.lp.length} 字，已截断）` : s1.lp,
    roster: roster ? { columns: roster.columns, rows: roster.rows } : null,
  };
}

/** 放宽组 → 引擎 conflictReason 的原话 */
const RULE_REASON: Record<string, string> = {
  rest: "两班之间休息不足",
  daycount: "当天已有班",
  dailyhours: "超出每日工时上限",
  weekhours: "超出周工时上限",
  consec: "连续上班超限",
  restdays: "每周休息日不足",
  nights: "本周夜班次数已满",
};

function relaxation(api: HighsApi, ctx: Ctx): NonNullable<ShiftOptimizeReport["relax"]> {
  const peak = ctx.demand.find((d) => {
    const overlapping = ctx.demand.filter((o) => o.absStart < d.absEnd && d.absStart < o.absEnd);
    return overlapping.reduce((sum, o) => sum + o.count, 0) > ctx.staff.length;
  });
  if (peak) {
    return {
      status: "impossible",
      proved: true,
      cost: null,
      items: [],
      note: `${seatLabel(peak)} 前后同时在岗的需求超过全店 ${ctx.staff.length} 人，放宽任何规则都排不满，只能加人或减需求。`,
    };
  }
  const r = build(ctx, "relax");
  const cost = new Map([...r.groups.values()].map((g) => [g.col, g.info.weight]));
  const s = solve(api, r.m, cost);
  if (!s.values) {
    return { status: "impossible", proved: s.status === "无解", cost: null, items: [], note: `即使放宽全部可放宽的规则也排不满（${s.status}），只能加人或减需求。` };
  }
  const values = s.values;
  const items: ShiftRelaxation[] = [];
  for (const [id, g] of r.groups) {
    if (values[g.col]! < 0.5) continue;
    const enables: string[] = [];
    ctx.demand.forEach((d, j) => {
      ctx.staff.forEach((st, i) => {
        if (r.staticGroup.get(xKey(i, j)) !== id) return;
        const c = r.x.get(xKey(i, j));
        if (c !== undefined && values[c]! > 0.5) enables.push(`${st.name} → ${seatLabel(d)}`);
      });
    });
    if (g.info.kind === "用工规则") {
      const i = ctx.staff.findIndex((p) => p.name === g.info.person);
      const want = RULE_REASON[id.split(":")[0]!];
      const mine: Seat[] = ctx.demand
        .filter((_, j) => {
          const c = r.x.get(xKey(i, j));
          return c !== undefined && values[c]! > 0.5;
        })
        .map((d) => ({ key: `${d.idx}-0`, d, assignee: g.info.person, via: "" }));
      for (const seat of mine) {
        const why = conflictReason(ctx.staff[i]!, seat, mine.filter((o) => o !== seat), ctx.rules);
        if (why && why === want) enables.push(`${g.info.person} → ${seatLabel(seat.d)}`);
      }
    }
    items.push({ ...g.info, enables });
  }
  items.sort((a, b) => b.weight - a.weight || a.person.localeCompare(b.person, "zh"));
  const total = items.reduce((sum, it) => sum + it.weight, 0);
  return {
    status: "relaxed",
    proved: s.proved,
    cost: total,
    items,
    note: s.proved
      ? `HiGHS 已证明：要排满全部 ${ctx.demand.reduce((sum, d) => sum + d.count, 0)} 人次，至少要放宽这 ${items.length} 条（代价 ${total}）；任何代价更低的放宽组合都排不满。`
      : `在时限内找到的最省放宽方案（${s.status}），尚未证明没有更省的。`,
  };
}

export function registerShiftOptimizer(app: Hono) {
  app.post("/api/lab/shift-optimize", async (c) => {
    const body = await c.req.json<{ sessionId?: string; skillId?: string }>().catch(() => null);
    if (!body || !isLabSession(body.sessionId)) return c.json({ error: "先导入员工表和班次需求表" }, 400);
    const skill = currentSkillRaw(body.skillId ?? "shift-desk");
    if (!skill) return c.json({ error: "找不到排班技能" }, 404);
    try {
      return c.json(await optimizeShifts(body.sessionId, skill.raw));
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : "求解失败" }, 500);
    }
  });
}
