import type { Context, Hono } from "hono";
import { dbGet } from "./db.ts";
import { buildEvidenceBundle, publicKeyInfo } from "./evidence.ts";
import { currentSkillRaw } from "./labSession.ts";
import { ownsSession } from "./productRun.ts";
import { counterfactualForSession } from "./ruleSynth.ts";
import { forkRun, runOwnedBySession, streamRunEvents } from "./runEventStore.ts";
import { optimizeShifts } from "./shiftOptimizer.ts";

function ownedRun(c: Context, sessionId: string, runId: string): string | null {
  if (!sessionId || !runId) return "缺少 sessionId / runId";
  if (!ownsSession(c, sessionId) || !runOwnedBySession(runId, sessionId)) return "forbidden";
  return null;
}

/** 对话里办完的一单：找到它的运行记录，并在客户自己的会话材料上做求解。都先校验会话归属。 */
export function registerProductInsights(app: Hono) {
  app.get("/api/product-run/insight/public-key", async (c) => c.json(await publicKeyInfo()));

  app.get("/api/product-run/insight/stream", (c) => {
    const sessionId = c.req.query("sessionId")?.trim() ?? "";
    const runId = c.req.query("runId")?.trim() ?? "";
    const bad = ownedRun(c, sessionId, runId);
    if (bad) return c.json({ ok: false, error: bad }, bad === "forbidden" ? 403 : 400);
    return streamRunEvents(c, runId, Number(c.req.query("after") ?? 0) || 0);
  });

  app.post("/api/product-run/insight/fork", async (c) => {
    const body = await c.req.json<{ sessionId?: string; runId?: string; stepId?: string; args?: Record<string, unknown> }>().catch(() => null);
    const sessionId = body?.sessionId?.trim() ?? "";
    const runId = body?.runId?.trim() ?? "";
    const bad = ownedRun(c, sessionId, runId);
    if (bad) return c.json({ ok: false, error: bad }, bad === "forbidden" ? 403 : 400);
    if (!body?.stepId || !body.args || typeof body.args !== "object") return c.json({ ok: false, error: "stepId 和 args 必填" }, 400);
    const r = forkRun(runId, body.stepId, body.args);
    if ("error" in r) return c.json({ ok: false, error: r.error }, 400);
    void r.done;
    return c.json({ ok: true, runId: r.runId });
  });

  app.post("/api/product-run/insight/evidence", async (c) => {
    const body = await c.req.json<{ sessionId?: string; runId?: string }>().catch(() => null);
    const sessionId = body?.sessionId?.trim() ?? "";
    const runId = body?.runId?.trim() ?? "";
    const bad = ownedRun(c, sessionId, runId);
    if (bad) return c.json({ ok: false, error: bad }, bad === "forbidden" ? 403 : 400);
    const r = await buildEvidenceBundle(runId);
    if ("error" in r) return c.json({ ok: false, error: r.error }, 400);
    return c.json(r);
  });

  app.get("/api/product-run/insight", (c) => {
    const sessionId = c.req.query("sessionId")?.trim() ?? "";
    const processId = c.req.query("processId")?.trim() ?? "";
    if (!sessionId || !processId) return c.json({ ok: false, error: "缺少 sessionId / processId" }, 400);
    if (!ownsSession(c, sessionId)) return c.json({ ok: false, error: "forbidden" }, 403);
    const row = dbGet<{ run_id: string; status: string; skill_id: string }>(
      "SELECT run_id, status, skill_id FROM agent_runs WHERE process_id=? AND session_id=? ORDER BY created_at DESC LIMIT 1",
      [processId, sessionId],
    );
    if (!row) return c.json({ ok: false, error: "这次办理没有运行记录" }, 404);
    return c.json({ ok: true, runId: row.run_id, status: row.status, skillId: row.skill_id });
  });

  app.post("/api/product-run/insight/counterfactual", async (c) => {
    const body = await c.req.json<{ sessionId?: string; skillId?: string }>().catch(() => null);
    const sessionId = body?.sessionId?.trim() ?? "";
    if (!sessionId) return c.json({ ok: false, error: "缺少 sessionId" }, 400);
    if (!ownsSession(c, sessionId)) return c.json({ ok: false, error: "forbidden" }, 403);
    const skill = currentSkillRaw(body?.skillId ?? "ledger-desk");
    if (!skill) return c.json({ ok: false, error: "找不到技能原文" }, 404);
    try {
      return c.json(await counterfactualForSession(sessionId, skill.raw));
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : "求解失败" }, 500);
    }
  });

  app.post("/api/product-run/insight/shift-optimize", async (c) => {
    const body = await c.req.json<{ sessionId?: string; skillId?: string }>().catch(() => null);
    const sessionId = body?.sessionId?.trim() ?? "";
    if (!sessionId) return c.json({ ok: false, error: "缺少 sessionId" }, 400);
    if (!ownsSession(c, sessionId)) return c.json({ ok: false, error: "forbidden" }, 403);
    const skill = currentSkillRaw(body?.skillId ?? "shift-desk");
    if (!skill) return c.json({ ok: false, error: "找不到排班技能" }, 404);
    try {
      return c.json(await optimizeShifts(sessionId, skill.raw));
    } catch (err) {
      return c.json({ ok: false, error: err instanceof Error ? err.message : "求解失败" }, 500);
    }
  });
}
