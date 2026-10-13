/**
 * 客服工单分派与时效质检引擎。
 * 材料：工单表（service-tickets）+ 坐席表（service-agents），全部来自客户导入。
 * 每个阶段对应 SKILL 里的一步，规则全部来自该步 args。
 */

import {
  addBusinessMinutes,
  argBool,
  argList,
  argNum,
  argObj,
  argObjList,
  argStr,
  businessMinutesBetween,
  clip,
  countBy,
  fmtDateTime,
  fmtMinutes,
  fmtPct,
  loadMaterial,
  need,
  parseClock,
  parseDateTime,
  textSimilarity,
  type DeskArgs,
  type DeskPhaseResult,
  type DeskProgram,
  type TablesPaper,
  type WorkCalendar,
} from "./deskProgramKit";
import type { WorkGrid } from "./sheetEngine";
import { AGENT_COLUMNS, TICKET_COLUMNS, TICKET_DESK_ID, TICKET_DESK_META } from "./ticketDeskMeta";

type Priority = 1 | 2 | 3 | 4;

type SlaResult = {
  allDay: boolean;
  frLimit: number;
  resLimit: number;
  frUsed: number;
  frBreach: boolean;
  frJudged: boolean;
  frState: string;
  resUsed: number;
  resBreach: boolean;
  resJudged: boolean;
  resState: string;
  frDeadline: number;
  resDeadline: number;
  remaining: number;
};

type Ticket = {
  rowNo: number;
  id: string;
  customer: string;
  created: number | null;
  firstResp: number | null;
  resolved: number | null;
  channel: string;
  level: string;
  title: string;
  content: string;
  statusRaw: string;
  holder: string;
  open: boolean;
  valid: boolean;
  category: string;
  group: string;
  catHits: string[];
  priority: Priority;
  priorityWhy: string[];
  mergedInto: string | null;
  mergeScore: number;
  children: string[];
  sla: SlaResult | null;
  risk: "" | "临期" | "超时";
  riskWhy: string;
  assignee: string | null;
  assignWhy: string;
  escalation: { to: string; reason: string } | null;
};

type Agent = {
  rowNo: number;
  name: string;
  groups: string[];
  onDuty: boolean;
  backlog: number;
  cap: number;
  assigned: string[];
};

type QualityRow = {
  key: string;
  total: number;
  frOk: number;
  frJudged: number;
  resOk: number;
  resJudged: number;
  frSum: number;
  frCount: number;
  open: number;
  openBreach: number;
};

export type TicketDeskState = {
  tickets: Ticket[] | null;
  ticketTitle: string;
  agents: Agent[] | null;
  agentTitle: string;
  dataIssues: { rowNo: number; id: string; problem: string }[];
  cal: WorkCalendar | null;
  calNote: string;
  asOf: number | null;
  classified: boolean;
  slaDone: boolean;
  assignDone: boolean;
  escalateDone: boolean;
  quality: { byPriority: QualityRow[]; byGroup: QualityRow[]; targets: { fr: number; res: number }; misses: string[] } | null;
  guardNotes: string[];
  tables: { id: string; name: string; grid: WorkGrid; filename: string }[];
  summary: string | null;
};

const P = (p: Priority) => `P${p}`;

function clampPriority(n: number): Priority {
  return Math.min(4, Math.max(1, Math.round(n))) as Priority;
}

const CLOSED_RE = /已解决|已关闭|已完成|已完结|已结单|关闭|完结|结单|resolved|closed|done|solved/i;
const MERGED_RE = /合并|重复单|duplicate/i;

function liveTickets(state: TicketDeskState): Ticket[] {
  return need(state.tickets, "读入工单").filter((t) => t.valid && !t.mergedInto);
}

function putTable(state: TicketDeskState, id: string, name: string, grid: WorkGrid) {
  const filename = `${name}.csv`;
  const at = state.tables.findIndex((t) => t.id === id);
  const row = { id, name, grid, filename };
  if (at >= 0) state.tables[at] = row;
  else state.tables.push(row);
}

/* ───────────── 阶段 ───────────── */

function intake(state: TicketDeskState, args: DeskArgs, env: Parameters<typeof loadMaterial>[0]): DeskPhaseResult {
  const label = TICKET_DESK_META.requirements[0]!.label;
  const mat = loadMaterial(env, "service-tickets", label, TICKET_COLUMNS);
  const tickets: Ticket[] = mat.rows.map((r) => {
    const status = r.get("状态");
    const resolved = parseDateTime(r.get("解决时间"));
    const closed = CLOSED_RE.test(status) || MERGED_RE.test(status) || (!status && resolved !== null);
    return {
      rowNo: r.rowNo,
      id: r.get("工单号"),
      customer: r.get("客户"),
      created: parseDateTime(r.get("创建时间")),
      firstResp: parseDateTime(r.get("首次响应时间")),
      resolved,
      channel: r.get("渠道"),
      level: r.get("客户等级"),
      title: r.get("标题"),
      content: r.get("内容"),
      statusRaw: status,
      holder: r.get("处理人"),
      open: !closed,
      valid: true,
      category: "",
      group: "",
      catHits: [],
      priority: 3,
      priorityWhy: [],
      mergedInto: null,
      mergeScore: 0,
      children: [],
      sla: null,
      risk: "",
      riskWhy: "",
      assignee: null,
      assignWhy: "",
      escalation: null,
    };
  });
  state.tickets = tickets;
  state.ticketTitle = mat.title;
  const open = tickets.filter((t) => t.open).length;
  const withResp = mat.present.has("首次响应时间");
  const withRes = mat.present.has("解决时间");
  const missing = [!withResp ? "首次响应时间" : "", !withRes ? "解决时间" : ""].filter(Boolean);
  const maxRows = argNum(args, "maxRows", 20000);
  if (tickets.length > maxRows) {
    return { detail: `「${mat.title}」有 ${tickets.length} 张工单，超过单次上限 ${maxRows} 张，请分批导入。`, guardFailed: true };
  }
  return {
    detail:
      `读入「${mat.title}」${tickets.length} 张工单，其中未结 ${open} 张。` +
      (missing.length ? `材料里没有「${missing.join("」「")}」列，相关时效按未发生处理。` : ""),
  };
}

function parseOnDuty(text: string, fallback: boolean): boolean {
  const s = text.trim();
  if (!s) return fallback;
  if (/^(否|n|no|false|0|离岗|休息|休假|请假|下线|离线|不在岗?|off)/i.test(s)) return false;
  if (/^(是|y|yes|true|1|在岗|在线|上班|当班|on)/i.test(s)) return true;
  return fallback;
}

function agentsPhase(state: TicketDeskState, args: DeskArgs, env: Parameters<typeof loadMaterial>[0]): DeskPhaseResult {
  const label = TICKET_DESK_META.requirements[1]!.label;
  const mat = loadMaterial(env, "service-agents", label, AGENT_COLUMNS);
  const defaultCap = argNum(args, "defaultCap", 10);
  const defaultOnDuty = argBool(args, "defaultOnDuty", true);
  const seen = new Set<string>();
  const agents: Agent[] = [];
  for (const r of mat.rows) {
    const name = r.get("坐席");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const backlog = Number(r.get("当前待办"));
    const cap = Number(r.get("上限"));
    agents.push({
      rowNo: r.rowNo,
      name,
      groups: r.get("技能组").split(/[|、,，/;；]+/).map((g) => g.trim()).filter(Boolean),
      onDuty: parseOnDuty(r.get("在岗"), defaultOnDuty),
      backlog: Number.isFinite(backlog) && backlog > 0 ? Math.round(backlog) : 0,
      cap: Number.isFinite(cap) && cap > 0 ? Math.round(cap) : defaultCap,
      assigned: [],
    });
  }
  state.agents = agents;
  state.agentTitle = mat.title;
  const onDuty = agents.filter((a) => a.onDuty);
  const free = onDuty.reduce((s, a) => s + Math.max(0, a.cap - a.backlog), 0);
  const groups = countBy(onDuty.flatMap((a) => a.groups.map((g) => ({ g }))), (x) => x.g)
    .map(([g, n]) => `${g} ${n} 人`)
    .join("、");
  if (!onDuty.length) {
    return { detail: `「${mat.title}」${agents.length} 名坐席都不在岗，无法分派。`, guardFailed: true };
  }
  return {
    detail: `读入「${mat.title}」${agents.length} 名坐席，在岗 ${onDuty.length} 人（${groups || "未填技能组"}），还能接 ${free} 张。`,
  };
}

function validate(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  const tickets = need(state.tickets, "读入工单");
  const maxBadRatio = argNum(args, "maxBadRatio", 0.1);
  const issues: TicketDeskState["dataIssues"] = [];
  const ids = new Map<string, number>();
  for (const t of tickets) {
    const problems: string[] = [];
    if (!t.id) problems.push("缺工单号");
    else if (ids.has(t.id)) problems.push(`工单号与第 ${ids.get(t.id)} 行重复`);
    else ids.set(t.id, t.rowNo);
    if (t.created === null) problems.push("创建时间缺失或看不懂");
    if (t.created !== null && t.firstResp !== null && t.firstResp < t.created) problems.push("首次响应早于创建");
    if (t.created !== null && t.resolved !== null && t.resolved < t.created) problems.push("解决时间早于创建");
    if (t.firstResp !== null && t.resolved !== null && t.resolved < t.firstResp) problems.push("解决早于首次响应");
    if (!t.title && !t.content) problems.push("标题和内容都为空");
    const fatal = problems.some((p) => /缺工单号|重复|创建时间|早于创建/.test(p));
    if (fatal) t.valid = false;
    for (const p of problems) issues.push({ rowNo: t.rowNo, id: t.id || "（空）", problem: p });
  }
  state.dataIssues = issues;
  const bad = tickets.filter((t) => !t.valid).length;
  const ratio = tickets.length ? bad / tickets.length : 1;
  if (!tickets.length) return { detail: "工单表没有数据行。", guardFailed: true };
  if (ratio > maxBadRatio) {
    return {
      detail: `${bad} 张工单（${fmtPct(ratio)}）缺工单号、重复或时间不对，超过允许的 ${fmtPct(maxBadRatio)}，请先修正材料。`,
      guardFailed: true,
    };
  }
  if (!issues.length) return { detail: `${tickets.length} 张工单数据完整，时间先后正常。` };
  return {
    detail: `发现 ${issues.length} 处数据问题，${bad} 张无法计时效的工单不参与后续计算。`,
    grid: { columns: ["行号", "工单号", "问题"], rows: issues.map((i) => [String(i.rowNo), i.id, i.problem]) },
  };
}

function calendarPhase(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  const tickets = need(state.tickets, "读入工单");
  const start = parseClock(argStr(args, "workStart", "09:00"));
  const end = parseClock(argStr(args, "workEnd", "18:00"));
  if (start === null || end === null || end <= start) {
    throw new Error(`工作时间设置不对：${argStr(args, "workStart", "")}—${argStr(args, "workEnd", "")}`);
  }
  const workdays = new Set(argList(args, "workdays", ["1", "2", "3", "4", "5"]).map(Number).filter((n) => n >= 1 && n <= 7));
  const holidays = new Set(argList(args, "holidays").map((d) => d.slice(0, 10)));
  const extra = new Set(argList(args, "extraWorkdays").map((d) => d.slice(0, 10)));
  state.cal = { start, end, workdays, holidays, extraWorkdays: extra };

  const asOfArg = argStr(args, "asOf", "latest");
  let asOf: number | null = asOfArg === "latest" ? null : parseDateTime(asOfArg);
  if (asOf === null) {
    for (const t of tickets) {
      for (const v of [t.created, t.firstResp, t.resolved]) if (v !== null && (asOf === null || v > asOf)) asOf = v;
    }
  }
  state.asOf = asOf;
  const hours = (end - start) / 60;
  state.calNote = `工作时间 ${argStr(args, "workStart", "09:00")}—${argStr(args, "workEnd", "18:00")}，每周 ${workdays.size} 天，节假日 ${holidays.size} 天`;
  return {
    detail:
      `${state.calNote}（每天 ${hours} 小时）。` +
      (asOf !== null ? `时效统计截至 ${fmtDateTime(asOf)}${asOfArg === "latest" ? "（材料里最晚的时间）" : ""}。` : ""),
  };
}

type Category = { name: string; group: string; priority: Priority; keywords: string[] };

function classify(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  const tickets = liveTickets(state);
  const cats: Category[] = argObjList(args, "categories").map((c) => ({
    name: String(c.name ?? "").trim(),
    group: String(c.group ?? "").trim(),
    priority: clampPriority(Number(c.priority ?? 3)),
    keywords: argList(c, "keywords"),
  })).filter((c) => c.name && c.keywords.length);
  const fallback = {
    name: argStr(args, "defaultCategory", "其他咨询"),
    group: argStr(args, "defaultGroup", "综合组"),
    priority: clampPriority(argNum(args, "defaultPriority", 3)),
  };
  const titleWeight = argNum(args, "titleWeight", 2);
  for (const t of tickets) {
    let best: Category | null = null;
    let bestScore = 0;
    let bestHits: string[] = [];
    for (const c of cats) {
      let score = 0;
      const hits: string[] = [];
      for (const k of c.keywords) {
        const inTitle = t.title.includes(k);
        const inBody = t.content.includes(k);
        if (inTitle || inBody) hits.push(k);
        score += (inTitle ? titleWeight : 0) + (inBody ? 1 : 0);
      }
      if (score > bestScore) {
        best = c;
        bestScore = score;
        bestHits = hits;
      }
    }
    t.category = best?.name ?? fallback.name;
    t.group = best?.group || fallback.group;
    t.priority = best?.priority ?? fallback.priority;
    t.catHits = bestHits;
    t.priorityWhy = [`${t.category}默认 ${P(t.priority)}`];
  }
  state.classified = true;
  const dist = countBy(tickets, (t) => t.category).map(([k, n]) => `${k} ${n}`).join("、");
  const unknown = tickets.filter((t) => t.category === fallback.name).length;
  return {
    detail: `${tickets.length} 张工单分成 ${countBy(tickets, (t) => t.category).length} 类：${dist}。` +
      (unknown ? `${unknown} 张没有命中关键词，归入「${fallback.name}」。` : ""),
  };
}

function priorityPhase(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  if (!state.classified) need(null, "问题分类");
  const tickets = liveTickets(state);
  const urgent = argList(args, "urgentKeywords");
  const levelBoost = argObj(args, "levelBoost");
  const channelBoost = argObj(args, "channelBoost");
  const repeat = argObj(args, "repeatContact");
  const repeatCount = Number(repeat.count ?? 0);
  const repeatBoost = Number(repeat.boost ?? 0);
  const perCustomer = new Map<string, number>();
  for (const t of tickets) perCustomer.set(t.customer, (perCustomer.get(t.customer) ?? 0) + 1);

  let urgentN = 0;
  let boosted = 0;
  for (const t of tickets) {
    let p: number = t.priority;
    const hit = urgent.find((k) => t.title.includes(k) || t.content.includes(k));
    if (hit) {
      p = 1;
      t.priorityWhy.push(`含「${hit}」直接定 P1`);
      urgentN += 1;
    } else {
      for (const [key, raw] of Object.entries(levelBoost)) {
        if (key && t.level.includes(key) && Number(raw) > 0) {
          p -= Number(raw);
          t.priorityWhy.push(`${key}客户提 ${Number(raw)} 级`);
        }
      }
      for (const [key, raw] of Object.entries(channelBoost)) {
        if (key && t.channel.includes(key) && Number(raw) !== 0) {
          p -= Number(raw);
          t.priorityWhy.push(`${key}渠道${Number(raw) > 0 ? "提" : "降"} ${Math.abs(Number(raw))} 级`);
        }
      }
      if (repeatCount > 1 && repeatBoost > 0 && (perCustomer.get(t.customer) ?? 0) >= repeatCount) {
        p -= repeatBoost;
        t.priorityWhy.push(`同一客户 ${perCustomer.get(t.customer)} 张单，提 ${repeatBoost} 级`);
      }
    }
    const next = clampPriority(p);
    if (next < t.priority && !hit) boosted += 1;
    t.priority = next;
  }
  const dist = ([1, 2, 3, 4] as Priority[])
    .map((p) => [p, tickets.filter((t) => t.priority === p).length] as const)
    .filter(([, n]) => n)
    .map(([p, n]) => `${P(p)} ${n}`)
    .join("、");
  return { detail: `优先级：${dist}。紧急词直接定 P1 的 ${urgentN} 张，因客户等级/渠道/反复来电上调的 ${boosted} 张。` };
}

function dedupe(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  if (!state.classified) need(null, "问题分类");
  const tickets = liveTickets(state).slice().sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
  const windowMin = argNum(args, "windowHours", 48) * 60;
  const threshold = argNum(args, "similarity", 0.5);
  const sameCategory = argBool(args, "sameCategory", true);
  const closeChildren = argBool(args, "closeMerged", true);
  let merged = 0;
  for (let i = 0; i < tickets.length; i += 1) {
    const t = tickets[i]!;
    for (let j = i - 1; j >= 0; j -= 1) {
      const p = tickets[j]!;
      if ((t.created ?? 0) - (p.created ?? 0) > windowMin) break;
      if (p.mergedInto || p.customer !== t.customer || !t.customer) continue;
      if (sameCategory && p.category !== t.category) continue;
      const score = textSimilarity(t.title || clip(t.content, 40), p.title || clip(p.content, 40));
      if (score < threshold) continue;
      t.mergedInto = p.id;
      t.mergeScore = score;
      p.children.push(t.id);
      if (t.priority < p.priority) {
        p.priority = t.priority;
        p.priorityWhy.push(`合并 ${t.id} 后取较高优先级 ${P(t.priority)}`);
      }
      if (t.open) {
        if (!p.open) {
          p.open = true;
          p.priorityWhy.push(`重复单 ${t.id} 未结，主单重新打开`);
        }
        if (closeChildren) t.open = false;
      }
      merged += 1;
      break;
    }
  }
  const parents = tickets.filter((t) => t.children.length).length;
  return {
    detail: merged
      ? `同一客户 ${argNum(args, "windowHours", 48)} 小时内反映同一问题的 ${merged} 张工单并入 ${parents} 张主单，只按主单计时和分派。`
      : `没有找到需要合并的重复工单（同客户、${argNum(args, "windowHours", 48)} 小时内、标题相似度 ≥ ${threshold}）。`,
  };
}

function slaPhase(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  const tickets = liveTickets(state);
  const table = argObj(args, "targets");
  let asOf = state.asOf;
  if (asOf === null) {
    for (const t of need(state.tickets, "读入工单")) {
      for (const v of [t.created, t.firstResp, t.resolved]) if (v !== null && (asOf === null || v > asOf)) asOf = v;
    }
    state.asOf = asOf;
  }
  const now = asOf ?? 0;
  const missingLevels = new Set<string>();
  for (const t of tickets) {
    const row = (table[P(t.priority)] ?? {}) as Record<string, unknown>;
    if (!table[P(t.priority)]) missingLevels.add(P(t.priority));
    const frLimit = Number(row.firstResponseMinutes ?? 240);
    const resLimit = Number(row.resolveHours ?? 72) * 60;
    const allDay = row.allDay === true || row.allDay === "true" || !state.cal;
    const cal = allDay ? null : state.cal;
    const created = t.created!;
    const frEnd = t.firstResp ?? (t.open ? now : t.resolved);
    const frUnknown = frEnd === null;
    const frUsed = frUnknown ? 0 : businessMinutesBetween(created, Math.max(created, frEnd), cal);
    const responded = !frUnknown && (t.firstResp !== null || !t.open);
    const frBreach = !frUnknown && frUsed > frLimit;
    const resUnknown = !t.open && t.resolved === null;
    const resUsed = resUnknown ? 0 : businessMinutesBetween(created, Math.max(created, t.resolved ?? now), cal);
    const resBreach = !resUnknown && resUsed > resLimit;
    t.sla = {
      allDay,
      frLimit,
      resLimit,
      frUsed,
      frBreach,
      frJudged: responded || frBreach,
      frState: frUnknown
        ? "已结·缺响应时间"
        : responded
          ? frBreach ? "超时" : "达标"
          : frBreach ? "未响应·已超时" : "未响应·计时中",
      resUsed,
      resBreach,
      resJudged: !resUnknown && (!t.open || resBreach),
      resState: resUnknown
        ? "已结·缺解决时间"
        : !t.open
          ? resBreach ? "超时" : "达标"
          : resBreach ? "未结·已超时" : "未结·计时中",
      frDeadline: addBusinessMinutes(created, frLimit, cal),
      resDeadline: addBusinessMinutes(created, resLimit, cal),
      remaining: resLimit - resUsed,
    };
  }
  state.slaDone = true;
  const frBad = tickets.filter((t) => t.sla!.frBreach).length;
  const resBad = tickets.filter((t) => t.sla!.resBreach).length;
  const openBad = tickets.filter((t) => t.open && (t.sla!.resBreach || t.sla!.frBreach)).length;
  return {
    detail:
      `按${state.cal ? "工作时间" : "自然时间"}计时：首响超时 ${frBad} 张，解决超时 ${resBad} 张，其中仍未结的 ${openBad} 张。` +
      (missingLevels.size ? `未给 ${[...missingLevels].join("、")} 设时限，按首响 4 小时、解决 72 小时计。` : ""),
  };
}

function risk(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  if (!state.slaDone) need(null, "计算时效");
  const ratio = argNum(args, "riskRatio", 0.8);
  const tickets = liveTickets(state).filter((t) => t.open);
  for (const t of tickets) {
    const s = t.sla!;
    if (s.resBreach || (s.frBreach && t.firstResp === null)) {
      t.risk = "超时";
      t.riskWhy = s.resBreach
        ? `解决已用 ${fmtMinutes(s.resUsed)}，超过时限 ${fmtMinutes(s.resLimit)}`
        : `已等 ${fmtMinutes(s.frUsed)} 未首次响应，超过 ${fmtMinutes(s.frLimit)}`;
    } else if (s.resUsed >= s.resLimit * ratio) {
      t.risk = "临期";
      t.riskWhy = `解决时限只剩 ${fmtMinutes(s.remaining)}`;
    } else if (t.firstResp === null && s.frUsed >= s.frLimit * ratio) {
      t.risk = "临期";
      t.riskWhy = `首次响应只剩 ${fmtMinutes(s.frLimit - s.frUsed)}`;
    }
  }
  const late = tickets.filter((t) => t.risk === "超时").length;
  const near = tickets.filter((t) => t.risk === "临期").length;
  return { detail: `${tickets.length} 张未结工单中，已超时 ${late} 张，用掉时限 ${fmtPct(ratio)} 以上的临期 ${near} 张。` };
}

function urgencyOrder(a: Ticket, b: Ticket): number {
  const rank = (t: Ticket) => (t.risk === "超时" ? 0 : t.risk === "临期" ? 1 : 2);
  return (
    a.priority - b.priority ||
    rank(a) - rank(b) ||
    (a.sla?.remaining ?? 0) - (b.sla?.remaining ?? 0) ||
    (a.created ?? 0) - (b.created ?? 0)
  );
}

function assign(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  const agents = need(state.agents, "读入坐席");
  if (!state.classified) need(null, "问题分类");
  const strategy = argStr(args, "strategy", "least-load");
  const allowFallback = argBool(args, "allowFallback", true);
  const fallbackGroup = argStr(args, "fallbackGroup", "综合组");
  const respectCap = argBool(args, "respectCap", true);
  const keepExisting = argBool(args, "keepExisting", true);
  const byName = new Map(agents.map((a) => [a.name, a]));
  for (const a of agents) a.assigned = [];
  const queue = liveTickets(state).filter((t) => t.open).sort(urgencyOrder);
  const rr = new Map<string, number>();
  const load = (a: Agent) => a.backlog + a.assigned.length;
  const pick = (group: string): Agent | null => {
    const pool = agents.filter((a) => a.onDuty && a.groups.includes(group) && (!respectCap || load(a) < a.cap));
    if (!pool.length) return null;
    if (strategy === "round-robin") {
      const i = (rr.get(group) ?? 0) % pool.length;
      rr.set(group, i + 1);
      return pool[i]!;
    }
    return pool.slice().sort((x, y) => load(x) / x.cap - load(y) / y.cap || load(x) - load(y) || x.rowNo - y.rowNo)[0]!;
  };
  let kept = 0;
  let fallback = 0;
  for (const t of queue) {
    t.assignee = null;
    if (keepExisting && t.holder) {
      t.assignee = t.holder;
      t.assignWhy = "沿用原处理人";
      byName.get(t.holder)?.assigned.push(t.id);
      kept += 1;
      continue;
    }
    let a = pick(t.group);
    if (a) {
      t.assignWhy = strategy === "round-robin" ? `${t.group}轮流派单` : `${t.group}当前最空（派前 ${load(a)}/${a.cap}）`;
    } else if (allowFallback && fallbackGroup !== t.group) {
      a = pick(fallbackGroup);
      if (a) {
        t.assignWhy = `${t.group}无人可接，转${fallbackGroup}`;
        fallback += 1;
      }
    }
    if (a) {
      t.assignee = a.name;
      a.assigned.push(t.id);
      continue;
    }
    const groupAgents = agents.filter((x) => x.groups.includes(t.group));
    t.assignWhy = !groupAgents.length
      ? `坐席表里没有${t.group}的人`
      : !groupAgents.some((x) => x.onDuty)
        ? `${t.group}没人在岗`
        : `${t.group}在岗坐席都已满额`;
  }
  state.assignDone = true;
  const done = queue.filter((t) => t.assignee).length;
  const left = queue.length - done;
  return {
    detail:
      `按「${strategy === "round-robin" ? "轮流" : "谁最空派谁"}」把 ${queue.length} 张未结工单从急到缓派出 ${done} 张` +
      (kept ? `（${kept} 张沿用原处理人）` : "") +
      (fallback ? `，${fallback} 张转${fallbackGroup}` : "") +
      (left ? `；${left} 张派不出去。` : "。"),
  };
}

function escalate(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  if (!state.slaDone) need(null, "计算时效");
  const p1BreachTo = argStr(args, "p1BreachTo", "值班经理");
  const breachTo = argStr(args, "breachTo", "客服主管");
  const riskTo = argStr(args, "riskTo", "组长");
  const unassignedTo = argStr(args, "unassignedTo", "客服主管");
  const riskMaxPriority = argNum(args, "riskMaxPriority", 2);
  const unassignedMaxPriority = argNum(args, "unassignedMaxPriority", 2);
  const tickets = liveTickets(state).filter((t) => t.open);
  for (const t of tickets) {
    t.escalation = null;
    if (t.risk === "超时" && t.priority === 1) t.escalation = { to: p1BreachTo, reason: `P1 已超时：${t.riskWhy}` };
    else if (t.risk === "超时") t.escalation = { to: breachTo, reason: t.riskWhy };
    else if (state.assignDone && !t.assignee && t.priority <= unassignedMaxPriority) {
      t.escalation = { to: unassignedTo, reason: `${P(t.priority)} 派不出去：${t.assignWhy}` };
    } else if (t.risk === "临期" && t.priority <= riskMaxPriority) t.escalation = { to: riskTo, reason: `${P(t.priority)} 临期：${t.riskWhy}` };
  }
  state.escalateDone = true;
  const list = tickets.filter((t) => t.escalation);
  const by = countBy(list, (t) => t.escalation!.to).map(([k, n]) => `${k} ${n} 张`).join("、");
  return { detail: list.length ? `需要升级 ${list.length} 张：${by}。` : "没有需要升级的工单。" };
}

function emptyQuality(key: string): QualityRow {
  return { key, total: 0, frOk: 0, frJudged: 0, resOk: 0, resJudged: 0, frSum: 0, frCount: 0, open: 0, openBreach: 0 };
}

function addQuality(row: QualityRow, t: Ticket) {
  const s = t.sla!;
  row.total += 1;
  if (s.frJudged) {
    row.frJudged += 1;
    if (!s.frBreach) row.frOk += 1;
  }
  if (s.resJudged) {
    row.resJudged += 1;
    if (!s.resBreach) row.resOk += 1;
  }
  if (t.firstResp !== null) {
    row.frSum += s.frUsed;
    row.frCount += 1;
  }
  if (t.open) {
    row.open += 1;
    if (t.risk === "超时" || s.resBreach) row.openBreach += 1;
  }
}

function quality(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  if (!state.slaDone) need(null, "计算时效");
  const targets = argObj(args, "targets");
  const fr = Number(targets.firstResponseRate ?? 0.9);
  const res = Number(targets.resolveRate ?? 0.85);
  const tickets = liveTickets(state);
  const byPriority = ([1, 2, 3, 4] as Priority[]).map((p) => {
    const row = emptyQuality(P(p));
    tickets.filter((t) => t.priority === p).forEach((t) => addQuality(row, t));
    return row;
  }).filter((r) => r.total);
  const groups = [...new Set(tickets.map((t) => t.group))];
  const byGroup = groups.map((g) => {
    const row = emptyQuality(g);
    tickets.filter((t) => t.group === g).forEach((t) => addQuality(row, t));
    return row;
  });
  const all = emptyQuality("合计");
  tickets.forEach((t) => addQuality(all, t));
  byPriority.push(all);
  const misses: string[] = [];
  for (const r of [...byPriority, ...byGroup]) {
    if (r.frJudged && r.frOk / r.frJudged < fr) misses.push(`${r.key}首响 ${fmtPct(r.frOk / r.frJudged)}`);
    if (r.resJudged && r.resOk / r.resJudged < res) misses.push(`${r.key}解决 ${fmtPct(r.resOk / r.resJudged)}`);
  }
  state.quality = { byPriority, byGroup, targets: { fr, res }, misses };
  const frRate = all.frJudged ? fmtPct(all.frOk / all.frJudged) : "无可判";
  const resRate = all.resJudged ? fmtPct(all.resOk / all.resJudged) : "无可判";
  return {
    detail:
      `整体首响达标 ${frRate}（目标 ${fmtPct(fr)}），解决达标 ${resRate}（目标 ${fmtPct(res)}）。` +
      (misses.length ? `未达标：${misses.slice(0, 6).join("、")}${misses.length > 6 ? " 等" : ""}。` : "各优先级与各组均达标。"),
  };
}

function capacityGuard(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  if (!state.assignDone) need(null, "分派坐席");
  const maxP1 = argNum(args, "maxUnassignedP1", 0);
  const maxAll = argNum(args, "maxUnassigned", -1);
  const open = liveTickets(state).filter((t) => t.open);
  const unP1 = open.filter((t) => !t.assignee && t.priority === 1);
  const unAll = open.filter((t) => !t.assignee);
  const overP1 = unP1.length > maxP1;
  const overAll = maxAll >= 0 && unAll.length > maxAll;
  if (overP1 || overAll) {
    const text = overP1
      ? `${unP1.length} 张 P1 工单派不出去（${unP1.slice(0, 5).map((t) => t.id).join("、")}），需要马上加派人手。`
      : `${unAll.length} 张工单派不出去，超过允许的 ${maxAll} 张，需要调人。`;
    state.guardNotes.push(text);
    return { detail: text, guardFailed: true };
  }
  return { detail: unAll.length ? `${unAll.length} 张工单暂未分派，都不是 P1，在允许范围内。` : "所有未结工单都有人接。" };
}

/* ───────────── 交付 ───────────── */

function slaCells(t: Ticket): string[] {
  const s = t.sla;
  if (!s) return ["", "", "", "", ""];
  return [
    s.frState.startsWith("已结·缺") ? "" : fmtMinutes(s.frUsed),
    s.frState,
    s.resState.startsWith("已结·缺") ? "" : fmtMinutes(s.resUsed),
    s.resState,
    fmtDateTime(s.resDeadline),
  ];
}

function deliverDetail(state: TicketDeskState): DeskPhaseResult {
  const all = need(state.tickets, "读入工单");
  const grid: WorkGrid = {
    columns: ["工单号", "客户", "创建时间", "分类", "处理组", "优先级", "状态", "首响用时", "首响结论", "解决已用", "解决结论", "解决时限", "风险", "处理人", "升级给", "说明"],
    rows: all.map((t) => {
      const status = !t.valid ? "数据有误" : t.mergedInto ? `并入 ${t.mergedInto}` : t.open ? "未结" : "已结";
      const notes = [...t.priorityWhy, t.catHits.length ? `命中：${t.catHits.slice(0, 3).join("、")}` : "", t.riskWhy, t.assignWhy]
        .filter(Boolean)
        .join("；");
      return [
        t.id,
        t.customer,
        t.created !== null ? fmtDateTime(t.created) : "",
        t.category,
        t.group,
        t.category ? P(t.priority) : "",
        status,
        ...(t.mergedInto || !t.valid ? ["", "", "", "", ""] : slaCells(t)),
        t.risk,
        t.assignee ?? "",
        t.escalation?.to ?? "",
        notes,
      ];
    }),
  };
  putTable(state, "detail", "工单处理明细", grid);
  return { detail: `工单处理明细 ${grid.rows.length} 行，每张单的分类、优先级、时效、处理人都在里面。`, grid };
}

function deliverAssign(state: TicketDeskState): DeskPhaseResult {
  if (!state.assignDone) need(null, "分派坐席");
  const agents = need(state.agents, "读入坐席");
  const queue = liveTickets(state).filter((t) => t.open).sort(urgencyOrder);
  const grid: WorkGrid = {
    columns: ["顺序", "工单号", "优先级", "分类", "处理组", "处理人", "分派说明", "解决时限", "剩余时间"],
    rows: queue.map((t, i) => [
      String(i + 1),
      t.id,
      P(t.priority),
      t.category,
      t.group,
      t.assignee ?? "未分派",
      t.assignWhy,
      t.sla ? fmtDateTime(t.sla.resDeadline) : "",
      t.sla ? (t.sla.remaining >= 0 ? fmtMinutes(t.sla.remaining) : `已超 ${fmtMinutes(-t.sla.remaining)}`) : "",
    ]),
  };
  putTable(state, "assign", "分派表", grid);
  const loadGrid: WorkGrid = {
    columns: ["坐席", "技能组", "在岗", "原有待办", "本次新派", "派后合计", "上限", "负载"],
    rows: agents.map((a) => {
      const total = a.backlog + a.assigned.length;
      return [a.name, a.groups.join("|"), a.onDuty ? "是" : "否", String(a.backlog), String(a.assigned.length), String(total), String(a.cap), fmtPct(total / a.cap)];
    }),
  };
  putTable(state, "load", "坐席负载", loadGrid);
  return { detail: `分派表 ${grid.rows.length} 行（按急缓排序），附坐席负载 ${loadGrid.rows.length} 人。`, grid };
}

function deliverEscalation(state: TicketDeskState): DeskPhaseResult {
  if (!state.escalateDone) need(null, "升级处理");
  const list = liveTickets(state).filter((t) => t.escalation).sort(urgencyOrder);
  const grid: WorkGrid = {
    columns: ["工单号", "客户", "客户等级", "优先级", "标题", "升级给", "原因", "处理人", "解决时限"],
    rows: list.map((t) => [
      t.id,
      t.customer,
      t.level,
      P(t.priority),
      clip(t.title || t.content, 30),
      t.escalation!.to,
      t.escalation!.reason,
      t.assignee ?? "未分派",
      t.sla ? fmtDateTime(t.sla.resDeadline) : "",
    ]),
  };
  putTable(state, "escalation", "升级清单", grid);
  return { detail: list.length ? `升级清单 ${list.length} 张。` : "升级清单为空。", grid };
}

function qualityCells(r: QualityRow, targets: { fr: number; res: number }): string[] {
  const frRate = r.frJudged ? r.frOk / r.frJudged : null;
  const resRate = r.resJudged ? r.resOk / r.resJudged : null;
  const pass = (frRate === null || frRate >= targets.fr) && (resRate === null || resRate >= targets.res);
  return [
    r.key,
    String(r.total),
    frRate === null ? "—" : `${fmtPct(frRate)}（${r.frOk}/${r.frJudged}）`,
    resRate === null ? "—" : `${fmtPct(resRate)}（${r.resOk}/${r.resJudged}）`,
    r.frCount ? fmtMinutes(r.frSum / r.frCount) : "—",
    String(r.open),
    String(r.openBreach),
    pass ? "达标" : "未达标",
  ];
}

function deliverQuality(state: TicketDeskState): DeskPhaseResult {
  const q = need(state.quality, "时效质检");
  const columns = ["维度", "工单数", "首响达标率", "解决达标率", "平均首响", "未结", "未结超时", "结论"];
  const grid: WorkGrid = { columns, rows: q.byPriority.map((r) => qualityCells(r, q.targets)) };
  putTable(state, "quality", "时效达标统计", grid);
  putTable(state, "quality-group", "各组时效", { columns, rows: q.byGroup.map((r) => qualityCells(r, q.targets)) });
  return { detail: `时效达标统计：按优先级 ${q.byPriority.length - 1} 档、按组 ${q.byGroup.length} 组。`, grid };
}

function deliverMerge(state: TicketDeskState): DeskPhaseResult {
  const all = need(state.tickets, "读入工单");
  const byId = new Map(all.map((t) => [t.id, t]));
  const rows = all
    .filter((t) => t.mergedInto)
    .map((t) => {
      const p = byId.get(t.mergedInto!)!;
      const gap = (t.created ?? 0) - (p.created ?? 0);
      return [p.id, t.id, t.customer, t.category, clip(p.title || p.content, 24), clip(t.title || t.content, 24), t.mergeScore.toFixed(2), fmtMinutes(gap)];
    });
  const grid: WorkGrid = { columns: ["主工单", "并入工单", "客户", "分类", "主单标题", "并入单标题", "相似度", "间隔"], rows };
  putTable(state, "merge", "重复合并表", grid);
  return { detail: rows.length ? `重复合并表 ${rows.length} 行。` : "没有合并的重复工单。", grid };
}

function report(state: TicketDeskState, args: DeskArgs): DeskPhaseResult {
  const all = need(state.tickets, "读入工单");
  const live = all.filter((t) => t.valid && !t.mergedInto);
  const open = live.filter((t) => t.open);
  const merged = all.filter((t) => t.mergedInto).length;
  const invalid = all.filter((t) => !t.valid).length;
  const parts: string[] = [`「${state.ticketTitle}」共 ${all.length} 张工单，未结 ${open.length} 张`];
  if (merged) parts.push(`合并重复 ${merged} 张`);
  if (invalid) parts.push(`${invalid} 张数据有误未计`);
  if (state.assignDone) {
    const done = open.filter((t) => t.assignee).length;
    parts.push(`已分派 ${done} 张${open.length - done ? `、派不出去 ${open.length - done} 张` : ""}`);
  }
  if (state.slaDone) {
    parts.push(`超时未结 ${open.filter((t) => t.risk === "超时").length} 张、临期 ${open.filter((t) => t.risk === "临期").length} 张`);
  }
  if (state.escalateDone) parts.push(`升级 ${open.filter((t) => t.escalation).length} 张`);
  if (state.quality) {
    const total = state.quality.byPriority[state.quality.byPriority.length - 1]!;
    if (total.frJudged) parts.push(`首响达标率 ${fmtPct(total.frOk / total.frJudged)}`);
    if (total.resJudged) parts.push(`解决达标率 ${fmtPct(total.resOk / total.resJudged)}`);
  }
  const summary = `${parts.join("，")}。`;
  state.summary = summary;

  const draftLevels = new Set(argList(args, "draftFor", ["P1", "P2"]));
  const maxDrafts = argNum(args, "maxDrafts", 5);
  const drafts = open
    .filter((t) => draftLevels.has(P(t.priority)))
    .sort(urgencyOrder)
    .slice(0, maxDrafts);
  const facts = [
    `结论：${summary}`,
    drafts.length ? "需要先回复客户的工单：" : "没有需要优先回复的工单。",
    ...drafts.map(
      (t) =>
        `- ${t.id}｜${P(t.priority)}｜${t.category}｜客户等级：${t.level || "未填"}｜标题：${clip(t.title, 40)}｜内容：${clip(t.content, 120)}｜处理人：${t.assignee ?? "未分派"}｜解决时限：${t.sla ? fmtDateTime(t.sla.resDeadline) : "未计算"}`,
    ),
  ].join("\n");
  return { detail: summary, summary, llmFacts: facts };
}

/* ───────────── 程序 ───────────── */

export const TICKET_DESK_PROGRAM: DeskProgram<TicketDeskState> = {
  skillId: TICKET_DESK_ID,
  guardCode: TICKET_DESK_META.guardCode,
  init: () => ({
    tickets: null,
    ticketTitle: "",
    agents: null,
    agentTitle: "",
    dataIssues: [],
    cal: null,
    calNote: "",
    asOf: null,
    classified: false,
    slaDone: false,
    assignDone: false,
    escalateDone: false,
    quality: null,
    guardNotes: [],
    tables: [],
    summary: null,
  }),
  phases: {
    __ticket_intake__: intake,
    __ticket_agents__: agentsPhase,
    __ticket_validate__: validate,
    __ticket_calendar__: calendarPhase,
    __ticket_classify__: classify,
    __ticket_priority__: priorityPhase,
    __ticket_dedupe__: dedupe,
    __ticket_sla__: slaPhase,
    __ticket_risk__: risk,
    __ticket_assign__: assign,
    __ticket_escalate__: escalate,
    __ticket_quality__: quality,
    __ticket_capacity_guard__: capacityGuard,
    __ticket_deliver_detail__: deliverDetail,
    __ticket_deliver_assign__: deliverAssign,
    __ticket_deliver_escalation__: deliverEscalation,
    __ticket_deliver_quality__: deliverQuality,
    __ticket_deliver_merge__: deliverMerge,
    __ticket_report__: report,
  },
  paper(state): TablesPaper | null {
    if (!state.tickets) return null;
    const live = state.tickets.filter((t) => t.valid && !t.mergedInto);
    const open = live.filter((t) => t.open);
    const total = state.quality?.byPriority[state.quality.byPriority.length - 1];
    const metrics: TablesPaper["metrics"] = [
      { label: "工单", value: String(state.tickets.length) },
      { label: "未结", value: String(open.length) },
    ];
    const merged = state.tickets.filter((t) => t.mergedInto).length;
    if (merged) metrics.push({ label: "合并重复", value: String(merged) });
    if (state.assignDone) {
      const left = open.filter((t) => !t.assignee).length;
      metrics.push({ label: "已分派", value: String(open.length - left), tone: "ok" });
      metrics.push({ label: "派不出去", value: String(left), tone: left ? "bad" : "ok" });
    }
    if (state.slaDone) {
      const late = open.filter((t) => t.risk === "超时").length;
      metrics.push({ label: "超时未结", value: String(late), tone: late ? "bad" : "ok" });
    }
    if (state.escalateDone) metrics.push({ label: "升级", value: String(open.filter((t) => t.escalation).length), tone: "warn" });
    if (total?.frJudged) {
      const r = total.frOk / total.frJudged;
      metrics.push({ label: "首响达标", value: fmtPct(r), tone: r >= state.quality!.targets.fr ? "ok" : "bad" });
    }
    if (total?.resJudged) {
      const r = total.resOk / total.resJudged;
      metrics.push({ label: "解决达标", value: fmtPct(r), tone: r >= state.quality!.targets.res ? "ok" : "bad" });
    }
    const notes = [
      ...state.guardNotes,
      ...(state.dataIssues.length ? [`材料里有 ${state.dataIssues.length} 处数据问题，详见工单处理明细「数据有误」行。`] : []),
      ...(state.calNote ? [`时效口径：${state.calNote}${state.asOf !== null ? `，统计截至 ${fmtDateTime(state.asOf)}` : ""}。`] : []),
    ];
    return {
      kind: "tables",
      skillId: TICKET_DESK_ID,
      tag: "工单质检",
      title: `${state.ticketTitle} · 分派与时效质检`,
      subtitle: state.summary ?? "",
      metrics,
      notes,
      tables: state.tables,
    };
  },
};
