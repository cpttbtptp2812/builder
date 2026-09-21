/** 客户向思考时间线 — 结构化证据 + 可读 chips */

export type FlowJournalId = "read" | "route" | "fetch" | "write";

export type FlowEvidence = {
  id: string;
  kind: "query" | "route" | "hit" | "tool" | "stream";
  title: string;
  excerpt?: string;
  score?: number;
  meta?: string;
};

export type FlowJournalNode = {
  id: FlowJournalId;
  label: string;
  hint: string;
  status: "pending" | "active" | "done";
  chips: string[];
  evidence: FlowEvidence[];
};

const LABELS: Record<FlowJournalId, { label: string; hint: string }> = {
  read: { label: "读问题", hint: "Agent 先理解您问了什么" },
  route: { label: "定路径", hint: "判断走知识库、工具还是技能" },
  fetch: { label: "取材料", hint: "检索知识库或调用工具拿依据" },
  write: { label: "写答复", hint: "基于材料组织回答" },
};

function syncChips(evidence: FlowEvidence[]): string[] {
  return evidence.map((e) => {
    if (e.kind === "hit" && e.score != null) return `${e.title} · 相关度 ${(e.score * 100).toFixed(0)}%`;
    if (e.meta) return `${e.title} · ${e.meta}`;
    return e.title;
  });
}

function patchNode(node: FlowJournalNode, evidence: FlowEvidence[]): FlowJournalNode {
  return { ...node, evidence, chips: syncChips(evidence) };
}

export function createFlowJournal(query: string): FlowJournalNode[] {
  const q = query.trim();
  const preview = q.length > 72 ? `${q.slice(0, 72)}…` : q;
  const readEvidence: FlowEvidence[] = preview
    ? [{ id: "q", kind: "query", title: preview, excerpt: q.length > preview.length ? q : undefined }]
    : [];

  return (["read", "route", "fetch", "write"] as FlowJournalId[]).map((id, i) => ({
    id,
    label: LABELS[id].label,
    hint: LABELS[id].hint,
    status: i === 0 ? "active" : "pending",
    evidence: id === "read" ? readEvidence : [],
    chips: id === "read" ? syncChips(readEvidence) : [],
  }));
}

export function activateFlowNode(journal: FlowJournalNode[], id: FlowJournalId): FlowJournalNode[] {
  let seen = false;
  return journal.map((n) => {
    if (n.id === id) {
      seen = true;
      return { ...n, status: "active" };
    }
    if (!seen && n.status === "active") return { ...n, status: "done" };
    return n;
  });
}

export function addFlowEvidence(journal: FlowJournalNode[], id: FlowJournalId, item: FlowEvidence): FlowJournalNode[] {
  return journal.map((n) => {
    if (n.id !== id) return n;
    if (n.evidence.some((e) => e.id === item.id)) return n;
    return patchNode(n, [...n.evidence, item].slice(-10));
  });
}

export function setFlowEvidence(journal: FlowJournalNode[], id: FlowJournalId, evidence: FlowEvidence[]): FlowJournalNode[] {
  return journal.map((n) => (n.id === id ? patchNode(n, evidence.slice(0, 10)) : n));
}

export function addFlowChip(journal: FlowJournalNode[], id: FlowJournalId, chip: string): FlowJournalNode[] {
  const t = chip.trim();
  if (!t) return journal;
  const item: FlowEvidence = { id: `chip-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, kind: "route", title: t };
  return addFlowEvidence(journal, id, item);
}

export function setFlowChips(journal: FlowJournalNode[], id: FlowJournalId, chips: string[]): FlowJournalNode[] {
  const evidence = chips.filter(Boolean).map((c, i) => ({
    id: `stream-${i}`,
    kind: "stream" as const,
    title: c,
  }));
  return setFlowEvidence(journal, id, evidence);
}

export function finishFlowJournal(journal: FlowJournalNode[]): FlowJournalNode[] {
  return journal.map((n) => ({ ...n, status: "done" as const }));
}

/** 兼容旧会话数据 — 补全 evidence、去重 id */
const VALID_IDS = new Set<FlowJournalId>(["read", "route", "fetch", "write"]);

export function normalizeFlowJournal(journal: FlowJournalNode[] | undefined | null): FlowJournalNode[] {
  if (!Array.isArray(journal) || !journal.length) return [];
  const seenIds = new Set<string>();
  return journal
    .map((raw) => {
    const n = raw as Partial<FlowJournalNode>;
    if (!n.id || !VALID_IDS.has(n.id as FlowJournalId)) return null;
    let evidence: FlowEvidence[] = Array.isArray(n.evidence)
      ? n.evidence.filter((e): e is FlowEvidence => Boolean(e && e.kind && e.title))
      : [];
    if (!evidence.length && Array.isArray(n.chips)) {
      evidence = n.chips.filter(Boolean).map((title, i) => ({
        id: `legacy-${n.id ?? "x"}-${i}`,
        kind: "stream" as const,
        title: String(title),
      }));
    }
    evidence = evidence.map((e, i) => {
      let id = e.id || `${n.id}-${i}`;
      if (seenIds.has(id)) id = `${id}-${i}`;
      seenIds.add(id);
      return { ...e, id };
    });
    return {
      id: n.id as FlowJournalId,
      label: n.label ?? LABELS[n.id as FlowJournalId]?.label ?? "步骤",
      hint: n.hint ?? LABELS[n.id as FlowJournalId]?.hint ?? "",
      status: n.status ?? "done",
      evidence,
      chips: syncChips(evidence),
    };
  })
    .filter((n): n is FlowJournalNode => n != null);
}

export function flowJournalStats(journal: FlowJournalNode[]) {
  const safe = normalizeFlowJournal(journal);
  const hits = safe.flatMap((n) => n.evidence).filter((e) => e?.kind === "hit");
  const scores = hits.map((h) => h.score).filter((s): s is number => s != null);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  return {
    hitCount: hits.length,
    evidenceCount: safe.reduce((n, j) => n + j.evidence.length, 0),
    avgScore,
    doneSteps: safe.filter((n) => n.status === "done").length,
  };
}

export function evidenceFromKnowledgeResult(content: unknown): FlowEvidence[] {
  const hits = (content as { hits?: { title?: string; score?: number; excerpt?: string; chunkId?: string }[] })?.hits ?? [];
  if (!hits.length) {
    return [{ id: "miss", kind: "hit", title: "知识库暂无匹配", meta: "0 段" }];
  }
  return hits.slice(0, 6).map((h, i) => ({
    id: `${h.chunkId ?? "hit"}-${i}`,
    kind: "hit" as const,
    title: h.title?.trim() || "相关条目",
    excerpt: h.excerpt?.trim().slice(0, 160),
    score: h.score,
    meta: h.score != null ? `${(h.score * 100).toFixed(0)}%` : undefined,
  }));
}

export function chipsFromKnowledgeResult(content: unknown): string[] {
  return syncChips(evidenceFromKnowledgeResult(content));
}

export function evidenceFromTool(name: string, content: unknown, preview?: string): FlowEvidence {
  return {
    id: `tool-${name}-${Date.now()}`,
    kind: "tool",
    title: toolLabelZh(name),
    excerpt: preview?.trim() || previewFromToolContent(name, content) || undefined,
    meta: preview?.trim() ? undefined : "已完成",
  };
}

export function chipFromTool(name: string, content: unknown, preview?: string): string {
  const e = evidenceFromTool(name, content, preview);
  return e.excerpt ? `${e.title}：${e.excerpt}` : e.title;
}

function toolLabelZh(name: string): string {
  const map: Record<string, string> = {
    knowledge_search: "知识检索",
    http_probe: "站点探活",
    browser_snapshot: "页面快照",
    policy_search: "制度检索",
  };
  return map[name] ?? name;
}

function previewFromToolContent(name: string, content: unknown): string {
  if (content == null) return "";
  const c = content as Record<string, unknown>;
  if (name === "knowledge_search") {
    const hits = (c.hits as unknown[] | undefined)?.length ?? 0;
    return hits ? `命中 ${hits} 段` : "未命中";
  }
  if (name === "http_probe") return `${c.status ?? "—"} · ${c.latencyMs ?? "—"}ms`;
  if (name === "browser_snapshot") return `${c.nodeCount ?? "—"} 个节点`;
  return typeof content === "string" ? content.slice(0, 40) : "";
}
