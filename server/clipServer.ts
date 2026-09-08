import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";

const PORT = Number(process.env.CLIP_PORT ?? 38472);
export const CLIP_HUB_TOKEN = process.env.CLIP_HUB_TOKEN ?? "clip-dev-token";

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

function authToken(c: { req: { header: (n: string) => string | undefined } }) {
  return c.req.header("X-Clip-Token") ?? c.req.header("x-clip-token") ?? "";
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw);
      return Array.isArray(j) ? j.map(String).filter(Boolean) : [];
    } catch {
      return raw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

function rowToSnippet(row: Record<string, unknown>): ClipSnippet {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    pageUrl: row.page_url ? String(row.page_url) : undefined,
    pageTitle: row.page_title ? String(row.page_title) : undefined,
    textFragment: row.text_fragment ? String(row.text_fragment) : undefined,
    scrollY: row.scroll_y != null ? Number(row.scroll_y) : null,
    tags: parseTags(row.tags ?? "[]"),
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (origin) => origin ?? "*",
    allowHeaders: ["Content-Type", "X-Clip-Token"],
  }),
);

app.get("/health", (c) => {
  if (authToken(c) !== CLIP_HUB_TOKEN) {
    return c.json({ ok: false, error: "token 无效" }, 401);
  }
  const count = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM clip_snippets");
  return c.json({ ok: true, snippets: count?.c ?? 0 });
});

app.get("/snippets", (c) => {
  if (authToken(c) !== CLIP_HUB_TOKEN) {
    return c.json({ error: "token 无效" }, 401);
  }
  const rows = dbAll<Record<string, unknown>>(
    "SELECT * FROM clip_snippets ORDER BY created_at DESC LIMIT 500",
  );
  return c.json({ items: rows.map(rowToSnippet) });
});

app.post("/snippets", async (c) => {
  if (authToken(c) !== CLIP_HUB_TOKEN) {
    return c.json({ error: "token 无效" }, 401);
  }
  const body = (await c.req.json()) as ClipSnippet;
  if (!body.id || !body.content) {
    return c.json({ error: "缺少 id 或 content" }, 400);
  }
  const createdAt = body.createdAt ?? nowIso();
  const tags = JSON.stringify(parseTags(body.tags ?? []));
  dbRun(
    `INSERT INTO clip_snippets (id, title, content, page_url, page_title, text_fragment, scroll_y, tags, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       content = excluded.content,
       page_url = excluded.page_url,
       page_title = excluded.page_title,
       text_fragment = excluded.text_fragment,
       scroll_y = excluded.scroll_y,
       tags = excluded.tags,
       created_at = excluded.created_at`,
    [
      body.id,
      body.title ?? "",
      body.content,
      body.pageUrl ?? null,
      body.pageTitle ?? null,
      body.textFragment ?? null,
      body.scrollY ?? null,
      tags,
      createdAt,
    ],
  );
  return c.json({ ...body, tags: parseTags(tags), createdAt });
});

app.patch("/snippets/:id", async (c) => {
  if (authToken(c) !== CLIP_HUB_TOKEN) {
    return c.json({ error: "token 无效" }, 401);
  }
  const body = (await c.req.json()) as { tags?: string[] };
  const tags = JSON.stringify(parseTags(body.tags ?? []));
  dbRun("UPDATE clip_snippets SET tags = ? WHERE id = ?", [tags, c.req.param("id")]);
  return c.json({ ok: true, tags: parseTags(tags) });
});

app.delete("/snippets/:id", (c) => {
  if (authToken(c) !== CLIP_HUB_TOKEN) {
    return c.json({ error: "token 无效" }, 401);
  }
  dbRun("DELETE FROM clip_snippets WHERE id = ?", [c.req.param("id")]);
  return c.json({ ok: true });
});

console.log(`[clip-hub] http://127.0.0.1:${PORT} · token=${CLIP_HUB_TOKEN}`);

serve({ fetch: app.fetch, port: PORT });
