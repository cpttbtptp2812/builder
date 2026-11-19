import React, { useCallback, useEffect, useRef, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Loader2, RefreshCw, WifiOff } from "lucide-react";

type Span = {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  runId?: string | null;
  name: string;
  spanKind?: string;
  status: "UNSET" | "OK" | "ERROR" | string;
  startedAt: string;
  endedAt?: string | null;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  usageSource?: string;
  attributes?: Record<string, unknown> | null;
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

function mergeSpans(current: Span[], incoming: Span[]): Span[] {
  const byId = new Map(current.map((span) => [span.spanId, span]));
  for (const span of incoming) {
    if (!span || typeof span.spanId !== "string" || typeof span.traceId !== "string") continue;
    byId.set(span.spanId, { ...byId.get(span.spanId), ...span });
  }
  return [...byId.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

function parseSpanEvent(block: string): Span | null {
  const lines = block.split(/\r?\n/);
  const eventName = lines.find((line) => line.startsWith("event:"))?.slice(6).trim();
  if (eventName !== "trace_span") return null;
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).replace(/^ /, ""))
    .join("\n");
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as Span;
    return parsed && typeof parsed.spanId === "string" && typeof parsed.traceId === "string"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function formatDuration(value?: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return "—";
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

function statusLabel(status: string): string {
  if (status === "OK") return "已完成";
  if (status === "ERROR") return "失败";
  return "执行中";
}

export const ExternalAgentTracePanel: React.FC = () => {
  // API keys stay in component memory only; never persist them in localStorage/sessionStorage.
  const [apiKey, setApiKey] = useState("");
  const [traceId, setTraceId] = useState("");
  const [spans, setSpans] = useState<Span[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rawExpanded, setRawExpanded] = useState<Set<string>>(new Set());
  const [detailsOpen, setDetailsOpen] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setConnected(false);
    setLoading(false);
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  const readStream = async (response: Response, signal: AbortSignal) => {
    if (!response.body) throw new Error("实时连接没有返回可读取的数据流");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!signal.aborted) {
        const item = await reader.read();
        if (item.done) break;
        buffer += decoder.decode(item.value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() || "";
        for (const block of blocks) {
          const span = parseSpanEvent(block);
          if (span) setSpans((current) => mergeSpans(current, [span]));
        }
      }
      buffer += decoder.decode();
      const finalSpan = parseSpanEvent(buffer);
      if (finalSpan) setSpans((current) => mergeSpans(current, [finalSpan]));
      if (!signal.aborted) throw new Error("实时连接已结束");
    } finally {
      reader.releaseLock();
    }
  };

  const connect = async () => {
    const key = apiKey.trim();
    const id = traceId.trim();
    if (!key || !id) {
      setError("请填写 Agent API Key 和 Trace ID");
      return;
    }

    stop();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");
    setSpans([]);
    setExpanded(new Set());
    setRawExpanded(new Set());

    const headers = { Authorization: `Bearer ${key}` };
    let attempt = 0;
    try {
      while (!controller.signal.aborted && attempt < 6) {
        try {
          // Subscribe first, then load the snapshot. Events emitted during the snapshot
          // request remain buffered in the stream and are merged afterwards.
          const streamResponse = await fetch(
            `/api/v1/traces/${encodeURIComponent(id)}/events`,
            { headers: { ...headers, Accept: "text/event-stream" }, signal: controller.signal, cache: "no-store" }
          );
          if (!streamResponse.ok) {
            const message = streamResponse.status === 401 || streamResponse.status === 403
              ? "API Key 无效，或没有权限访问该 Trace"
              : `实时订阅失败：HTTP ${streamResponse.status}`;
            throw new Error(message);
          }

          const snapshotResponse = await fetch(
            `/api/v1/traces/${encodeURIComponent(id)}/spans`,
            { headers, signal: controller.signal, cache: "no-store" }
          );
          if (!snapshotResponse.ok) {
            void streamResponse.body?.cancel();
            throw new Error(snapshotResponse.status === 401 || snapshotResponse.status === 403
              ? "API Key 无效，或没有权限访问该 Trace"
              : `读取 Trace 失败：HTTP ${snapshotResponse.status}`);
          }
          let snapshot: unknown;
          try {
            snapshot = await snapshotResponse.json();
          } catch {
            void streamResponse.body?.cancel();
            throw new Error("Trace 响应不是有效 JSON");
          }
          if (!Array.isArray(snapshot)) {
            void streamResponse.body?.cancel();
            throw new Error("Trace 数据格式不正确：预期是 Span 数组");
          }

          setSpans((current) => mergeSpans(current, snapshot as Span[]));
          setConnected(true);
          setLoading(false);
          await readStream(streamResponse, controller.signal);
        } catch (cause) {
          if (controller.signal.aborted) break;
          if (cause instanceof Error && /API Key|没有权限|数据格式|HTTP 4/.test(cause.message)) throw cause;
          attempt += 1;
          setConnected(false);
          if (attempt >= 6) throw cause;
          setError(`实时连接中断，正在重连（${attempt}/5）…`);
          await sleep(Math.min(1000 * 2 ** (attempt - 1), 10000), controller.signal);
        }
      }
    } catch (cause) {
      if (!controller.signal.aborted) {
        controller.abort();
        setError(cause instanceof Error ? cause.message : "Trace 连接失败");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setConnected(false);
      setLoading(false);
    }
  };

  const retry = async (span: Span) => {
    const actionId = span.attributes?.action_id;
    if (typeof actionId !== "string" || !actionId || span.status !== "ERROR") return;
    if (!window.confirm("该步骤失败，但外部操作可能已经产生部分副作用。重试可能重复执行，请先核对外部系统。确认继续？")) return;
    try {
      const response = await fetch(
        `/api/v1/actions/${encodeURIComponent(actionId)}/retry?confirmPossibleDuplicateSideEffect=true`,
        { method: "POST", headers: { Authorization: `Bearer ${apiKey.trim()}` } }
      );
      if (!response.ok) {
        const detail = (await response.text()).slice(0, 160);
        throw new Error(`重试失败：HTTP ${response.status}${detail ? ` · ${detail}` : ""}`);
      }
      setError("已提交单独重试请求。它会创建新的 Action，不会覆盖原始失败记录。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "重试失败");
    }
  };

  const ordered = [...spans].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  // Token values are shown per span. Summing every span can double-count parent/child
  // model usage, so the header deliberately avoids presenting a misleading grand total.
  const tokenSpans = spans.filter((span) => span.totalTokens != null);
  const knownTokenCount = tokenSpans.length;
  const failedCount = spans.filter((span) => span.status === "ERROR").length;

  return (
    <section className="mb-3 overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50/40">
      <button
        type="button"
        onClick={() => setDetailsOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 border-b border-indigo-100 px-3 py-2.5 text-left"
        aria-expanded={detailsOpen}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-indigo-600" />
          <b className="truncate text-xs text-slate-800">连接外部 Agent 观察执行</b>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : loading ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-500"}`}>
            {connected ? "实时连接中" : loading ? "正在连接" : "未连接"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 text-[10px] text-slate-500">
          {spans.length} spans{failedCount > 0 ? ` · ${failedCount} 失败` : ""} · {knownTokenCount} 条含 Token
          {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>

      {detailsOpen && <div className="space-y-2 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <input
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder="Agent API Key"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono"
          />
          <input
            value={traceId}
            onChange={(event) => setTraceId(event.target.value)}
            placeholder="Trace ID"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono"
          />
          <button
            type="button"
            onClick={connected || loading ? stop : () => void connect()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : connected ? <WifiOff className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {loading ? "停止连接" : connected ? "断开连接" : "连接 Trace"}
          </button>
        </div>
        <p className="text-[10px] leading-4 text-slate-500">
          API Key 仅在当前页面内存中使用，不会写入浏览器存储。Span、耗时和 Token 只展示 SDK 实际上报的数据。
        </p>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-700">{error}</div>}

        {ordered.length === 0 ? (
          <div className="py-5 text-center text-[11px] text-slate-400">
            {connected || loading ? "正在等待该 Agent 上报执行步骤…" : "连接后，这里会显示该 Agent 已上报的真实执行步骤"}
          </div>
        ) : (
          <div className="max-h-[42vh] space-y-1.5 overflow-y-auto">
            {ordered.map((span, index) => {
              const open = expanded.has(span.spanId);
              const actionId = span.attributes?.action_id;
              return (
                <div key={span.spanId} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setExpanded((current) => {
                      const next = new Set(current);
                      open ? next.delete(span.spanId) : next.add(span.spanId);
                      return next;
                    })}
                    className="flex w-full items-center gap-2 p-2.5 text-left"
                    aria-expanded={open}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${span.status === "ERROR" ? "bg-rose-500" : span.status === "OK" ? "bg-emerald-500" : "animate-pulse bg-blue-400"}`} />
                    <span className="text-[10px] font-mono text-slate-400">#{index + 1}</span>
                    <b className="min-w-0 flex-1 truncate text-xs text-slate-800">{span.name}</b>
                    <span className={`text-[10px] ${span.status === "ERROR" ? "text-rose-600" : span.status === "OK" ? "text-emerald-600" : "text-blue-600"}`}>{statusLabel(span.status)}</span>
                    <span className="text-[10px] text-slate-500">{formatDuration(span.durationMs)}</span>
                    <span className="text-[10px] text-slate-500">{span.totalTokens ?? "—"} tokens</span>
                    {open ? <ChevronDown className="h-3.5 w-3.5 text-slate-400" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                  </button>
                  {open && <div className="space-y-2 border-t border-slate-100 p-2.5">
                    <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                      <div className="rounded bg-slate-50 p-2"><div className="text-slate-400">状态</div><b>{statusLabel(span.status)} ({span.status})</b></div>
                      <div className="rounded bg-slate-50 p-2"><div className="text-slate-400">输入 / 输出</div><b>{span.inputTokens ?? "—"} / {span.outputTokens ?? "—"}</b></div>
                      <div className="rounded bg-slate-50 p-2"><div className="text-slate-400">Usage 来源</div><b>{span.usageSource || "MISSING"}</b></div>
                      <div className="rounded bg-slate-50 p-2"><div className="text-slate-400">Span ID</div><b className="break-all font-mono">{span.spanId}</b></div>
                    </div>
                    {span.parentSpanId && <div className="text-[10px] text-slate-500">父级 Span：<code>{span.parentSpanId}</code></div>}
                    {span.runId && <div className="text-[10px] text-slate-500">Run ID：<code>{span.runId}</code></div>}
                    {(() => {
                      const attrs = span.attributes || {};
                      const sections: Array<{ label: string; value: unknown; tone: string }> = [
                        { label: "实际发送给模型的提示词 / 上下文", value: attrs.prompt_messages ?? attrs.messages_sent ?? attrs.messages ?? attrs.prompt, tone: "border-violet-200 bg-violet-50/60" },
                        { label: "模型实际返回", value: attrs.model_response ?? attrs.response_message ?? attrs.assistant_message ?? attrs.completion, tone: "border-blue-200 bg-blue-50/60" },
                        { label: "模型决定调用的工具", value: attrs.tool_calls ?? attrs.tool_call ?? attrs.function_call, tone: "border-amber-200 bg-amber-50/60" },
                        { label: "工具实际输入参数", value: attrs.tool_arguments ?? attrs.arguments ?? attrs.action_arguments, tone: "border-sky-200 bg-sky-50/60" },
                        { label: "工具实际执行结果", value: attrs.tool_result ?? attrs.action_output ?? attrs.result, tone: "border-emerald-200 bg-emerald-50/60" },
                        { label: "失败信息", value: attrs.error_message ?? attrs.error ?? attrs.exception, tone: "border-rose-200 bg-rose-50/60" },
                      ].filter((item) => item.value !== undefined && item.value !== null);
                      return (
                        <div className="space-y-2">
                          {sections.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                              这条 Span 只记录了名称、状态和耗时，没有采集提示词、模型响应或工具参数。需要在 Agent SDK 中显式开启内容采集并上报，不能从 Span 名称还原真实提示词。
                            </div>
                          ) : sections.map((item) => (
                            <div key={item.label} className={`overflow-hidden rounded-lg border p-2.5 ${item.tone}`}>
                              <div className="mb-1.5 text-[10px] font-bold text-slate-700">{item.label}</div>
                              <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-slate-700">{typeof item.value === "string" ? item.value : JSON.stringify(item.value, null, 2)}</pre>
                            </div>
                          ))}
                          <button type="button" onClick={() => setRawExpanded((current) => {
                            const next = new Set(current);
                            next.has(span.spanId) ? next.delete(span.spanId) : next.add(span.spanId);
                            return next;
                          })} className="text-[10px] font-semibold text-slate-500 hover:text-indigo-600">
                            {rawExpanded.has(span.spanId) ? "收起原始 Span 数据" : "查看原始 Span 数据"}
                          </button>
                          {rawExpanded.has(span.spanId) && <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-2 text-[10px] text-slate-100">{JSON.stringify(attrs, null, 2)}</pre>}
                        </div>
                      );
                    })()}
                    {span.status === "ERROR" && typeof actionId === "string" && actionId && (
                      <button
                        type="button"
                        onClick={() => void retry(span)}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-800"
                      >
                        确认风险并重试关联 Action
                      </button>
                    )}
                  </div>}
                </div>
              );
            })}
          </div>
        )}
      </div>}
    </section>
  );
};
