/** Guest Agent — 优先服务端 SQLite+MCP，回退浏览器内运行时 */

import {
  explainDiscovery,
  getSkill,
  runSkill,
  type AgentSkill,
  type SkillResult,
  type SkillTraceStep,
} from "./agentSkills";
import { runGuestAgentAsync } from "./backendBridge";
import { mcpServer } from "./mcpServer";
import type { AgentStreamEvent, AgentToolTrace, AgentTurnTrace } from "./agentRuntime";
import { buildSpansFromAgentRun, saveTraceSession } from "./agentTraceStore";

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

/** 先判「正不正常」，再判「是干嘛的」。顺序反了，带「这个网站」的体检也会被当成介绍。 */
const HEALTH_INTENT = /检查|正不正常|正常吗|能不能打开|打得开|探活|健康|体检|性能|ttfb|latency|加载慢|慢不慢|可用吗/i;
const ABOUT_SITE_INTENT =
  /是干嘛|干嘛的|这是什么网站|这个网站是|看一下这个网站|看下这个网站|看一下这个站|本站是干嘛|这个站是/i;
const KNOWLEDGE_INTENT = /介绍|讲讲|说说|了解一下|做过|简历|经历|背景|技术栈|项目|知识库|imean|ownagent/i;

type SkillPick =
  | { kind: "skill"; skill: AgentSkill; hits: string[]; score: number }
  | { kind: "about-site"; reason: string }
  | { kind: "knowledge"; reason: string }
  | { kind: "none" };

/**
 * 路由顺序：站点体检 → 本站介绍 → 项目知识 → trigger 打分 → 明确没匹配。
 * 禁止「没命中就跑 site-analyzer」，否则每句话都是同一份体检报告。
 */
function pickSkill(query: string): SkillPick {
  if (HEALTH_INTENT.test(query)) {
    return { kind: "skill", skill: getSkill("site-analyzer")!, hits: ["health-intent"], score: 2 };
  }
  if (ABOUT_SITE_INTENT.test(query)) {
    return { kind: "about-site", reason: "问的是这个网站是什么，不是让它去探活" };
  }
  if (KNOWLEDGE_INTENT.test(query)) {
    return { kind: "knowledge", reason: "问的是项目 / 经历类信息，走知识库检索" };
  }

  const top = explainDiscovery(query)[0];
  if (top && top.score > 0) {
    return { kind: "skill", skill: top.skill, hits: top.hits, score: top.score };
  }

  if (/dom|元素|定位|snapshot/i.test(query)) {
    return { kind: "skill", skill: getSkill("dom-probe")!, hits: ["dom-fallback"], score: 1 };
  }
  if (/workflow|自动化|流程|回放/i.test(query)) {
    return { kind: "skill", skill: getSkill("workflow-orchestrator")!, hits: ["workflow-fallback"], score: 1 };
  }

  return { kind: "none" };
}

/** 一句话没匹配上时，说清楚为什么 + 能问什么，而不是随便挑个技能跑 */
function synthesizeNoMatch(query: string): string {
  return [
    `没有技能命中「${query}」，所以这轮没有调用任何工具。`,
    "",
    "路由规则是：每个技能在 SKILL.md 里声明 triggers，命中长词记 2 分、短词 1 分，Top-1 才进入执行；一个都没命中就停在这里，不猜。",
    "",
    "现在装了三个技能，可以这样问：",
    "",
    "- **site-analyzer** — 「帮我检查一下这个网站正不正常」「分析本站性能和 ttfb」",
    "- **dom-probe** — 「分析当前页面的 DOM 结构」「统计可交互元素」",
    "- **workflow-orchestrator** — 「跑一遍改价上架的自动化流程」",
    "",
    "想了解项目本身，直接问「介绍一下 iMean 项目」会走知识库检索。",
  ].join("\n");
}

function synthesizeSiteAudit(result: SkillResult, query: string): string {
  const d = result.dashboard as {
    http?: { status?: number; latencyMs?: number; ok?: boolean; url?: string };
    dom?: { a11yNodes?: number };
    perf?: { ttfbMs?: number | null; loadMs?: number | null; resourceCount?: number };
  } | undefined;
  const http = d?.http;
  const perf = d?.perf;

  const problems: string[] = [];
  if (http && !http.ok) problems.push(`HTTP 探活失败（status ${http.status ?? "—"}）`);
  if (perf?.ttfbMs != null && perf.ttfbMs > 200) problems.push(`TTFB ${perf.ttfbMs}ms 偏高`);
  if (perf?.loadMs != null && perf.loadMs > 3000) problems.push(`Load ${perf.loadMs}ms 偏慢`);
  if (perf?.resourceCount != null && perf.resourceCount > 200) problems.push(`资源数 ${perf.resourceCount} 偏多`);

  const ok = problems.length === 0 && (http?.ok ?? true);
  const askedOk = /正不正常|正常吗|能不能打开|打得开|可用吗|检查/.test(query);
  const askedPerf = /性能|ttfb|加载|慢|latency|metrics/.test(query);

  const verdict = askedOk
    ? ok
      ? `**能打开，站点正常。** HTTP ${http?.status ?? "—"}，探活 ${http?.latencyMs ?? "—"}ms。`
      : `**能访问，但有问题：** ${problems.join("；")}。`
    : askedPerf
      ? `**性能快照：** TTFB ${perf?.ttfbMs ?? "—"}ms · Load ${perf?.loadMs ?? "—"}ms · 资源 ${perf?.resourceCount ?? "—"}。`
      : ok
        ? "**探活通过，指标正常。**"
        : `**探活通过，但有 ${problems.length} 项需要注意：** ${problems.join("；")}。`;

  const lines = [verdict, ""];
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
  opts?: { searchQuery?: string; compose?: (hits: { title: string; score: number; excerpt: string }[]) => string },
): Promise<{ text: string; traces: AgentTurnTrace[] }> {
  const searchQuery = opts?.searchQuery ?? query;
  const t0 = performance.now();
  const tool: AgentToolTrace = {
    id: "guest-knowledge",
    name: "knowledge_search",
    args: JSON.stringify({ query: searchQuery, topK: 3 }),
    iteration: 1,
  };
  const traces: AgentTurnTrace[] = [
    { iteration: 1, label: "Retrieve · 知识库", reasoning: "", text: "", tools: [tool] },
  ];
  onEvent({ type: "iteration", n: 1 });
  onEvent({ type: "trace-sync", traces });
  onEvent({ type: "tool-start", tool });

  const out = await mcpServer.callTool("knowledge_search", { query: searchQuery, topK: 3 }, ctx);
  tool.result = out.content;
  tool.ms = Math.round(performance.now() - t0);
  tool.ok = !out.isError;
  onEvent({ type: "tool-end", tool: { ...tool } });
  onEvent({ type: "trace-sync", traces: [...traces] });

  const hits = (out.content as { hits?: { title: string; score: number; excerpt: string }[] })?.hits ?? [];
  const text = (opts?.compose ?? synthesizeKnowledgeHits)(hits);
  return { text, traces };
}

function synthesizeAboutSite(hits: { title: string; score: number; excerpt: string }[]): string {
  const lines = [
    "**这是王旭的个人作品站，主项目是 OwnAgent。**",
    "",
    "OwnAgent 是一个跑在浏览器里的 AI Agent 平台：你输入一句话，它先做技能路由，再调 MCP 工具，最后流式作答。上面六个 Tab 分别是对话、运行追踪、知识检索、技能路由、回归评测、能力全景。",
    "",
    "它**不是**聊天套壳。打开就能跑，不需要 API Key；每一步的耗时和工具返回都能在「运行追踪」里展开。",
  ];
  if (hits.length > 0) {
    lines.push("", "知识库里和本站相关的片段：", "");
    hits.slice(0, 3).forEach((h, i) => {
      lines.push(`${i + 1}. **${h.title}**（相关度 ${Math.round(h.score * 100)}%）`);
      lines.push(`   ${h.excerpt}`);
    });
  }
  return lines.join("\n");
}

function synthesizeKnowledgeHits(hits: { title: string; score: number; excerpt: string }[]): string {
  if (hits.length === 0) return "知识库未命中相关内容，可换项目名试试，比如 iMean、OwnAgent。";
  return [
    `检索到 ${hits.length} 条相关片段：`,
    "",
    ...hits.map((h, i) => `${i + 1}. **${h.title}**（相关度 ${Math.round(h.score * 100)}%）\n   ${h.excerpt}`),
  ].join("\n");
}

function synthesizeResponse(skill: AgentSkill, result: SkillResult, query: string): string {
  switch (skill.id) {
    case "site-analyzer":
      return synthesizeSiteAudit(result, query);
    case "dom-probe":
      return synthesizeDomProbe(result);
    case "workflow-orchestrator":
      return synthesizeWorkflow(result);
    default:
      return "任务已完成，详见右侧 MCP Trace。";
  }
}

/** 每条回复都带上「这句话被路由到哪、依据是什么」，避免不同问题看起来回了同一段 */
function routingHeader(query: string, skill: AgentSkill, hits: string[], score: number): string {
  const basis = hits.length > 0 && score > 0 ? `命中 ${hits.join("、")}，共 ${score} 分` : "正则兜底匹配";
  return `> 「${query}」→ 技能 **${skill.name}**（${basis}），调用 \`${skill.tools.join("` → `")}\`\n`;
}

function persistGuestRun(
  query: string,
  assistantText: string,
  traces: AgentTurnTrace[],
  runtime: string | undefined,
  totalMs: number,
) {
  saveTraceSession({
    query,
    assistantText,
    traces,
    runtime,
    totalMs,
    spans: buildSpansFromAgentRun(query, traces, assistantText, totalMs),
  });
}

/** 免 API Key · Router + MCP（服务端优先） */
export async function runGuestAgentTurn(
  query: string,
  ctx: { snapshotRoot?: Element | null; signal?: AbortSignal },
  onEvent: (ev: AgentStreamEvent) => void,
): Promise<{ assistantText: string; traces: AgentTurnTrace[]; runtime?: "server" | "local" }> {
  const t0 = performance.now();
  const turnId = `guest-${Date.now().toString(36)}`;
  onEvent({ type: "turn-start", turnId });

  const serverResult = await runGuestAgentAsync(query, ctx);
  if (serverResult) {
    onEvent({ type: "iteration", n: 1 });
    onEvent({ type: "trace-sync", traces: serverResult.traces });
    await streamReasoning(`Server Agent · SQLite + MCP\nSkill 路由与工具调用已持久化到服务端数据库。`, onEvent);
    for (const t of serverResult.traces[0]?.tools ?? []) {
      onEvent({ type: "tool-start", tool: t });
      onEvent({ type: "tool-end", tool: t });
    }
    await streamText(serverResult.assistantText, onEvent);
    onEvent({ type: "done", iterations: 1, toolCount: serverResult.traces[0]?.tools.length ?? 0 });
    const out = { ...serverResult, runtime: "server" as const };
    persistGuestRun(query, out.assistantText, out.traces, out.runtime, Math.round(performance.now() - t0));
    return out;
  }

  const pick = pickSkill(query);

  if (pick.kind === "about-site" || pick.kind === "knowledge") {
    const about = pick.kind === "about-site";
    await streamReasoning(
      [`Guest Agent · 意图路由`, pick.reason, `Pipeline：knowledge_search → ${about ? "本站介绍" : "引用合成"}`].join("\n"),
      onEvent,
    );
    const { text, traces } = await runKnowledgePath(query, ctx, onEvent, {
      searchQuery: about ? "OwnAgent 浏览器内 AI Agent 平台" : query,
      compose: about ? synthesizeAboutSite : synthesizeKnowledgeHits,
    });
    const reply = `> 「${query}」→ ${about ? "本站介绍" : "知识库检索"}（${pick.reason}）\n\n${text}`;
    await streamText(reply, onEvent);
    onEvent({ type: "done", iterations: 1, toolCount: 1 });
    persistGuestRun(query, reply, traces, "local", Math.round(performance.now() - t0));
    return { assistantText: reply, traces, runtime: "local" };
  }

  if (pick.kind === "none") {
    await streamReasoning(
      [`Guest Agent · explainDiscovery 路由`, `所有技能得分为 0，不执行任何工具`].join("\n"),
      onEvent,
    );
    const text = synthesizeNoMatch(query);
    await streamText(text, onEvent);
    onEvent({ type: "done", iterations: 0, toolCount: 0 });
    persistGuestRun(query, text, [], "local", Math.round(performance.now() - t0));
    return { assistantText: text, traces: [], runtime: "local" };
  }

  const { skill, hits, score } = pick;

  const reasoning = [
    `Guest Agent · explainDiscovery 路由`,
    `命中 Skill \`${skill.name}\`（${hits.join(", ")}，${score} 分）`,
    `Pipeline：${skill.plan.join(" → ")}`,
  ].join("\n");

  await streamReasoning(reasoning, onEvent);

  onEvent({ type: "iteration", n: 1 });

  // runSkill 会在返回前就回调，这里不能引用还未初始化的 trace
  const seen: SkillTraceStep[] = [];
  const { trace, result } = await runSkill(
    skill,
    query,
    (step) => {
      seen.push(step);
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
        traces: [skillTraceToAgentTrace(seen.filter((s) => !s.tool.startsWith("__")), reasoning)],
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

  const text = `${routingHeader(query, skill, hits, score)}\n${synthesizeResponse(skill, result, query)}`;
  await streamText(text, onEvent);

  onEvent({ type: "done", iterations: 1, toolCount: finalTraces[0]?.tools.length ?? 0 });
  persistGuestRun(query, text, finalTraces, "local", Math.round(performance.now() - t0));
  return { assistantText: text, traces: finalTraces, runtime: "local" };
}

export function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /401|403|authentication|invalid.*key|api key/i.test(msg);
}
