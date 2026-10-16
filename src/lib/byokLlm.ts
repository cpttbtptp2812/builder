import { apiUrl, getTeamToken } from "./apiClient";
import type { LlmConfig } from "./llmConfig";
import { resolveLlmBaseUrl } from "./llmConfig";
import { createThinkSplitter, parseModelIds, readStreamDelta, takeSseDataLines } from "./llmWire";

export async function callByokLlm(
  config: LlmConfig,
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const res = await fetch(apiUrl("/llm/byok/chat"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    }),
  });
  const data = (await res.json().catch(() => null)) as { content?: string; error?: string } | null;
  if (!res.ok) throw new Error(data?.error || `LLM HTTP ${res.status}`);
  if (!data?.content?.trim()) throw new Error("模型没有返回内容");
  return data.content.trim();
}

export async function listByokModels(config: LlmConfig): Promise<string[]> {
  if (isDirectLlm(config)) {
    const headers: Record<string, string> = {};
    if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
    const res = await fetch(`${resolveLlmBaseUrl(config.baseUrl)}/models`, { headers });
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 160)}`);
    const models = parseModelIds(JSON.parse(text) as unknown);
    if (!models.length) throw new Error("模型列表为空");
    return models;
  }
  const res = await fetch(apiUrl("/llm/models"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ baseUrl: config.baseUrl, apiKey: config.apiKey }),
  });
  const data = (await res.json().catch(() => null)) as { models?: string[]; error?: string } | null;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  if (!data?.models?.length) throw new Error("模型列表为空");
  return data.models;
}

/** 普通聊天：逐段回调正文。云端 Key 经办事服务转发，不落库。 */
export async function streamByokChat(
  config: LlmConfig,
  messages: { role: string; content: string }[],
  opts: {
    signal?: AbortSignal;
    onDelta?: (text: string) => void;
    onReasoning?: (text: string) => void;
    maxTokens?: number;
  } = {},
): Promise<{ content: string; reasoning: string }> {
  const direct = isDirectLlm(config);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const team = getTeamToken();
  if (direct && config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  if (!direct && team) headers.Authorization = `Bearer ${team}`;
  const res = await fetch(direct ? `${resolveLlmBaseUrl(config.baseUrl)}/chat/completions` : apiUrl("/llm/byok/stream"), {
    method: "POST",
    headers,
    signal: opts.signal,
    body: JSON.stringify(
      direct
        ? {
            model: config.model,
            messages,
            temperature: 0.4,
            max_tokens: opts.maxTokens ?? 800,
            stream: true,
          }
        : {
            baseUrl: config.baseUrl,
            model: config.model,
            apiKey: config.apiKey,
            messages,
            temperature: 0.4,
            maxTokens: opts.maxTokens ?? 800,
          },
    ),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let detail = errText.slice(0, 180);
    try {
      const parsed = JSON.parse(errText) as { error?: string };
      if (parsed.error) detail = parsed.error;
    } catch {
      /* 上游原文 */
    }
    throw new Error(detail || `LLM HTTP ${res.status}`);
  }
  if (!res.body) throw new Error("模型响应无正文");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";
  let reasoning = "";
  const splitThink = createThinkSplitter();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const taken = takeSseDataLines(buffer);
    buffer = taken.rest;
    for (const raw of taken.data) {
      const delta = readStreamDelta(raw);
      if (delta.reasoning) {
        reasoning += delta.reasoning;
        opts.onReasoning?.(delta.reasoning);
      }
      for (const piece of splitThink(delta.content)) {
        if (piece.kind === "reasoning") {
          reasoning += piece.text;
          opts.onReasoning?.(piece.text);
        } else {
          content += piece.text;
          opts.onDelta?.(piece.text);
        }
      }
    }
  }
  if (!content.trim() && !reasoning.trim()) throw new Error("模型没有返回内容");
  return { content: content.trim(), reasoning: reasoning.trim() };
}

function isDirectLlm(config: LlmConfig): boolean {
  return config.preset === "ollama" || /localhost|127\.0\.0\.1/.test(config.baseUrl);
}

function jsonHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const team = getTeamToken();
  if (team) headers.Authorization = `Bearer ${team}`;
  return headers;
}

