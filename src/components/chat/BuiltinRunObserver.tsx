import React, { useCallback, useEffect, useState } from "react";
import type { ExecutionTraceData } from "@/components/chat/TraceInspectorDrawer";

type RunMessage = {
  id: string;
  content: string;
  isThinking?: boolean;
  runId?: string;
  traceId?: string;
  sessionId?: string;
  userPrompt?: string;
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
  const [selectedSpanId, setSelectedSpanId] = useState("");
  const [activeTab, setActiveTab] = useState<"stage" | "details" | "events" | "tokens">("stage");

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
  const selectedSpan = spans.find((span) => span.spanId === selectedSpanId) || spans[spans.length - 1];
  const selectedAttributes = selectedSpan ? safeObject(selectedSpan.attributes) : {};
  const selectedDetails = safeObject(selectedAttributes.details);
  const selectedEvidence = selectedSpan ? [
    ["模型请求", selectedAttributes.prompt_messages ?? selectedDetails.prompt_messages],
    ["模型响应", selectedAttributes.model_response ?? selectedDetails.model_response],
    ["工具定义", selectedAttributes.tool_schema ?? selectedDetails.tool_schema],
    ["工具参数", selectedAttributes.tool_arguments ?? selectedDetails.tool_arguments ?? selectedDetails.arguments],
    ["工具结果", selectedAttributes.tool_result ?? selectedDetails.tool_result ?? selectedDetails.result],
    ["错误详情", selectedAttributes.error_message ?? selectedDetails.error_message ?? selectedDetails.error],
  ] as Array<[string, unknown]> : [];
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
    <aside className="trace-cosmos relative flex h-full min-h-0 min-w-0 flex-col border-l border-indigo-300/15 bg-[#080d20] text-slate-100" style={{ flex: "1 1 54%", width: "54%" }}>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" />
            <span className="text-sm font-semibold text-white">Run · {run?.name || activeRunId?.slice(0, 22) || "等待执行"}</span>
            <span className={"rounded-full border px-2 py-0.5 text-[10px] " + statusTone(run?.status || (message.isThinking ? "RUNNING" : "UNKNOWN"))}>{run?.status || (message.isThinking ? "RUNNING" : "等待运行")}</span>
          </div>
          <div className="mt-1 truncate text-[10px] text-slate-500">{activeRunId || "发送消息后自动关联真实 Run"}{run?.model ? " · " + run.model : ""}</div>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>耗时 <b className="ml-1 text-slate-200">{durationLabel(run?.durationMs)}</b></span>
          <span>Token <b className="ml-1 text-slate-200">{run?.totalTokens == null ? "未上报" : run.totalTokens.toLocaleString()}</b></span>
          {runHistory.length > 0 && <select value={activeRunId} onChange={(event) => setSelectedRunId(event.target.value)} aria-label="选择运行记录" className="max-w-36 rounded-lg border border-white/10 bg-slate-900 px-2 py-1.5 text-[10px] text-slate-200">{runHistory.map((item) => <option key={item.runId} value={item.runId}>{(item.name || item.runId.slice(0, 12)) + " · " + item.status}</option>)}</select>}
          <button type="button" onClick={() => void refresh()} disabled={!activeRunId || loading} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-slate-300 hover:bg-white/10 disabled:opacity-40">{loading ? "刷新中…" : "刷新"}</button>
        </div>
      </header>

      {!activeRunId ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-indigo-300/20 bg-indigo-400/10 text-2xl text-indigo-200">⌁</div>
          <div className="text-sm font-semibold text-white">{message.isThinking ? "正在等待后端创建运行记录" : "等待 Agent 开始行动"}</div>
          <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">这里会呈现真实的 Agent 决策、工具执行、结果证据和运行反馈。不会使用预设步骤或虚构指标。</p>
          {runHistory.length > 0 && <div className="mt-5 w-full max-w-lg space-y-2">{runHistory.slice(0,4).map((item) => <button key={item.runId} onClick={() => setSelectedRunId(item.runId)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[.03] p-3 text-left hover:bg-white/[.07]"><span className="truncate text-xs">{item.name || item.runId}</span><span className={"rounded-full border px-2 py-1 text-[9px] " + statusTone(item.status)}>{item.status}</span></button>)}</div>}
        </div>
      ) : error && !detail ? (
        <div className="m-4 rounded-xl border border-rose-300/20 bg-rose-400/5 p-4 text-xs text-rose-200">{error}</div>
      ) : !detail ? (
        <div className="flex flex-1 items-center justify-center text-xs text-slate-400">正在读取真实运行数据…</div>
      ) : (
        <>
          <nav className="flex shrink-0 gap-1 border-b border-white/10 px-4 py-2">
            {([["stage","执行过程"],["details","详细信息"],["events","运行日志"],["tokens","Token 统计"]] as const).map(([key,label]) => <button key={key} onClick={() => setActiveTab(key)} className={"rounded-lg px-3 py-2 text-[11px] transition " + (activeTab === key ? "bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-300/25" : "text-slate-400 hover:bg-white/5 hover:text-white")}>{label}</button>)}
          </nav>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
            {activeTab === "stage" && (
              <>
                <section className="overflow-hidden rounded-2xl border border-indigo-300/15 bg-[radial-gradient(ellipse_at_50%_0%,rgba(99,102,241,.16),transparent_65%),linear-gradient(145deg,rgba(16,25,57,.92),rgba(8,15,35,.96))] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div><div className="text-xs font-semibold text-white">Agent 行动舞台 · 实时执行流</div><div className="mt-1 text-[10px] text-slate-500">节点来自本次 Run 的真实 Span</div></div>
                    <div className="flex gap-3 text-[9px] text-slate-400"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-400"/>进行中</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400"/>成功</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-400"/>失败</span></div>
                  </div>
                  <div className="mt-5 flex items-stretch gap-2 overflow-x-auto pb-2">
                    <div className="flex min-w-[104px] flex-col items-center justify-center rounded-xl border border-sky-300/20 bg-sky-400/[.07] px-3 py-4 text-center">
                      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-400/15 text-lg">✦</span><b className="text-[11px] text-sky-100">用户输入</b><span className="mt-1 text-[9px] text-slate-500">任务请求</span>
                    </div>
                    {spans.map((span,index) => {
                      const label=(span.name || span.spanKind || "执行步骤").replace(/[_-]+/g," ");
                      const kind=(span.spanKind || span.name || "").toLowerCase();
                      const isTool=kind.includes("tool") || kind.includes("action") || kind.includes("http") || kind.includes("mcp");
                      const failed=["ERROR","FAILED"].includes(String(span.status).toUpperCase());
                      const active=!span.endedAt && running;
                      return <React.Fragment key={span.spanId}>
                        <div className="flex min-w-[22px] items-center justify-center text-xl text-indigo-300/80">→</div>
                        <button onClick={() => {setSelectedSpanId(span.spanId);setActiveTab("details");}} className={"group flex min-w-[126px] max-w-[168px] flex-col items-center justify-center rounded-xl border px-3 py-4 text-center transition hover:-translate-y-0.5 " + (selectedSpan?.spanId===span.spanId ? "border-indigo-300/60 bg-indigo-500/15 shadow-[0_0_24px_rgba(99,102,241,.16)]" : failed ? "border-rose-300/30 bg-rose-400/[.07]" : active ? "border-indigo-300/40 bg-indigo-400/[.09]" : "border-emerald-300/20 bg-emerald-400/[.05]")}>
                          <span className={"mb-2 flex h-10 w-10 items-center justify-center rounded-full text-lg " + (failed?"bg-rose-400/15 text-rose-300":active?"bg-indigo-400/20 text-indigo-200":"bg-emerald-400/15 text-emerald-300")}>{failed?"!":isTool?"⚙":"✧"}</span>
                          <b className="line-clamp-2 text-[10px] leading-4 text-slate-100">{label}</b>
                          <span className="mt-1 text-[9px] text-slate-500">{isTool?"工具执行":"Agent / 模型步骤"}</span>
                          <span className="mt-2 text-[9px] tabular-nums text-slate-400">{durationLabel(span.durationMs)}</span>
                        </button>
                      </React.Fragment>;
                    })}
                    <div className="flex min-w-[22px] items-center justify-center text-xl text-indigo-300/80">→</div>
                    <div className={"flex min-w-[104px] flex-col items-center justify-center rounded-xl border px-3 py-4 text-center " + (["ERROR","FAILED","UNKNOWN"].includes(String(run.status).toUpperCase())?"border-rose-300/20 bg-rose-400/[.06]":"border-emerald-300/20 bg-emerald-400/[.06]")}>
                      <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/15 text-lg text-emerald-300">{running?"◌":"✓"}</span><b className="text-[11px] text-slate-100">{running?"执行中":"Run 结束"}</b><span className="mt-1 text-[9px] text-slate-500">{run.status}</span>
                    </div>
                  </div>
                  {spans.length===0 && <p className="mt-2 text-center text-[10px] text-slate-500">Run 已创建，等待后端写入第一条 Span…</p>}
                </section>

                <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                  {[["总耗时",durationLabel(run.durationMs)],["输入 Token",run.inputTokens==null?"未上报":run.inputTokens.toLocaleString()],["输出 Token",run.outputTokens==null?"未上报":run.outputTokens.toLocaleString()],["总 Token",run.totalTokens==null?"未上报":run.totalTokens.toLocaleString()]].map(([label,value])=><div key={label} className="rounded-xl border border-white/10 bg-white/[.035] p-3"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-1 text-base font-semibold text-white">{value}</div></div>)}
                </section>

                <div className="grid min-h-[320px] grid-cols-1 gap-3 xl:grid-cols-[1.05fr_.95fr]">
                  <section className="rounded-2xl border border-white/10 bg-white/[.025] p-3">
                    <div className="flex items-center justify-between"><h3 className="text-xs font-semibold text-white">步骤时间线</h3><span className="text-[10px] text-slate-500">{spans.length} 个 Span</span></div>
                    {spans.length===0 ? <p className="py-10 text-center text-xs text-slate-500">等待执行步骤…</p> : <div className="mt-3 space-y-1">{spans.map((span,index)=><button key={span.spanId} onClick={()=>{setSelectedSpanId(span.spanId);setActiveTab("details");}} className={"flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition " + (selectedSpan?.spanId===span.spanId?"bg-indigo-400/10":"hover:bg-white/[.04]")}><span className={"flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] " + (span.status==="ERROR"?"bg-rose-400/15 text-rose-300":span.endedAt?"bg-emerald-400/15 text-emerald-300":"bg-indigo-400/15 text-indigo-200")}>{span.status==="ERROR"?"!":index+1}</span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-medium text-slate-100">{span.name}</span><span className="mt-1 block text-[9px] text-slate-500">{span.spanKind || "SPAN"} · {span.inputTokens==null&&span.outputTokens==null?"Token 未上报":(span.inputTokens||0)+(span.outputTokens||0)+" tokens"}</span></span><span className="shrink-0 text-[10px] tabular-nums text-slate-400">{durationLabel(span.durationMs)}</span></button>)}</div>}
                  </section>
                  <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.025]">
                    <div className="border-b border-white/10 px-3 py-3"><h3 className="text-xs font-semibold text-white">工具执行现场 / 结果证据</h3><p className="mt-1 text-[10px] text-slate-500">选择一个步骤查看其真实输入、输出与错误</p></div>
                    {selectedSpan ? <><div className="flex items-center justify-between gap-2 px-3 py-3"><b className="min-w-0 truncate text-[11px] text-indigo-100">{selectedSpan.name}</b><span className={"rounded-full border px-2 py-1 text-[9px] "+statusTone(selectedSpan.status)}>{selectedSpan.status}</span></div><div className="grid grid-cols-3 gap-2 px-3 pb-3 text-[10px]"><div><span className="text-slate-500">耗时</span><b className="mt-1 block text-slate-200">{durationLabel(selectedSpan.durationMs)}</b></div><div><span className="text-slate-500">输入</span><b className="mt-1 block text-slate-200">{selectedSpan.inputTokens??"—"}</b></div><div><span className="text-slate-500">输出</span><b className="mt-1 block text-slate-200">{selectedSpan.outputTokens??"—"}</b></div></div>{selectedEvidence.filter(([,value])=>value!=null).length ? selectedEvidence.map(([label,value])=><Evidence key={label} label={label} value={value}/>) : <p className="px-3 pb-4 text-[10px] text-slate-500">当前 Span 没有单独采集输入/输出证据。可在「详细信息」查看完整属性。</p>}</> : <p className="p-8 text-center text-xs text-slate-500">等待第一条真实执行步骤</p>}
                  </section>
                </div>
                <div className="rounded-xl border border-indigo-300/15 bg-indigo-400/[.06] px-3 py-3 text-[10px] text-indigo-100/80">💡 本次运行的数据来自 OwnAgent 持久化 Run。工具专属可视化（浏览器画面、文件 Diff、检索来源等）将在对应工具提供真实证据后逐类接入。</div>
              </>
            )}

            {activeTab === "details" && (
              <div className="space-y-3">
                <section className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="text-xs font-semibold text-white">运行概览</div><div className="mt-3 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-3">{[["模型",run.model||"未上报"],["Provider",run.provider||"未上报"],["Token 来源",run.usageSource||"MISSING"],["开始时间",dateLabel(run.startedAt)],["结束时间",dateLabel(run.endedAt)],["Span 数量",String(spans.length)]].map(([k,v])=><div key={k}><div className="text-slate-500">{k}</div><div className="mt-1 break-all text-slate-200">{v}</div></div>)}</div>{run.errorMessage&&<div className="mt-4 rounded-xl border border-rose-300/20 bg-rose-400/5 p-3 text-xs text-rose-200">{run.errorMessage}</div>}</section>
                {selectedSpan ? <section className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><div className="mb-2 text-xs font-semibold text-white">当前步骤：{selectedSpan.name}</div>{selectedEvidence.map(([label,value])=><Evidence key={label} label={label} value={value}/>)}<details className="mt-2"><summary className="cursor-pointer text-[10px] text-slate-400">完整 Span 属性</summary><pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-slate-300">{pretty(selectedAttributes)}</pre></details></section>:<p className="text-xs text-slate-500">尚无可查看的 Span。</p>}
              </div>
            )}

            {activeTab === "events" && <section className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold text-white">运行事件时间线</h3><span className="text-[10px] text-slate-500">{events.length} 条事件</span></div>{events.length===0?<p className="py-10 text-center text-xs text-slate-500">暂无持久化事件</p>:<div className="space-y-2">{events.map((event)=><details key={event.sequence} className="rounded-xl border border-white/10 bg-black/10 px-3 py-3"><summary className="flex cursor-pointer flex-wrap items-center gap-2 text-[10px]"><span className="font-mono text-slate-500">#{event.sequence}</span><b className="min-w-0 flex-1 text-slate-200">{event.eventType}</b><span className={"rounded-full border px-2 py-0.5 "+statusTone(event.status)}>{event.status}</span><span className="text-slate-500">{dateLabel(event.eventTime)}</span></summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-black/30 p-3 text-[10px] leading-5 text-slate-300">{pretty(safeObject(event.payload))}</pre></details>)}</div>}</section>}

            {activeTab === "tokens" && <div className="space-y-3"><section className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["输入 Token",run.inputTokens],["输出 Token",run.outputTokens],["总 Token",run.totalTokens]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="text-[10px] text-slate-500">{label}</div><div className="mt-2 text-2xl font-semibold text-white">{value==null?"未上报":Number(value).toLocaleString()}</div></div>)}</section><section className="rounded-2xl border border-white/10 bg-white/[.025] p-3"><div className="mb-3 text-xs font-semibold text-white">各步骤 Token 消耗</div>{spans.map((span)=><div key={span.spanId} className="mb-3"><div className="mb-1 flex justify-between gap-3 text-[10px]"><span className="truncate text-slate-300">{span.name}</span><span className="shrink-0 text-slate-400">{span.inputTokens==null&&span.outputTokens==null?"未上报":((span.inputTokens||0)+(span.outputTokens||0)).toLocaleString()+" tokens"}</span></div><div className="flex h-2 overflow-hidden rounded-full bg-white/5"><div className="bg-sky-400" style={{width:run.totalTokens&&span.inputTokens!=null?(span.inputTokens/run.totalTokens*100)+"%":"0%"}}/><div className="bg-violet-400" style={{width:run.totalTokens&&span.outputTokens!=null?(span.outputTokens/run.totalTokens*100)+"%":"0%"}}/></div></div>)}<div className="mt-4 flex gap-4 text-[9px] text-slate-500"><span><i className="mr-1 inline-block h-2 w-2 rounded bg-sky-400"/>输入 Token</span><span><i className="mr-1 inline-block h-2 w-2 rounded bg-violet-400"/>输出 Token</span><span>来源：{run.usageSource||"MISSING"}</span></div></section></div>}
          </div>
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 px-4 py-2.5 text-[9px] text-slate-500"><span>Run 数据持久化 · {spans.length} Spans · {events.length} Events</span><span>{updatedAt ? "更新于 "+updatedAt : "等待更新"}</span><button onClick={()=>{setActiveTab("events");}} className="rounded-lg bg-indigo-400/10 px-2.5 py-1.5 text-indigo-200 hover:bg-indigo-400/20">查看运行历史 →</button></footer>
        </>
      )}
    </aside>
  );
}
