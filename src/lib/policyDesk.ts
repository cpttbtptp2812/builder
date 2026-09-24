import { loadPolicyHandbook, loadPolicySettings, matchPolicyRules } from "./policyConfig";

/** 制度值班 — 能力信封 + 出处锁 + 工单预演 */

export type Capability = "read" | "mutate" | "abstain";
export type PolicyOutcome = "GROUNDED" | "POLICY_CONFLICT" | "NEEDS_HITL" | "COMMITTED" | "REFUSED";

export type PolicyClause = {
  id: string;
  topic: "leave" | "overtime" | "vpn" | "reimburse";
  status: "current" | "abolished";
  text: string;
  slot?: string;
  value?: string;
  condition?: string;
};

export type PolicyHit = PolicyClause & { score: number };

export type TicketDraft = {
  id: string;
  title: string;
  action: string;
  status: "draft" | "allowed" | "denied";
  createdAt: number;
};

export type CapabilityDecision = {
  cap: Capability;
  matched: boolean;
  reason: string;
  topic?: PolicyClause["topic"];
};

export type PolicyDeskResult = {
  query: string;
  capability: CapabilityDecision;
  outcome: PolicyOutcome;
  citations: PolicyHit[];
  facts: { slot: string; value: string; clauseId: string; condition?: string }[];
  ticket: TicketDraft | null;
  markdown: string;
};

export const POLICY_HANDBOOK: PolicyClause[] = [
  {
    id: "KB-休假-现行-1年",
    topic: "leave",
    status: "current",
    text: "现行制度：员工司龄满 1 年，年假 10 天。",
    slot: "leave.days",
    value: "10",
    condition: "司龄≥1年",
  },
  {
    id: "KB-休假-现行-5年",
    topic: "leave",
    status: "current",
    text: "现行制度：员工司龄满 5 年，年假 15 天。",
    slot: "leave.days",
    value: "15",
    condition: "司龄≥5年",
  },
  {
    id: "KB-休假-2022废止",
    topic: "leave",
    status: "abolished",
    text: "已废止（2022）：入职即可休年假 5 天。本条不得与现行天数写进同一句。",
    slot: "leave.days",
    value: "5",
    condition: "已废止",
  },
  {
    id: "KB-加班-禁止抵假",
    topic: "overtime",
    status: "current",
    text: "加班不得抵扣年假。休假制度与加班制度均写明禁止。",
    slot: "leave.offset",
    value: "forbidden",
  },
  {
    id: "KB-报销-发票",
    topic: "reimburse",
    status: "current",
    text: "报销须附合规发票，缺发票不得入账。",
    slot: "reimburse.invoice",
    value: "required",
  },
  {
    id: "KB-VPN-工单",
    topic: "vpn",
    status: "current",
    text: "开通 VPN、更换设备、改系统权限必须走工单，对话里不得直接开通。",
    slot: "vpn.channel",
    value: "ticket",
  },
];

const TICKET_KEY = "ownagent-policy-tickets";

function loadTickets(): TicketDraft[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(TICKET_KEY);
    return raw ? (JSON.parse(raw) as TicketDraft[]) : [];
  } catch {
    return [];
  }
}

function saveTickets(list: TicketDraft[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(TICKET_KEY, JSON.stringify(list.slice(0, 20)));
}

let tickets: TicketDraft[] = loadTickets();

export function getTicket(id: string): TicketDraft | null {
  return tickets.find((t) => t.id === id) ?? null;
}

export function listTickets() {
  return tickets;
}

export function classifyCapability(query: string): CapabilityDecision {
  const hit = matchPolicyRules(query, loadPolicySettings());
  return {
    cap: hit.cap,
    matched: hit.matched,
    reason: hit.reason,
    topic: hit.topic,
  };
}

export function getPolicyHandbook() {
  return loadPolicyHandbook();
}

export function searchPolicy(query: string, topK = 4): PolicyHit[] {
  const q = query.toLowerCase();
  const tokens = q.match(/[\u4e00-\u9fff]{1,8}|[a-z0-9]{2,}/g) ?? [];
  const cap = classifyCapability(query);

  return getPolicyHandbook().map((clause) => {
    const text = clause.text.toLowerCase();
    let score = tokens.filter((t) => text.includes(t) || clause.id.toLowerCase().includes(t)).length * 0.14;
    if (cap.topic && clause.topic === cap.topic) score += 0.28;
    if (q.includes("5") && clause.value === "5") score += 0.2;
    if (q.includes("10") && clause.value === "10") score += 0.2;
    if (/废止|旧|以前|有人说/.test(q) && clause.status === "abolished") score += 0.22;
    if (clause.status === "abolished" && !/废止|旧|以前|有人说|5\s*天/.test(q)) score -= 0.08;
    return { ...clause, score: Math.min(0.99, score) };
  })
    .filter((h) => h.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function detectConflict(hits: PolicyHit[]) {
  const bySlot = new Map<string, PolicyHit[]>();
  for (const h of hits) {
    if (!h.slot || !h.value) continue;
    const key = h.slot;
    bySlot.set(key, [...(bySlot.get(key) ?? []), h]);
  }
  for (const [slot, rows] of bySlot) {
    const currents = rows.filter((r) => r.status === "current");
    const abolished = rows.filter((r) => r.status === "abolished");
    const currentValues = new Set(currents.map((r) => r.value));
    if (abolished.length && currents.length && abolished.some((a) => !currentValues.has(a.value))) {
      return { slot, left: currents[0]!, right: abolished[0]! };
    }
    const sameCond = currents.filter((a, i) =>
      currents.some((b, j) => i !== j && a.condition === b.condition && a.value !== b.value),
    );
    if (sameCond.length) return { slot, left: sameCond[0]!, right: sameCond[1]! };
  }
  return null;
}

export function draftTicket(action: string, title: string): TicketDraft {
  const ticket: TicketDraft = {
    id: `tkt-${Date.now().toString(36)}`,
    title,
    action,
    status: "draft",
    createdAt: Date.now(),
  };
  tickets = [ticket, ...tickets].slice(0, 20);
  saveTickets(tickets);
  return ticket;
}

export function resolveTicket(id: string, status: "allowed" | "denied"): TicketDraft | null {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket || ticket.status !== "draft") return null;
  ticket.status = status;
  saveTickets(tickets);
  return ticket;
}

export function commitTicket(id: string): { ok: boolean; ticket?: TicketDraft; error?: string } {
  const ticket = tickets.find((t) => t.id === id);
  if (!ticket) return { ok: false, error: "工单不存在" };
  if (ticket.status === "draft") return { ok: false, error: "未人工确认，拒绝提交" };
  if (ticket.status === "denied") return { ok: false, error: "工单已拒绝" };
  return { ok: true, ticket };
}

function factsFromHits(hits: PolicyHit[]) {
  return hits
    .filter((h) => h.slot && h.value && h.status === "current")
    .map((h) => ({ slot: h.slot!, value: h.value!, clauseId: h.id, condition: h.condition }));
}

export function runPolicyDesk(query: string, opts?: { persistTicket?: boolean }): PolicyDeskResult {
  const settings = loadPolicySettings();
  const capability = classifyCapability(query);

  if (capability.cap === "abstain") {
    return {
      query,
      capability,
      outcome: "REFUSED",
      citations: [],
      facts: [],
      ticket: null,
      markdown: [
        `已拒绝 — ${capability.reason}`,
        "",
        settings.refuseMessage,
      ].join("\n"),
    };
  }

  if (capability.cap === "mutate") {
    const citations = searchPolicy(query);
    const ticket =
      opts?.persistTicket === false
        ? { id: "eval-dry-run", title: "开通 VPN / 设备权限（预演）", action: "vpn.provision", status: "draft" as const, createdAt: 0 }
        : draftTicket("vpn.provision", "开通 VPN / 设备权限（预演）");
    return {
      query,
      capability,
      outcome: "NEEDS_HITL",
      citations,
      facts: factsFromHits(citations),
      ticket,
      markdown: [
        `能力信封：**mutate（只许起草）** — ${capability.reason}`,
        "",
        `已起草工单 \`${ticket.id}\`，状态 draft。对话里没有开通，点「允许」才提交。`,
        citations[0] ? `依据：${citations[0].id} ${citations[0].text}` : "",
      ].join("\n"),
    };
  }

  const rawHits = searchPolicy(query);
  const askedOld = /废止|旧|以前|有人说|5\s*天/.test(query);
  const citations = askedOld ? rawHits : rawHits.filter((c) => c.status === "current");
  const conflict = detectConflict(citations);
  if (conflict) {
    return {
      query,
      capability,
      outcome: "POLICY_CONFLICT",
      citations,
      facts: factsFromHits(citations),
      ticket: null,
      markdown: [
        `能力信封：**read** — ${capability.reason}`,
        "",
        `冲突熔断：\`${conflict.left.id}\` = ${conflict.left.value}，\`${conflict.right.id}\` = ${conflict.right.value}。`,
        "同一条件下新旧取值不同，不合成一句，转人工。",
        "",
        ...citations.map((c) => `- ${c.id}（${c.status}） ${c.text}`),
      ].join("\n"),
    };
  }

  if (!citations.length && settings.requireCitation) {
    return {
      query,
      capability,
      outcome: "REFUSED",
      citations: [],
      facts: [],
      ticket: null,
      markdown: `未找到可引用的制度条款。请在「回答规则 → 制度条款」补充内容，或调整关键词规则。`,
    };
  }

  return {
    query,
    capability,
    outcome: "GROUNDED",
    citations,
    facts: factsFromHits(citations),
    ticket: null,
    markdown: [
      `能力信封：**read** — ${capability.reason}`,
      "",
      "只输出手册原句：",
      "",
      ...citations.map((c) => `- [${c.id}] ${c.text}`),
    ].join("\n"),
  };
}

export const POLICY_EVAL_CASES = [
  { id: "p1", query: "满一年年假几天", expectedCap: "read" as Capability, expectedOutcome: "GROUNDED" as PolicyOutcome, expectedSkillId: "policy-desk" },
  { id: "p2", query: "有人说年假 5 天也有人说 10 天", expectedCap: "read" as Capability, expectedOutcome: "POLICY_CONFLICT" as PolicyOutcome, expectedSkillId: "policy-desk" },
  { id: "p3", query: "帮我开通公司 VPN", expectedCap: "mutate" as Capability, expectedOutcome: "NEEDS_HITL" as PolicyOutcome, expectedSkillId: "policy-desk" },
  { id: "p4", query: "公司什么时候上市", expectedCap: "abstain" as Capability, expectedOutcome: "REFUSED" as PolicyOutcome, expectedSkillId: "policy-desk" },
  { id: "p5", query: "加班能不能抵年假", expectedCap: "read" as Capability, expectedOutcome: "GROUNDED" as PolicyOutcome, expectedSkillId: "policy-desk" },
] as const;

export function runPolicyEval() {
  return POLICY_EVAL_CASES.map((c) => {
    const result = runPolicyDesk(c.query, { persistTicket: false });
    const pass = result.capability.cap === c.expectedCap && result.outcome === c.expectedOutcome;
    return {
      ...c,
      predictedCap: result.capability.cap,
      predictedOutcome: result.outcome,
      ticketStatus: result.ticket?.status ?? null,
      committed: result.ticket?.status === "allowed",
      pass,
    };
  });
}

export function policyEvalSummary(rows: ReturnType<typeof runPolicyEval>) {
  const pass = rows.filter((r) => r.pass).length;
  const leakedCommit = rows.filter((r) => r.committed).length;
  return {
    total: rows.length,
    pass,
    accuracy: rows.length ? Math.round((pass / rows.length) * 100) : 0,
    leakedCommit,
  };
}
