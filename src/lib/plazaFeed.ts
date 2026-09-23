/** 知识广场客户端 — 共享问答检索 / 发布 / 导入导出（API 不可用时降级 localStorage） */

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";
const LOCAL_KEY = "oa-feed-local";
const CACHE_KEY = "oa-feed-cache";

export type PlazaItem = {
  id: string;
  question: string;
  answer: string;
  author: string;
  avatar_color: string;
  source_doc: string | null;
  tags: string[];
  likes: number;
  views: number;
  pinned: number;
  created_at: string;
  updated_at?: string;
};

export type PlazaMatch = {
  item: PlazaItem;
  score: number;
};

export type PublishResult = {
  id: string;
  offline?: boolean;
};

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((t): t is string => typeof t === "string");
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as string[]; } catch { return []; }
  }
  return [];
}

function normalizeItem(row: Record<string, unknown>): PlazaItem {
  return {
    id: String(row.id ?? ""),
    question: String(row.question ?? ""),
    answer: String(row.answer ?? ""),
    author: String(row.author ?? "匿名用户"),
    avatar_color: String(row.avatar_color ?? "#6366f1"),
    source_doc: row.source_doc ? String(row.source_doc) : null,
    tags: parseTags(row.tags),
    likes: Number(row.likes ?? 0),
    views: Number(row.views ?? 0),
    pinned: Number(row.pinned ?? 0),
    created_at: String(row.created_at ?? ""),
    updated_at: row.updated_at ? String(row.updated_at) : undefined,
  };
}

function loadLocalFeed(): PlazaItem[] {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]") as PlazaItem[];
  } catch {
    return [];
  }
}

function saveLocalFeed(items: PlazaItem[]) {
  const sorted = [...items].sort((a, b) => {
    if (b.pinned !== a.pinned) return b.pinned - a.pinned;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
  localStorage.setItem(LOCAL_KEY, JSON.stringify(sorted));
  localStorage.setItem(CACHE_KEY, JSON.stringify(sorted.slice(0, 30)));
}

function newLocalId() {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function filterByQuery(items: PlazaItem[], q: string, limit: number) {
  const query = q.trim().toLowerCase();
  const filtered = query
    ? items.filter((it) => it.question.toLowerCase().includes(query) || it.answer.toLowerCase().includes(query))
    : items;
  return filtered.slice(0, limit);
}

function createLocalItem(input: {
  question: string;
  answer: string;
  author?: string;
  tags?: string[];
  sourceDoc?: string;
}): PlazaItem {
  const now = new Date().toISOString();
  return {
    id: newLocalId(),
    question: input.question.trim(),
    answer: input.answer.trim(),
    author: input.author?.trim() || "匿名用户",
    avatar_color: "#6366f1",
    source_doc: input.sourceDoc ?? null,
    tags: input.tags ?? [],
    likes: 0,
    views: 0,
    pinned: 0,
    created_at: now,
    updated_at: now,
  };
}

export async function listPlaza(q = "", limit = 50): Promise<{ items: PlazaItem[]; total: number; offline?: boolean }> {
  try {
    const res = await fetch(`${API}/api/feed?q=${encodeURIComponent(q)}&limit=${limit}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json() as { items: Record<string, unknown>[]; total: number };
    const items = data.items.map(normalizeItem);
    localStorage.setItem(CACHE_KEY, JSON.stringify(items.slice(0, 30)));
    return { items, total: data.total };
  } catch {
    let local = loadLocalFeed();
    if (local.length === 0) {
      try {
        local = JSON.parse(localStorage.getItem(CACHE_KEY) || "[]") as PlazaItem[];
      } catch { /* */ }
    }
    const items = filterByQuery(local, q, limit);
    return { items, total: items.length, offline: true };
  }
}

export function scorePlazaLocal(query: string, item: PlazaItem): number {
  const q = query.trim().toLowerCase();
  const title = item.question.trim().toLowerCase();
  if (!q || !title) return 0;
  if (q === title) return 100;
  if (title.includes(q) || q.includes(title)) return 88;
  const qTokens = q.split(/[\s，。？?、]+/).filter((t) => t.length >= 2);
  if (qTokens.length === 0) return 0;
  const hit = qTokens.filter((t) => title.includes(t) || item.answer.toLowerCase().includes(t)).length;
  return Math.round((hit / qTokens.length) * 80);
}

export async function matchPlaza(query: string): Promise<PlazaMatch | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(`${API}/api/feed/match?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data = await res.json() as { match: PlazaMatch | null };
      if (data.match?.item) {
        return {
          item: normalizeItem(data.match.item as unknown as Record<string, unknown>),
          score: data.match.score,
        };
      }
    }
  } catch { /* fallback local */ }
  const { items } = await listPlaza(q, 20);
  let best: PlazaMatch | null = null;
  for (const item of items) {
    const score = scorePlazaLocal(q, item);
    if (!best || score > best.score) best = { item, score };
  }
  return best && best.score >= 40 ? best : null;
}

export async function publishPlaza(input: {
  question: string;
  answer: string;
  author?: string;
  tags?: string[];
  sourceDoc?: string;
}): Promise<PublishResult> {
  try {
    const res = await fetch(`${API}/api/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json() as { id: string };
    return { id: data.id };
  } catch {
    const item = createLocalItem(input);
    saveLocalFeed([item, ...loadLocalFeed()]);
    return { id: item.id, offline: true };
  }
}

export async function updatePlaza(
  id: string,
  input: { question?: string; answer?: string; author?: string; tags?: string[] },
): Promise<{ offline?: boolean }> {
  try {
    const res = await fetch(`${API}/api/feed/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await res.text());
    return {};
  } catch {
    const items = loadLocalFeed();
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) throw new Error("条目不存在");
    items[idx] = {
      ...items[idx]!,
      question: input.question ?? items[idx]!.question,
      answer: input.answer ?? items[idx]!.answer,
      author: input.author ?? items[idx]!.author,
      tags: input.tags ?? items[idx]!.tags,
      updated_at: new Date().toISOString(),
    };
    saveLocalFeed(items);
    return { offline: true };
  }
}

export async function deletePlaza(id: string): Promise<{ offline?: boolean }> {
  try {
    const res = await fetch(`${API}/api/feed/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(await res.text());
    return {};
  } catch {
    saveLocalFeed(loadLocalFeed().filter((it) => it.id !== id));
    return { offline: true };
  }
}

export async function importPlaza(
  items: { question: string; answer: string; author?: string; tags?: string[] }[],
): Promise<{ ok: boolean; count: number; offline?: boolean }> {
  try {
    const res = await fetch(`${API}/api/feed/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ ok: boolean; count: number }>;
  } catch {
    const created = items.map((it) => createLocalItem(it));
    saveLocalFeed([...created, ...loadLocalFeed()]);
    return { ok: true, count: created.length, offline: true };
  }
}

export async function exportPlaza(): Promise<PlazaItem[]> {
  try {
    const res = await fetch(`${API}/api/feed/export`);
    if (res.ok) {
      const data = await res.json() as { items: Record<string, unknown>[] };
      return data.items.map(normalizeItem);
    }
  } catch { /* */ }
  const { items } = await listPlaza("", 200);
  return items;
}

export function formatThreadAsPlaza(thread: { role: string; content: string }[]): { question: string; answer: string } | null {
  const pairs: string[] = [];
  let firstQ = "";
  for (let i = 0; i < thread.length; i++) {
    const m = thread[i];
    if (m.role === "user") {
      if (!firstQ) firstQ = m.content.trim();
      const next = thread[i + 1];
      const ans = next?.role === "assistant" ? next.content.trim() : "";
      pairs.push(`问：${m.content.trim()}\n答：${ans || "（无回答）"}`);
    }
  }
  if (!firstQ || pairs.length === 0) return null;
  const title = pairs.length > 1 ? `对话纪要：${firstQ.slice(0, 36)}${firstQ.length > 36 ? "…" : ""}` : firstQ;
  return { question: title, answer: pairs.join("\n\n---\n\n") };
}
