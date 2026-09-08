/** ClipHub 片段 — 与扩展 / 桌面同步服务共用结构 */

export type ClipSnippet = {
  id: string;
  title: string;
  content: string;
  pageUrl?: string;
  pageTitle?: string;
  textFragment?: string;
  scrollY?: number | null;
  tags?: string[];
  createdAt?: string;
};

const TOKEN_KEY = "clipHubToken";
const DEFAULT_TOKEN = "clip-dev-token";

export function clipApiBase() {
  if (import.meta.env.DEV) return "/clip-api";
  return "http://127.0.0.1:38472";
}

export function getClipToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || DEFAULT_TOKEN;
  } catch {
    return DEFAULT_TOKEN;
  }
}

export function setClipToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

function mapSnippet(row: Record<string, unknown>): ClipSnippet {
  let tags: string[] = [];
  if (Array.isArray(row.tags)) tags = row.tags.map(String);
  else if (typeof row.tags === "string") {
    try {
      const j = JSON.parse(row.tags);
      tags = Array.isArray(j) ? j.map(String) : [];
    } catch {
      tags = [];
    }
  }
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    content: String(row.content),
    pageUrl: row.pageUrl ? String(row.pageUrl) : row.page_url ? String(row.page_url) : undefined,
    pageTitle: row.pageTitle ? String(row.pageTitle) : row.page_title ? String(row.page_title) : undefined,
    textFragment: row.textFragment ? String(row.textFragment) : undefined,
    scrollY: row.scrollY != null ? Number(row.scrollY) : null,
    tags,
    createdAt: row.createdAt ? String(row.createdAt) : row.created_at ? String(row.created_at) : undefined,
  };
}

export async function clipHealth(): Promise<{ ok: boolean; snippets?: number; error?: string }> {
  try {
    const res = await fetch(`${clipApiBase()}/health`, {
      headers: { "X-Clip-Token": getClipToken() },
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error ?? "连接失败" };
    return { ok: true, snippets: data.snippets };
  } catch {
    return { ok: false, error: "同步服务未启动（npm run dev:clip）" };
  }
}

export async function fetchClips(): Promise<{ items: ClipSnippet[]; error?: string }> {
  try {
    const res = await fetch(`${clipApiBase()}/snippets`, {
      headers: { "X-Clip-Token": getClipToken() },
    });
    const data = await res.json();
    if (!res.ok) return { items: [], error: data.error ?? "加载失败" };
    return { items: (data.items ?? []).map(mapSnippet) };
  } catch {
    return { items: [], error: "无法连接同步服务" };
  }
}

export async function updateClipTags(id: string, tags: string[]): Promise<boolean> {
  const res = await fetch(`${clipApiBase()}/snippets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "X-Clip-Token": getClipToken() },
    body: JSON.stringify({ tags }),
  });
  return res.ok;
}

export async function deleteClip(id: string): Promise<boolean> {
  const res = await fetch(`${clipApiBase()}/snippets/${id}`, {
    method: "DELETE",
    headers: { "X-Clip-Token": getClipToken() },
  });
  return res.ok;
}

export function hostFrom(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function buildOpenUrl(item: ClipSnippet): string | null {
  if (!item.pageUrl) return null;
  const base = item.pageUrl.split("#")[0];
  if (item.textFragment) return base + item.textFragment;
  if (item.scrollY != null) return `${base}#clip-y-${item.scrollY}`;
  return base;
}

export function clipsToMarkdown(items: ClipSnippet[]): string {
  return items
    .map((item, i) => {
      const src = item.pageUrl ? `[${item.pageTitle || item.pageUrl}](${item.pageUrl})` : "";
      const tagLine = item.tags?.length ? `标签：${item.tags.join(", ")}\n\n` : "";
      return `## ${i + 1}. ${item.title || "片段"}\n\n${tagLine}> ${item.content.replace(/\n/g, "\n> ")}\n\n${src ? `来源：${src}\n` : ""}`;
    })
    .join("\n---\n\n");
}

export function parseTagInput(raw: string): string[] {
  return [...new Set(raw.split(/[,，\s#]+/).map((s) => s.trim()).filter(Boolean))];
}

export { DEFAULT_TOKEN };
