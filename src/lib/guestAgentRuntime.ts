/** Guest Agent — 免配置开箱即用：Router 选 Skill → MCP 真实执行 → 流式回复 */

import {
  explainDiscovery,
  getSkill,
  runSkill,
  type AgentSkill,
  type SkillResult,
  type SkillTraceStep,
} from "./agentSkills";
import { mcpServer } from "./mcpServer";
import type { AgentStreamEvent, AgentToolTrace, AgentTurnTrace } from "./agentRuntime";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function streamText(text: string, onEvent: (ev: AgentStreamEvent) => void, chunk = 2) {
  for (let i = 0; i < text.length; i += chunk) {
    onEvent({ type: "text-delta", text: text.slice(i, i + chunk) });
    await sleep(12);
  }
}

async function streamReasoning(text: string, onEvent: (ev: AgentStreamEvent) => void) {
  for (let i = 0; i < text.length; i += 3) {
    onEvent({ type: "reasoning-delta", text: text.slice(i, i + 3) });
    await sleep(8);
  }
}

function skillTraceToAgentTrace(steps: SkillTraceStep[], reasoning: string): AgentTurnTrace {
  const tools: AgentToolTrace[] = steps
    .filter((s) => !s.tool.startsWith("__"))
    .map((s, i) => ({
      id: `guest-${s.stepId}-${i}`,
      name: s.tool,
      args: "{}",
      result: s.result,
      ms: s.ms,
      ok: s.ok,
      iteration: 1,
    }));

  return {
    iteration: 1,
    label: "Execute · MCP Pipeline",
    reasoning,
    text: "",
    tools,
  };
}

function pickSkill(query: string): { skill: AgentSkill; hits: string[]; score: number } {
  const rows = explainDiscovery(query);
  const top = rows[0];
  if (top && top.score > 0) {
    return { skill: top.skill, hits: top.hits, score: top.score };
  }
  if (/项目|知识|介绍|agent|做过|简历/i.test(query)) {
    return { skill: getSkill("site-analyzer")!, hits: ["knowledge-fallback"], score: 1 };
  }
  if (/dom|元素|定位|snapshot/i.test(query)) {
    return { skill: getSkill("dom-probe")!, hits: ["dom-fallback"], score: 1 };
  }
  if (/workflow|自动化|流程|回放/i.test(query)) {
    return { skill: getSkill("workflow-orchestrator")!, hits: ["workflow-fallback"], score: 1 };
  }
  return { skill: getSkill("site-analyzer")!, hits: ["default"], score: 0 };
}

function synthesizeSiteAudit(result: SkillResult): string {
  const d = result.dashboard as {
    http?: { status?: number; latencyMs?: number; ok?: boolean; url?: string };
    dom?: { a11yNodes?: number };
    perf?: { ttfbMs?: number | null; loadMs?: number | null; resourceCount?: number };
  } | undefined;
  const http = d?.http;
  const perf = d?.perf;
  const lines = ["**发布前检查结果**", ""];
  if (http) {
    lines.push(`- HTTP 探活：${http.ok ? "✅ 通过" : "❌ 失败"} · status ${http.status ?? "—"} · ${http.latencyMs ?? "—"}ms`);
    lines.push(`- 目标：${http.url ?? "本站"}`);
  }
  if (perf) {
    lines.push(`- TTFB：${perf.ttfbMs ?? "—"}ms · Load：${perf.loadMs ?? "—"}ms · Resources：${perf.resourceCount ?? "—"}`);
  }
  if (d?.dom) lines.push(`- DOM a11y 节点：${d.dom.a11yNodes ?? "—"}`);
  lines.push("", "以上数据来自真实 `http_probe` + Performance API + `browser_snapshot`，非 mock。");
  return lines.join("\n");
}

function synthesizeDomProbe(result: SkillResult): string {
  const p = (result.dashboard as { domProbe?: { totalNodes?: number; interactive?: number; density?: number; byRole?: Record<string, number> } })?.domProbe;
  if (!p) return "DOM 探针已完成，详见右侧 Trace JSON。";
  const topRoles = Object.entries(p.byRole ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r, n]) => `${r}(${n})`)
    .join("、");
  return [
    "**DOM 探针结果**",
    "",
    `- 总节点：${p.totalNodes ?? "—"}`,
    `- 可交互元素：${p.interactive ?? "—"}（密度 ${p.density ?? "—"}%）`,
    `- Role 分布：${topRoles || "—"}`,
    "",
    "同源算法见 Locator Lab · 数据来自真实 browser_snapshot。",
  ].join("\n");
}

function synthesizeWorkflow(result: SkillResult): string {
  const wf = (result.dashboard as { workflow?: { runId?: string; workflowId?: string; status?: string; replaySteps?: number } })?.workflow;
  return [
    "**Workflow 已入队**",
    "",
    `- runId：${wf?.runId ?? "—"}`,
    `- workflowId：${wf?.workflowId ?? "—"}`,
    `- 状态：${wf?.status ?? "queued"}`,
    `- 回放步骤：${wf?.replaySteps ?? "—"} 步`,
    "",
    "TaskQueue 上游协议见 SDK Lab · workflow_run 为真实 MCP 调用。",
  ].join("\n");
}

async function runKnowledgePath(
  query: string,
  ctx: { snapshotRoot?: Element | null },
  onEvent: (ev: AgentStreamEvent) => void,
): Promise<{ text: string; traces: AgentTurnTrace[] }> {
  const t0 = performance.now();
  const tool: AgentToolTrace = {
    id: "guest-knowledge",
    name: "knowledge_search",
    args: JSON.stringify({ query, topK: 3 }),
    iteration: 1,
  };
  const traces: AgentTurnTrace[] = [
    { iteration: 1, label: "Retrieve · 知识库", reasoning: "", text: "", tools: [tool] },
  ];
  onEvent({ type: "iteration", n: 1 });
  onEvent({ type: "trace-sync", traces });
  onEvent({ type: "tool-start", tool });

  const out = await mcpServer.callTool("knowledge_search", { query, topK: 3 }, ctx);
  tool.result = out.content;
  tool.ms = Math.round(performance.now() - t0);
  tool.ok = !out.isError;
  onEvent({ type: "tool-end", tool: { ...tool } });
  onEvent({ type: "trace-sync", traces: [...traces] });

  const hits = (out.content as { hits?: { title: string; score: number; excerpt: string }[] })?.hits ?? [];
  const text =
    hits.length === 0
      ? "知识库未命中相关内容，可换个关键词试试。"
      : [
          "**知识库检索结果**（真实 PROJECT_DETAILS 语料）",
          "",
          ...hits.map((h, i) => `${i + 1}. **${h.title}**（相关度 ${Math.round(h.score * 100)}%）\n   ${h.excerpt}`),
        ].join("\n\n");

  return { text, traces };
}

function synthesizeResponse(skill: AgentSkill, result: SkillResult): string {
  switch (skill.id) {
    case "site-analyzer":
      return synthesizeSiteAudit(result);
    case "dom-probe":
      return synthesizeDomProbe(result);
    case "workflow-orchestrator":
      return synthesizeWorkflow(result);
    default:
      return "任务已完成，详见右侧 MCP Trace。";
  }
}

/** 免 API Key · 内置 Router + MCP 流水线 */
export async function runGuestAgentTurn(
  query: string,
  ctx: { snapshotRoot?: Element | null; signal?: AbortSignal },
  onEvent: (ev: AgentStreamEvent) => void,
): Promise<{ assistantText: string; traces: AgentTurnTrace[] }> {
  const turnId = `guest-${Date.now().toString(36)}`;
  onEvent({ type: "turn-start", turnId });

  const { skill, hits, score } = pickSkill(query);

  const reasoning = [
    `Guest Agent · explainDiscovery 路由`,
    score > 0 ? `命中 Skill \`${skill.name}\`（${hits.join(", ")}）` : `默认 Skill \`${skill.name}\``,
    `Pipeline：${skill.plan.join(" → ")}`,
  ].join("\n");

  await streamReasoning(reasoning, onEvent);

  if (/项目|知识|介绍|agent|做过|简历/i.test(query) && skill.id === "site-analyzer" && hits.includes("knowledge-fallback")) {
    const { text, traces } = await runKnowledgePath(query, ctx, onEvent);
    await streamText(text, onEvent);
    onEvent({ type: "done", iterations: 1, toolCount: 1 });
    return { assistantText: text, traces };
  }

  onEvent({ type: "iteration", n: 1 });

  const { trace, result } = await runSkill(
    skill,
    query,
    (step) => {
      if (step.tool.startsWith("__")) return;
      onEvent({
        type: "tool-end",
        tool: {
          id: `guest-${step.stepId}-${step.tool}`,
          name: step.tool,
          args: "{}",
          iteration: 1,
          ok: step.ok,
          ms: step.ms,
          result: step.result,
        },
      });
      onEvent({
        type: "trace-sync",
        traces: [skillTraceToAgentTrace(trace.filter((s) => !s.tool.startsWith("__")), reasoning)],
      });
    },
    {
      snapshotRoot: ctx.snapshotRoot,
      onStepStart: (step) => {
        if (step.tool.startsWith("__")) return;
        onEvent({
          type: "tool-start",
          tool: {
            id: `guest-${step.id}-${step.tool}`,
            name: step.tool,
            args: "{}",
            iteration: 1,
          },
        });
      },
    },
  );

  const finalTraces = [skillTraceToAgentTrace(trace.filter((s) => !s.tool.startsWith("__")), reasoning)];
  onEvent({ type: "trace-sync", traces: finalTraces });

  const text = synthesizeResponse(skill, result);
  await streamText(text, onEvent);

  onEvent({ type: "done", iterations: 1, toolCount: finalTraces[0]?.tools.length ?? 0 });
  return { assistantText: text, traces: finalTraces };
}

export function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /401|403|authentication|invalid.*key|api key/i.test(msg);
}
