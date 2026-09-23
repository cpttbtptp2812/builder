/** Guest Agent — 浏览器内开放工具循环（不依赖固定演示句） */

import {
  explainDiscovery,
  getSkill,
  runSkill,
  type AgentSkill,
  type SkillResult,
  type SkillTraceStep,
} from "./agentSkills";
import { mcpServer } from "./mcpServer";
import type { AgentChatMessage, AgentStreamEvent, AgentToolTrace, AgentTurnTrace } from "./agentRuntime";
import { buildSpansFromAgentRun, saveTraceSession } from "./agentTraceStore";
import { classifyCapability, getTicket, type TicketDraft } from "./policyDesk";
import type { PolicyTrustView, RouteScoreView } from "./chatFrontier";
import { runGuestAgentAsync } from "./backendBridge";
import { peekRuntimeConfig } from "./runtimeConfig";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type GuestForce = "knowledge" | "probe" | "dom" | "policy";

export type GuestTurnCtx = {
  snapshotRoot?: Element | null;
  signal?: AbortSignal;
  enabledTools?: string[];
  history?: AgentChatMessage[];
  force?: GuestForce;
  pinned?: string;
};

type KnowledgeHit = { title?: string; score?: number; excerpt?: string };
type PolicyHit = { text?: string; chunkId?: string; score?: number; slot?: string; value?: string };
type HttpProbe = {
  url?: string;
  status?: number;
  ok?: boolean;
  latencyMs?: number;
  error?: string;
  contentType?: string;
};
type SnapResult = {
  nodeCount?: number;
  nodes?: { role: string; name: string; tag: string }[];
};

type PlannedCall = { name: string; args: Record<string, unknown> };
type ToolPack = { name: string; content: unknown; ok: boolean };

export function toolPreviewFromResult(name: string, content: unknown): string {
  if (content == null) return "";
  const c = content as Record<string, unknown>;
  if (name === "http_probe") {
    return `${c.status ?? "—"} · ${c.latencyMs ?? "—"}ms${c.ok === false ? " · fail" : ""}`;
  }
  if (name === "knowledge_search") {
    if (c.error) return `error · ${String(c.error).slice(0, 40)}`;
    const hits = (c.hits as unknown[] | undefined)?.length ?? 0;
    const chunks = c.chunkCount ?? c.chunks;
    return chunks != null ? `${hits} hits · ${chunks} chunks` : `${hits} hits`;
  }
  if (name === "browser_snapshot") {
    return `${c.nodeCount ?? (c.nodes as unknown[] | undefined)?.length ?? "—"} nodes`;
  }
  if (name === "policy_search") {
    const hits = (c.hits as unknown[] | undefined)?.length ?? 0;
    return `${hits} clauses`;
  }
  if (name === "ticket_draft" || name === "ticket_commit") {
    return String(c.id ?? c.ticketId ?? c.status ?? "ticket");
  }
  if (name === "workflow_run") {
    return String(c.runId ?? c.workflowId ?? "queued");
  }
  return typeof content === "string" ? content.slice(0, 48) : "ok";
}

const HEALTH_INTENT = /检查|正不正常|正常吗|能不能打开|打得开|探活|健康|体检|性能|ttfb|latency|加载慢|慢不慢|可用吗/i;
const ABOUT_SITE_INTENT =
  /是干嘛|干嘛的|这是什么网站|这个网站是|看一下这个网站|看下这个网站|看一下这个站|本站是干嘛|这个站是/i;
const KNOWLEDGE_INTENT = /介绍|讲讲|说说|了解一下|做过|简历|经历|背景|技术栈|项目|知识库|imean|ownagent|剑池|难点|挑战|架构/i;
const DOM_INTENT = /dom|元素|定位|snapshot|a11y|页面结构|可交互|有多少按钮|当前页/i;
const POLICY_INTENT = /制度|年假|加班|vpn|工单|请假|报销|开通/i;
const URL_RE = /https?:\/\/[^\s)）"'<>]+/i;

type SkillPick =
  | { kind: "skill"; skill: AgentSkill; hits: string[]; score: number }
  | { kind: "about-site"; reason: string }
  | { kind: "knowledge"; reason: string }
  | { kind: "open" };

function toolAllowed(name: string, enabled?: string[]) {
  if (!enabled?.length) return true;
  return enabled.includes(name);
}

function expandQuery(query: string, history?: AgentChatMessage[]): string {
  const turns = (history ?? []).filter((m) => m.role === "user" || m.role === "assistant");
  const compact = query.replace(/\s/g, "");
  if (compact.length > 18 || turns.length < 2) return query;
  const lastUser = [...turns].reverse().find((m) => m.role === "user" && m.content.trim() !== query.trim());
  if (!lastUser) return query;
  return `${lastUser.content}\n追问：${query}`;
}

function pickSkill(query: string): SkillPick {
  if (URL_RE.test(query)) {
    return { kind: "open" };
  }
  if (HEALTH_INTENT.test(query) && getSkill("site-analyzer")) {
    return { kind: "skill", skill: getSkill("site-analyzer")!, hits: ["health-intent"], score: 2 };
  }
  if (ABOUT_SITE_INTENT.test(query)) {
    return { kind: "about-site", reason: "问的是这个网站是什么" };
  }

  const cap = classifyCapability(query);
  if (cap.matched && getSkill("policy-desk")) {
    return { kind: "skill", skill: getSkill("policy-desk")!, hits: [cap.cap], score: 3 };
  }

  if (KNOWLEDGE_INTENT.test(query)) {
    return { kind: "knowledge", reason: "项目 / 经历类问题，检索知识库" };
  }

  const top = explainDiscovery(query)[0];
  if (top && top.score >= 2) {
    return { kind: "skill", skill: top.skill, hits: top.hits, score: top.score };
  }

  return { kind: "open" };
}

function planOpenTools(query: string, enabled?: string[], force?: GuestForce): PlannedCall[] {
  const allow = (n: string) => toolAllowed(n, enabled);
  const origin = typeof location !== "undefined" ? location.origin : "";
  const url = query.match(URL_RE)?.[0] ?? (force === "probe" ? origin : undefined);

  if (force === "probe") {
    return allow("http_probe") && url ? [{ name: "http_probe", args: { url, method: "GET" } }] : [];
  }
  if (force === "dom") {
    return allow("browser_snapshot") ? [{ name: "browser_snapshot", args: { compact: true } }] : [];
  }
  if (force === "policy") {
    return allow("policy_search") ? [{ name: "policy_search", args: { query, topK: 4 } }] : [];
  }
  if (force === "knowledge") {
    return allow("knowledge_search") ? [{ name: "knowledge_search", args: { query, topK: 5 } }] : [];
  }

  const calls: PlannedCall[] = [];
  if (url && allow("http_probe")) {
    calls.push({ name: "http_probe", args: { url, method: "GET" } });
  } else if (HEALTH_INTENT.test(query) && allow("http_probe") && origin) {
    calls.push({ name: "http_probe", args: { url: origin, method: "HEAD" } });
  }

  if (DOM_INTENT.test(query) && allow("browser_snapshot")) {
    calls.push({ name: "browser_snapshot", args: { compact: true } });
  }

  if (POLICY_INTENT.test(query) && allow("policy_search")) {
    calls.push({ name: "policy_search", args: { query, topK: 4 } });
    // 制度问句只查手册，不误伤项目知识库导致「未命中」
    return calls;
  }

  if (allow("knowledge_search")) {
    calls.push({ name: "knowledge_search", args: { query, topK: 5 } });
  }

  return calls;
}

async function streamText(text: string, onEvent: (ev: AgentStreamEvent) => void, chunk = 2) {
  for (let i = 0; i < text.length; i += chunk) {
    onEvent({ type: "text-delta", text: text.slice(i, i + chunk) });
    await sleep(8);
  }
}

async function streamReasoning(text: string, onEvent: (ev: AgentStreamEvent) => void) {
  for (let i = 0; i < text.length; i += 4) {
    onEvent({ type: "reasoning-delta", text: text.slice(i, i + 4) });
    await sleep(6);
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

function composeFromHits(hits: KnowledgeHit[], lead?: string): string {
  const usable = hits.filter((h) => (h.excerpt ?? "").trim().length > 0);
  if (usable.length === 0) {
    return lead ? `${lead}\n\n知识库这一轮没有更多片段。` : "";
  }
  const body = usable
    .slice(0, 3)
    .map((h) => h.excerpt!.trim())
    .join("\n\n");
  const sources = [...new Set(usable.map((h) => h.title).filter(Boolean))];
  const parts = [lead, body, sources.length ? `来源：${sources.join(" · ")}` : ""]
    .filter(Boolean)
    .join("\n\n");
  return parts;
}

function summarizeSnapshot(snap: SnapResult | undefined): string {
  const nodes = snap?.nodes ?? [];
  const byRole: Record<string, number> = {};
  for (const n of nodes) byRole[n.role] = (byRole[n.role] ?? 0) + 1;
  const interactive = (byRole.button ?? 0) + (byRole.link ?? 0) + (byRole.textbox ?? 0);
  const top = Object.entries(byRole)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([r, n]) => `${r} ${n}`)
    .join("、");
  const samples = nodes
    .filter((n) => n.role === "button" || n.role === "link" || n.role === "textbox")
    .slice(0, 8)
    .map((n) => `- ${n.role} · ${n.name || n.tag}`)
    .join("\n");
  return [
    `当前页抓到 ${snap?.nodeCount ?? nodes.length} 个节点，可交互约 ${interactive} 个。`,
    top ? `Role 分布：${top}` : "",
    samples ? `可交互样例：\n${samples}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function synthesizeOpenAnswer(query: string, packs: ToolPack[]): string {
  const parts: string[] = [];
  const compact = query.replace(/\s/g, "");

  if (compact.length <= 2 && !URL_RE.test(query)) {
    return "这句话信息太少了。可以直接问项目（iMean / OwnAgent / 剑池）、粘贴 URL 探活、或输入 /search /dom /policy。";
  }

  const httpPack = packs.find((p) => p.name === "http_probe");
  const http = httpPack?.content as HttpProbe | undefined;
  if (http) {
    if (http.ok) {
      parts.push(`**探活通过。** ${http.url ?? ""} → HTTP ${http.status ?? "—"}，${http.latencyMs ?? "—"}ms。`);
    } else {
      parts.push(
        `**探活失败。** ${http.url ?? ""} ${http.error ? `· ${http.error}` : `· status ${http.status ?? "—"}`}。跨域或站点拒绝时浏览器会拦请求。`,
      );
    }
  }

  const snapPack = packs.find((p) => p.name === "browser_snapshot");
  if (snapPack?.ok) parts.push(summarizeSnapshot(snapPack.content as SnapResult));

  const policyPack = packs.find((p) => p.name === "policy_search");
  const policyHits = ((policyPack?.content as { hits?: PolicyHit[] } | undefined)?.hits ?? []).filter((h) => h.text);
  if (policyHits.length) {
    parts.push(
      policyHits
        .slice(0, 3)
        .map((h) => (h.value ? `**${h.slot ?? h.chunkId}**：${h.value}\n${h.text}` : h.text))
        .join("\n\n"),
    );
  }

  const knowPack = packs.find((p) => p.name === "knowledge_search");
  const hits = ((knowPack?.content as { hits?: KnowledgeHit[] } | undefined)?.hits ?? []) as KnowledgeHit[];
  const fromKb = composeFromHits(hits);
  if (fromKb && !ABOUT_SITE_INTENT.test(query)) parts.push(fromKb);
  if (fromKb && ABOUT_SITE_INTENT.test(query)) {
    parts.unshift(composeFromHits(hits, "这是王旭的个人作品站，主项目是 OwnAgent。"));
  }

  const unique = [...new Set(parts.filter(Boolean))];
  if (unique.length) return unique.join("\n\n");

  return [
    `知识库和当前工具里，没有足够依据回答「${query}」。`,
    "可以直接问项目（iMean / OwnAgent / 剑池）、粘贴一个 URL 让我探活、让我看当前页的 DOM，或问年假/VPN 这类制度。接入自己的模型后，开放问题会走完整 Tool Call。",
  ].join("\n\n");
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
    lines.push(`- HTTP 探活：${http.ok ? "通过" : "失败"} · status ${http.status ?? "—"} · ${http.latencyMs ?? "—"}ms`);
    lines.push(`- 目标：${http.url ?? "本站"}`);
  }
  if (perf) {
    lines.push(`- TTFB：${perf.ttfbMs ?? "—"}ms · Load：${perf.loadMs ?? "—"}ms · Resources：${perf.resourceCount ?? "—"}`);
  }
  if (d?.dom) lines.push(`- DOM a11y 节点：${d.dom.a11yNodes ?? "—"}`);
  return lines.join("\n");
}

function synthesizeDomProbe(result: SkillResult): string {
  const p = (result.dashboard as { domProbe?: { totalNodes?: number; interactive?: number; density?: number; byRole?: Record<string, number> } })?.domProbe;
  if (!p) return "当前页 DOM 已抓取，细节在右侧 Trace。";
  const topRoles = Object.entries(p.byRole ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([r, n]) => `${r}(${n})`)
    .join("、");
  return [
    `当前页 ${p.totalNodes ?? "—"} 个节点，可交互 ${p.interactive ?? "—"}（密度 ${p.density ?? "—"}%）。`,
    topRoles ? `Role：${topRoles}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function synthesizeWorkflow(result: SkillResult): string {
  const wf = (result.dashboard as { workflow?: { runId?: string; workflowId?: string; status?: string; replaySteps?: number } })?.workflow;
  return [
    `已在本机 MCP 入队 workflow \`${wf?.workflowId ?? "—"}\`（runId ${wf?.runId ?? "—"}，${wf?.replaySteps ?? "—"} 步）。`,
    "这是本站的入队接口，不会去操控外部网站。要看真实浏览器自动化，打开 iMean 产品页。",
  ].join("\n");
}

function synthesizeGeneric(result: SkillResult): string {
  if (result.markdown) return result.markdown;
  if (result.dashboard) {
    return "```json\n" + JSON.stringify(result.dashboard, null, 2).slice(0, 2500) + "\n```";
  }
  if (result.meta?.raw != null) {
    return "```json\n" + JSON.stringify(result.meta.raw, null, 2).slice(0, 2500) + "\n```";
  }
  return "这轮工具已跑完，右侧 Trace 是原始返回。";
}

function synthesizeResponse(skill: AgentSkill, result: SkillResult, query: string): string {
  switch (skill.id) {
    case "site-analyzer":
      return synthesizeSiteAudit(result, query);
    case "dom-probe":
      return synthesizeDomProbe(result);
    case "workflow-orchestrator":
      return synthesizeWorkflow(result);
    case "policy-desk":
      return result.markdown ?? "制度值班已完成。";
    case "knowledge-lookup":
      return result.markdown ?? synthesizeGeneric(result);
    default:
      return synthesizeGeneric(result);
  }
}

async function runKnowledgePath(
  query: string,
  ctx: GuestTurnCtx,
  onEvent: (ev: AgentStreamEvent) => void,
  opts?: { searchQuery?: string; lead?: string },
): Promise<{ text: string; traces: AgentTurnTrace[] }> {
  const searchQuery = opts?.searchQuery ?? query;
  const t0 = performance.now();
  const tool: AgentToolTrace = {
    id: "guest-knowledge",
    name: "knowledge_search",
    args: JSON.stringify({ query: searchQuery, topK: 5 }),
    iteration: 1,
  };
  const traces: AgentTurnTrace[] = [{ iteration: 1, label: "Retrieve · 知识库", reasoning: "", text: "", tools: [tool] }];
  onEvent({ type: "iteration", n: 1 });
  onEvent({ type: "trace-sync", traces });
  onEvent({ type: "tool-start", tool });

  const out = await mcpServer.callTool("knowledge_search", { query: searchQuery, topK: 5 }, ctx);
  tool.result = out.content;
  tool.ms = Math.round(performance.now() - t0);
  tool.ok = !out.isError;
  onEvent({ type: "tool-end", tool: { ...tool } });
  onEvent({ type: "trace-sync", traces: [...traces] });

  const hits = (out.content as { hits?: KnowledgeHit[] })?.hits ?? [];
  const text =
    composeFromHits(hits, opts?.lead) ||
    `知识库未命中「${query}」。可以换项目名，或问架构 / 难点 / 技术栈。`;
  return { text, traces };
}

async function runOpenToolLoop(
  query: string,
  ctx: GuestTurnCtx,
  onEvent: (ev: AgentStreamEvent) => void,
): Promise<{ text: string; traces: AgentTurnTrace[] }> {
  const calls = planOpenTools(query, ctx.enabledTools, ctx.force);
  const traces: AgentTurnTrace[] = [
    { iteration: 1, label: "Act · 工具", reasoning: "", text: "", tools: [] },
  ];
  onEvent({ type: "iteration", n: 1 });
  onEvent({ type: "trace-sync", traces });

  const packs: ToolPack[] = [];
  for (const call of calls) {
    if (ctx.signal?.aborted) break;
    const tool: AgentToolTrace = {
      id: `open-${call.name}-${packs.length}`,
      name: call.name,
      args: JSON.stringify(call.args),
      iteration: 1,
    };
    traces[0]!.tools.push(tool);
    onEvent({ type: "tool-start", tool });
    onEvent({ type: "trace-sync", traces: traces.map((t) => ({ ...t, tools: [...t.tools] })) });
    const t0 = performance.now();
    const out = await mcpServer.callTool(call.name, call.args, ctx);
    tool.result = out.content;
    tool.ms = Math.round(performance.now() - t0);
    tool.ok = !out.isError;
    onEvent({ type: "tool-end", tool: { ...tool } });
    onEvent({ type: "trace-sync", traces: traces.map((t) => ({ ...t, tools: [...t.tools] })) });
    packs.push({ name: call.name, content: out.content, ok: !out.isError });
  }

  return { text: synthesizeOpenAnswer(query, packs), traces };
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

/** 免 API Key：对当前输入选工具并作答（带会话上下文） */
export async function runGuestAgentTurn(
  query: string,
  ctx: GuestTurnCtx,
  onEvent: (ev: AgentStreamEvent) => void,
): Promise<{
  assistantText: string;
  traces: AgentTurnTrace[];
  runtime?: "server" | "local";
  hitl?: TicketDraft;
  policyTrust?: PolicyTrustView;
  route?: RouteScoreView;
}> {
  const t0 = performance.now();
  const turnId = `guest-${Date.now().toString(36)}`;
  onEvent({ type: "turn-start", turnId });

  const working = ctx.pinned?.trim()
    ? `${query}\n【钉住】${ctx.pinned.trim().slice(0, 800)}`
    : query;

  const wrap = (
    text: string,
    traces: AgentTurnTrace[],
    runtime: "server" | "local",
    extra?: { hitl?: TicketDraft; policyTrust?: PolicyTrustView; route?: RouteScoreView },
  ) => {
    onEvent({ type: "done", iterations: 1, toolCount: traces.reduce((n, t) => n + t.tools.length, 0) });
    persistGuestRun(query, text, traces, runtime, Math.round(performance.now() - t0));
    return { assistantText: text, traces, runtime, ...extra };
  };

  if (
    peekRuntimeConfig().features.preferServerGuest &&
    !ctx.force &&
    !ctx.pinned?.trim()
  ) {
    try {
      const remote = await runGuestAgentAsync(query, { snapshotRoot: ctx.snapshotRoot });
      if (remote && !ctx.signal?.aborted) {
        for (const trace of remote.traces) {
          for (const tool of trace.tools) {
            onEvent({
              type: "tool-start",
              tool: { id: tool.id, name: tool.name, args: tool.args, iteration: tool.iteration },
            });
            onEvent({
              type: "tool-end",
              tool: { id: tool.id, name: tool.name, args: tool.args, result: tool.result, ok: tool.ok, iteration: tool.iteration },
            });
          }
        }
        await streamText(remote.assistantText, onEvent);
        return wrap(remote.assistantText, remote.traces, remote.runtime, {
          route: {
            skillId: "server-guest",
            skillName: "自研 Agent · Server",
            score: 4,
            hits: ["hybrid-rag", "mcp"],
            path: "guest",
          },
        });
      }
    } catch { /* 回退浏览器内 Agent Loop */ }
  }

  if (ctx.force === "knowledge") {
    await streamReasoning("斜杠 /search · 知识库", onEvent);
    const expanded = expandQuery(working, ctx.history);
    const ran = await runKnowledgePath(expanded, ctx, onEvent, { searchQuery: expanded });
    await streamText(ran.text, onEvent);
    return wrap(ran.text, ran.traces, "local", {
      route: { skillId: "knowledge-lookup", skillName: "知识检索", score: 2, hits: ["/search"], path: "knowledge" },
    });
  }

  if (ctx.force === "probe" || ctx.force === "dom" || ctx.force === "policy") {
    await streamReasoning(`斜杠 /${ctx.force} · 指定工具`, onEvent);
    const ran = await runOpenToolLoop(working, { ...ctx, force: ctx.force }, onEvent);
    await streamText(ran.text, onEvent);
    return wrap(ran.text, ran.traces, "local", {
      route: {
        skillId: ctx.force,
        skillName: ctx.force === "policy" ? "制度检索" : ctx.force === "dom" ? "DOM 探针" : "站点探活",
        score: 3,
        hits: [`/${ctx.force}`],
        path: "open",
      },
    });
  }

  const pick = pickSkill(working);
  const expanded = expandQuery(working, ctx.history);

  if (pick.kind === "about-site" || pick.kind === "knowledge" || pick.kind === "open") {
    await streamReasoning(
      pick.kind === "open" ? "按问题选工具：检索 / 探活 / 当前页 / 制度" : pick.reason,
      onEvent,
    );
    const ran =
      pick.kind === "open"
        ? await runOpenToolLoop(query, ctx, onEvent)
        : await runKnowledgePath(expanded, ctx, onEvent, {
            searchQuery: pick.kind === "about-site" ? `${expanded} OwnAgent 作品站` : expanded,
            lead: pick.kind === "about-site" ? "这是王旭的个人作品站，主项目是 OwnAgent。" : undefined,
          });
    await streamText(ran.text, onEvent);
    return wrap(ran.text, ran.traces, "local", {
      route: {
        skillId: pick.kind,
        skillName: pick.kind === "about-site" ? "本站介绍" : pick.kind === "knowledge" ? "知识检索" : "开放工具",
        score: pick.kind === "open" ? 1 : 2,
        hits: pick.kind === "open" ? ["open-tools"] : [pick.reason],
        path: pick.kind,
      },
    });
  }

  const { skill, hits, score } = pick;
  const reasoning = `命中技能 ${skill.name}（${hits.join("、") || score}）→ ${skill.plan.join(" → ")}`;
  await streamReasoning(reasoning, onEvent);
  onEvent({ type: "iteration", n: 1 });

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

  const text = synthesizeResponse(skill, result, expanded);
  await streamText(text, onEvent);

  let hitl: TicketDraft | undefined;
  let policyTrust: PolicyTrustView | undefined;
  const pol = result.dashboard?.policy;
  if (pol && typeof pol === "object") {
    const p = pol as {
      ticketId?: string;
      capability?: PolicyTrustView["cap"];
      reason?: string;
      outcome?: PolicyTrustView["outcome"];
      citations?: PolicyTrustView["citations"];
    };
    if (p.ticketId) hitl = getTicket(p.ticketId) ?? undefined;
    if (p.capability && p.outcome) {
      policyTrust = {
        cap: p.capability,
        reason: p.reason ?? "",
        outcome: p.outcome,
        citations: p.citations ?? [],
      };
    }
  }

  return wrap(text, finalTraces, "local", {
    hitl,
    policyTrust,
    route: {
      skillId: skill.id,
      skillName: skill.name,
      score,
      hits,
      path: "skill",
    },
  });
}

export function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /401|403|authentication|invalid.*key|api key/i.test(msg);
}
