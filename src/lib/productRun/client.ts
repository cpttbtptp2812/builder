import { apiUrl, getTeamToken } from "../apiClient";
import type { ProductLlmConfig } from "../llmProductBrief";
import type { ProductDataSlot } from "../productDataStore";
import type {
  ProductRunApiResult,
  ProductRunProcessPart,
  ProductRunStreamHandlers,
  ProductRunView,
} from "./types";

export function productHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getTeamToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function parseSseBody(
  body: ReadableStream<Uint8Array>,
  handlers: ProductRunStreamHandlers,
  signal?: AbortSignal,
): Promise<ProductRunApiResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let final: ProductRunApiResult | null = null;

  const dispatch = (block: string) => {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;
    const raw = dataLines.join("\n");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }

    if (event === "running") {
      handlers.onRunning?.(parsed as { processId: string; skillId: string; query: string });
      return;
    }
    if (event === "gate") {
      const g = parsed as Extract<ProductRunApiResult, { ok: true; status: "waiting_import" }>;
      final = g;
      handlers.onGate?.(g);
      return;
    }
    if (event === "step") {
      handlers.onStep?.(parsed as ProductRunProcessPart);
      return;
    }
    if (event === "finish") {
      const f = parsed as Extract<ProductRunApiResult, { ok: true; status: "finish" }>;
      final = f;
      handlers.onFinish?.(f);
      return;
    }
    if (event === "error") {
      const err = parsed as { error?: string };
      const msg = err.error ? String(err.error) : "办事 run 失败";
      final = { ok: false, error: msg };
      handlers.onError?.(msg);
    }
  };

  while (true) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      if (block.trim()) dispatch(block);
    }
  }
  if (buffer.trim()) dispatch(buffer);

  return final ?? { ok: false, error: "流结束但未收到结果" };
}

export async function streamProductRun(
  body:
    | { action: "start"; sessionId: string; skillId: string; query: string; llmConfig?: ProductLlmConfig }
    | { action: "continue"; processId: string; sessionId: string; llmConfig?: ProductLlmConfig }
    | { action: "rerun"; processId: string; sessionId: string; llmConfig?: ProductLlmConfig },
  handlers: ProductRunStreamHandlers,
  signal?: AbortSignal,
): Promise<ProductRunApiResult> {
  const res = await fetch(apiUrl("/product-run/stream"), {
    method: "POST",
    headers: productHeaders({ "Content-Type": "application/json", Accept: "text/event-stream" }),
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => "");
    return { ok: false, error: err.slice(0, 200) || `HTTP ${res.status}` };
  }
  return parseSseBody(res.body, handlers, signal);
}

export function viewFromStreamStart(
  processId: string,
  skillId: string,
  query: string,
  status: ProductRunView["status"] = "running",
): ProductRunView {
  return { processId, skillId, query, status, parts: [] };
}

export async function apiStartProductRun(opts: {
  sessionId: string;
  skillId: string;
  query: string;
  signal?: AbortSignal;
  handlers?: ProductRunStreamHandlers;
  llmConfig?: ProductLlmConfig;
}): Promise<ProductRunApiResult> {
  if (opts.handlers) {
    return streamProductRun(
      {
        action: "start",
        sessionId: opts.sessionId,
        skillId: opts.skillId,
        query: opts.query,
        llmConfig: opts.llmConfig,
      },
      opts.handlers,
      opts.signal,
    );
  }
  const res = await fetch(apiUrl("/product-run/start"), {
    method: "POST",
    headers: productHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
    signal: opts.signal,
  });
  return (await res.json()) as ProductRunApiResult;
}

export async function apiContinueProductRun(
  processId: string,
  sessionId: string,
  handlers?: ProductRunStreamHandlers,
  signal?: AbortSignal,
  llmConfig?: ProductLlmConfig,
): Promise<ProductRunApiResult> {
  if (handlers) {
    return streamProductRun({ action: "continue", processId, sessionId, llmConfig }, handlers, signal);
  }
  const res = await fetch(apiUrl("/product-run/continue"), {
    method: "POST",
    headers: productHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ processId, sessionId }),
    signal,
  });
  return (await res.json()) as ProductRunApiResult;
}

export async function apiRerunProductRun(
  processId: string,
  sessionId: string,
  handlers?: ProductRunStreamHandlers,
  signal?: AbortSignal,
  llmConfig?: ProductLlmConfig,
): Promise<ProductRunApiResult> {
  if (handlers) {
    return streamProductRun({ action: "rerun", processId, sessionId, llmConfig }, handlers, signal);
  }
  const res = await fetch(apiUrl("/product-run/continue"), {
    method: "POST",
    headers: productHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ processId, sessionId }),
    signal,
  });
  return (await res.json()) as ProductRunApiResult;
}

export async function apiFetchDeskTemplate(
  skillId: string,
  slot: ProductDataSlot,
): Promise<{ ok: boolean; error?: string; filename?: string; csv?: string }> {
  const q = new URLSearchParams({ skillId, slot });
  const res = await fetch(apiUrl(`/product-run/template?${q}`), { headers: productHeaders() });
  return (await res.json()) as { ok: boolean; error?: string; filename?: string; csv?: string };
}

export async function apiUploadProductDataset(opts: {
  sessionId: string;
  slot: ProductDataSlot;
  csv?: string;
  title?: string;
  workbookBase64?: string;
  filename?: string;
}): Promise<{
  ok: boolean;
  error?: string;
  title?: string;
  rows?: number;
  schemaOk?: boolean;
  schemaIssues?: string[];
}> {
  const res = await fetch(apiUrl("/product-run/dataset"), {
    method: "POST",
    headers: productHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(opts),
  });
  return (await res.json()) as {
    ok: boolean;
    error?: string;
    rows?: number;
    schemaOk?: boolean;
    schemaIssues?: string[];
  };
}

export async function apiArchiveProductRun(
  processId: string,
  sessionId: string,
): Promise<{ ok: boolean; error?: string; archivedAt?: string }> {
  const res = await fetch(apiUrl("/product-run/archive"), {
    method: "POST",
    headers: productHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ processId, sessionId }),
  });
  return (await res.json()) as { ok: boolean; error?: string; archivedAt?: string };
}
