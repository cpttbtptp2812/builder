/** 外部工具：只按声明的地址、权限和超时，经网关调用。不在主进程里跑对方的代码。 */

import type { Context, Hono } from "hono";
import type { ToolCapability } from "../src/lib/platformProtocol.ts";
import { dbAll, dbGet, dbRun, nowIso } from "./db.ts";
import { fetchExternal, readResponseTextLimited } from "./security.ts";
import { teamAccess } from "./skillGate.ts";

export type ExternalTool = {
  name: string;
  title: string;
  endpoint: string;
  capability: ToolCapability;
  timeoutMs: number;
};

export function listExternalTools(): ExternalTool[] {
  return dbAll<{ name: string; title: string; endpoint: string; capability: string; timeout_ms: number }>(
    `SELECT name, title, endpoint, capability, timeout_ms FROM external_tools ORDER BY name`,
  ).map(toTool);
}

export function externalTool(name: string): ExternalTool | null {
  const row = dbGet<{ name: string; title: string; endpoint: string; capability: string; timeout_ms: number }>(
    `SELECT name, title, endpoint, capability, timeout_ms FROM external_tools WHERE name = ?`,
    [name],
  );
  return row ? toTool(row) : null;
}

function toTool(row: { name: string; title: string; endpoint: string; capability: string; timeout_ms: number }): ExternalTool {
  const capability = row.capability === "network" || row.capability === "model" || row.capability === "write" ? row.capability : "read";
  return { name: row.name, title: row.title, endpoint: row.endpoint, capability, timeoutMs: row.timeout_ms };
}

export async function callExternalTool(tool: ExternalTool, args: Record<string, unknown>): Promise<{ content: unknown; isError?: boolean }> {
  const res = await fetchExternal(
    tool.endpoint,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: tool.name, args }) },
    { timeoutMs: tool.timeoutMs, maxBytes: 256 * 1024 },
  );
  const text = await readResponseTextLimited(res, 256 * 1024);
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* 对方没回 JSON 就保留原文 */
  }
  if (!res.ok) return { content: { error: `外部工具返回 ${res.status}`, body }, isError: true };
  return { content: body };
}

export function registerExternalTools(app: Hono) {
  app.get("/api/tools/external", (c) => {
    const access = allow(c);
    if (!access.ok) return c.json({ error: access.error }, access.status);
    return c.json({ tools: listExternalTools() });
  });
  app.post("/api/tools/external", async (c) => {
    const access = allow(c);
    if (!access.ok) return c.json({ error: access.error }, access.status);
    const body = await c.req.json<{ name?: string; title?: string; endpoint?: string; capability?: string; timeoutMs?: number }>().catch(() => null);
    const name = body?.name?.trim() ?? "";
    const endpoint = body?.endpoint?.trim() ?? "";
    if (!/^[a-z][a-z0-9_-]{1,40}$/.test(name)) return c.json({ error: "工具名用小写字母开头，只能含数字、下划线和连字符" }, 400);
    if (!endpoint) return c.json({ error: "要填写工具地址" }, 400);
    const capability = body?.capability === "read" || body?.capability === "write" || body?.capability === "model" ? body.capability : "network";
    const timeoutMs = Math.min(60_000, Math.max(1_000, Number(body?.timeoutMs) || 15_000));
    dbRun(
      `INSERT INTO external_tools (name, title, endpoint, capability, timeout_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET title = excluded.title, endpoint = excluded.endpoint, capability = excluded.capability, timeout_ms = excluded.timeout_ms`,
      [name, body?.title?.trim() || name, endpoint, capability, timeoutMs, nowIso()],
    );
    return c.json({ ok: true, tool: externalTool(name) });
  });
  app.delete("/api/tools/external/:name", (c) => {
    const access = allow(c);
    if (!access.ok) return c.json({ error: access.error }, access.status);
    dbRun(`DELETE FROM external_tools WHERE name = ?`, [c.req.param("name")]);
    return c.json({ ok: true });
  });
}

function allow(c: Context) {
  return teamAccess(c.req.header("authorization"), "prod", "publish");
}
