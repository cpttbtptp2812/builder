/**
 * 实验台会话：材料与办事主链同一条路径（parseCsvText 别名归一 → saveServerDataset → 引擎从 SQLite 读）。
 * 会话 ID 以 lab: 开头，不进客户办理记录。
 */

import type { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parseCsvText, type ProductDataSlot } from "../src/lib/productDataStore.ts";
import { saveServerDataset, getServerDataset } from "./productDataStore.ts";
import { liveSkill } from "./liveSkills.ts";

const SLOTS: ProductDataSlot[] = ["expense-ledger", "staff-roster", "shift-demand", "service-tickets", "service-agents"];

export function currentSkillRaw(skillId: string): { raw: string; version: string; source: "live" | "repo" } | null {
  const live = liveSkill(skillId);
  if (live) return { raw: live.raw, version: live.version, source: "live" };
  const file = path.join(process.cwd(), "src", "skills", skillId, "SKILL.md");
  if (!/^[a-z0-9-]+$/.test(skillId) || !existsSync(file)) return null;
  const raw = readFileSync(file, "utf8");
  const version = raw.match(/^version:\s*["']?([^"'\n]+)/m)?.[1] ?? "repo";
  return { raw, version, source: "repo" };
}

export function newLabSession(): string {
  return `lab:${randomUUID()}`;
}

export function isLabSession(id: unknown): id is string {
  return typeof id === "string" && /^lab:[0-9a-f-]{36}$/.test(id);
}

export function saveLabDataset(
  sessionId: string,
  input: { csv: string; title: string; slot: string },
): { ok: true; slot: ProductDataSlot; title: string; columns: string[]; rows: number } | { ok: false; error: string } {
  const slot = SLOTS.find((s) => s === input.slot);
  if (!slot) return { ok: false, error: `不支持的材料槽：${input.slot}` };
  if (input.csv.length > 2_000_000) return { ok: false, error: "材料超过 2MB" };
  const parsed = parseCsvText(input.csv, input.title || "导入材料", slot);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  try {
    saveServerDataset(sessionId, { slot, title: parsed.title, columns: parsed.columns, rows: parsed.rows });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "保存失败" };
  }
  return { ok: true, slot, title: parsed.title, columns: parsed.columns, rows: parsed.rows.length };
}

export function registerLabSession(app: Hono) {
  app.get("/api/lab/skill/:id", (c) => {
    const skill = currentSkillRaw(c.req.param("id"));
    if (!skill) return c.json({ error: "没有这项技能" }, 404);
    return c.json(skill);
  });
  app.post("/api/lab/dataset", async (c) => {
    const body = await c.req.json<{ sessionId?: string; csv?: string; title?: string; slot?: string }>().catch(() => null);
    if (!body?.csv || !body.slot) return c.json({ error: "csv 和 slot 必填" }, 400);
    const sessionId = isLabSession(body.sessionId) ? body.sessionId : newLabSession();
    const saved = saveLabDataset(sessionId, { csv: body.csv, title: body.title ?? "", slot: body.slot });
    if (!saved.ok) return c.json({ error: saved.error }, 400);
    return c.json({ sessionId, ...saved });
  });
}

export function labDatasetTitle(sessionId: string, slot: ProductDataSlot): string | null {
  return getServerDataset(sessionId, slot)?.title ?? null;
}
