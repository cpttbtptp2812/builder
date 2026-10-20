import { createOpenAI } from "@ai-sdk/openai";
import { frontendTools, type FrontendTools } from "assistant-stream/ai-sdk";
import { convertToModelMessages, streamText, type ToolSet, type UIMessage } from "ai";
import type { Context } from "hono";
import { assertSafeExternalUrl, fetchExternal } from "./security.ts";
import { recordLlmError, safeLog } from "./observability.ts";

function hostOf(raw: string): string {
  try {
    return new URL(raw).hostname;
  } catch {
    return "";
  }
}

function providerFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const timeout = AbortSignal.timeout(120_000);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetchExternal(url, { ...init, signal }, { timeoutMs: 120_000, maxBytes: 4 * 1024 * 1024 });
}

function frontendToolSet(raw: unknown): ToolSet | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const safe: FrontendTools = {};
  for (const [name, def] of Object.entries(raw).slice(0, 24)) {
    if (!/^[A-Za-z][\w-]{0,64}$/.test(name)) continue;
    if (!def || typeof def !== "object") continue;
    const parameters = (def as { parameters?: unknown }).parameters;
    if (!parameters || typeof parameters !== "object") continue;
    const description = (def as { description?: unknown }).description;
    safe[name] = {
      description: typeof description === "string" ? description.slice(0, 800) : undefined,
      parameters: parameters as FrontendTools[string]["parameters"],
    };
  }
  if (Object.keys(safe).length === 0) return undefined;
  return frontendTools(safe);
}

/** AI SDK 的对话流转发。Key 只用于这一次请求，不入库。 */
export async function handleAssistantChat(c: Context): Promise<Response> {
  let body: {
    messages?: UIMessage[];
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    system?: string;
    tools?: unknown;
    callSettings?: { temperature?: number };
  };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "请求不是 JSON" }, 400);
  }
  const baseUrl = String(body.baseUrl ?? "").trim().replace(/\/$/, "");
  const model = String(body.model ?? "").trim();
  const apiKey = String(body.apiKey ?? "").trim();
  const messages = body.messages;
  const system = typeof body.system === "string" ? body.system.slice(0, 72_000) : "";
  const temperature = typeof body.callSettings?.temperature === "number" ? body.callSettings.temperature : 0.7;
  if (!baseUrl || !model || !apiKey) {
    return c.json({ error: "模型地址、模型与 Key 不能为空" }, 400);
  }
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 80) {
    return c.json({ error: "消息需为 1 到 80 条" }, 400);
  }
  try {
    assertSafeExternalUrl(baseUrl);
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "模型地址无效" }, 400);
  }
  try {
    const provider = createOpenAI({
      baseURL: baseUrl,
      apiKey,
      name: "byok",
      fetch: providerFetch,
    });
    const tools = frontendToolSet(body.tools);
    const result = streamText({
      model: provider.chat(model),
      system: system || undefined,
      tools,
      messages: await convertToModelMessages(messages, { tools }),
      abortSignal: c.req.raw.signal,
      maxOutputTokens: 8192,
      temperature,
    });
    return result.toUIMessageStreamResponse();
  } catch (error) {
    recordLlmError();
    safeLog("llm.error", { reason: "assistant-chat", host: hostOf(baseUrl) });
    return c.json({ error: error instanceof Error ? error.message : "模型请求失败" }, 502);
  }
}
