/**
 * 办事程序底座：一条技能 = 一串有状态的处理阶段。
 * - 每个步骤调用一个阶段，阶段读上一步留下的状态、按本步 args 处理、把结果写回状态；
 *   删步、换顺序、改参数都会真实改变结果（不是每步重算一遍同一个函数）。
 * - 状态放在本次运行的 vars 里（键 `__desk:<skillId>`），不进 trace。
 * - 材料只从导入槽取；没有材料就抛 ProductDataMissingError，没有任何内置样例。
 */

import { getWorkbenchDataset } from "./workbenchDataset";
import { ProductDataMissingError, type ProductDataSlot, type ProductDataset } from "./productDataStore";
import { mapColumns, type ColumnSpec } from "./materialColumns";
import type { WorkGrid } from "./sheetEngine";

export type DeskArgs = Record<string, unknown>;

export type DeskEnv = {
  sessionId?: string;
  productWorkbench: boolean;
  query: string;
};

export type DeskPhaseResult = {
  detail: string;
  grid?: WorkGrid;
  guardFailed?: boolean;
  /** 只有出结论的阶段才给；办结说明与试跑结论都取最后一个 summary */
  summary?: string;
  /** 给模型步骤用的事实材料（不直接给客户看） */
  llmFacts?: string;
};

export type DeskPhase<S> = (state: S, args: DeskArgs, env: DeskEnv) => DeskPhaseResult;

export type TablesPaperMetric = { label: string; value: string; tone?: "ok" | "warn" | "bad" };
export type TablesPaperTable = { id: string; name: string; grid: WorkGrid; filename: string };

export type TablesPaper = {
  kind: "tables";
  skillId: string;
  tag: string;
  title: string;
  subtitle: string;
  metrics: TablesPaperMetric[];
  notes: string[];
  tables: TablesPaperTable[];
};

export type DeskProgram<S> = {
  skillId: string;
  guardCode: string;
  init(): S;
  phases: Record<string, DeskPhase<S>>;
  paper(state: S): TablesPaper | null;
};

export type DeskToolOutput = { content: unknown; isError?: boolean };

/** 步骤缺前置（例如删掉了「读入工单」却留着「分派」）——给客户看得懂的话 */
export class DeskStepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeskStepError";
  }
}

export function need<T>(value: T | null | undefined, stepName: string): T {
  if (value === null || value === undefined) {
    throw new DeskStepError(`这一步需要先完成「${stepName}」，请检查技能步骤顺序。`);
  }
  return value;
}

function stateKey(skillId: string) {
  return `__desk:${skillId}`;
}

export function deskEnvFromArgs(args: DeskArgs, query: string): DeskEnv {
  return {
    sessionId: typeof args.__sessionId === "string" ? args.__sessionId : undefined,
    productWorkbench: args.__productWorkbench === true,
    query,
  };
}

export function runDeskTool<S>(
  program: DeskProgram<S>,
  name: string,
  args: DeskArgs,
  vars: Record<string, unknown>,
  env: DeskEnv,
): DeskToolOutput | null {
  const phase = program.phases[name];
  if (!phase) return null;
  const key = stateKey(program.skillId);
  let state = vars[key] as S | undefined;
  if (!state) {
    state = program.init();
    vars[key] = state;
  }
  const failFast = args.failFast === true || args.guard === "fail";
  try {
    const out = phase(state, args, env);
    const meta = { skill: program.skillId, tool: name, guard: out.guardFailed ? (failFast ? "fail" : "warn") : undefined };
    if (out.guardFailed && failFast) {
      return {
        content: { error: out.detail, code: program.guardCode, detail: out.detail, meta },
        isError: true,
      };
    }
    return {
      content: {
        detail: out.detail,
        markdown: out.detail,
        ...(out.summary ? { summary: out.summary } : {}),
        ...(out.llmFacts ? { llmFacts: out.llmFacts } : {}),
        ...(out.grid ? { grid: out.grid } : {}),
        meta,
      },
    };
  } catch (err) {
    if (err instanceof ProductDataMissingError) {
      return { content: { error: err.message, code: "PRODUCT_DATA_MISSING", slot: err.slot }, isError: true };
    }
    if (err instanceof Error) {
      return { content: { error: err.message, detail: err.message }, isError: true };
    }
    throw err;
  }
}

/** 文书用：按技能步骤重放一遍（跳过模型步骤），守卫 fail 时与运行时一样停下 */
export function runDeskPipeline<S>(
  program: DeskProgram<S>,
  steps: { tool: string; args?: DeskArgs }[],
  env: DeskEnv,
): S | null {
  const vars: Record<string, unknown> = {};
  let ran = 0;
  for (const step of steps) {
    if (!program.phases[step.tool]) continue;
    const out = runDeskTool(program, step.tool, { ...(step.args ?? {}) }, vars, env);
    ran += 1;
    if (out?.isError) {
      const code = (out.content as { code?: string }).code;
      if (code !== program.guardCode) return null;
      break;
    }
  }
  if (!ran) return null;
  return (vars[stateKey(program.skillId)] as S | undefined) ?? null;
}

/* ───────────── 材料 ───────────── */

export type MaterialRows = {
  title: string;
  rows: { rowNo: number; get(canon: string): string }[];
  present: Set<string>;
};

export function loadMaterial(env: DeskEnv, slot: ProductDataSlot, label: string, specs: ColumnSpec[]): MaterialRows {
  const ds: ProductDataset | null = getWorkbenchDataset(env.sessionId, slot);
  if (!ds?.rows.length) {
    throw new ProductDataMissingError(slot, `请先导入「${label}」后再继续办理。`);
  }
  const sources = mapColumns(ds.columns, specs);
  const index = new Map<string, number>();
  specs.forEach((spec, i) => {
    const src = sources[i];
    if (src) index.set(spec.canon, ds.columns.indexOf(src));
  });
  return {
    title: ds.title?.trim() || label,
    present: new Set(index.keys()),
    rows: ds.rows
      .map((cells, i) => ({
        rowNo: i + 2,
        get: (canon: string) => {
          const j = index.get(canon);
          return j === undefined || j < 0 ? "" : String(cells[j] ?? "").trim();
        },
      }))
      .filter((r) => specs.some((s) => r.get(s.canon))),
  };
}

/* ───────────── 参数 ───────────── */

export function argNum(args: DeskArgs, key: string, fallback: number): number {
  const v = args[key];
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export function argStr(args: DeskArgs, key: string, fallback: string): string {
  const v = args[key];
  return typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : fallback;
}

export function argBool(args: DeskArgs, key: string, fallback: boolean): boolean {
  const v = args[key];
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

export function argList(args: DeskArgs, key: string, fallback: string[] = []): string[] {
  const v = args[key];
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(/[,，、|]/).map((x) => x.trim()).filter(Boolean);
  if (typeof v === "number") return [String(v)];
  return fallback;
}

export function argObj(args: DeskArgs, key: string): Record<string, unknown> {
  const v = args[key];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function argObjList(args: DeskArgs, key: string): Record<string, unknown>[] {
  const v = args[key];
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

/* ───────────── 时间（按分钟计，与运行机器时区无关） ───────────── */

const DAY = 1440;

/** 「2026-10-12 09:30」「2026/10/12 9:30」「2026-10-12T09:30:00」「2026年10月12日 9:30」 → 绝对分钟 */
export function parseDateTime(text: string): number | null {
  const s = text.trim();
  if (!s) return null;
  const m = s.match(
    /^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?(?:[ T]+(\d{1,2})[:：时](\d{1,2})(?:[:：分](\d{1,2})秒?)?)?/,
  );
  if (!m) return null;
  const [y, mo, d, h = "0", mi = "0"] = [m[1], m[2], m[3], m[4], m[5]];
  const ms = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (!Number.isFinite(ms)) return null;
  const check = new Date(ms);
  if (check.getUTCMonth() !== Number(mo) - 1 || check.getUTCDate() !== Number(d)) return null;
  if (Number(h) > 23 || Number(mi) > 59) return null;
  return Math.round(ms / 60000);
}

export function parseDate(text: string): number | null {
  const abs = parseDateTime(text.trim().split(/[ T]/)[0] ?? "");
  return abs === null ? null : Math.floor(abs / DAY);
}

/** 「09:00」「9:30」「21点」 → 当天分钟 */
export function parseClock(text: string): number | null {
  const s = String(text ?? "").trim();
  const m = s.match(/^(\d{1,2})(?:[:：点时](\d{1,2})?)?分?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

export function dayIndex(abs: number) {
  return Math.floor(abs / DAY);
}

export function dayKey(day: number): string {
  const d = new Date(day * DAY * 60000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** 周一=1 … 周日=7 */
export function weekdayOf(day: number): number {
  const w = new Date(day * DAY * 60000).getUTCDay();
  return w === 0 ? 7 : w;
}

export const WEEKDAY_NAMES = ["", "周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/** ISO 周的周一（日序号） */
export function weekStartOf(day: number): number {
  return day - (weekdayOf(day) - 1);
}

export function fmtDateTime(abs: number): string {
  const day = dayIndex(abs);
  const min = abs - day * DAY;
  return `${dayKey(day)} ${fmtClock(min)}`;
}

export function fmtClock(min: number): string {
  const m = ((min % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function fmtMinutes(min: number): string {
  const m = Math.round(Math.abs(min));
  const sign = min < 0 ? "-" : "";
  if (m < 60) return `${sign}${m} 分钟`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${sign}${h} 小时 ${r} 分` : `${sign}${h} 小时`;
}

export function fmtHours(hours: number): string {
  const r = Math.round(hours * 100) / 100;
  return Number.isInteger(r) ? String(r) : r.toFixed(r * 10 === Math.round(r * 10) ? 1 : 2);
}

export function fmtMoney(n: number): string {
  return (Math.round(n * 100) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtPct(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;
}

/* ───────────── 工作日历 ───────────── */

export type WorkCalendar = {
  /** 当天开始/结束（分钟） */
  start: number;
  end: number;
  workdays: Set<number>;
  holidays: Set<string>;
  /** 调休上班日（覆盖 workdays 与 holidays） */
  extraWorkdays: Set<string>;
};

export function isWorkday(cal: WorkCalendar, day: number): boolean {
  const key = dayKey(day);
  if (cal.extraWorkdays.has(key)) return true;
  if (cal.holidays.has(key)) return false;
  return cal.workdays.has(weekdayOf(day));
}

const MAX_CAL_DAYS = 1200;

/** [a, b) 之间落在工作时间里的分钟数 */
export function businessMinutesBetween(a: number, b: number, cal: WorkCalendar | null): number {
  if (b <= a) return 0;
  if (!cal) return b - a;
  let total = 0;
  const first = dayIndex(a);
  const last = Math.min(dayIndex(b), first + MAX_CAL_DAYS);
  for (let d = first; d <= last; d += 1) {
    if (!isWorkday(cal, d)) continue;
    const ws = d * DAY + cal.start;
    const we = d * DAY + cal.end;
    total += Math.max(0, Math.min(b, we) - Math.max(a, ws));
  }
  return total;
}

/** 从 a 起数 minutes 个工作分钟后的时刻 */
export function addBusinessMinutes(a: number, minutes: number, cal: WorkCalendar | null): number {
  if (!cal) return a + minutes;
  let remaining = minutes;
  let d = dayIndex(a);
  for (let i = 0; i < MAX_CAL_DAYS; i += 1, d += 1) {
    if (!isWorkday(cal, d)) continue;
    const ws = Math.max(a, d * DAY + cal.start);
    const we = d * DAY + cal.end;
    if (we <= ws) continue;
    if (remaining <= we - ws) return ws + remaining;
    remaining -= we - ws;
  }
  return a + minutes;
}

/* ───────────── 文本 ───────────── */

function bigrams(text: string): Set<string> {
  const s = text.replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
  const out = new Set<string>();
  if (s.length === 1) out.add(s);
  for (let i = 0; i < s.length - 1; i += 1) out.add(s.slice(i, i + 2));
  return out;
}

/** 二元组 Jaccard 相似度 0..1 */
export function textSimilarity(a: string, b: string): number {
  const x = bigrams(a);
  const y = bigrams(b);
  if (!x.size || !y.size) return 0;
  let inter = 0;
  for (const g of x) if (y.has(g)) inter += 1;
  return inter / (x.size + y.size - inter);
}

export function clip(text: string, max: number): string {
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function countBy<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
