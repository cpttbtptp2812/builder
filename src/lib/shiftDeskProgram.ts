/**
 * 门店排班引擎（约束排班）。
 * 材料：员工表（staff-roster）+ 班次需求表（shift-demand），全部来自客户导入。
 * 硬约束：技能、可上班星期/时段、请假、同班不重复、时段不重叠、两班间休息、每日班数与工时、周工时上限、连续上班天数。
 * 算法：最难排的班先排（可选人最少）→ 一层调换补缺 → 逐条复核 → 工时成本核算。
 */

import {
  argBool,
  argList,
  argNum,
  argObj,
  argStr,
  clip,
  countBy,
  dayKey,
  fmtClock,
  fmtHours,
  fmtMoney,
  fmtPct,
  loadMaterial,
  need,
  parseClock,
  parseDate,
  weekStartOf,
  weekdayOf,
  WEEKDAY_NAMES,
  type DeskArgs,
  type DeskEnv,
  type DeskPhaseResult,
  type DeskProgram,
  type TablesPaper,
} from "./deskProgramKit";
import type { WorkGrid } from "./sheetEngine";
import { DEMAND_COLUMNS, SHIFT_DESK_ID, SHIFT_DESK_META, STAFF_COLUMNS } from "./shiftDeskMeta";

const DAY = 1440;

export type Staff = {
  rowNo: number;
  name: string;
  skills: string[];
  type: string;
  capRaw: number | null;
  weeklyCap: number;
  dailyCap: number;
  days: Set<number>;
  earliest: number | null;
  latest: number | null;
  rate: number | null;
  unavailable: Set<number>;
  valid: boolean;
};

export type Demand = {
  idx: number;
  rowNo: number;
  date: number;
  shift: string;
  start: number;
  end: number;
  absStart: number;
  absEnd: number;
  role: string;
  count: number;
  paid: number;
  valid: boolean;
};

export type Seat = { key: string; d: Demand; assignee: string | null; via: "初排" | "调换" | "最优解" | "" };

export type Rules = {
  minRestHours: number;
  maxDailyHours: number;
  maxShiftsPerDay: number;
  maxConsecutiveDays: number;
  weeklyCapByType: Record<string, number>;
  dailyCapByType: Record<string, number>;
  defaultWeeklyCap: number;
  overtimeAfterWeeklyHours: number;
  overtimeRate: number;
  breakAfterHours: number;
  breakMinutes: number;
  nightStart: number;
  nightEnd: number;
  nightPremium: number;
  /** 夜班时段里至少有多少分钟才算一个夜班 */
  nightShiftMinMinutes: number;
  /** 每周最多几个夜班，0 = 不限 */
  maxNightShiftsPerWeek: number;
  /** 每周（周一到周日）至少休息几天 */
  minRestDaysPerWeek: number;
  holidayPayDays: Set<number>;
  holidayPayRate: number;
  minWeeklyHoursByType: Record<string, number>;
};

type PersonHours = {
  name: string;
  shifts: number;
  hours: number;
  overtime: number;
  night: number;
  nightShifts: number;
  weekendShifts: number;
  holidayHours: number;
  cost: number;
  peakWeek: number;
  weeks: number;
  minWeekly: number | null;
  days: number[];
};

export type ShiftDeskState = {
  staff: Staff[] | null;
  staffTitle: string;
  demand: Demand[] | null;
  demandTitle: string;
  dataIssues: { table: string; rowNo: number; who: string; problem: string }[];
  rules: Rules | null;
  eligible: Map<number, string[]> | null;
  rejectWhy: Map<number, Map<string, string>> | null;
  seats: Seat[] | null;
  assignDone: boolean;
  swaps: { seat: string; moved: string; from: string; to: string; cover: string }[];
  violations: { who: string; seat: string; problem: string }[] | null;
  hours: PersonHours[] | null;
  gaps: { d: Demand; missing: number; reason: string }[] | null;
  roleMerges: { from: string; to: string; where: string }[];
  keyholderMisses: { day: number; when: string; people: string[] }[] | null;
  fairness: { spread: number; under: string[]; weekendSpread: number } | null;
  guardNotes: string[];
  tables: { id: string; name: string; grid: WorkGrid; filename: string }[];
  summary: string | null;
};

/* ───────────── 解析 ───────────── */

const WD: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7, 天: 7, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7 };
const ALL_DAYS = () => new Set([1, 2, 3, 4, 5, 6, 7]);

function parseWeekdays(text: string): Set<number> | null {
  const raw = text.trim();
  if (!raw || /每天|全周|不限|全部|任意|all/i.test(raw)) return ALL_DAYS();
  const s = raw.replace(/星期|礼拜|周/g, "");
  const out = new Set<number>();
  for (const part of s.split(/[|,，、;；\s]+/).filter(Boolean)) {
    const m = part.match(/^([一二三四五六日天1-7])\s*(?:至|到|-|~|～|—)\s*([一二三四五六日天1-7])$/);
    if (m) {
      const a = WD[m[1]!]!;
      const b = WD[m[2]!]!;
      for (let i = 0, d = a; i < 7; i += 1, d = (d % 7) + 1) {
        out.add(d);
        if (d === b) break;
      }
      continue;
    }
    for (const ch of part) {
      const d = WD[ch];
      if (!d) return null;
      out.add(d);
    }
  }
  return out.size ? out : null;
}

function parseDayList(text: string): { days: Set<number>; bad: string[] } {
  const days = new Set<number>();
  const bad: string[] = [];
  for (const part of text.split(/[|,，、;；\s]+/).filter(Boolean)) {
    const range = part.split(/~|～|至|到/);
    if (range.length === 2) {
      const a = parseDate(range[0]!);
      const b = parseDate(range[1]!);
      if (a === null || b === null || b < a || b - a > 366) {
        bad.push(part);
        continue;
      }
      for (let d = a; d <= b; d += 1) days.add(d);
      continue;
    }
    const d = parseDate(part);
    if (d === null) bad.push(part);
    else days.add(d);
  }
  return { days, bad };
}

export function fmtDay(day: number) {
  return `${dayKey(day).slice(5)}（${WEEKDAY_NAMES[weekdayOf(day)]}）`;
}

export function seatLabel(d: Demand) {
  return `${fmtDay(d.date)} ${d.shift || "班"} ${fmtClock(d.start)}-${fmtClock(d.end)} ${d.role}`;
}

function putTable(state: ShiftDeskState, id: string, name: string, grid: WorkGrid) {
  const row = { id, name, grid, filename: `${name}.csv` };
  const at = state.tables.findIndex((t) => t.id === id);
  if (at >= 0) state.tables[at] = row;
  else state.tables.push(row);
}

/* ───────────── 读入与检查 ───────────── */

function staffPhase(state: ShiftDeskState, _args: DeskArgs, env: DeskEnv): DeskPhaseResult {
  const label = SHIFT_DESK_META.requirements[0]!.label;
  const mat = loadMaterial(env, "staff-roster", label, STAFF_COLUMNS);
  const staff: Staff[] = [];
  const seen = new Set<string>();
  for (const r of mat.rows) {
    const name = r.get("员工");
    const problems: string[] = [];
    if (!name) problems.push("缺员工姓名");
    else if (seen.has(name)) problems.push("员工重名，只保留第一行");
    const skills = r.get("岗位技能").split(/[|、,，/;；]+/).map((x) => x.trim()).filter(Boolean);
    if (!skills.length) problems.push("没填岗位技能");
    const days = parseWeekdays(r.get("可上班星期"));
    if (!days) problems.push(`看不懂可上班星期「${r.get("可上班星期")}」`);
    const earliestRaw = r.get("最早");
    const latestRaw = r.get("最晚");
    const earliest = earliestRaw ? parseClock(earliestRaw) : null;
    const latest = latestRaw ? parseClock(latestRaw) : null;
    if (earliestRaw && earliest === null) problems.push(`看不懂最早时间「${earliestRaw}」`);
    if (latestRaw && latest === null) problems.push(`看不懂最晚时间「${latestRaw}」`);
    if (earliest !== null && latest !== null && latest <= earliest) problems.push("最晚不晚于最早");
    const rateRaw = r.get("时薪");
    const rate = rateRaw ? Number(rateRaw.replace(/[¥￥元,\s]/g, "")) : null;
    if (rateRaw && !Number.isFinite(rate)) problems.push(`看不懂时薪「${rateRaw}」`);
    const capRaw = r.get("周工时上限") ? Number(r.get("周工时上限")) : null;
    if (capRaw !== null && !(Number.isFinite(capRaw) && capRaw > 0)) problems.push(`看不懂周工时上限「${r.get("周工时上限")}」`);
    const leave = parseDayList(r.get("不可用日期"));
    if (leave.bad.length) problems.push(`看不懂请假日期「${leave.bad.join("、")}」`);
    for (const p of problems) state.dataIssues.push({ table: label, rowNo: r.rowNo, who: name || "（空）", problem: p });
    const valid = !!name && !seen.has(name) && skills.length > 0 && !!days;
    if (name) seen.add(name);
    if (!valid) continue;
    staff.push({
      rowNo: r.rowNo,
      name,
      skills,
      type: r.get("用工类型") || "未填",
      capRaw: capRaw !== null && Number.isFinite(capRaw) && capRaw > 0 ? capRaw : null,
      weeklyCap: capRaw ?? 40,
      dailyCap: 10,
      days: days!,
      earliest,
      latest,
      rate: rate !== null && Number.isFinite(rate) ? rate : null,
      unavailable: leave.days,
      valid,
    });
  }
  state.staff = staff;
  state.staffTitle = mat.title;
  const roles = countBy(staff.flatMap((s) => s.skills.map((k) => ({ k }))), (x) => x.k).map(([k, n]) => `${k} ${n} 人`).join("、");
  if (!staff.length) return { detail: `「${mat.title}」没有可排的员工（姓名、岗位技能、可上班星期都要能看懂）。`, guardFailed: true };
  return { detail: `读入「${mat.title}」${staff.length} 名员工，会做：${roles}。` };
}

function demandPhase(state: ShiftDeskState, args: DeskArgs, env: DeskEnv): DeskPhaseResult {
  const label = SHIFT_DESK_META.requirements[1]!.label;
  const mat = loadMaterial(env, "shift-demand", label, DEMAND_COLUMNS);
  const maxSeats = argNum(args, "maxSeats", 5000);
  const demand: Demand[] = mat.rows.map((r, idx) => {
    const problems: string[] = [];
    const date = parseDate(r.get("日期"));
    if (date === null) problems.push(`看不懂日期「${r.get("日期")}」`);
    const start = parseClock(r.get("开始"));
    const endRaw = parseClock(r.get("结束"));
    if (start === null) problems.push(`看不懂开始时间「${r.get("开始")}」`);
    if (endRaw === null) problems.push(`看不懂结束时间「${r.get("结束")}」`);
    const count = Number(r.get("人数"));
    if (!(Number.isInteger(count) && count > 0)) problems.push(`人数「${r.get("人数")}」不是正整数`);
    const role = r.get("岗位");
    if (!role) problems.push("缺岗位");
    const end = start !== null && endRaw !== null ? (endRaw <= start ? endRaw + DAY : endRaw) : 0;
    if (start !== null && endRaw !== null && end - start > 16 * 60) problems.push("班长超过 16 小时");
    for (const p of problems) state.dataIssues.push({ table: label, rowNo: r.rowNo, who: `${r.get("日期")} ${r.get("班次")}`.trim(), problem: p });
    const ok = !problems.length;
    return {
      idx,
      rowNo: r.rowNo,
      date: date ?? 0,
      shift: r.get("班次"),
      start: start ?? 0,
      end,
      absStart: (date ?? 0) * DAY + (start ?? 0),
      absEnd: (date ?? 0) * DAY + end,
      role,
      count: ok ? count : 0,
      paid: (end - (start ?? 0)) / 60,
      valid: ok,
    };
  });
  state.demand = demand;
  state.demandTitle = mat.title;
  const good = demand.filter((d) => d.valid);
  const seats = good.reduce((s, d) => s + d.count, 0);
  if (seats > maxSeats) return { detail: `需要排 ${seats} 人次，超过单次上限 ${maxSeats}，请按周分批导入。`, guardFailed: true };
  if (!good.length) return { detail: `「${mat.title}」没有能看懂的班次。`, guardFailed: true };
  const dates = good.map((d) => d.date);
  const from = Math.min(...dates);
  const to = Math.max(...dates);
  return {
    detail: `读入「${mat.title}」${good.length} 个班次，共需 ${seats} 人次，日期 ${fmtDay(from)} 至 ${fmtDay(to)}（${to - from + 1} 天）。`,
  };
}

function validate(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const staff = need(state.staff, "读入员工");
  const demand = need(state.demand, "读入班次需求");
  const maxBadRatio = argNum(args, "maxBadRatio", 0.1);
  const badDemand = demand.filter((d) => !d.valid).length;
  const ratio = demand.length ? badDemand / demand.length : 1;
  const skills = new Set(staff.flatMap((s) => s.skills));
  const orphanRoles = [...new Set(demand.filter((d) => d.valid && !skills.has(d.role)).map((d) => d.role))];
  for (const role of orphanRoles) state.dataIssues.push({ table: "班次需求表", rowNo: 0, who: role, problem: `没有员工会「${role}」` });
  const grid: WorkGrid = {
    columns: ["材料", "行号", "对象", "问题"],
    rows: state.dataIssues.map((i) => [i.table, i.rowNo ? String(i.rowNo) : "", i.who, i.problem]),
  };
  if (ratio > maxBadRatio) {
    return {
      detail: `${badDemand} 个班次（${fmtPct(ratio)}）日期、时间或人数看不懂，超过允许的 ${fmtPct(maxBadRatio)}，请先修正班次需求表。`,
      guardFailed: true,
      grid,
    };
  }
  if (!state.dataIssues.length) return { detail: "员工表和班次需求表都能看懂，没有发现问题。" };
  return {
    detail:
      `发现 ${state.dataIssues.length} 处问题，看不懂的行不参与排班。` +
      (orphanRoles.length ? `没有人会的岗位：${orphanRoles.join("、")}。` : ""),
    grid,
  };
}

function rolesPhase(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const staff = need(state.staff, "读入员工");
  const demand = need(state.demand, "读入班次需求");
  const aliases = new Map(
    Object.entries(argObj(args, "aliases")).map(([from, to]) => [from.trim(), String(to ?? "").trim()] as const).filter(([f, t]) => f && t),
  );
  const ignoreSuffix = argList(args, "ignoreSuffix", []);
  const canon = (role: string) => {
    let r = role.trim();
    if (aliases.has(r)) return aliases.get(r)!;
    for (const suffix of ignoreSuffix) {
      if (r.length > suffix.length && r.endsWith(suffix)) {
        r = r.slice(0, -suffix.length);
        break;
      }
    }
    return aliases.get(r) ?? r;
  };
  const merges = new Map<string, { from: string; to: string; where: Set<string> }>();
  const note = (from: string, to: string, where: string) => {
    if (from === to) return;
    const key = `${from}→${to}`;
    if (!merges.has(key)) merges.set(key, { from, to, where: new Set() });
    merges.get(key)!.where.add(where);
  };
  for (const s of staff) {
    s.skills = [...new Set(s.skills.map((k) => {
      const c = canon(k);
      note(k, c, "员工表");
      return c;
    }))];
  }
  for (const d of demand) {
    const c = canon(d.role);
    note(d.role, c, "班次需求表");
    d.role = c;
  }
  state.roleMerges = [...merges.values()].map((m) => ({ from: m.from, to: m.to, where: [...m.where].join("、") }));
  const roles = [...new Set(demand.filter((d) => d.valid).map((d) => d.role))];
  return {
    detail: state.roleMerges.length
      ? `统一了 ${state.roleMerges.length} 种岗位写法（${state.roleMerges.slice(0, 4).map((m) => `${m.from}→${m.to}`).join("、")}${state.roleMerges.length > 4 ? " 等" : ""}），需求涉及岗位：${roles.join("、")}。`
      : `岗位写法一致，需求涉及岗位：${roles.join("、")}。`,
    grid: state.roleMerges.length
      ? { columns: ["原写法", "统一为", "出现在"], rows: state.roleMerges.map((m) => [m.from, m.to, m.where]) }
      : undefined,
  };
}

function rulesPhase(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const staff = need(state.staff, "读入员工");
  const demand = need(state.demand, "读入班次需求");
  const positiveMap = (key: string) =>
    Object.fromEntries(
      Object.entries(argObj(args, key)).map(([k, v]) => [k, Number(v)]).filter(([, v]) => Number.isFinite(v as number) && (v as number) > 0),
    ) as Record<string, number>;
  const capByType = positiveMap("weeklyCapByType");
  const dailyByType = positiveMap("dailyCapByType");
  const nightStart = parseClock(argStr(args, "nightStart", "22:00")) ?? 22 * 60;
  const nightEnd = parseClock(argStr(args, "nightEnd", "06:00")) ?? 6 * 60;
  const rules: Rules = {
    minRestHours: argNum(args, "minRestHours", 11),
    maxDailyHours: argNum(args, "maxDailyHours", 10),
    maxShiftsPerDay: Math.max(1, Math.round(argNum(args, "maxShiftsPerDay", 1))),
    maxConsecutiveDays: Math.max(1, Math.round(argNum(args, "maxConsecutiveDays", 6))),
    weeklyCapByType: capByType,
    dailyCapByType: dailyByType,
    defaultWeeklyCap: argNum(args, "defaultWeeklyCap", 40),
    overtimeAfterWeeklyHours: argNum(args, "overtimeAfterWeeklyHours", 40),
    overtimeRate: argNum(args, "overtimeRate", 1.5),
    breakAfterHours: argNum(args, "breakAfterHours", 6),
    breakMinutes: argNum(args, "breakMinutes", 30),
    nightStart,
    nightEnd,
    nightPremium: argNum(args, "nightPremium", 0),
    nightShiftMinMinutes: argNum(args, "nightShiftMinMinutes", 120),
    maxNightShiftsPerWeek: Math.max(0, Math.round(argNum(args, "maxNightShiftsPerWeek", 0))),
    minRestDaysPerWeek: Math.min(6, Math.max(0, Math.round(argNum(args, "minRestDaysPerWeek", 1)))),
    holidayPayDays: new Set(argList(args, "holidayPayDays").map((d) => parseDate(d)).filter((d): d is number => d !== null)),
    holidayPayRate: argNum(args, "holidayPayRate", 3),
    minWeeklyHoursByType: positiveMap("minWeeklyHoursByType"),
  };
  state.rules = rules;
  for (const s of staff) {
    const typeCap = Object.entries(capByType).find(([k]) => s.type.includes(k))?.[1];
    s.weeklyCap = s.capRaw ?? typeCap ?? rules.defaultWeeklyCap;
    const typeDaily = Object.entries(dailyByType).find(([k]) => s.type.includes(k))?.[1];
    s.dailyCap = Math.min(rules.maxDailyHours, typeDaily ?? rules.maxDailyHours);
  }
  for (const d of demand) {
    const hours = (d.end - d.start) / 60;
    d.paid = hours > rules.breakAfterHours ? hours - rules.breakMinutes / 60 : hours;
  }
  const caps = Object.entries(capByType).map(([k, v]) => `${k} ${v} 小时`).join("、");
  const daily = Object.entries(dailyByType).map(([k, v]) => `${k}每天 ≤ ${v} 小时`).join("、");
  return {
    detail:
      `两班之间至少休息 ${rules.minRestHours} 小时，每天最多 ${rules.maxShiftsPerDay} 个班、${rules.maxDailyHours} 小时，最多连上 ${rules.maxConsecutiveDays} 天；` +
      `周工时上限${caps ? ` ${caps}` : ""}（未填按 ${rules.defaultWeeklyCap} 小时，员工表里填了的以员工表为准）${daily ? `，${daily}` : ""}；` +
      `每周至少休 ${rules.minRestDaysPerWeek} 天` +
      (rules.maxNightShiftsPerWeek ? `、夜班每周最多 ${rules.maxNightShiftsPerWeek} 个` : "") +
      `；班长超过 ${rules.breakAfterHours} 小时扣 ${rules.breakMinutes} 分钟用餐；周工时超过 ${rules.overtimeAfterWeeklyHours} 小时按 ${rules.overtimeRate} 倍计加班` +
      (rules.holidayPayDays.size ? `，${rules.holidayPayDays.size} 个法定节假日按 ${rules.holidayPayRate} 倍计薪` : "") +
      "。",
  };
}

export function staticReason(s: Staff, d: Demand): string | null {
  if (!s.skills.includes(d.role)) return `不会${d.role}`;
  if (s.unavailable.has(d.date) || (d.end > DAY && s.unavailable.has(d.date + 1))) return "当天请假";
  if (!s.days.has(weekdayOf(d.date))) return `${WEEKDAY_NAMES[weekdayOf(d.date)]}不上班`;
  if (s.earliest !== null && d.start < s.earliest) return `最早 ${fmtClock(s.earliest)} 才能到`;
  if (s.latest !== null && d.end > s.latest && s.latest !== DAY) return `最晚只能到 ${fmtClock(s.latest)}`;
  return null;
}

function eligibility(state: ShiftDeskState): DeskPhaseResult {
  const staff = need(state.staff, "读入员工");
  const demand = need(state.demand, "读入班次需求").filter((d) => d.valid);
  const eligible = new Map<number, string[]>();
  const why = new Map<number, Map<string, string>>();
  for (const d of demand) {
    const ok: string[] = [];
    const no = new Map<string, string>();
    for (const s of staff) {
      const r = staticReason(s, d);
      if (r) no.set(s.name, r);
      else ok.push(s.name);
    }
    eligible.set(d.idx, ok);
    why.set(d.idx, no);
  }
  state.eligible = eligible;
  state.rejectWhy = why;
  const tight = demand
    .map((d) => ({ d, n: eligible.get(d.idx)!.length }))
    .sort((a, b) => a.n / a.d.count - b.n / b.d.count)
    .filter((x) => x.n < x.d.count * 2)
    .slice(0, 3);
  const none = demand.filter((d) => !eligible.get(d.idx)!.length).length;
  return {
    detail:
      `按技能、可上班星期、时段、请假筛完：${demand.length} 个班次里 ${none} 个没有任何人能上。` +
      (tight.length ? `最难排：${tight.map((x) => `${seatLabel(x.d)}（要 ${x.d.count} 人，可选 ${x.n} 人）`).join("；")}。` : ""),
  };
}

/* ───────────── 约束 ───────────── */

export function conflictReason(s: Staff, seat: Seat, mine: Seat[], rules: Rules): string | null {
  const d = seat.d;
  for (const o of mine) {
    if (o.d.idx === d.idx) return "同一班次已排";
    if (o.d.absStart < d.absEnd && d.absStart < o.d.absEnd) return "时段冲突";
    const gap = o.d.absEnd <= d.absStart ? d.absStart - o.d.absEnd : o.d.absStart - d.absEnd;
    const sameDaySplit = o.d.date === d.date && rules.maxShiftsPerDay > 1;
    if (!sameDaySplit && gap < rules.minRestHours * 60) return "两班之间休息不足";
  }
  const sameDay = mine.filter((o) => o.d.date === d.date);
  if (sameDay.length >= rules.maxShiftsPerDay) return "当天已有班";
  if (sameDay.reduce((sum, o) => sum + o.d.paid, 0) + d.paid > s.dailyCap + 1e-9) return "超出每日工时上限";
  const week = weekStartOf(d.date);
  const weekHours = mine.filter((o) => weekStartOf(o.d.date) === week).reduce((sum, o) => sum + o.d.paid, 0) + d.paid;
  if (weekHours > s.weeklyCap + 1e-9) return "超出周工时上限";
  const days = new Set(mine.map((o) => o.d.date));
  days.add(d.date);
  let run = 1;
  for (let x = d.date - 1; days.has(x); x -= 1) run += 1;
  for (let x = d.date + 1; days.has(x); x += 1) run += 1;
  if (run > rules.maxConsecutiveDays) return "连续上班超限";
  const weekDays = [...days].filter((x) => weekStartOf(x) === week).length;
  if (weekDays > 7 - rules.minRestDaysPerWeek) return "每周休息日不足";
  if (rules.maxNightShiftsPerWeek && isNightShift(d, rules)) {
    const nights = mine.filter((o) => weekStartOf(o.d.date) === week && isNightShift(o.d, rules)).length;
    if (nights >= rules.maxNightShiftsPerWeek) return "本周夜班次数已满";
  }
  return null;
}

export function isNightShift(d: Demand, rules: Rules): boolean {
  return nightMinutes(d, rules) >= rules.nightShiftMinMinutes;
}

function seatsBy(seats: Seat[]): Map<string, Seat[]> {
  const m = new Map<string, Seat[]>();
  for (const s of seats) {
    if (!s.assignee) continue;
    if (!m.has(s.assignee)) m.set(s.assignee, []);
    m.get(s.assignee)!.push(s);
  }
  return m;
}

function hoursOf(list: Seat[] | undefined) {
  return (list ?? []).reduce((sum, s) => sum + s.d.paid, 0);
}

function rankCandidates(cands: Staff[], mine: Map<string, Seat[]>, tieBreak: string): Staff[] {
  const rate = (s: Staff) => s.rate ?? Number.MAX_SAFE_INTEGER;
  return cands.slice().sort((a, b) => {
    const ha = hoursOf(mine.get(a.name));
    const hb = hoursOf(mine.get(b.name));
    if (tieBreak === "cost") return rate(a) - rate(b) || ha - hb || a.rowNo - b.rowNo;
    return ha / a.weeklyCap - hb / b.weeklyCap || rate(a) - rate(b) || a.rowNo - b.rowNo;
  });
}

/* ───────────── 排班 ───────────── */

function assign(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const rules = need(state.rules, "设定用工规则");
  const eligible = need(state.eligible, "筛可上人选");
  const staff = need(state.staff, "读入员工");
  const demand = need(state.demand, "读入班次需求").filter((d) => d.valid);
  const order = argStr(args, "order", "scarcity");
  const tieBreak = argStr(args, "tieBreak", "fair");
  const byName = new Map(staff.map((s) => [s.name, s]));
  const seats: Seat[] = demand.flatMap((d) =>
    Array.from({ length: d.count }, (_, k) => ({ key: `${d.idx}-${k}`, d, assignee: null, via: "" as const })),
  );
  const sorted =
    order === "chronological"
      ? seats.slice().sort((a, b) => a.d.absStart - b.d.absStart || a.d.idx - b.d.idx)
      : seats.slice().sort(
          (a, b) =>
            eligible.get(a.d.idx)!.length / a.d.count - eligible.get(b.d.idx)!.length / b.d.count ||
            a.d.absStart - b.d.absStart ||
            a.d.idx - b.d.idx,
        );
  const mine = new Map<string, Seat[]>();
  for (const seat of sorted) {
    const cands = eligible
      .get(seat.d.idx)!
      .map((n) => byName.get(n)!)
      .filter((s) => !conflictReason(s, seat, mine.get(s.name) ?? [], rules));
    const pick = rankCandidates(cands, mine, tieBreak)[0];
    if (!pick) continue;
    seat.assignee = pick.name;
    seat.via = "初排";
    if (!mine.has(pick.name)) mine.set(pick.name, []);
    mine.get(pick.name)!.push(seat);
  }
  state.seats = seats;
  state.assignDone = true;
  const filled = seats.filter((s) => s.assignee).length;
  return {
    detail:
      `按「${order === "chronological" ? "时间先后" : "最难排的班先排"}」、${tieBreak === "cost" ? "同等条件先用时薪低的" : "同等条件先给工时少的"}，` +
      `${seats.length} 人次排上 ${filled} 人次，还缺 ${seats.length - filled} 人次。`,
  };
}

function repair(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const rules = need(state.rules, "设定用工规则");
  const seats = need(state.seats, "初排");
  const eligible = need(state.eligible, "筛可上人选");
  const staff = need(state.staff, "读入员工");
  const byName = new Map(staff.map((s) => [s.name, s]));
  const maxSwaps = argNum(args, "maxSwaps", 200);
  const tieBreak = argStr(args, "tieBreak", "fair");
  let direct = 0;
  const open = seats.filter((s) => !s.assignee).sort((a, b) => a.d.absStart - b.d.absStart);
  for (const seat of open) {
    if (state.swaps.length >= maxSwaps) break;
    const mine = seatsBy(seats);
    const cands = rankCandidates(eligible.get(seat.d.idx)!.map((n) => byName.get(n)!), mine, tieBreak);
    let done = false;
    for (const x of cands) {
      const xs = mine.get(x.name) ?? [];
      if (!conflictReason(x, seat, xs, rules)) {
        seat.assignee = x.name;
        seat.via = "调换";
        direct += 1;
        done = true;
        break;
      }
      for (const give of xs) {
        const rest = xs.filter((s) => s !== give);
        if (conflictReason(x, seat, rest, rules)) continue;
        const takers = rankCandidates(
          eligible.get(give.d.idx)!.filter((n) => n !== x.name).map((n) => byName.get(n)!),
          mine,
          tieBreak,
        );
        const y = takers.find((t) => !conflictReason(t, give, mine.get(t.name) ?? [], rules));
        if (!y) continue;
        give.assignee = y.name;
        give.via = "调换";
        seat.assignee = x.name;
        seat.via = "调换";
        state.swaps.push({ seat: seatLabel(seat.d), moved: x.name, from: seatLabel(give.d), to: y.name, cover: seatLabel(give.d) });
        done = true;
        break;
      }
      if (done) break;
    }
  }
  const left = seats.filter((s) => !s.assignee).length;
  return {
    detail:
      state.swaps.length || direct
        ? `调换 ${state.swaps.length} 次${direct ? `、直接补上 ${direct} 个` : ""}，补上 ${state.swaps.length + direct} 个缺口，还缺 ${left} 人次。`
        : `缺口 ${left} 人次都试过一层调换，换不出来。`,
    grid: state.swaps.length
      ? {
          columns: ["补上的班", "调过去的人", "原来的班", "原来的班改由"],
          rows: state.swaps.map((s) => [s.seat, s.moved, s.from, s.to]),
        }
      : undefined,
  };
}

function verify(state: ShiftDeskState): DeskPhaseResult {
  const rules = need(state.rules, "设定用工规则");
  const seats = need(state.seats, "初排");
  const staff = need(state.staff, "读入员工");
  const byName = new Map(staff.map((s) => [s.name, s]));
  const mine = seatsBy(seats);
  const violations: NonNullable<ShiftDeskState["violations"]> = [];
  for (const [name, list] of mine) {
    const s = byName.get(name);
    if (!s) {
      for (const seat of list) violations.push({ who: name, seat: seatLabel(seat.d), problem: "员工表里没有这个人" });
      continue;
    }
    for (const seat of list) {
      const r = staticReason(s, seat.d) ?? conflictReason(s, seat, list.filter((o) => o !== seat), rules);
      if (r) violations.push({ who: name, seat: seatLabel(seat.d), problem: r });
    }
  }
  state.violations = violations;
  if (violations.length) {
    const text = `复核发现 ${violations.length} 处违反用工规则：${violations.slice(0, 3).map((v) => `${v.who} ${v.seat} ${v.problem}`).join("；")}。`;
    state.guardNotes.push(text);
    return {
      detail: text,
      guardFailed: true,
      grid: { columns: ["员工", "班次", "问题"], rows: violations.map((v) => [v.who, v.seat, v.problem]) },
    };
  }
  return { detail: `逐人逐班复核 ${seats.filter((s) => s.assignee).length} 人次：技能、请假、休息、工时、连续天数全部符合。` };
}

function nightMinutes(d: Demand, rules: Rules): number {
  if (rules.nightStart === rules.nightEnd) return 0;
  let total = 0;
  for (let day = d.date - 1; day <= d.date + 1; day += 1) {
    const ws = day * DAY + rules.nightStart;
    const we = rules.nightStart > rules.nightEnd ? (day + 1) * DAY + rules.nightEnd : day * DAY + rules.nightEnd;
    total += Math.max(0, Math.min(d.absEnd, we) - Math.max(d.absStart, ws));
  }
  return total;
}

function hoursPhase(state: ShiftDeskState): DeskPhaseResult {
  const rules = need(state.rules, "设定用工规则");
  const seats = need(state.seats, "初排");
  const staff = need(state.staff, "读入员工");
  const mine = seatsBy(seats);
  const weekCount = new Set(seats.map((x) => weekStartOf(x.d.date))).size;
  const rows: PersonHours[] = staff.map((s) => {
    const list = mine.get(s.name) ?? [];
    const weeks = new Map<number, number>();
    for (const seat of list) weeks.set(weekStartOf(seat.d.date), (weeks.get(weekStartOf(seat.d.date)) ?? 0) + seat.d.paid);
    const overtime = [...weeks.values()].reduce((sum, h) => sum + Math.max(0, h - rules.overtimeAfterWeeklyHours), 0);
    const hours = hoursOf(list);
    const night = list.reduce((sum, seat) => sum + nightMinutes(seat.d, rules), 0) / 60;
    const holidayHours = list.filter((x) => rules.holidayPayDays.has(x.d.date)).reduce((sum, x) => sum + x.d.paid, 0);
    const rate = s.rate ?? 0;
    const minEntry = Object.entries(rules.minWeeklyHoursByType).find(([k]) => s.type.includes(k));
    return {
      name: s.name,
      shifts: list.length,
      hours,
      overtime,
      night,
      nightShifts: list.filter((x) => isNightShift(x.d, rules)).length,
      weekendShifts: list.filter((x) => weekdayOf(x.d.date) >= 6).length,
      holidayHours,
      cost:
        hours * rate +
        overtime * rate * (rules.overtimeRate - 1) +
        night * rate * rules.nightPremium +
        holidayHours * rate * Math.max(0, rules.holidayPayRate - 1),
      peakWeek: Math.max(0, ...weeks.values()),
      weeks: weekCount,
      minWeekly: minEntry ? minEntry[1] : null,
      days: [...new Set(list.map((x) => x.d.date))].sort((a, b) => a - b),
    };
  });
  state.hours = rows;
  const total = rows.reduce((s, r) => s + r.hours, 0);
  const ot = rows.reduce((s, r) => s + r.overtime, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const holiday = rows.reduce((s, r) => s + r.holidayHours, 0);
  const noRate = staff.filter((s) => s.rate === null && (mine.get(s.name)?.length ?? 0) > 0).map((s) => s.name);
  const working = rows.filter((r) => r.shifts);
  const spread = working.length ? Math.max(...working.map((r) => r.hours)) - Math.min(...working.map((r) => r.hours)) : 0;
  return {
    detail:
      `排上的 ${working.length} 人合计 ${fmtHours(total)} 小时（加班 ${fmtHours(ot)} 小时` +
      (holiday ? `、法定节假日 ${fmtHours(holiday)} 小时` : "") +
      `），预计人工成本 ${fmtMoney(cost)} 元；` +
      `工时最多与最少相差 ${fmtHours(spread)} 小时。` +
      (noRate.length ? `${noRate.join("、")} 没填时薪，成本按 0 计。` : ""),
  };
}

function gapsPhase(state: ShiftDeskState): DeskPhaseResult {
  const rules = need(state.rules, "设定用工规则");
  const seats = need(state.seats, "初排");
  const staff = need(state.staff, "读入员工");
  const why = need(state.rejectWhy, "筛可上人选");
  const mine = seatsBy(seats);
  const byDemand = new Map<number, { d: Demand; missing: number; seat: Seat }>();
  for (const s of seats) {
    if (s.assignee) continue;
    const g = byDemand.get(s.d.idx) ?? { d: s.d, missing: 0, seat: s };
    g.missing += 1;
    byDemand.set(s.d.idx, g);
  }
  const allReasons: string[] = [];
  const gaps = [...byDemand.values()]
    .sort((a, b) => a.d.absStart - b.d.absStart)
    .map(({ d, missing, seat }) => {
      const skilled = staff.filter((s) => s.skills.includes(d.role));
      if (!skilled.length) {
        allReasons.push(`没有员工会${d.role}`);
        return { d, missing, reason: `没有员工会${d.role}` };
      }
      const reasons = skilled.map((s) => {
        const st = why.get(d.idx)?.get(s.name);
        if (st) return /^最早|^最晚/.test(st) ? "时段不合适" : st;
        const list = mine.get(s.name) ?? [];
        if (list.some((o) => o.d.idx === d.idx)) return "已在这个班上";
        return conflictReason(s, seat, list, rules) ?? "能上但已排到更难排的班";
      });
      allReasons.push(...reasons.filter((r) => r !== "已在这个班上"));
      const tally = countBy(reasons, (r) => r).map(([r, n]) => `${n} 人${r}`).join("，");
      return { d, missing, reason: `会${d.role}的 ${skilled.length} 人里：${tally}` };
    });
  state.gaps = gaps;
  const total = gaps.reduce((s, g) => s + g.missing, 0);
  const top = countBy(allReasons, (r) => r).slice(0, 3).map(([r]) => r).join("、");
  return {
    detail: total ? `${gaps.length} 个班次共缺 ${total} 人次，最常见原因：${top}。` : "所有班次都排满了。",
  };
}

function coverageGuard(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const seats = need(state.seats, "初排");
  const min = argNum(args, "minCoverage", 0.9);
  const critical = argList(args, "criticalRoles");
  const filled = seats.filter((s) => s.assignee).length;
  const rate = seats.length ? filled / seats.length : 0;
  const criticalMiss = critical.filter((role) => seats.some((s) => s.d.role === role && !s.assignee));
  if (rate < min || criticalMiss.length) {
    const text =
      (rate < min ? `覆盖率 ${fmtPct(rate)}，低于要求的 ${fmtPct(min)}` : `覆盖率 ${fmtPct(rate)}`) +
      (criticalMiss.length ? `，关键岗位「${criticalMiss.join("、")}」有班没人` : "") +
      "，这份排班不能直接发布，请先补人或调整需求。";
    state.guardNotes.push(text);
    return { detail: text, guardFailed: true };
  }
  return { detail: `覆盖率 ${fmtPct(rate)}，达到要求的 ${fmtPct(min)}${critical.length ? `，关键岗位「${critical.join("、")}」全部排满` : ""}。` };
}

function keyholder(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const seats = need(state.seats, "初排");
  const staff = need(state.staff, "读入员工");
  const demand = need(state.demand, "读入班次需求").filter((d) => d.valid);
  const keySkills = argList(args, "keySkills", ["店长", "值班长"]);
  const checkOpen = argBool(args, "checkOpen", true);
  const checkClose = argBool(args, "checkClose", true);
  const byName = new Map(staff.map((s) => [s.name, s]));
  const holds = (name: string) => byName.get(name)?.skills.some((k) => keySkills.includes(k)) ?? false;
  const misses: NonNullable<ShiftDeskState["keyholderMisses"]> = [];
  const dates = [...new Set(demand.map((d) => d.date))].sort((a, b) => a - b);
  for (const day of dates) {
    const rows = demand.filter((d) => d.date === day);
    const first = Math.min(...rows.map((d) => d.absStart));
    const last = Math.max(...rows.map((d) => d.absEnd));
    const onAt = (t: number, edge: "open" | "close") =>
      seats
        .filter((s) => s.assignee && s.d.date === day && (edge === "open" ? s.d.absStart === t : s.d.absEnd === t))
        .map((s) => s.assignee!);
    if (checkOpen) {
      const people = [...new Set(onAt(first, "open"))];
      if (!people.some(holds)) misses.push({ day, when: `开店 ${fmtClock(first % DAY)}`, people });
    }
    if (checkClose) {
      const people = [...new Set(onAt(last, "close"))];
      if (!people.some(holds)) misses.push({ day, when: `闭店 ${fmtClock(last % DAY)}`, people });
    }
  }
  state.keyholderMisses = misses;
  const holders = staff.filter((s) => holds(s.name)).map((s) => s.name);
  if (!holders.length) {
    const text = `员工表里没有人具备「${keySkills.join("、")}」，开闭店无人持钥匙。`;
    state.guardNotes.push(text);
    return { detail: text, guardFailed: true };
  }
  if (misses.length) {
    const text = `${misses.length} 个开闭店时段没有「${keySkills.join("、")}」在班：${misses.slice(0, 3).map((m) => `${fmtDay(m.day)} ${m.when}`).join("、")}${misses.length > 3 ? " 等" : ""}。`;
    state.guardNotes.push(text);
    return {
      detail: text,
      guardFailed: true,
      grid: {
        columns: ["日期", "时段", "当时在班", "问题"],
        rows: misses.map((m) => [fmtDay(m.day), m.when, m.people.join("、") || "无人", `没有${keySkills.join("或")}`]),
      },
    };
  }
  return { detail: `${dates.length} 天的开店和闭店都有「${keySkills.join("、")}」在班。` };
}

function fairness(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const hours = need(state.hours, "核算工时与成本");
  const maxSpread = argNum(args, "maxHoursSpread", 16);
  const maxWeekendSpread = argNum(args, "maxWeekendSpread", 2);
  const onlyType = argStr(args, "compareType", "全职");
  const staff = need(state.staff, "读入员工");
  const byName = new Map(staff.map((s) => [s.name, s]));
  const peers = hours.filter((h) => (byName.get(h.name)?.type ?? "").includes(onlyType) && h.shifts > 0);
  const spread = peers.length ? Math.max(...peers.map((p) => p.hours)) - Math.min(...peers.map((p) => p.hours)) : 0;
  const weekendSpread = peers.length ? Math.max(...peers.map((p) => p.weekendShifts)) - Math.min(...peers.map((p) => p.weekendShifts)) : 0;
  const under = hours
    .filter((h) => h.minWeekly !== null && h.weeks > 0 && h.hours / h.weeks + 1e-9 < h.minWeekly!)
    .map((h) => h.name);
  state.fairness = { spread, under, weekendSpread };
  const problems = [
    spread > maxSpread ? `${onlyType}员工工时最多与最少相差 ${fmtHours(spread)} 小时（超过 ${maxSpread}）` : "",
    weekendSpread > maxWeekendSpread ? `周末班最多与最少相差 ${weekendSpread} 个（超过 ${maxWeekendSpread}）` : "",
    under.length ? `${under.length} 人周均工时低于保底：${under.slice(0, 5).join("、")}${under.length > 5 ? " 等" : ""}` : "",
  ].filter(Boolean);
  if (problems.length) {
    const text = `${problems.join("；")}。`;
    state.guardNotes.push(text);
    return { detail: text, guardFailed: true };
  }
  return {
    detail: `${onlyType}员工工时相差 ${fmtHours(spread)} 小时、周末班相差 ${weekendSpread} 个，都在允许范围内${Object.keys(need(state.rules, "设定用工规则").minWeeklyHoursByType).length ? "，没有人低于保底工时" : ""}。`,
  };
}

/* ───────────── 交付 ───────────── */

function deliverRoster(state: ShiftDeskState): DeskPhaseResult {
  const seats = need(state.seats, "初排");
  const demand = need(state.demand, "读入班次需求").filter((d) => d.valid);
  const grid: WorkGrid = {
    columns: ["日期", "星期", "班次", "时间", "岗位", "需要", "已排", "人员", "缺口", "计薪工时"],
    rows: demand
      .slice()
      .sort((a, b) => a.absStart - b.absStart || a.role.localeCompare(b.role, "zh"))
      .map((d) => {
        const on = seats.filter((s) => s.d.idx === d.idx && s.assignee);
        return [
          dayKey(d.date),
          WEEKDAY_NAMES[weekdayOf(d.date)]!,
          d.shift,
          `${fmtClock(d.start)}-${d.end > DAY ? "次日" : ""}${fmtClock(d.end)}`,
          d.role,
          String(d.count),
          String(on.length),
          on.map((s) => (s.via === "调换" ? `${s.assignee}（调换）` : s.assignee!)).join("、"),
          d.count > on.length ? String(d.count - on.length) : "",
          fmtHours(d.paid),
        ];
      }),
  };
  putTable(state, "roster", "排班表", grid);
  return { detail: `排班表 ${grid.rows.length} 个班次。`, grid };
}

function deliverPerson(state: ShiftDeskState): DeskPhaseResult {
  const hours = need(state.hours, "核算工时与成本");
  const staff = need(state.staff, "读入员工");
  const byName = new Map(staff.map((s) => [s.name, s]));
  const grid: WorkGrid = {
    columns: ["员工", "用工类型", "班数", "计薪工时", "周工时上限", "最忙一周", "周均", "保底", "加班工时", "夜班工时", "夜班数", "周末班", "节假日工时", "时薪", "预计成本", "上班日"],
    rows: hours.map((h) => {
      const s = byName.get(h.name)!;
      const avg = h.weeks ? h.hours / h.weeks : 0;
      return [
        h.name,
        s.type,
        String(h.shifts),
        fmtHours(h.hours),
        fmtHours(s.weeklyCap),
        fmtHours(h.peakWeek),
        fmtHours(avg),
        h.minWeekly === null ? "" : avg + 1e-9 < h.minWeekly ? `低于 ${fmtHours(h.minWeekly)}` : fmtHours(h.minWeekly),
        fmtHours(h.overtime),
        fmtHours(h.night),
        String(h.nightShifts),
        String(h.weekendShifts),
        fmtHours(h.holidayHours),
        s.rate === null ? "未填" : fmtMoney(s.rate),
        fmtMoney(h.cost),
        h.days.map((d) => dayKey(d).slice(5)).join(" "),
      ];
    }),
  };
  putTable(state, "person", "个人工时表", grid);
  return { detail: `个人工时表 ${grid.rows.length} 人。`, grid };
}

function deliverGaps(state: ShiftDeskState): DeskPhaseResult {
  const gaps = need(state.gaps, "分析缺口");
  const grid: WorkGrid = {
    columns: ["日期", "班次", "时间", "岗位", "缺几人", "为什么排不上"],
    rows: gaps.map((g) => [
      `${dayKey(g.d.date)}（${WEEKDAY_NAMES[weekdayOf(g.d.date)]}）`,
      g.d.shift,
      `${fmtClock(g.d.start)}-${fmtClock(g.d.end)}`,
      g.d.role,
      String(g.missing),
      g.reason,
    ]),
  };
  putTable(state, "gaps", "缺口清单", grid);
  return { detail: gaps.length ? `缺口清单 ${gaps.length} 个班次。` : "缺口清单为空。", grid };
}

function deliverMatrix(state: ShiftDeskState): DeskPhaseResult {
  const seats = need(state.seats, "初排");
  const staff = need(state.staff, "读入员工");
  const demand = need(state.demand, "读入班次需求").filter((d) => d.valid);
  const dates = [...new Set(demand.map((d) => d.date))].sort((a, b) => a - b);
  const mine = seatsBy(seats);
  const grid: WorkGrid = {
    columns: ["员工", ...dates.map(fmtDay)],
    rows: staff.map((s) => [
      s.name,
      ...dates.map((day) => {
        const list = (mine.get(s.name) ?? []).filter((x) => x.d.date === day).sort((a, b) => a.d.start - b.d.start);
        if (list.length) return list.map((x) => `${x.d.shift || ""}${fmtClock(x.d.start)}-${fmtClock(x.d.end)} ${x.d.role}`.trim()).join("／");
        if (s.unavailable.has(day)) return "请假";
        return "休";
      }),
    ]),
  };
  putTable(state, "matrix", "人员日历", grid);
  return { detail: `人员日历 ${grid.rows.length} 人 × ${dates.length} 天。`, grid };
}

function report(state: ShiftDeskState, args: DeskArgs): DeskPhaseResult {
  const seats = need(state.seats, "初排");
  const filled = seats.filter((s) => s.assignee).length;
  const parts = [
    `「${state.demandTitle}」共需 ${seats.length} 人次，排上 ${filled} 人次（覆盖率 ${fmtPct(seats.length ? filled / seats.length : 0)}）`,
  ];
  if (seats.length - filled) parts.push(`缺 ${seats.length - filled} 人次`);
  if (state.swaps.length) parts.push(`其中调换补上 ${state.swaps.length} 个`);
  if (state.hours) {
    const total = state.hours.reduce((s, r) => s + r.hours, 0);
    const ot = state.hours.reduce((s, r) => s + r.overtime, 0);
    const cost = state.hours.reduce((s, r) => s + r.cost, 0);
    parts.push(`合计 ${fmtHours(total)} 计薪小时${ot ? `（加班 ${fmtHours(ot)} 小时）` : ""}，预计人工成本 ${fmtMoney(cost)} 元`);
  }
  if (state.violations) parts.push(state.violations.length ? `${state.violations.length} 处违反用工规则` : "复核无违规");
  const summary = `${parts.join("，")}。`;
  state.summary = summary;

  const maxPeople = argNum(args, "maxPeopleInNotice", 40);
  const mine = seatsBy(seats);
  const people = need(state.staff, "读入员工").filter((s) => mine.has(s.name)).slice(0, maxPeople);
  const facts = [
    `结论：${summary}`,
    "每人班表：",
    ...people.map((s) => {
      const list = mine.get(s.name)!.slice().sort((a, b) => a.d.absStart - b.d.absStart);
      return `- ${s.name}：${list.map((x) => seatLabel(x.d)).join("；")}`;
    }),
    ...(state.gaps?.length
      ? ["还没排上的班：", ...state.gaps.slice(0, 10).map((g) => `- ${seatLabel(g.d)} 缺 ${g.missing} 人：${clip(g.reason, 60)}`)]
      : []),
  ].join("\n");
  return { detail: summary, summary, llmFacts: facts };
}

/* ───────────── 程序 ───────────── */

export const SHIFT_DESK_PROGRAM: DeskProgram<ShiftDeskState> = {
  skillId: SHIFT_DESK_ID,
  guardCode: SHIFT_DESK_META.guardCode,
  init: () => ({
    staff: null,
    staffTitle: "",
    demand: null,
    demandTitle: "",
    dataIssues: [],
    rules: null,
    eligible: null,
    rejectWhy: null,
    seats: null,
    assignDone: false,
    swaps: [],
    violations: null,
    hours: null,
    gaps: null,
    roleMerges: [],
    keyholderMisses: null,
    fairness: null,
    guardNotes: [],
    tables: [],
    summary: null,
  }),
  phases: {
    __shift_staff__: staffPhase,
    __shift_demand__: demandPhase,
    __shift_roles__: rolesPhase,
    __shift_validate__: validate,
    __shift_rules__: rulesPhase,
    __shift_eligibility__: eligibility,
    __shift_assign__: assign,
    __shift_repair__: repair,
    __shift_verify__: verify,
    __shift_hours__: hoursPhase,
    __shift_gaps__: gapsPhase,
    __shift_coverage_guard__: coverageGuard,
    __shift_keyholder__: keyholder,
    __shift_fairness__: fairness,
    __shift_deliver_roster__: deliverRoster,
    __shift_deliver_person__: deliverPerson,
    __shift_deliver_gaps__: deliverGaps,
    __shift_deliver_matrix__: deliverMatrix,
    __shift_report__: report,
  },
  paper(state): TablesPaper | null {
    if (!state.seats) return null;
    const filled = state.seats.filter((s) => s.assignee).length;
    const rate = state.seats.length ? filled / state.seats.length : 0;
    const metrics: TablesPaper["metrics"] = [
      { label: "需要人次", value: String(state.seats.length) },
      { label: "已排", value: String(filled), tone: "ok" },
      { label: "缺口", value: String(state.seats.length - filled), tone: state.seats.length - filled ? "bad" : "ok" },
      { label: "覆盖率", value: fmtPct(rate), tone: rate >= 0.95 ? "ok" : rate >= 0.85 ? "warn" : "bad" },
    ];
    if (state.swaps.length) metrics.push({ label: "调换补缺", value: String(state.swaps.length) });
    if (state.hours) {
      metrics.push({ label: "计薪工时", value: fmtHours(state.hours.reduce((s, r) => s + r.hours, 0)) });
      const ot = state.hours.reduce((s, r) => s + r.overtime, 0);
      if (ot) metrics.push({ label: "加班工时", value: fmtHours(ot), tone: "warn" });
      metrics.push({ label: "预计成本(元)", value: fmtMoney(state.hours.reduce((s, r) => s + r.cost, 0)) });
    }
    if (state.violations) {
      metrics.push({ label: "违规", value: String(state.violations.length), tone: state.violations.length ? "bad" : "ok" });
    }
    const notes = [
      ...state.guardNotes,
      ...(state.dataIssues.length ? [`材料里有 ${state.dataIssues.length} 处问题，看不懂的行没有参与排班。`] : []),
      ...(state.rules
        ? [`用工规则：两班间休息 ≥ ${state.rules.minRestHours} 小时，每天 ≤ ${state.rules.maxDailyHours} 小时，连续上班 ≤ ${state.rules.maxConsecutiveDays} 天。`]
        : []),
    ];
    return {
      kind: "tables",
      skillId: SHIFT_DESK_ID,
      tag: "排班",
      title: `${state.demandTitle} · 排班结果`,
      subtitle: state.summary ?? "",
      metrics,
      notes,
      tables: state.tables,
    };
  },
};