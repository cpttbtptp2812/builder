import { apiFetch } from "./apiClient";
import type { LlmConfig } from "./llmConfig";

export async function callByokLlm(
  config: LlmConfig,
  messages: { role: string; content: string }[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const out = await apiFetch<{ content?: string }>("/llm/byok/chat", {
    method: "POST",
    body: JSON.stringify({
      baseUrl: config.baseUrl,
      model: config.model,
      apiKey: config.apiKey,
      messages,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    }),
  });
  if (!out?.content?.trim()) throw new Error("模型没有返回内容");
  return out.content.trim();
}

