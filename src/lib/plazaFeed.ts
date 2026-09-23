/** 知识广场客户端 — 共享问答检索 / 发布 / 导入导出 */

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

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

export async function listPlaza(q = "", limit = 50): Promise<{ items: PlazaItem[]; total: number }> {
  try {
    const res = await fetch(`${API}/api/feed?q=${encodeURIComponent(q)}&limit=${limit}`);
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json() as { items: Record<string, unknown>[]; total: number };
    const items = data.items.map(normalizeItem);
    localStorage.setItem("oa-feed-cache", JSON.stringify(items.slice(0, 30)));
    return { items, total: data.total };
  } catch {
    try {
      const cached = JSON.parse(localStorage.getItem("oa-feed-cache") || "[]") as PlazaItem[];
      const query = q.trim().toLowerCase();
      const items = query
        ? cached.filter((it) => it.question.toLowerCase().includes(query) || it.answer.toLowerCase().includes(query))
        : cached;
      return { items, total: items.length };
    } catch {
      return { items: [], total: 0 };
    }
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
      if (data.match?.item) return { item: normalizeItem(data.match.item as unknown as Record<string, unknown>), score: data.match.score };
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
}): Promise<string | null> {
  const res = await fetch(`${API}/api/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json() as { id: string };
  return data.id;
}

export async function updatePlaza(id: string, input: { question?: string; answer?: string; author?: string; tags?: string[] }) {
  const res = await fetch(`${API}/api/feed/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await res.text());
}

export async function deletePlaza(id: string) {
  const res = await fetch(`${API}/api/feed/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
}

export async function importPlaza(items: { question: string; answer: string; author?: string; tags?: string[] }[]) {
  const res = await fetch(`${API}/api/feed/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ ok: boolean; count: number }>;
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
