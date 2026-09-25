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
import { seedCustomerData } from "./customerSeed.ts";
import { retrieveRagFromDb } from "./rag.ts";
import {
  explainDiscovery,
  probeHttpTool,
  runRouterEval,
  runSkillBenchmark,
  runSkillOnServer,
  SKILL_CATALOG,
} from "./skills.ts";
import { compileParsedOnly, parseSkillMarkdown } from "../src/lib/skillMarkdown.ts";
import { compileSkill } from "../src/lib/skillSemcompiler.ts";
import { runPolicyEval } from "../src/lib/policyDesk.ts";
import { dbGet, dbAll, dbRun } from "./db.ts";
import { loadRuntimeConfig } from "./runtimeConfig.ts";
import { randomUUID } from "node:crypto";
import { registerEvalOps } from "./evalops.ts";

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
seedCustomerData();
registerEvalOps(app);

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

/** 跨域 URL 探活 — 浏览器直连受 CORS/网络限制，走服务端 fetch */
app.post("/api/tools/http-probe", async (c) => {
  const body = await c.req.json<{ url?: string; method?: "GET" | "HEAD" }>().catch(() => ({}));
  const url = String(body.url ?? "").trim();
  if (!url) return c.json({ error: "url required" }, 400);
  try {
    new URL(url);
  } catch {
    return c.json({ error: "invalid url" }, 400);
  }
  const method = body.method === "HEAD" ? "HEAD" : "GET";
  return c.json(await probeHttpTool(url.startsWith("http") ? url : `https://${url}`, method));
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

app.get("/api/skills/list", (c) =>
  c.json({
    skills: SKILL_CATALOG.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      runnable: s.runnable,
      compileOk: s.compileOk,
      runOk: s.runOk,
      effectUpperBound: s.effectUpperBound,
      plan: s.plan,
      triggers: s.triggers,
      tools: s.tools,
      issues: s.parsed.issues,
      diagnostics: s.diagnostics,
    })),
  }),
);

app.post("/api/skills/parse", async (c) => {
  const body = await c.req.json<{ markdown?: string }>().catch(() => ({ markdown: "" }));
  const parsed = parseSkillMarkdown(body.markdown ?? "");
  const compile = compileParsedOnly(parsed, parsed.name || "preview", SKILL_CATALOG.map((s) => ({ id: s.id, triggers: s.triggers })), "server");
  return c.json({ parsed, ...compile });
});

app.post("/api/skills/compile", async (c) => {
  const body = await c.req.json<{ markdown?: string; skillId?: string }>().catch(() => ({}));
  const parsed = parseSkillMarkdown(body.markdown ?? "");
  const skillId = body.skillId ?? parsed.name ?? "preview";
  const peers = SKILL_CATALOG.filter((s) => s.id !== skillId).map((s) => ({ id: s.id, triggers: s.triggers }));
  const compile = compileSkill(parsed, { skillId, env: "server", peers });
  return c.json({
    skillId,
    compile,
    diagnostics: compileParsedOnly(parsed, skillId, peers, "server").diagnostics,
  });
});

app.get("/api/skill-runs", (c) => {
  const skillId = c.req.query("skillId");
  const limit = Math.min(50, Number(c.req.query("limit") ?? 20) || 20);
  const rows = skillId
    ? dbAll<{ id: number; skill_id: string; query: string; trace_json: string; ok: number; total_ms: number; created_at: string }>(
        `SELECT id, skill_id, query, trace_json, ok, total_ms, created_at FROM skill_runs WHERE skill_id = ? ORDER BY id DESC LIMIT ?`,
        [skillId, limit],
      )
    : dbAll<{ id: number; skill_id: string; query: string; trace_json: string; ok: number; total_ms: number; created_at: string }>(
        `SELECT id, skill_id, query, trace_json, ok, total_ms, created_at FROM skill_runs ORDER BY id DESC LIMIT ?`,
        [limit],
      );
  return c.json({
    runs: rows.map((r) => ({
      id: r.id,
      skillId: r.skill_id,
      query: r.query,
      trace: JSON.parse(r.trace_json),
      ok: Boolean(r.ok),
      totalMs: r.total_ms,
      createdAt: r.created_at,
    })),
  });
});

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

app.get("/api/eval/policy", (c) => c.json({ rows: runPolicyEval() }));

app.get("/api/runtime/config", (c) => c.json(loadRuntimeConfig()));

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

/* ════════════════════════════════════════════════════════════
   管理后台 API — 知识库 CRUD / 配置 / 分析 / 鉴权
   ════════════════════════════════════════════════════════════ */

function nowIsoLocal() { return new Date().toISOString(); }

/* ─── 鉴权中间件 ──────────────────────────────────────────── */
function getAdminPassword() {
  const row = dbGet<{ value: string }>("SELECT value FROM app_config WHERE key='admin_password'");
  return row?.value ?? process.env.ADMIN_PASSWORD ?? "admin123";
}

app.post("/api/admin/login", async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  if (password === getAdminPassword()) {
    return c.json({ ok: true, token: Buffer.from(`admin:${password}`).toString("base64") });
  }
  return c.json({ ok: false, error: "密码错误" }, 401);
});

function requireAdmin(c: { req: { header: (k: string) => string | undefined }; json: (b: unknown, s?: number) => Response }) {
  const auth = c.req.header("x-admin-token") ?? "";
  const decoded = Buffer.from(auth, "base64").toString("utf8");
  return decoded.startsWith("admin:") && decoded.slice(6) === getAdminPassword();
}

/* ─── 知识库 CRUD ─────────────────────────────────────────── */
app.get("/api/admin/knowledge", (c) => {
  const docs = dbAll<{ id: string; title: string; body: string; prompts: string; tags: string; enabled: number; created_at: string; updated_at: string }>(
    "SELECT * FROM knowledge_docs ORDER BY updated_at DESC"
  );
  return c.json({ docs: docs.map(d => ({ ...d, prompts: JSON.parse(d.prompts), tags: JSON.parse(d.tags) })) });
});

app.post("/api/admin/knowledge", async (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const body = await c.req.json<{ title: string; body: string; prompts?: string[]; tags?: string[] }>();
  const id = `kb-${randomUUID().slice(0, 8)}`;
  const now = nowIsoLocal();
  dbRun(
    "INSERT INTO knowledge_docs(id,title,body,prompts,tags,enabled,created_at,updated_at) VALUES(?,?,?,?,?,1,?,?)",
    [id, body.title, body.body, JSON.stringify(body.prompts ?? []), JSON.stringify(body.tags ?? []), now, now]
  );
  return c.json({ ok: true, id });
});

app.put("/api/admin/knowledge/:id", async (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const id = c.req.param("id");
  const body = await c.req.json<{ title?: string; body?: string; prompts?: string[]; tags?: string[]; enabled?: boolean }>();
  const now = nowIsoLocal();
  dbRun(
    `UPDATE knowledge_docs SET
      title=COALESCE(?,title), body=COALESCE(?,body),
      prompts=COALESCE(?,prompts), tags=COALESCE(?,tags),
      enabled=COALESCE(?,enabled), updated_at=?
    WHERE id=?`,
    [
      body.title ?? null, body.body ?? null,
      body.prompts ? JSON.stringify(body.prompts) : null,
      body.tags ? JSON.stringify(body.tags) : null,
      body.enabled !== undefined ? (body.enabled ? 1 : 0) : null,
      now, id
    ]
  );
  return c.json({ ok: true });
});

app.delete("/api/admin/knowledge/:id", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  dbRun("DELETE FROM knowledge_docs WHERE id=?", [c.req.param("id")]);
  return c.json({ ok: true });
});

/* ─── URL 内容抓取（用于知识库导入） ─────────────────────── */
app.post("/api/admin/knowledge/import-url", async (c) => {
  const { url } = await c.req.json<{ url: string }>();
  if (!url?.trim()) return c.json({ error: "URL 不能为空" }, 400);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 OwnAgent-KnowledgeImporter/1.0", "Accept": "text/html,text/plain,*/*" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return c.json({ error: `请求失败: ${res.status}` }, 502);
    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    const pageTitle = (ogTitle?.[1] || titleMatch?.[1] || url).trim();

    // Strip HTML to plain text
    let text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[\s\S]*?<\/header>/gi, "")
      .replace(/<aside[\s\S]*?<\/aside>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Split into sections by double newline
    const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 20);
    if (paragraphs.length === 0) return c.json({ error: "页面无有效内容" }, 400);

    // If too long, split into logical sections
    if (paragraphs.length > 5) {
      const sections: { title: string; body: string }[] = [];
      let chunk: string[] = [];
      let chunkTitle = pageTitle;
      for (const p of paragraphs) {
        chunk.push(p);
        if (chunk.join("\n\n").length > 800) {
          sections.push({ title: chunkTitle, body: chunk.join("\n\n") });
          chunkTitle = `${pageTitle} (续${sections.length + 1})`;
          chunk = [];
        }
      }
      if (chunk.length) sections.push({ title: chunkTitle, body: chunk.join("\n\n") });
      return c.json({ title: pageTitle, body: text.slice(0, 3000), sections });
    }

    return c.json({ title: pageTitle, body: paragraphs.join("\n\n") });
  } catch (e) {
    return c.json({ error: `抓取失败: ${e instanceof Error ? e.message : String(e)}` }, 502);
  }
});

/* ─── 应用配置 ────────────────────────────────────────────── */
const PUBLIC_CONFIG_KEYS = [
  "app_name", "app_logo_url", "app_description", "theme_color", "welcome_message",
  "plaza_match_threshold", "plaza_first_enabled", "allow_anonymous_publish", "low_confidence_threshold",
];

app.get("/api/config", (c) => {
  const rows = dbAll<{ key: string; value: string }>(
    `SELECT key, value FROM app_config WHERE key IN (${PUBLIC_CONFIG_KEYS.map(() => "?").join(",")})`,
    PUBLIC_CONFIG_KEYS
  );
  return c.json(Object.fromEntries(rows.map(r => [r.key, r.value])));
});

app.get("/api/admin/config", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const rows = dbAll<{ key: string; value: string }>("SELECT key, value FROM app_config");
  const cfg = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Mask sensitive values
  if (cfg["llm_api_key"]) cfg["llm_api_key"] = "sk-***" + (cfg["llm_api_key"] as string).slice(-4);
  return c.json(cfg);
});

app.post("/api/admin/config", async (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const body = await c.req.json<Record<string, string>>();
  const now = nowIsoLocal();
  for (const [key, value] of Object.entries(body)) {
    dbRun("INSERT OR REPLACE INTO app_config(key,value,updated_at) VALUES(?,?,?)", [key, value, now]);
    // Sync LLM env vars at runtime
    if (key === "llm_api_key" && !value.includes("***")) process.env.DEEPSEEK_API_KEY = value;
    if (key === "llm_base_url") process.env.LLM_BASE_URL = value;
    if (key === "llm_model") process.env.LLM_MODEL = value;
  }
  return c.json({ ok: true });
});

/* ─── 聊天日志记录 & 分析 ─────────────────────────────────── */
app.post("/api/analytics/log", async (c) => {
  const body = await c.req.json<{
    sessionId: string;
    query: string;
    answerPreview?: string;
    answerLength?: number;
    groundedness?: number;
    hitCount?: number;
    latencyMs?: number;
    mode?: string;
    plazaHit?: boolean;
    published?: boolean;
  }>();
  dbRun(
    `INSERT INTO chat_sessions(
      id,session_id,query,answer_preview,answer_length,groundedness,hit_count,latency_ms,mode,plaza_hit,published,created_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      randomUUID(),
      body.sessionId,
      body.query,
      (body.answerPreview ?? "").slice(0, 500),
      body.answerLength ?? 0,
      body.groundedness ?? 0,
      body.hitCount ?? 0,
      body.latencyMs ?? 0,
      body.mode ?? "llm",
      body.plazaHit ? 1 : 0,
      body.published ? 1 : 0,
      nowIsoLocal(),
    ],
  );
  return c.json({ ok: true });
});

app.post("/api/analytics/published", async (c) => {
  const body = await c.req.json<{ query: string }>();
  if (!body.query?.trim()) return c.json({ ok: false }, 400);
  dbRun(
    "UPDATE chat_sessions SET published=1 WHERE query=? AND published=0",
    [body.query.trim()],
  );
  return c.json({ ok: true });
});

app.get("/api/admin/analytics", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const total = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM chat_sessions")?.c ?? 0;
  const today = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM chat_sessions WHERE date(created_at)=date('now')")?.c ?? 0;
  const avgLatency = dbGet<{ v: number }>("SELECT AVG(latency_ms) as v FROM chat_sessions")?.v ?? 0;
  const avgGround = dbGet<{ v: number }>("SELECT AVG(groundedness) as v FROM chat_sessions")?.v ?? 0;
  const plazaHits = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM chat_sessions WHERE plaza_hit=1")?.c ?? 0;
  const aiCalls = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM chat_sessions WHERE plaza_hit=0")?.c ?? 0;
  const topQueries = dbAll<{ query: string; c: number }>(
    "SELECT query, COUNT(*) as c FROM chat_sessions GROUP BY query ORDER BY c DESC LIMIT 10",
  );
  const dailyTrend = dbAll<{ day: string; c: number; plaza: number; ai: number }>(
    `SELECT date(created_at) as day,
      COUNT(*) as c,
      SUM(CASE WHEN plaza_hit=1 THEN 1 ELSE 0 END) as plaza,
      SUM(CASE WHEN plaza_hit=0 THEN 1 ELSE 0 END) as ai
     FROM chat_sessions GROUP BY day ORDER BY day DESC LIMIT 14`,
  );
  const kbCount = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM knowledge_docs WHERE enabled=1")?.c ?? 0;
  const plazaCount = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM published_qa")?.c ?? 0;
  const plazaHitRate = total ? Math.round((plazaHits / total) * 100) : 0;
  const tokenSavedEst = plazaHits * 800;
  return c.json({
    total,
    today,
    avgLatency: Math.round(avgLatency),
    avgGround: Math.round(avgGround),
    topQueries,
    dailyTrend,
    kbCount,
    plazaCount,
    plazaHits,
    aiCalls,
    plazaHitRate,
    tokenSavedEst,
  });
});

/* ─── 知识运营台 ─────────────────────────────────────────── */
app.get("/api/admin/operations", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const lowThreshold = Number(dbGet<{ value: string }>("SELECT value FROM app_config WHERE key='low_confidence_threshold'")?.value ?? "65");

  const gaps = dbAll<{ query: string; count: number; avg_ground: number; avg_hits: number }>(
    `SELECT query, COUNT(*) as count,
      ROUND(AVG(groundedness)) as avg_ground,
      ROUND(AVG(hit_count)) as avg_hits
     FROM chat_sessions
     WHERE plaza_hit=0 AND (groundedness < ? OR hit_count=0)
     GROUP BY query
     HAVING count >= 1
     ORDER BY count DESC, avg_ground ASC
     LIMIT 20`,
    [lowThreshold],
  );

  const lowConfidence = dbAll<{
    id: string; query: string; answer_preview: string; groundedness: number; hit_count: number; mode: string; created_at: string;
  }>(
    `SELECT id, query, answer_preview, groundedness, hit_count, mode, created_at
     FROM chat_sessions
     WHERE groundedness < ? AND plaza_hit=0
     ORDER BY created_at DESC LIMIT 15`,
    [lowThreshold],
  );

  const pendingPublish = dbAll<{
    id: string; query: string; answer_preview: string; groundedness: number; hit_count: number; mode: string; created_at: string;
  }>(
    `SELECT id, query, answer_preview, groundedness, hit_count, mode, created_at
     FROM chat_sessions
     WHERE published=0 AND plaza_hit=0 AND groundedness >= ?
     ORDER BY created_at DESC LIMIT 15`,
    [lowThreshold],
  );

  const summary = {
    gapCount: gaps.length,
    lowConfidenceCount: lowConfidence.length,
    pendingPublishCount: pendingPublish.length,
    plazaTotal: dbGet<{ c: number }>("SELECT COUNT(*) as c FROM published_qa")?.c ?? 0,
  };

  return c.json({ summary, gaps, lowConfidence, pendingPublish });
});

/* ─── 制度条款 CRUD ─────────────────────────────────────── */
app.get("/api/admin/policies", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const rows = dbAll<Record<string, unknown>>(
    "SELECT * FROM policy_clauses ORDER BY sort_order ASC, updated_at DESC",
  );
  return c.json({ clauses: rows });
});

app.post("/api/admin/policies", async (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const body = await c.req.json<{
    id?: string; topic?: string; status?: string; text: string;
    slot?: string; value?: string; condition_text?: string; sort_order?: number;
  }>();
  const id = body.id?.trim() || `KB-${randomUUID().slice(0, 8)}`;
  const now = nowIsoLocal();
  dbRun(
    `INSERT INTO policy_clauses(id,topic,status,text,slot,value,condition_text,sort_order,enabled,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,?,1,?,?)`,
    [id, body.topic ?? "general", body.status ?? "current", body.text, body.slot ?? null, body.value ?? null, body.condition_text ?? "", body.sort_order ?? 99, now, now],
  );
  return c.json({ ok: true, id });
});

app.put("/api/admin/policies/:id", async (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const body = await c.req.json<Record<string, unknown>>();
  const now = nowIsoLocal();
  dbRun(
    `UPDATE policy_clauses SET
      topic=COALESCE(?,topic), status=COALESCE(?,status), text=COALESCE(?,text),
      slot=COALESCE(?,slot), value=COALESCE(?,value), condition_text=COALESCE(?,condition_text),
      sort_order=COALESCE(?,sort_order), enabled=COALESCE(?,enabled), updated_at=?
     WHERE id=?`,
    [
      body.topic ?? null, body.status ?? null, body.text ?? null,
      body.slot ?? null, body.value ?? null, body.condition_text ?? null,
      body.sort_order ?? null, body.enabled !== undefined ? (body.enabled ? 1 : 0) : null,
      now, c.req.param("id"),
    ],
  );
  return c.json({ ok: true });
});

app.delete("/api/admin/policies/:id", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  dbRun("DELETE FROM policy_clauses WHERE id=?", [c.req.param("id")]);
  return c.json({ ok: true });
});

/* ─── 能力规则 CRUD ─────────────────────────────────────── */
app.get("/api/admin/capability-rules", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const rows = dbAll<Record<string, unknown>>(
    "SELECT * FROM capability_rules ORDER BY priority ASC, updated_at DESC",
  );
  return c.json({ rules: rows });
});

app.post("/api/admin/capability-rules", async (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const body = await c.req.json<{ name: string; cap: string; pattern: string; reason: string; priority?: number }>();
  const id = `cap-${randomUUID().slice(0, 8)}`;
  const now = nowIsoLocal();
  dbRun(
    `INSERT INTO capability_rules(id,name,cap,pattern,reason,priority,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?)`,
    [id, body.name, body.cap, body.pattern, body.reason, body.priority ?? 50, now, now],
  );
  return c.json({ ok: true, id });
});

app.put("/api/admin/capability-rules/:id", async (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const body = await c.req.json<Record<string, unknown>>();
  const now = nowIsoLocal();
  dbRun(
    `UPDATE capability_rules SET
      name=COALESCE(?,name), cap=COALESCE(?,cap), pattern=COALESCE(?,pattern),
      reason=COALESCE(?,reason), priority=COALESCE(?,priority),
      enabled=COALESCE(?,enabled), updated_at=?
     WHERE id=?`,
    [
      body.name ?? null, body.cap ?? null, body.pattern ?? null, body.reason ?? null,
      body.priority ?? null, body.enabled !== undefined ? (body.enabled ? 1 : 0) : null,
      now, c.req.param("id"),
    ],
  );
  return c.json({ ok: true });
});

app.delete("/api/admin/capability-rules/:id", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  dbRun("DELETE FROM capability_rules WHERE id=?", [c.req.param("id")]);
  return c.json({ ok: true });
});

/* ─── 广场管理（管理员） ─────────────────────────────────── */
app.get("/api/admin/plaza", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const rows = dbAll<Record<string, unknown>>(
    "SELECT * FROM published_qa ORDER BY pinned DESC, created_at DESC LIMIT 200",
  );
  return c.json({
    items: rows.map((r) => ({ ...r, tags: JSON.parse(String(r.tags ?? "[]")) })),
    total: dbGet<{ c: number }>("SELECT COUNT(*) as c FROM published_qa")?.c ?? 0,
  });
});

/* ════════════════════════════════════════════════════════════
   共享问答 Feed（朋友圈式知识共享）
   ════════════════════════════════════════════════════════════ */

function scorePlazaQuestion(query: string, question: string, answer: string): number {
  const q = query.trim().toLowerCase();
  const title = question.trim().toLowerCase();
  if (!q || !title) return 0;
  if (q === title) return 100;
  if (title.includes(q) || q.includes(title)) return 88;
  const tokens = q.split(/[\s，。？?、]+/).filter((t) => t.length >= 2);
  if (!tokens.length) return 0;
  const blob = `${title} ${answer.toLowerCase()}`;
  const hit = tokens.filter((t) => blob.includes(t)).length;
  return Math.round((hit / tokens.length) * 80);
}

/* 优先匹配（问答时先搜广场） */
app.get("/api/feed/match", (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return c.json({ match: null });
  const rows = dbAll<{ id: string; question: string; answer: string; author: string; avatar_color: string; source_doc: string | null; tags: string; likes: number; views: number; pinned: number; created_at: string; updated_at: string }>(
    "SELECT * FROM published_qa"
  );
  let best: { item: Record<string, unknown>; score: number } | null = null;
  for (const row of rows) {
    const score = scorePlazaQuestion(q, row.question, row.answer);
    if (!best || score > best.score) {
      best = { item: { ...row, tags: JSON.parse(row.tags || "[]") }, score };
    }
  }
  if (!best || best.score < 40) return c.json({ match: null });
  return c.json({ match: best });
});

app.get("/api/feed/export", (c) => {
  const rows = dbAll<Record<string, unknown>>("SELECT * FROM published_qa ORDER BY pinned DESC, created_at DESC");
  return c.json({
    exportedAt: nowIsoLocal(),
    items: rows.map(r => ({ ...r, tags: JSON.parse(String(r.tags ?? "[]")) })),
  });
});

app.post("/api/feed/import", async (c) => {
  const body = await c.req.json<{ items?: { question?: string; answer?: string; author?: string; tags?: string[] }[] }>();
  const items = body.items ?? [];
  const now = nowIsoLocal();
  const colors = ["#6366f1", "#059669", "#d97706", "#0891b2", "#ec4899", "#8b5cf6"];
  let count = 0;
  for (const it of items) {
    if (!it.question?.trim() || !it.answer?.trim()) continue;
    dbRun(
      `INSERT INTO published_qa(id,question,answer,author,avatar_color,source_doc,tags,likes,views,pinned,created_at,updated_at)
       VALUES(?,?,?,?,?,?,?,0,0,0,?,?)`,
      [
        `qa-${randomUUID().slice(0, 8)}`,
        it.question.trim(),
        it.answer.trim(),
        it.author?.trim() || "导入",
        colors[count % colors.length],
        null,
        JSON.stringify(it.tags ?? []),
        now,
        now,
      ]
    );
    count++;
  }
  return c.json({ ok: true, count });
});

/* 列表（公开） */
app.get("/api/feed", (c) => {
  const search = c.req.query("q")?.trim() ?? "";
  const limit = Math.min(Number(c.req.query("limit") ?? 30), 100);
  const offset = Number(c.req.query("offset") ?? 0);
  let rows;
  if (search) {
    rows = dbAll<Record<string, unknown>>(
      `SELECT * FROM published_qa WHERE question LIKE ? OR answer LIKE ? OR tags LIKE ?
       ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?`,
      [`%${search}%`, `%${search}%`, `%${search}%`, limit, offset]
    );
  } else {
    rows = dbAll<Record<string, unknown>>(
      "SELECT * FROM published_qa ORDER BY pinned DESC, created_at DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
  }
  const total = dbGet<{ c: number }>("SELECT COUNT(*) as c FROM published_qa")?.c ?? 0;
  return c.json({ items: rows.map(r => ({ ...r, tags: JSON.parse(String(r.tags ?? "[]")) })), total });
});

/* 发布 */
app.post("/api/feed", async (c) => {
  const body = await c.req.json<{
    question: string; answer: string;
    author?: string; avatarColor?: string;
    sourceDoc?: string; tags?: string[];
  }>();
  if (!body.question?.trim() || !body.answer?.trim()) {
    return c.json({ error: "问题和回答不能为空" }, 400);
  }
  const id = `qa-${randomUUID().slice(0, 8)}`;
  const now = nowIsoLocal();
  const colors = ["#6366f1", "#059669", "#d97706", "#0891b2", "#ec4899", "#8b5cf6", "#ef4444"];
  const color = body.avatarColor ?? colors[Math.floor(Math.random() * colors.length)];
  dbRun(
    `INSERT INTO published_qa(id,question,answer,author,avatar_color,source_doc,tags,likes,views,pinned,created_at,updated_at)
     VALUES(?,?,?,?,?,?,?,0,0,0,?,?)`,
    [id, body.question.trim(), body.answer.trim(), body.author?.trim() || "匿名用户", color,
     body.sourceDoc ?? null, JSON.stringify(body.tags ?? []), now, now]
  );
  return c.json({ ok: true, id });
});

/* 点赞 */
app.post("/api/feed/:id/like", (c) => {
  const id = c.req.param("id");
  dbRun("UPDATE published_qa SET likes=likes+1, updated_at=? WHERE id=?", [nowIsoLocal(), id]);
  const row = dbGet<{ likes: number }>("SELECT likes FROM published_qa WHERE id=?", [id]);
  return c.json({ ok: true, likes: row?.likes ?? 0 });
});

/* 浏览量 +1 */
app.post("/api/feed/:id/view", (c) => {
  dbRun("UPDATE published_qa SET views=views+1 WHERE id=?", [c.req.param("id")]);
  return c.json({ ok: true });
});

/* 置顶/取消置顶（管理员） */
app.post("/api/feed/:id/pin", (c) => {
  if (!requireAdmin(c as Parameters<typeof requireAdmin>[0])) return c.json({ error: "未授权" }, 401);
  const row = dbGet<{ pinned: number }>("SELECT pinned FROM published_qa WHERE id=?", [c.req.param("id")]);
  dbRun("UPDATE published_qa SET pinned=?, updated_at=? WHERE id=?",
    [row?.pinned ? 0 : 1, nowIsoLocal(), c.req.param("id")]);
  return c.json({ ok: true });
});

/* 编辑（客户可改自己发布的问答） */
app.put("/api/feed/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<{ question?: string; answer?: string; author?: string; tags?: string[] }>();
  dbRun(
    `UPDATE published_qa SET
      question=COALESCE(?,question), answer=COALESCE(?,answer),
      author=COALESCE(?,author), tags=COALESCE(?,tags), updated_at=?
     WHERE id=?`,
    [
      body.question?.trim() || null,
      body.answer?.trim() || null,
      body.author?.trim() || null,
      body.tags ? JSON.stringify(body.tags) : null,
      nowIsoLocal(),
      id,
    ]
  );
  return c.json({ ok: true });
});

/* 删除 */
app.delete("/api/feed/:id", (c) => {
  dbRun("DELETE FROM published_qa WHERE id=?", [c.req.param("id")]);
  return c.json({ ok: true });
});

console.log(`[builder-api] SQLite ready · ${getChunkCount()} RAG chunks · http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });
