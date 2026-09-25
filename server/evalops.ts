/** 回归评测 API — 被测对象 / 测试集 / 实验（后台执行，前端轮询进度） */

import type { Hono } from "hono";
import { db, dbAll, dbGet, dbRun, nowIso } from "./db.ts";
import { runGuestAgentOnServer } from "./agent.ts";
import { ragHitsForMcp } from "./rag.ts";
import { callChat, citationsFromTraces, invokeHttp, maskTarget, openAiToHttp, unmaskTarget } from "../src/lib/evalops/targets.ts";
import { runExperiment } from "../src/lib/evalops/runner.ts";
import { generateCases, type SourceDoc } from "../src/lib/evalops/generate.ts";
import {
  DEFAULT_RUN_OPTIONS,
  newId,
  type EvalRun,
  type EvalSuite,
  type EvalTarget,
  type InvokeResult,
  type JudgeConfig,
  type LlmFn,
  type RunOptions,
} from "../src/lib/evalops/types.ts";

db.exec(`
  CREATE TABLE IF NOT EXISTS evalops_targets (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS evalops_suites (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS evalops_runs (id TEXT PRIMARY KEY, data TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS idx_evalops_runs_created ON evalops_runs(created_at DESC);
`);

// 进程重启时，未跑完的实验标记为中断
dbAll<{ id: string; data: string }>("SELECT id, data FROM evalops_runs WHERE status IN ('queued','running')").forEach((row) => {
  const run = JSON.parse(row.data) as EvalRun;
  run.status = "failed";
  run.error = "服务重启，实验中断，可以重新运行";
  saveRun(run);
});

function readAll<T>(table: string): T[] {
  return dbAll<{ data: string }>(`SELECT data FROM ${table} ORDER BY updated_at DESC`).map((r) => JSON.parse(r.data) as T);
}
function readOne<T>(table: string, id: string): T | undefined {
  const row = dbGet<{ data: string }>(`SELECT data FROM ${table} WHERE id = ?`, [id]);
  return row ? (JSON.parse(row.data) as T) : undefined;
}
function writeOne(table: "evalops_targets" | "evalops_suites", id: string, data: unknown) {
  dbRun(`INSERT INTO ${table}(id, data, updated_at) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`, [
    id,
    JSON.stringify(data),
    nowIso(),
  ]);
}
function saveRun(run: EvalRun) {
  dbRun(
    "INSERT INTO evalops_runs(id, data, status, created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data, status=excluded.status",
    [run.id, JSON.stringify(run), run.status, run.createdAt],
  );
}

function resolveJudge(input?: Partial<JudgeConfig> | null): JudgeConfig | null {
  if (input?.baseUrl && input.model && (input.apiKey || /localhost|127\.0\.0\.1/.test(input.baseUrl))) {
    return { baseUrl: input.baseUrl, model: input.model, apiKey: input.apiKey ?? "" };
  }
  const key = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!key) return null;
  return {
    baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1",
    model: process.env.LLM_MODEL ?? "deepseek-chat",
    apiKey: key,
  };
}

function llmFrom(judge: JudgeConfig | null): LlmFn | undefined {
  if (!judge) return undefined;
  return (messages) => callChat(judge, messages);
}

export async function invokeOnServer(t: EvalTarget, question: string): Promise<InvokeResult> {
  if (t.kind === "http" && t.http) return invokeHttp(t.http, question);
  if (t.kind === "openai" && t.openai) return invokeHttp(openAiToHttp(t.openai), question);
  if (t.kind === "builtin") {
    const t0 = Date.now();
    try {
      if (t.builtin?.variant === "kb-only") {
        const hits = ragHitsForMcp(question, 3).hits;
        return {
          answer: hits.length ? hits.map((h) => `${h.title}：${h.excerpt}`).join("\n") : "资料库里没有找到相关内容。",
          citations: hits.map((h) => `${h.title}：${h.excerpt}`),
          latencyMs: Date.now() - t0,
        };
      }
      const r = await runGuestAgentOnServer(question, "evalops");
      return { answer: r.assistantText, citations: citationsFromTraces(r.traces), latencyMs: Date.now() - t0 };
    } catch (err) {
      return { answer: "", citations: [], latencyMs: Date.now() - t0, error: err instanceof Error ? err.message : String(err) };
    }
  }
  return { answer: "", citations: [], latencyMs: 0, error: "被测对象配置不完整" };
}

const stopFlags = new Map<string, boolean>();

async function executeRun(run: EvalRun, suite: EvalSuite, a: EvalTarget, b: EvalTarget | null, judge: JudgeConfig | null) {
  run.status = "running";
  saveRun(run);
  let lastSave = 0;
  try {
    const { results, summary, stopped } = await runExperiment(suite, a, b, run.options, {
      invoke: invokeOnServer,
      llm: llmFrom(judge),
      shouldStop: () => stopFlags.get(run.id) === true,
      onProgress: (done, total, partial) => {
        run.progress = { done, total };
        run.results = partial;
        if (Date.now() - lastSave > 800) {
          lastSave = Date.now();
          saveRun(run);
        }
      },
    });
    run.results = results;
    run.summary = summary;
    run.status = stopped ? "cancelled" : "done";
  } catch (err) {
    run.status = "failed";
    run.error = err instanceof Error ? err.message : String(err);
  } finally {
    run.finishedAt = nowIso();
    stopFlags.delete(run.id);
    saveRun(run);
  }
}

export function registerEvalOps(app: Hono) {
  /* 被测对象 */
  app.get("/api/evalops/targets", (c) => c.json({ items: readAll<EvalTarget>("evalops_targets").map(maskTarget) }));

  app.post("/api/evalops/targets", async (c) => {
    const body = await c.req.json<EvalTarget>();
    const prev = body.id ? readOne<EvalTarget>("evalops_targets", body.id) : undefined;
    const now = nowIso();
    const target = unmaskTarget({ ...body, id: body.id || newId("tgt"), createdAt: prev?.createdAt ?? now, updatedAt: now }, prev);
    writeOne("evalops_targets", target.id, target);
    return c.json({ item: maskTarget(target) });
  });

  app.delete("/api/evalops/targets/:id", (c) => {
    dbRun("DELETE FROM evalops_targets WHERE id = ?", [c.req.param("id")]);
    return c.json({ ok: true });
  });

  /** 试调一次：可以测还没保存的配置 */
  app.post("/api/evalops/test", async (c) => {
    const body = await c.req.json<{ target: EvalTarget; question: string }>();
    const prev = body.target.id ? readOne<EvalTarget>("evalops_targets", body.target.id) : undefined;
    const target = unmaskTarget(body.target, prev);
    return c.json(await invokeOnServer(target, body.question || "你好，请简单介绍一下你能做什么"));
  });

  /* 测试集 */
  app.get("/api/evalops/suites", (c) => c.json({ items: readAll<EvalSuite>("evalops_suites") }));

  app.post("/api/evalops/suites", async (c) => {
    const body = await c.req.json<EvalSuite>();
    const prev = body.id ? readOne<EvalSuite>("evalops_suites", body.id) : undefined;
    const now = nowIso();
    const suite: EvalSuite = { ...body, id: body.id || newId("suite"), createdAt: prev?.createdAt ?? now, updatedAt: now };
    writeOne("evalops_suites", suite.id, suite);
    return c.json({ item: suite });
  });

  app.delete("/api/evalops/suites/:id", (c) => {
    dbRun("DELETE FROM evalops_suites WHERE id = ?", [c.req.param("id")]);
    return c.json({ ok: true });
  });

  /* 实验 */
  app.get("/api/evalops/runs", (c) => {
    const items = dbAll<{ data: string }>("SELECT data FROM evalops_runs ORDER BY created_at DESC LIMIT 50").map((r) => {
      const run = JSON.parse(r.data) as EvalRun;
      return { ...run, results: [] };
    });
    return c.json({ items });
  });

  app.get("/api/evalops/runs/:id", (c) => {
    const run = dbGet<{ data: string }>("SELECT data FROM evalops_runs WHERE id = ?", [c.req.param("id")]);
    return run ? c.json({ item: JSON.parse(run.data) }) : c.json({ error: "实验不存在" }, 404);
  });

  app.post("/api/evalops/runs", async (c) => {
    const body = await c.req.json<{
      name?: string;
      suiteId: string;
      targetAId: string;
      targetBId?: string | null;
      options?: Partial<RunOptions>;
      judge?: Partial<JudgeConfig> | null;
    }>();
    const suite = readOne<EvalSuite>("evalops_suites", body.suiteId);
    const a = readOne<EvalTarget>("evalops_targets", body.targetAId);
    const b = body.targetBId ? readOne<EvalTarget>("evalops_targets", body.targetBId) ?? null : null;
    if (!suite || !a) return c.json({ error: "测试集或被测对象不存在" }, 400);
    if (!suite.cases.length) return c.json({ error: "测试集是空的" }, 400);
    const options: RunOptions = { ...DEFAULT_RUN_OPTIONS, ...body.options, gate: { ...DEFAULT_RUN_OPTIONS.gate, ...body.options?.gate } };
    const judge = options.useLlmJudge ? resolveJudge(body.judge) : null;
    const run: EvalRun = {
      id: newId("run"),
      name: body.name?.trim() || `${a.name}${b ? ` vs ${b.name}` : ""}`,
      suiteId: suite.id,
      suiteName: suite.name,
      targetA: { id: a.id, name: a.name },
      targetB: b ? { id: b.id, name: b.name } : null,
      options: { ...options, useLlmJudge: Boolean(judge) },
      status: "queued",
      progress: { done: 0, total: suite.cases.length },
      results: [],
      judgeModel: judge?.model,
      createdAt: nowIso(),
    };
    saveRun(run);
    void executeRun(run, suite, a, b, judge);
    return c.json({ item: run });
  });

  app.post("/api/evalops/runs/:id/cancel", (c) => {
    stopFlags.set(c.req.param("id"), true);
    return c.json({ ok: true });
  });

  app.delete("/api/evalops/runs/:id", (c) => {
    stopFlags.set(c.req.param("id"), true);
    dbRun("DELETE FROM evalops_runs WHERE id = ?", [c.req.param("id")]);
    return c.json({ ok: true });
  });

  /* 从文档出题 */
  app.post("/api/evalops/generate", async (c) => {
    const body = await c.req.json<{ docs: SourceDoc[]; count?: number; judge?: Partial<JudgeConfig> | null }>();
    const judge = resolveJudge(body.judge);
    const result = await generateCases(body.docs ?? [], Math.min(Math.max(body.count ?? 10, 1), 60), llmFrom(judge));
    return c.json(result);
  });

  app.get("/api/evalops/judge", (c) => {
    const j = resolveJudge(null);
    return c.json({ serverJudge: j ? { model: j.model } : null });
  });
}
