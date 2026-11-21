import React, { useCallback, useEffect, useState } from "react";
import type { ExecutionTraceData } from "@/components/chat/TraceInspectorDrawer";

type RunMessage = {
  id: string;
  content: string;
  isThinking?: boolean;
  runId?: string;
  traceId?: string;
  sessionId?: string;
  trace?: ExecutionTraceData;
};

type RunSummary = {
  runId: string;
  traceId?: string;
  name?: string;
  model?: string | null;
  provider?: string | null;
  status: string;
  startedAt?: string | null;
  durationMs?: number | null;
  totalTokens?: number | null;
  spanCount?: number;
  errorCount?: number;
};

type RunDetail = {
  run: {
    runId: string;
    traceId: string;
    name: string;
    model?: string | null;
    provider?: string | null;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
    durationMs?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    totalTokens?: number | null;
    usageSource?: string | null;
    errorMessage?: string | null;
  };
  spans: Array<{
    spanId: string;
    parentSpanId?: string | null;
    name: string;
    spanKind?: string;
    status: string;
    startedAt?: string | null;
    endedAt?: string | null;
    durationMs?: number | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    usageSource?: string | null;
    attributes?: unknown;
  }>;
  events: Array<{
    sequence: number;
    eventType: string;
    status: string;
    eventTime?: string;
    payload?: unknown;
  }>;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

function parseJson(value: unknown): any {
  if (typeof value !== "string") return value ?? {};
  try { return JSON.parse(value); } catch { return value; }
}

function safeObject(value: unknown): Record<string, any> {
  const parsed = parseJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const clean: Record<string, any> = {};
  for (const [key, item] of Object.entries(parsed)) {
    if (/^(analysis|reasoning|chain_of_thought|chainofthought|internal_thought|thoughts?|scratchpad)/i.test(key)) continue;
    clean[key] = item;
  }
  return clean;
}

function pretty(value: unknown): string {
  if (value == null) return "未采集";
  const parsed = parseJson(value);
  return typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
}

function dateLabel(value?: string | null): string {
  if (!value) return "未上报";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function durationLabel(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "未上报";
  return value >= 1000 ? (value / 1000).toFixed(2) + "s" : Math.round(value) + "ms";
}

function statusTone(status?: string): string {
  const value = (status || "").toUpperCase();
  if (value === "ERROR" || value === "FAILED") return "text-rose-300 bg-rose-400/10 border-rose-300/20";
  if (value === "OK" || value === "COMPLETED" || value === "DONE" || value === "SUCCEEDED") return "text-emerald-300 bg-emerald-400/10 border-emerald-300/20";
  if (value === "RUNNING" || value === "UNSET" || value === "STREAMING") return "text-cyan-200 bg-cyan-400/10 border-cyan-300/20";
  return "text-slate-300 bg-white/5 border-white/10";
}

function Evidence({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === "") return null;
  return (
    <details className="border-t border-white/10 px-3 py-2">
      <summary className="cursor-pointer text-[11px] font-medium text-cyan-100/80">{label}</summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-slate-200">{pretty(value)}</pre>
    </details>
  );
}

/** Live observer for the persisted built-in chat Run. No synthetic steps or metrics. */
export default function BuiltinRunObserver({ message }: { message: RunMessage }) {
  const runId = message.runId || message.trace?.runId || "";
  const [selectedRunId, setSelectedRunId] = useState(runId);
  const [runHistory, setRunHistory] = useState<RunSummary[]>([]);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const activeRunId = selectedRunId || runId;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState("");

  useEffect(() => {
    setSelectedRunId(runId);
  }, [runId]);

  useEffect(() => {
    if (!message.sessionId) {
      setRunHistory([]);
      return;
    }
    const controller = new AbortController();
    const loadHistory = async () => {
      try {
        const response = await fetch(API_BASE + "/api/chat/runs?sessionId=" + encodeURIComponent(message.sessionId!), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("读取会话运行历史失败（HTTP " + response.status + "）");
        const rows = await response.json() as RunSummary[];
        if (controller.signal.aborted) return;
        const safeRows = Array.isArray(rows) ? rows : [];
        setRunHistory(safeRows);
        if (!runId && !selectedRunId && safeRows.length > 0) setSelectedRunId(safeRows[0].runId);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "读取会话运行历史失败");
      }
    };
    void loadHistory();
    return () => controller.abort();
  }, [message.sessionId, runId, selectedRunId]);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (!activeRunId) return;
    setLoading(true);
    try {
      const response = await fetch(API_BASE + "/api/chat/runs/" + encodeURIComponent(activeRunId), {
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) throw new Error(response.status === 404
        ? "运行记录尚未写入，请稍后刷新。"
        : "读取运行记录失败（HTTP " + response.status + "）");
      const next = await response.json() as RunDetail;
      if (!signal?.aborted) {
        setDetail(next);
        setError("");
        setUpdatedAt(new Date().toLocaleTimeString());
      }
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "读取运行记录失败");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [activeRunId]);

  useEffect(() => {
    setDetail(null);
    setError("");
    setUpdatedAt("");
    if (!activeRunId) return;
    const controller = new AbortController();
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const load = async () => {
      if (!active) return;
      try {
        const response = await fetch(API_BASE + "/api/chat/runs/" + encodeURIComponent(activeRunId), {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(response.status === 404
          ? "运行记录尚未写入，请稍后刷新。"
          : "读取运行记录失败（HTTP " + response.status + "）");
        const next = await response.json() as RunDetail;
        if (!active) return;
        setDetail(next);
        setError("");
        setUpdatedAt(new Date().toLocaleTimeString());
        if (String(next.run?.status).toUpperCase() !== "RUNNING" && timer) {
          clearInterval(timer);
          timer = undefined;
        }
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "读取运行记录失败");
      }
    };
    void load();
    timer = setInterval(() => void load(), 1200);
    return () => {
      active = false;
      controller.abort();
      if (timer) clearInterval(timer);
    };
  }, [activeRunId]);

  const run = detail?.run;
  const spans = detail?.spans ?? [];
  const events = detail?.events ?? [];
  const running = String(run?.status || (message.isThinking ? "RUNNING" : "UNKNOWN")).toUpperCase() === "RUNNING";
  const knownTimes = spans.flatMap((span) => [Date.parse(span.startedAt || ""), Date.parse(span.endedAt || "")]).filter(Number.isFinite);
  const timelineStart = knownTimes.length ? Math.min(...knownTimes) : 0;
  const timelineEnd = Math.max(timelineStart + 1, ...knownTimes, ...(running ? [Date.now()] : []));
  const timelineRange = Math.max(1, timelineEnd - timelineStart);

  return (
    <aside className="trace-cosmos relative flex h-full min-h-0 min-w-0 flex-col border-l border-slate-800 bg-slate-950 text-slate-100" style={{ flex: "1 1 54%", width: "54%" }}>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-white">OwnAgent · 实时执行记录</div>
          <div className="mt-0.5 truncate text-[10px] text-slate-400">{activeRunId || (message.sessionId ? "选择本会话的历史运行记录" : "等待本次对话的真实 Run ID")}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {runHistory.length > 0 && (
            <select
              value={activeRunId}
              onChange={(event) => setSelectedRunId(event.target.value)}
              aria-label="选择运行记录"
              className="max-w-40 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-200"
            >
              {runHistory.map((item) => (
                <option key={item.runId} value={item.runId}>
                  {(item.name || item.runId.slice(0, 12)) + " · " + item.status}
                </option>
              ))}
            </select>
          )}
          <span className={"rounded-full border px-2 py-1 text-[10px] " + statusTone(run?.status || (message.isThinking ? "RUNNING" : "UNKNOWN"))}>
            {run?.status || (message.isThinking ? "建立运行记录中" : activeRunId ? "读取中" : "尚无运行记录")}
          </span>
          <button type="button" onClick={() => void refresh()} disabled={!activeRunId || loading} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-40">
            {loading ? "刷新中…" : "刷新"}
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {!activeRunId ? (
          <div className="flex h-full min-h-64 flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-400/10 text-indigo-200">⌁</div>
            <div className="text-sm font-semibold text-slate-100">{message.isThinking ? "正在等待后端创建运行记录" : runHistory.length === 0 ? "本会话还没有运行记录" : "选择一条运行记录"}</div>
            <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">每次真实模型调用、工具执行和异常都会保存在 Run 中。发送一条消息后，这里会自动跟随最新运行；也可以从顶部切换历史记录。</p>
            {runHistory.length > 0 && (
              <div className="mt-4 w-full max-w-md space-y-2 text-left">
                {runHistory.slice(0, 5).map((item) => (
                  <button key={item.runId} type="button" onClick={() => setSelectedRunId(item.runId)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-left hover:bg-white/[0.07]">
                    <span className="min-w-0"><span className="block truncate text-xs text-slate-100">{item.name || item.runId}</span><span className="mt-1 block text-[10px] text-slate-500">{dateLabel(item.startedAt)} · {item.spanCount ?? 0} 个步骤</span></span>
                    <span className={"shrink-0 rounded-full border px-2 py-1 text-[9px] " + statusTone(item.status)}>{item.status}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : error && !detail ? (
          <div className="rounded-xl border border-rose-300/20 bg-rose-400/5 p-4 text-xs text-rose-200">{error}</div>
        ) : !detail ? (
          <div className="py-12 text-center text-xs text-slate-400">正在读取真实运行数据…</div>
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="text-[10px] text-slate-500">耗时</div>
                <div className="mt-1 text-base font-semibold text-white">{durationLabel(run?.durationMs)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="text-[10px] text-slate-500">输入 Token</div>
                <div className="mt-1 text-base font-semibold text-white">{run?.inputTokens == null ? "未上报" : run.inputTokens.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="text-[10px] text-slate-500">输出 Token</div>
                <div className="mt-1 text-base font-semibold text-white">{run?.outputTokens == null ? "未上报" : run.outputTokens.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
                <div className="text-[10px] text-slate-500">总 Token</div>
                <div className="mt-1 text-base font-semibold text-white">{run?.totalTokens == null ? "未上报" : run.totalTokens.toLocaleString()}</div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-white">本次运行</div>
                <span className="text-[10px] text-slate-500">数据更新于 {updatedAt || "—"}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[11px]">
                <div><div className="text-slate-500">模型</div><div className="mt-1 break-all text-slate-200">{run?.model || "未上报"}</div></div>
                <div><div className="text-slate-500">Provider</div><div className="mt-1 break-all text-slate-200">{run?.provider || "未上报"}</div></div>
                <div><div className="text-slate-500">Token 来源</div><div className="mt-1 text-slate-200">{run?.usageSource || "MISSING"}</div></div>
                <div><div className="text-slate-500">开始时间</div><div className="mt-1 text-slate-200">{dateLabel(run?.startedAt)}</div></div>
              </div>
              {run?.errorMessage && <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-400/5 p-3 text-xs text-rose-200"><div className="font-semibold">运行失败</div><p className="mt-1 whitespace-pre-wrap break-words">{run.errorMessage}</p></div>}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-white">执行瀑布流</h3>
                <span className="text-[10px] text-slate-500">按真实 Span 时间戳绘制</span>
              </div>
              {spans.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500">等待真实执行步骤…</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {spans.map((span) => {
                    const start = Date.parse(span.startedAt || "");
                    const persistedEnd = Date.parse(span.endedAt || "");
                    const end = Number.isFinite(persistedEnd) ? persistedEnd : (running && Number.isFinite(start) ? Date.now() : NaN);
                    const hasTime = Number.isFinite(start);
                    const left = hasTime ? Math.max(0, Math.min(100, ((start - timelineStart) / timelineRange) * 100)) : 0;
                    const width = hasTime && Number.isFinite(end)
                      ? Math.max(1.5, Math.min(100 - left, ((end - start) / timelineRange) * 100))
                      : 0;
                    const tone = span.status === "ERROR" ? "bg-rose-400" : span.endedAt ? "bg-emerald-400" : "bg-cyan-300";
                    return (
                      <div key={span.spanId} className="grid grid-cols-[minmax(88px,1fr)_minmax(0,2fr)_58px] items-center gap-2">
                        <span className="truncate text-[10px] text-slate-300" title={span.name}>{span.name}</span>
                        <div className="h-2 overflow-hidden rounded-full bg-white/5">
                          {hasTime && width > 0 && <div className={"h-full rounded-full " + tone} style={{ marginLeft: left + "%", width: width + "%" }} />}
                        </div>
                        <span className="text-right text-[9px] tabular-nums text-slate-500">{durationLabel(span.durationMs)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="mt-3 flex justify-between text-[9px] text-slate-500">
                <span>{timelineStart ? dateLabel(new Date(timelineStart).toISOString()) : "开始时间未上报"}</span>
                <span>{running ? "执行中" : timelineEnd > timelineStart ? dateLabel(new Date(timelineEnd).toISOString()) : "结束时间未上报"}</span>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-white">执行步骤</h3>
                <span className="text-[10px] text-slate-500">{spans.length} 个真实 Span</span>
              </div>
              {spans.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">{running ? "Agent 正在执行，等待第一条 Span…" : "本次运行没有记录到 Span。"}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {spans.map((span, index) => {
                    const attributes = safeObject(span.attributes);
                    const details = safeObject(attributes.details);
                    const evidence = [
                      ["实际请求消息", attributes.prompt_messages ?? details.prompt_messages],
                      ["模型响应", attributes.model_response ?? details.model_response],
                      ["工具定义", attributes.tool_schema ?? details.tool_schema],
                      ["工具参数", attributes.tool_arguments ?? details.tool_arguments ?? details.arguments],
                      ["工具结果", attributes.tool_result ?? details.tool_result ?? details.result],
                      ["错误详情", attributes.error_message ?? details.error_message ?? details.error],
                    ] as Array<[string, unknown]>;
                    return (
                      <article key={span.spanId} className="overflow-hidden rounded-lg border border-white/10 bg-black/10">
                        <div className="flex flex-wrap items-center gap-2 px-3 py-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-[10px] text-slate-300">{index + 1}</span>
                          <span className="min-w-0 flex-1 text-xs font-medium text-slate-100">{span.name}</span>
                          <span className={"rounded-full border px-2 py-0.5 text-[9px] " + statusTone(span.status)}>{span.status}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-white/10 px-3 py-2 text-[10px] sm:grid-cols-4">
                          <div><span className="text-slate-500">耗时</span><div className="mt-1 text-slate-300">{durationLabel(span.durationMs)}</div></div>
                          <div><span className="text-slate-500">输入 Token</span><div className="mt-1 text-slate-300">{span.inputTokens ?? "未上报"}</div></div>
                          <div><span className="text-slate-500">输出 Token</span><div className="mt-1 text-slate-300">{span.outputTokens ?? "未上报"}</div></div>
                          <div><span className="text-slate-500">Token 来源</span><div className="mt-1 text-slate-300">{span.usageSource || "MISSING"}</div></div>
                        </div>
                        <div className="border-t border-white/10 px-3 py-2 text-[10px] text-slate-500">
                          {dateLabel(span.startedAt)} → {dateLabel(span.endedAt)}
                          {span.parentSpanId ? " · 父步骤 " + span.parentSpanId : ""}
                        </div>
                        {evidence.map(([label, value]) => <Evidence key={label} label={label} value={value} />)}
                        <details className="border-t border-white/10 px-3 py-2">
                          <summary className="cursor-pointer text-[10px] text-slate-400">查看完整 Span 属性</summary>
                          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-slate-300">{pretty(attributes)}</pre>
                        </details>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-white">运行事件</h3>
                <span className="text-[10px] text-slate-500">{events.length} 条</span>
              </div>
              {events.length === 0 ? <p className="py-4 text-center text-xs text-slate-500">暂无事件</p> : (
                <div className="mt-2 space-y-1.5">
                  {events.map((event) => (
                    <details key={event.sequence} className="rounded-lg border border-white/10 bg-black/10 px-3 py-2">
                      <summary className="flex cursor-pointer items-center gap-2 text-[10px]">
                        <span className="font-mono text-slate-500">#{event.sequence}</span>
                        <span className="min-w-0 flex-1 text-slate-200">{event.eventType}</span>
                        <span className="text-slate-400">{event.status}</span>
                        <span className="text-slate-500">{dateLabel(event.eventTime)}</span>
                      </summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-slate-300">{pretty(safeObject(event.payload))}</pre>
                    </details>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
