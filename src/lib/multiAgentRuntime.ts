/** Multi-Agent 编排 — Planner → Executor → Reviewer（共用 MCP + RAG） */

import { mcpServer } from "./mcpServer";
import { formatRagContext, retrieveRag } from "./ragEngine";
import { buildMemoryContextBlock } from "./agentMemory";
import { explainDiscovery } from "./agentSkills";

export type AgentRole = "planner" | "executor" | "reviewer";

export type MultiAgentToolCall = {
  tool: string;
  args: Record<string, unknown>;
  ms: number;
  ok: boolean;
  preview?: string;
};

export type MultiAgentStep = {
  id: string;
  agentId: AgentRole;
  agentLabel: string;
  phase: string;
  content: string;
  toolCalls?: MultiAgentToolCall[];
  ms: number;
};

export type MultiAgentResult = {
  query: string;
  steps: MultiAgentStep[];
  answer: string;
  citations: { chunkId: string; projectName: string; score: number }[];
  totalMs: number;
};

const AGENT_META: Record<AgentRole, { label: string; color: string }> = {
  planner: { label: "Planner", color: "#818cf8" },
  executor: { label: "Executor", color: "#34d399" },
  reviewer: { label: "Reviewer", color: "#fbbf24" },
};

export function getAgentMeta(role: AgentRole) {
  return AGENT_META[role];
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function planForQuery(query: string): string {
  const skills = explainDiscovery(query).slice(0, 2);
  const skillLine =
    skills[0] && skills[0].score > 0
      ? `优先 Skill: ${skills[0].skill.id} (score ${skills[0].score.toFixed(2)})`
      : "无强 Skill 匹配，走通用 RAG + MCP";

  const steps: string[] = [
    `1. 解析意图: 「${query.slice(0, 48)}${query.length > 48 ? "…" : ""}」`,
    `2. ${skillLine}`,
    "3. Executor 调用 knowledge_search + 可选 http_probe",
    "4. Reviewer 合成带引用的最终答复",
  ];
  if (/架构|设计/.test(query)) steps.push("5. 侧重 architecture / narrative chunks");
  if (/性能|latency|metrics/.test(query)) steps.push("5. 追加 http_probe 验证站点健康");
  return steps.join("\n");
}

/** 三 Agent 流水线 — 每步回调便于 UI 流式展示 */
export async function runMultiAgentPipeline(
  query: string,
  onStep?: (step: MultiAgentStep) => void,
): Promise<MultiAgentResult> {
  const t0 = performance.now();
  const steps: MultiAgentStep[] = [];
  const q = query.trim();
  if (!q) {
    return { query: q, steps, answer: "请输入问题。", citations: [], totalMs: 0 };
  }

  const push = (step: Omit<MultiAgentStep, "id">) => {
    const row: MultiAgentStep = { ...step, id: `ma-${steps.length + 1}` };
    steps.push(row);
    onStep?.(row);
    return row;
  };

  // —— Planner ——
  const planT0 = performance.now();
  const memoryBlock = await buildMemoryContextBlock();
  const planContent = planForQuery(q);
  push({
    agentId: "planner",
    agentLabel: AGENT_META.planner.label,
    phase: "plan",
    content: `${planContent}\n\n【记忆上下文预览】\n${memoryBlock.slice(0, 200)}${memoryBlock.length > 200 ? "…" : ""}`,
    ms: Math.max(1, Math.round(performance.now() - planT0)),
  });
  await sleep(280);

  // —— Executor ——
  const execT0 = performance.now();
  const toolCalls: MultiAgentToolCall[] = [];

  const ragT0 = performance.now();
  const ragResult = retrieveRag(q, 4);
  toolCalls.push({
    tool: "knowledge_search",
    args: { query: q, topK: 4 },
    ms: ragResult.latencyMs,
    ok: ragResult.hits.length > 0,
    preview: `${ragResult.hits.length} hits · ${ragResult.chunkCount} chunks`,
  });

  let probePreview: string | undefined;
  if (/性能|探活|latency|health|检查|metrics/.test(q)) {
    const probeT0 = performance.now();
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${import.meta.env.BASE_URL}index.html`
          : "/index.html";
      const out = await mcpServer.callTool("http_probe", { url, method: "HEAD" });
      const probe = out.content as { status?: number; latencyMs?: number; ok?: boolean };
      probePreview = `HTTP ${probe.status} · ${probe.latencyMs}ms`;
      toolCalls.push({
        tool: "http_probe",
        args: { url, method: "HEAD" },
        ms: Math.max(1, Math.round(performance.now() - probeT0)),
        ok: !!probe.ok,
        preview: probePreview,
      });
    } catch {
      toolCalls.push({
        tool: "http_probe",
        args: { method: "HEAD" },
        ms: Math.max(1, Math.round(performance.now() - probeT0)),
        ok: false,
        preview: "probe failed",
      });
    }
  }

  const ragContext = formatRagContext(ragResult);
  push({
    agentId: "executor",
    agentLabel: AGENT_META.executor.label,
    phase: "execute",
    content: `RAG 检索完成 (${ragResult.latencyMs}ms)\n\n${ragContext.slice(0, 420)}${ragContext.length > 420 ? "…" : ""}`,
    toolCalls,
    ms: Math.max(1, Math.round(performance.now() - execT0)),
  });
  await sleep(320);

  // —— Reviewer ——
  const revT0 = performance.now();
  const top = ragResult.hits[0];
  const citations = ragResult.hits.map((h) => ({
    chunkId: h.chunkId,
    projectName: h.projectName,
    score: h.score,
  }));

  let answer: string;
  if (!top) {
    answer = `未在知识库中找到与「${q}」强相关的内容。建议换项目名（如 iMean、SkillForge）或话题（架构、性能）再试。`;
  } else {
    const extras = ragResult.hits.slice(1, 3).map((h) => h.text.slice(0, 80)).join("；");
    answer =
      `【${top.projectName}】\n\n${top.text}\n\n` +
      (extras ? `相关上下文：${extras}…\n\n` : "") +
      (probePreview ? `站点探活：${probePreview}\n\n` : "") +
      `引用：${citations.map((c, i) => `[${i + 1}] ${c.projectName} (${c.chunkId}, score ${c.score.toFixed(2)})`).join(" · ")}`;
  }

  push({
    agentId: "reviewer",
    agentLabel: AGENT_META.reviewer.label,
    phase: "review",
    content: answer,
    ms: Math.max(1, Math.round(performance.now() - revT0)),
  });

  return {
    query: q,
    steps,
    answer,
    citations,
    totalMs: Math.max(1, Math.round(performance.now() - t0)),
  };
}
