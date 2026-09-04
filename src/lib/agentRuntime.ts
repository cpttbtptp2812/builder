/** UniAgent 运行时 — LLM + MCP Tool Call Agent Loop */

import { isLlmConfigured, resolveLlmBaseUrl, type LlmConfig } from "./llmConfig";
import { buildAgentSystemPrompt, executeAgentTool, mcpToolsToOpenAi } from "./agentTools";

export type AgentRole = "user" | "assistant" | "system" | "tool";

export type AgentChatMessage = {
  role: AgentRole;
  content: string;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
};

type OpenAiToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type AgentToolTrace = {
  id: string;
  name: string;
  args: string;
  result?: unknown;
  ms?: number;
  ok?: boolean;
  iteration: number;
};

export type AgentTurnTrace = {
  iteration: number;
  label: string;
  reasoning: string;
  text: string;
  tools: AgentToolTrace[];
};

export type AgentStreamEvent =
  | { type: "turn-start"; turnId: string }
  | { type: "iteration"; n: number }
  | { type: "trace-sync"; traces: AgentTurnTrace[] }
  | { type: "reasoning-delta"; text: string }
  | { type: "text-delta"; text: string }
  | { type: "tool-start"; tool: AgentToolTrace }
  | { type: "tool-end"; tool: AgentToolTrace }
  | { type: "done"; iterations: number; toolCount: number }
  | { type: "error"; message: string };

type StreamDelta = {
  content?: string;
  reasoning_content?: string;
  tool_calls?: Array<{
    index: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
};

const MAX_ITERATIONS = 8;

async function streamChatCompletion(
  config: LlmConfig,
  messages: AgentChatMessage[],
  signal: AbortSignal,
  onDelta: (delta: StreamDelta) => void,
): Promise<{ content: string; reasoning: string; toolCalls: OpenAiToolCall[] }> {
  const baseUrl = resolveLlmBaseUrl(config.baseUrl);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: config.model,
      messages,
      tools: mcpToolsToOpenAi(),
      tool_choice: "auto",
      stream: true,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${errText.slice(0, 200) || res.statusText}`);
  }
  if (!res.body) throw new Error("LLM 响应无 body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  const toolAcc = new Map<number, OpenAiToolCall>();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;

      let parsed: { choices?: Array<{ delta?: StreamDelta; finish_reason?: string }> };
      try {
        parsed = JSON.parse(data) as typeof parsed;
      } catch {
        continue;
      }

      const delta = parsed.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.reasoning_content) {
        reasoning += delta.reasoning_content;
        onDelta({ reasoning_content: delta.reasoning_content });
      }
      if (delta.content) {
        content += delta.content;
        onDelta({ content: delta.content });
      }
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const prev = toolAcc.get(idx) ?? {
            id: tc.id ?? `call_${idx}`,
            type: "function" as const,
            function: { name: "", arguments: "" },
          };
          if (tc.id) prev.id = tc.id;
          if (tc.function?.name) prev.function.name += tc.function.name;
          if (tc.function?.arguments) prev.function.arguments += tc.function.arguments;
          toolAcc.set(idx, prev);
          onDelta({ tool_calls: [tc] });
        }
      }
    }
  }

  return {
    content,
    reasoning,
    toolCalls: [...toolAcc.values()].filter((t) => t.function.name),
  };
}

export async function runAgentTurn(
  userMessage: string,
  history: AgentChatMessage[],
  config: LlmConfig,
  ctx: { snapshotRoot?: Element | null; signal?: AbortSignal },
  onEvent: (ev: AgentStreamEvent) => void,
): Promise<{ assistantText: string; traces: AgentTurnTrace[]; messages: AgentChatMessage[] }> {
  if (!isLlmConfigured(config)) {
    onEvent({ type: "error", message: "请先配置 LLM API Key 和模型" });
    throw new Error("LLM not configured");
  }

  const signal = ctx.signal ?? new AbortController().signal;
  const turnId = `turn-${Date.now().toString(36)}`;
  onEvent({ type: "turn-start", turnId });

  const messages: AgentChatMessage[] = [
    { role: "system", content: buildAgentSystemPrompt() },
    ...history.filter((m) => m.role !== "system"),
    { role: "user", content: userMessage },
  ];

  const traces: AgentTurnTrace[] = [];
  let assistantText = "";
  let totalTools = 0;

  const syncTraces = () => onEvent({ type: "trace-sync", traces: traces.map((t) => ({ ...t, tools: [...t.tools] })) });

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    onEvent({ type: "iteration", n: iter + 1 });

    const trace: AgentTurnTrace = {
      iteration: iter + 1,
      label: iter === 0 ? "Plan · 解析意图" : `Replan · 第 ${iter + 1} 轮`,
      reasoning: "",
      text: "",
      tools: [],
    };
    traces.push(trace);
    syncTraces();

    const result = await streamChatCompletion(config, messages, signal, (delta) => {
      if (delta.reasoning_content) {
        trace.reasoning += delta.reasoning_content;
        onEvent({ type: "reasoning-delta", text: delta.reasoning_content });
      }
      if (delta.content) {
        trace.text += delta.content;
        onEvent({ type: "text-delta", text: delta.content });
      }
    });

    trace.reasoning = result.reasoning || trace.reasoning;
    trace.text = result.content || trace.text;

    if (result.toolCalls.length === 0) {
      assistantText = result.content;
      messages.push({ role: "assistant", content: result.content });
      break;
    }

    messages.push({
      role: "assistant",
      content: result.content || "",
      tool_calls: result.toolCalls,
    });

    for (const tc of result.toolCalls) {
      totalTools += 1;
      const toolTrace: AgentToolTrace = {
        id: tc.id,
        name: tc.function.name,
        args: tc.function.arguments,
        iteration: iter + 1,
      };
      trace.tools.push(toolTrace);
      onEvent({ type: "tool-start", tool: { ...toolTrace } });
      syncTraces();

      const exec = await executeAgentTool(tc.function.name, tc.function.arguments, ctx);
      toolTrace.result = exec.content;
      toolTrace.ms = exec.ms;
      toolTrace.ok = !exec.isError;
      onEvent({ type: "tool-end", tool: { ...toolTrace } });
      syncTraces();

      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(exec.content),
      });
    }

    if (iter === MAX_ITERATIONS - 1) {
      assistantText = result.content || "已达最大工具调用轮次。";
      messages.push({ role: "assistant", content: assistantText });
    }
  }

  onEvent({ type: "done", iterations: traces.length, toolCount: totalTools });
  return { assistantText, traces, messages: messages.filter((m) => m.role !== "system") };
}

export const AGENT_QUICK_PROMPTS = [
  { label: "发布前检查", text: "帮我对本站做发布前检查，探活并确认关键页面可访问" },
  { label: "项目检索", text: "我做过哪些 AI Agent 相关项目？用知识库检索后简要介绍" },
  { label: "DOM 分析", text: "分析当前页面的 DOM 结构，统计可交互元素" },
  { label: "自动化流程", text: "帮我入队一个改价上架的 workflow，并说明会执行哪些步骤" },
] as const;
