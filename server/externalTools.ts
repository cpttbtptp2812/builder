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
  consented: boolean;
};

export function listExternalTools(): ExternalTool[] {
  return dbAll<{ name: string; title: string; endpoint: string; capability: string; timeout_ms: number; granted: number | null }>(
    `SELECT t.name, t.title, t.endpoint, t.capability, t.timeout_ms, c.granted
     FROM external_tools t
     LEFT JOIN external_tool_consents c ON c.tool_name = t.name
     ORDER BY t.name`,
  ).map((row) => ({ ...toTool(row), consented: row.granted === 1 }));
}

export function isExternalToolConsented(name: string): boolean {
  const row = dbGet<{ granted: number }>(`SELECT granted FROM external_tool_consents WHERE tool_name = ?`, [name]);
  return row?.granted === 1;
}

export function setExternalToolConsent(name: string, granted: boolean) {
  if (!externalTool(name)) return false;
  dbRun(
    `INSERT INTO external_tool_consents (tool_name, granted, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(tool_name) DO UPDATE SET granted = excluded.granted, updated_at = excluded.updated_at`,
    [name, granted ? 1 : 0, nowIso()],
  );
  return true;
}

export function externalTool(name: string): ExternalTool | null {
  const row = dbGet<{ name: string; title: string; endpoint: string; capability: string; timeout_ms: number; granted: number | null }>(
    `SELECT t.name, t.title, t.endpoint, t.capability, t.timeout_ms, c.granted
     FROM external_tools t
     LEFT JOIN external_tool_consents c ON c.tool_name = t.name
     WHERE t.name = ?`,
    [name],
  );
  return row ? { ...toTool(row), consented: row.granted === 1 } : null;
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
    const ts = nowIso();
    dbRun(
      `INSERT INTO external_tools (name, title, endpoint, capability, timeout_ms, created_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET title = excluded.title, endpoint = excluded.endpoint, capability = excluded.capability, timeout_ms = excluded.timeout_ms`,
      [name, body?.title?.trim() || name, endpoint, capability, timeoutMs, ts],
    );
    dbRun(
      `INSERT INTO external_tool_consents (tool_name, granted, updated_at) VALUES (?, 0, ?)
       ON CONFLICT(tool_name) DO NOTHING`,
      [name, ts],
    );
    return c.json({ ok: true, tool: externalTool(name) });
  });
  app.post("/api/tools/external/consent", async (c) => {
    const access = allow(c);
    if (!access.ok) return c.json({ error: access.error }, access.status);
    const body = await c.req.json<{ name?: string; granted?: boolean }>().catch(() => null);
    const name = body?.name?.trim() ?? "";
    if (!name) return c.json({ error: "缺少工具名" }, 400);
    if (!setExternalToolConsent(name, Boolean(body?.granted))) return c.json({ error: "工具不存在" }, 404);
    return c.json({ ok: true, tool: externalTool(name) });
  });
  app.delete("/api/tools/external/:name", (c) => {
    const access = allow(c);
    if (!access.ok) return c.json({ error: access.error }, access.status);
    const name = c.req.param("name");
    dbRun(`DELETE FROM external_tools WHERE name = ?`, [name]);
    dbRun(`DELETE FROM external_tool_consents WHERE tool_name = ?`, [name]);
    return c.json({ ok: true });
  });
}

function allow(c: Context) {
  return teamAccess(c.req.header("authorization"), "prod", "publish");
}
