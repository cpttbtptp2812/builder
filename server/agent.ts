/** 服务端 Memory + Multi-Agent */

import { dbAll, dbRun, nowIso } from "./db.ts";
import { formatRagContext, retrieveRagFromDb } from "./rag.ts";
import { explainDiscovery, runSkillOnServer, getSkill } from "./skills.ts";
import { ragHitsForMcp } from "./rag.ts";

export function listMemories(sessionId: string) {
  return dbAll<{ key: string; value: string; category: string; updatedAt: string }>(
    `SELECT mem_key as key, value, category, updated_at as updatedAt FROM memories WHERE session_id = ? ORDER BY updated_at DESC`,
    [sessionId],
  );
}

export function upsertMemory(sessionId: string, key: string, value: string, category = "fact") {
  const updatedAt = nowIso();
  dbRun(
    `INSERT INTO memories (session_id, mem_key, value, category, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(session_id, mem_key) DO UPDATE SET value=excluded.value, category=excluded.category, updated_at=excluded.updated_at`,
    [sessionId, key, value, category, updatedAt],
  );
  return { key, value, category, updatedAt };
}

export function deleteMemory(sessionId: string, key: string) {
  dbRun(`DELETE FROM memories WHERE session_id = ? AND mem_key = ?`, [sessionId, key]);
}

export function appendSessionTurn(sessionId: string, role: "user" | "assistant", text: string) {
  dbRun(`INSERT INTO session_turns (session_id, role, text, created_at) VALUES (?, ?, ?, ?)`, [
    sessionId,
    role,
    text.slice(0, 2000),
    nowIso(),
  ]);
}

export function getSessionTurns(sessionId: string, limit = 12) {
  const rows = dbAll<{ role: string; text: string; ts: string }>(
    `SELECT role, text, created_at as ts FROM session_turns WHERE session_id = ? ORDER BY id DESC LIMIT ?`,
    [sessionId, limit],
  );
  return rows.reverse();
}

export function buildMemoryContextBlock(sessionId: string) {
  const longTerm = listMemories(sessionId);
  const sessionTurns = getSessionTurns(sessionId, 6);
  const parts: string[] = [];
  if (longTerm.length) {
    parts.push("【长期记忆 · SQLite】\n" + longTerm.map((m) => `- ${m.key}: ${m.value}`).join("\n"));
  }
  if (sessionTurns.length) {
    parts.push("【会话 · SQLite】\n" + sessionTurns.map((t) => `${t.role}: ${t.text.slice(0, 120)}`).join("\n"));
  }
  return parts.length ? parts.join("\n\n") : "（暂无持久化记忆）";
}

function pickSkill(query: string) {
  const rows = explainDiscovery(query);
  const top = rows[0];
  if (top && top.score > 0) return { skillId: top.skill.id, hits: top.hits, score: top.score };
  if (/dom|snapshot/i.test(query)) return { skillId: "dom-probe", hits: ["fallback"], score: 1 };
  if (/workflow|流程/i.test(query)) return { skillId: "workflow-orchestrator", hits: ["fallback"], score: 1 };
  return { skillId: "site-analyzer", hits: ["default"], score: 0 };
}

export async function runMultiAgentOnServer(
  query: string,
  sessionId: string,
  clientCtx: { clientSnapshot?: unknown; clientPerf?: unknown; probeUrl?: string } = {},
) {
  const t0 = performance.now();
  const steps: Array<{
    id: string;
    agentId: "planner" | "executor" | "reviewer";
    agentLabel: string;
    phase: string;
    content: string;
    toolCalls?: Array<{ tool: string; ms: number; ok: boolean; preview?: string }>;
    ms: number;
  }> = [];

  const planT0 = performance.now();
  const picked = pickSkill(query);
  const memoryBlock = buildMemoryContextBlock(sessionId);
  const planContent = [
    `1. 解析意图: ${query.slice(0, 48)}`,
    `2. Skill 路由: ${picked.skillId} (score ${picked.score})`,
    "3. Executor: knowledge_search + 条件 http_probe",
    "4. Reviewer: 带引用合成",
    "",
    memoryBlock.slice(0, 300),
  ].join("\n");
  steps.push({
    id: "ma-1",
    agentId: "planner",
    agentLabel: "Planner",
    phase: "plan",
    content: planContent,
    ms: Math.max(1, Math.round(performance.now() - planT0)),
  });

  const execT0 = performance.now();
  const toolCalls: Array<{ tool: string; ms: number; ok: boolean; preview?: string }> = [];
  const ragT0 = performance.now();
  const ragResult = retrieveRagFromDb(query, 4);
  toolCalls.push({
    tool: "knowledge_search",
    ms: ragResult.latencyMs,
    ok: ragResult.hits.length > 0,
    preview: `${ragResult.hits.length} hits · SQLite`,
  });

  let probePreview: string | undefined;
  if (/性能|探活|latency|metrics|检查/.test(query)) {
    const probeT0 = performance.now();
    const probeUrl = clientCtx.probeUrl ?? process.env.PROBE_URL ?? "https://cpttbtptp2812.github.io/builder/index.html";
    try {
      const res = await fetch(probeUrl, { method: "HEAD" });
      probePreview = `HTTP ${res.status}`;
      toolCalls.push({
        tool: "http_probe",
        ms: Math.max(1, Math.round(performance.now() - probeT0)),
        ok: res.ok,
        preview: probePreview,
      });
    } catch {
      toolCalls.push({ tool: "http_probe", ms: 1, ok: false, preview: "failed" });
    }
  }

  steps.push({
    id: "ma-2",
    agentId: "executor",
    agentLabel: "Executor",
    phase: "execute",
    content: formatRagContext(ragResult).slice(0, 500),
    toolCalls,
    ms: Math.max(1, Math.round(performance.now() - execT0)),
  });

  const revT0 = performance.now();
  const top = ragResult.hits[0];
  const citations = ragResult.hits.map((h) => ({
    chunkId: h.chunk_id,
    projectName: h.project_name,
    score: h.score,
  }));

  let answer: string;
  if (!top) {
    answer = `未在 SQLite 知识库命中「${query}」。可换 iMean、SkillForge 等项目名。`;
  } else {
    answer = `【${top.project_name}】\n\n${top.text}\n\n引用：${citations.map((c, i) => `[${i + 1}] ${c.projectName} (${c.chunkId})`).join(" · ")}`;
    if (probePreview) answer += `\n\n站点探活：${probePreview}`;
  }

  steps.push({
    id: "ma-3",
    agentId: "reviewer",
    agentLabel: "Reviewer",
    phase: "review",
    content: answer,
    ms: Math.max(1, Math.round(performance.now() - revT0)),
  });

  appendSessionTurn(sessionId, "user", query);
  appendSessionTurn(sessionId, "assistant", answer.slice(0, 500));

  return {
    query,
    steps,
    answer,
    citations,
    totalMs: Math.max(1, Math.round(performance.now() - t0)),
    runtime: "server" as const,
  };
}

export async function runGuestAgentOnServer(
  query: string,
  sessionId: string,
  clientCtx: { clientSnapshot?: unknown; clientPerf?: unknown; probeUrl?: string } = {},
) {
  const picked = pickSkill(query);

  if (/项目|知识|介绍|agent|做过|简历/i.test(query) && picked.skillId === "site-analyzer") {
    const hits = ragHitsForMcp(query, 3);
    appendSessionTurn(sessionId, "user", query);
    const text =
      hits.hits.length === 0
        ? "知识库未命中。"
        : hits.hits.map((h, i) => `${i + 1}. **${h.title}** (${Math.round(h.score * 100)}%)\n   ${h.excerpt}`).join("\n\n");
    appendSessionTurn(sessionId, "assistant", text);
    return {
      assistantText: `**知识库检索（SQLite）**\n\n${text}`,
      traces: [
        {
          iteration: 1,
          label: "Retrieve · SQLite RAG",
          reasoning: "Server knowledge_search",
          text: "",
          tools: [
            {
              id: "srv-knowledge",
              name: "knowledge_search",
              args: JSON.stringify({ query, topK: 3 }),
              result: hits,
              ok: true,
              iteration: 1,
            },
          ],
        },
      ],
      runtime: "server" as const,
    };
  }

  const skill = getSkill(picked.skillId)!;
  const { trace, result } = await runSkillOnServer(skill.id, query, sessionId, clientCtx);

  const tools = trace
    .filter((s) => !s.tool.startsWith("__"))
    .map((s, i) => ({
      id: `srv-${s.stepId}-${i}`,
      name: s.tool,
      args: "{}",
      result: s.result,
      ms: s.ms,
      ok: s.ok,
      iteration: 1,
    }));

  let assistantText = "任务已完成（服务端 MCP + SQLite 持久化）。";
  const dashboard = (result as { dashboard?: Record<string, unknown> })?.dashboard;
  if (dashboard?.http) assistantText = `**服务端 Site Audit**\n\n${JSON.stringify(dashboard, null, 2).slice(0, 800)}`;
  else if (dashboard?.domProbe) assistantText = `**服务端 DOM Probe**\n\n${JSON.stringify(dashboard.domProbe, null, 2)}`;
  else if (dashboard?.workflow) assistantText = `**Workflow 已写入 SQLite**\n\nrunId: ${(dashboard.workflow as { runId?: string }).runId}`;

  appendSessionTurn(sessionId, "user", query);
  appendSessionTurn(sessionId, "assistant", assistantText.slice(0, 500));

  return {
    assistantText,
    traces: [
      {
        iteration: 1,
        label: `Execute · ${skill.name}`,
        reasoning: `Server explainDiscovery → ${skill.name}`,
        text: "",
        tools,
      },
    ],
    runtime: "server" as const,
  };
}
