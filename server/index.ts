import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  appendSessionTurn,
  buildMemoryContextBlock,
  deleteMemory,
  listMemories,
  runGuestAgentOnServer,
  runMultiAgentOnServer,
  upsertMemory,
} from "./agent.ts";
import { getChunkCount, seedRagCorpus } from "./seed.ts";
import { retrieveRagFromDb } from "./rag.ts";
import { explainDiscovery, runRouterEval, runSkillBenchmark, runSkillOnServer, AGENT_SKILLS } from "./skills.ts";
import { dbGet, dbRun } from "./db.ts";

const app = new Hono();

const PORT = Number(process.env.PORT ?? 8787);
const CORS_ORIGINS = (process.env.CORS_ORIGINS ?? "http://localhost:5173,https://cpttbtptp2812.github.io").split(",");

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (CORS_ORIGINS.some((o) => origin.startsWith(o.trim()))) return origin;
      return CORS_ORIGINS[0] ?? origin;
    },
  }),
);

seedRagCorpus();

app.get("/api/health", (c) => {
  const skillRuns = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM skill_runs");
  const workflows = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM workflow_runs");
  return c.json({
    ok: true,
    runtime: "builder-api",
    db: "sqlite",
    ragChunks: getChunkCount(),
    skillRuns: skillRuns?.c ?? 0,
    workflowRuns: workflows?.c ?? 0,
    llm: Boolean(process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY),
  });
});

app.post("/api/rag/retrieve", async (c) => {
  const body = await c.req.json<{ query: string; topK?: number }>();
  return c.json(retrieveRagFromDb(body.query ?? "", body.topK ?? 5));
});

app.post("/api/skills/discover", async (c) => {
  const body = await c.req.json<{ query: string }>();
  const rows = explainDiscovery(body.query ?? "");
  return c.json({
    rows: rows.map((r) => ({
      skill: { id: r.skill.id, name: r.skill.name, description: r.skill.description, plan: r.skill.plan },
      score: r.score,
      hits: r.hits,
      breakdown: r.breakdown,
    })),
  });
});

app.post("/api/skills/run", async (c) => {
  const body = await c.req.json<{
    skillId: string;
    query: string;
    sessionId: string;
    clientSnapshot?: unknown;
    clientPerf?: unknown;
    probeUrl?: string;
  }>();
  const result = await runSkillOnServer(body.skillId, body.query, body.sessionId ?? "anon", {
    clientSnapshot: body.clientSnapshot as { nodes?: { role: string }[] },
    clientPerf: body.clientPerf as Record<string, unknown>,
    probeUrl: body.probeUrl,
  });
  return c.json(result);
});

app.get("/api/skills/list", (c) => c.json({ skills: AGENT_SKILLS.map((s) => ({ id: s.id, name: s.name, plan: s.plan })) }));

app.post("/api/agent/guest", async (c) => {
  const body = await c.req.json<{
    query: string;
    sessionId: string;
    clientSnapshot?: unknown;
    clientPerf?: unknown;
    probeUrl?: string;
  }>();
  const result = await runGuestAgentOnServer(body.query, body.sessionId ?? "anon", body);
  return c.json(result);
});

app.post("/api/multi-agent/run", async (c) => {
  const body = await c.req.json<{ query: string; sessionId: string; clientSnapshot?: unknown; clientPerf?: unknown; probeUrl?: string }>();
  const result = await runMultiAgentOnServer(body.query, body.sessionId ?? "anon", body);
  return c.json(result);
});

app.get("/api/eval/router", (c) => c.json({ rows: runRouterEval() }));

app.post("/api/eval/benchmark", async (c) => {
  const body = await c.req.json<{ sessionId?: string }>();
  const result = await runSkillBenchmark(body.sessionId ?? "anon");
  return c.json(result);
});

app.get("/api/memory", (c) => {
  const sessionId = c.req.query("sessionId") ?? "anon";
  return c.json({
    longTerm: listMemories(sessionId),
    sessionTurns: buildMemoryContextBlock(sessionId),
    preview: buildMemoryContextBlock(sessionId),
  });
});

app.post("/api/memory", async (c) => {
  const body = await c.req.json<{ sessionId: string; key: string; value: string; category?: string }>();
  const entry = upsertMemory(body.sessionId ?? "anon", body.key, body.value, body.category);
  return c.json(entry);
});

app.delete("/api/memory/:key", (c) => {
  const sessionId = c.req.query("sessionId") ?? "anon";
  deleteMemory(sessionId, c.req.param("key"));
  return c.json({ ok: true });
});

/** LLM 代理 — Key 只在服务端 */
app.post("/api/agent/chat", async (c) => {
  const apiKey = process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (!apiKey) return c.json({ error: "LLM API key not configured on server" }, 503);

  const body = await c.req.json<{ messages: unknown[]; model?: string }>();
  const baseUrl = process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1";
  const model = body.model ?? process.env.LLM_MODEL ?? "deepseek-chat";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: body.messages,
      stream: true,
      temperature: 0.4,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    return c.json({ error: err.slice(0, 300) }, 502);
  }

  return streamSSE(c, async (stream) => {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      await stream.writeSSE({ data: decoder.decode(value, { stream: true }) });
    }
    await stream.writeSSE({ data: "[DONE]" });
  });
});

console.log(`[builder-api] SQLite ready · ${getChunkCount()} RAG chunks · http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });
