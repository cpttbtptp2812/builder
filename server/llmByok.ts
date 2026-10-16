import { fetchExternal, readResponseTextLimited } from "./security.ts";
import { parseModelIds } from "../src/lib/llmWire.ts";

export type ByokMessage = { role: string; content: string };

const ROLES = new Set(["system", "user", "assistant"]);

export function readByokTarget(body: { baseUrl?: unknown; model?: unknown; apiKey?: unknown }): {
  baseUrl: string;
  model: string;
  apiKey: string;
} {
  const baseUrl = String(body.baseUrl ?? "").trim().replace(/\/$/, "");
  const model = String(body.model ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();
  return { baseUrl, model, apiKey };
}

export function readByokMessages(raw: unknown): ByokMessage[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 24) {
    throw new Error("消息需为 1 到 24 条");
  }
  return raw.map((row) => {
    if (!row || typeof row !== "object") throw new Error("消息格式无效");
    const role = String((row as { role?: unknown }).role ?? "");
    const content = String((row as { content?: unknown }).content ?? "");
    if (!ROLES.has(role) || !content.trim() || content.length > 8000) {
      throw new Error("消息角色或内容无效");
    }
    return { role, content };
  });
}

export async function listByokModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  const res = await fetchExternal(`${baseUrl}/models`, { headers }, { timeoutMs: 20_000, maxBytes: 512 * 1024 });
  const text = await readResponseTextLimited(res, 512 * 1024);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 160) || res.statusText}`);
  }
  const models = parseModelIds(JSON.parse(text) as unknown);
  if (!models.length) throw new Error("模型列表为空");
  return models;
}

export async function openByokChatStream(opts: {
  baseUrl: string;
  model: string;
  apiKey: string;
  messages: ByokMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`;
  const timeout = AbortSignal.timeout(120_000);
  const signal = opts.signal ? AbortSignal.any([timeout, opts.signal]) : timeout;
  return fetchExternal(
    `${opts.baseUrl}/chat/completions`,
    {
      method: "POST",
      headers,
      signal,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: Number.isFinite(opts.temperature) ? opts.temperature : 0.4,
        max_tokens: Math.min(2000, Math.max(1, Number(opts.maxTokens) || 800)),
        stream: true,
      }),
    },
    { timeoutMs: 120_000 },
  );
}
