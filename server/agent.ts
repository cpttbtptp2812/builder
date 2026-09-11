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

function pickSkill(query: string): { skillId: string | null; hits: string[]; score: number; kind: "skill" | "about" | "knowledge" | "none" } {
  if (/检查|正不正常|正常吗|能不能打开|打得开|探活|健康|体检|性能|ttfb|latency|加载慢|慢不慢|可用吗/i.test(query)) {
    return { skillId: "site-analyzer", hits: ["health-intent"], score: 2, kind: "skill" };
  }
  if (/是干嘛|干嘛的|这是什么网站|这个网站是|看一下这个网站|看下这个网站|本站是干嘛|这个站是/i.test(query)) {
    return { skillId: null, hits: [], score: 0, kind: "about" };
  }
  if (/介绍|讲讲|说说|了解一下|做过|简历|经历|背景|技术栈|项目|知识库|imean|ownagent/i.test(query)) {
    return { skillId: null, hits: [], score: 0, kind: "knowledge" };
  }
  const rows = explainDiscovery(query);
  const top = rows[0];
  if (top && top.score > 0) return { skillId: top.skill.id, hits: top.hits, score: top.score, kind: "skill" };
  if (/dom|snapshot/i.test(query)) return { skillId: "dom-probe", hits: ["fallback"], score: 1, kind: "skill" };
  if (/workflow|流程/i.test(query)) return { skillId: "workflow-orchestrator", hits: ["fallback"], score: 1, kind: "skill" };
  return { skillId: null, hits: [], score: 0, kind: "none" };
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
    `2. Skill 路由: ${picked.kind === "skill" ? picked.skillId : picked.kind} (score ${picked.score})`,
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

  if (picked.kind === "about" || picked.kind === "knowledge") {
    const search = picked.kind === "about" ? "OwnAgent 浏览器内 AI Agent 平台" : query;
    const hits = ragHitsForMcp(search, 3);
    appendSessionTurn(sessionId, "user", query);
    const body =
      picked.kind === "about"
        ? [
            "**这是王旭的个人作品站，主项目是 OwnAgent。**",
            "",
            "OwnAgent 是一个跑在浏览器里的 AI Agent 平台：输入一句话，先做技能路由，再调 MCP 工具，最后流式作答。",
            "",
            hits.hits.length
              ? "知识库片段：\n\n" + hits.hits.map((h, i) => `${i + 1}. **${h.title}**\n   ${h.excerpt}`).join("\n\n")
              : "",
          ].join("\n")
        : hits.hits.length === 0
          ? "知识库未命中。"
          : hits.hits.map((h, i) => `${i + 1}. **${h.title}** (${Math.round(h.score * 100)}%)\n   ${h.excerpt}`).join("\n\n");
    appendSessionTurn(sessionId, "assistant", body);
    return {
      assistantText: `> 「${query}」→ ${picked.kind === "about" ? "本站介绍" : "知识库检索"}\n\n${body}`,
      traces: [
        {
          iteration: 1,
          label: "Retrieve · SQLite RAG",
          reasoning: picked.kind === "about" ? "问的是这个网站是什么" : "Server knowledge_search",
          text: "",
          tools: [
            {
              id: "srv-knowledge",
              name: "knowledge_search",
              args: JSON.stringify({ query: search, topK: 3 }),
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

  if (picked.kind === "none" || !picked.skillId) {
    const text = [
      `没有技能命中「${query}」，所以这轮没有调用任何工具。`,
      "",
      "可以这样问：检查网站正不正常 / 这个网站是干嘛的 / 分析页面 DOM / 跑一遍改价上架流程。",
    ].join("\n");
    appendSessionTurn(sessionId, "user", query);
    appendSessionTurn(sessionId, "assistant", text);
    return { assistantText: text, traces: [], runtime: "server" as const };
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

  const dashboard = (result as { dashboard?: Record<string, unknown> })?.dashboard;
  const http = dashboard?.http as { ok?: boolean; status?: number; latencyMs?: number } | undefined;
  const perf = dashboard?.perf as { ttfbMs?: number; loadMs?: number; resourceCount?: number } | undefined;
  const dom = dashboard?.domProbe as { totalNodes?: number; interactive?: number } | undefined;
  const wf = dashboard?.workflow as { runId?: string; workflowId?: string; status?: string } | undefined;

  let assistantText = `> 「${query}」→ 技能 **${skill.name}**\n\n任务已完成（服务端 MCP + SQLite）。`;
  if (skill.id === "site-analyzer" && http) {
    const ok = http.ok !== false;
    assistantText = [
      `> 「${query}」→ 技能 **site-analyzer**（站点体检）`,
      "",
      ok ? `**能打开，站点正常。** HTTP ${http.status ?? "—"}，探活 ${http.latencyMs ?? "—"}ms。` : `**探活失败。** status ${http.status ?? "—"}`,
      "",
      `- TTFB：${perf?.ttfbMs ?? "—"}ms · Load：${perf?.loadMs ?? "—"}ms · 资源：${perf?.resourceCount ?? "—"}`,
    ].join("\n");
  } else if (dom) {
    assistantText = `> 「${query}」→ 技能 **dom-probe**\n\n总节点 ${dom.totalNodes ?? "—"}，可交互 ${dom.interactive ?? "—"}。`;
  } else if (wf) {
    assistantText = `> 「${query}」→ 技能 **workflow-orchestrator**\n\n已入队 ${wf.workflowId ?? "—"}，runId ${wf.runId ?? "—"}，状态 ${wf.status ?? "queued"}。`;
  }

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
