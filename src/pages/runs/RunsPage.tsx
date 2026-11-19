import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, Download, KeyRound, RefreshCw, Search, X, XCircle } from "lucide-react";

type TraceSpan = {
  traceId: string;
  spanId: string;
  parentSpanId?: string | null;
  runId?: string | null;
  name: string;
  spanKind?: string;
  status?: string;
  startedAt?: string;
  endedAt?: string | null;
  durationMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  usageSource?: string;
  attributes?: Record<string, unknown> | null;
};

type RunSummary = {
  traceId: string;
  runId: string;
  sessionId?: string | null;
  conversationId?: string | null;
  name: string;
  status: "ERROR" | "COMPLETED" | "RUNNING" | "UNKNOWN";
  startedAt?: string;
  endedAt?: string | null;
  durationMs?: number | null;
  spanCount: number;
  errorCount: number;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  usageSource?: string;
};

type RunDetail = {
  run: RunSummary;
  spans: TraceSpan[];
  events: Array<{ eventType: string; status: string; eventTime: string; spanId?: string; payload?: string }>;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

const dateLabel = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const statusLabel: Record<RunSummary["status"], string> = {
  ERROR: "失败",
  COMPLETED: "已完成",
  RUNNING: "进行中",
  UNKNOWN: "状态未知",
};

export default function RunsPage({ onClose }: { onClose?: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<RunDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [runQuery, setRunQuery] = useState("");
  const [runStatus, setRunStatus] = useState<"ALL" | "RUNNING" | "COMPLETED" | "ERROR" | "UNKNOWN">("ALL");
  const [detailLoading, setDetailLoading] = useState(false);
  const [spanQuery, setSpanQuery] = useState("");
  const [spanErrorsOnly, setSpanErrorsOnly] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"OFF" | "CONNECTING" | "LIVE">("OFF");
  const [judgeResult, setJudgeResult] = useState<any>(null);
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeError, setJudgeError] = useState("");
  const detailRequestId = useRef(0);

  const selected = selectedDetail?.run.runId === selectedRunId ? selectedDetail : null;
  const filteredRuns = useMemo(() => runs.filter((run) => {
    const query = runQuery.trim().toLowerCase();
    const matchesQuery = !query || [run.name, run.runId, run.traceId, run.sessionId || "", run.conversationId || ""].some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (runStatus === "ALL" || run.status === runStatus);
  }), [runs, runQuery, runStatus]);
  const visibleSpans = useMemo(() => (selected?.spans ?? []).filter((span) => {
    const query = spanQuery.trim().toLowerCase();
    const matchesQuery = !query || [
      span.name, span.spanId, span.parentSpanId || "", span.spanKind || "",
      String(span.attributes?.model ?? span.attributes?.["gen_ai.request.model"] ?? span.attributes?.["gen_ai.response.model"] ?? ""), String(span.attributes?.provider ?? span.attributes?.["gen_ai.provider.name"] ?? span.attributes?.["gen_ai.system"] ?? ""),
      String(span.attributes?.["gen_ai.tool.name"] ?? ""), String(span.attributes?.["gen_ai.operation.name"] ?? ""), String(span.attributes?.["gen_ai.agent.name"] ?? ""),
    ].some((value) => value.toLowerCase().includes(query));
    return matchesQuery && (!spanErrorsOnly || span.status === "ERROR");
  }), [selected, spanQuery, spanErrorsOnly]);
  useEffect(() => {
    const run = runs.find((item) => item.runId === selectedRunId);
    if (!run || !apiKey.trim() || !["RUNNING", "UNKNOWN"].includes(run.status)) {
      setLiveStatus("OFF");
      return;
    }

    const controller = new AbortController();
    let active = true;
    let refreshInFlight = false;
    setLiveStatus("CONNECTING");

    const refreshDetail = async () => {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const response = await fetch(`${API_BASE}/api/v1/runs/${encodeURIComponent(run.runId)}`, {
          headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const detail = await response.json() as RunDetail;
        if (active) setSelectedDetail(detail);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          console.warn("Run detail refresh failed", cause);
        }
      } finally {
        refreshInFlight = false;
      }
    };

    const connect = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/traces/${encodeURIComponent(run.traceId)}/events`, {
          headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: "text/event-stream" },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          if (active) setLiveStatus("OFF");
          return;
        }
        if (active) setLiveStatus("LIVE");
        // Re-read persisted state after subscription is established to close the
        // small gap between the initial Run detail request and SSE subscription.
        await refreshDetail();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (active) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            if (frame.split("\n").some((line) => line.startsWith("data:"))) {
              void refreshDetail();
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          console.warn("Run live stream disconnected", cause);
        }
      } finally {
        if (active) setLiveStatus("OFF");
      }
    };

    void connect();
    return () => {
      active = false;
      controller.abort();
      setLiveStatus("OFF");
    };
  }, [selectedRunId, apiKey, runs]);

  const timelineSpans = selected?.spans ?? [];
  const timelineStart = timelineSpans.length
    ? Math.min(...timelineSpans.map((span) => Date.parse(span.startedAt || "") || 0))
    : 0;
  const timelineEnd = timelineSpans.length
    ? Math.max(...timelineSpans.map((span) => Date.parse(span.endedAt || span.startedAt || "") || timelineStart))
    : timelineStart;
  const timelineRange = Math.max(1, timelineEnd - timelineStart);
  const spanDepth = (span: TraceSpan) => {
    let depth = 0;
    let parentId = span.parentSpanId || null;
    const seen = new Set([span.spanId]);
    while (parentId && depth < 8 && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = timelineSpans.find((item) => item.spanId === parentId);
      if (!parent) break;
      depth += 1;
      parentId = parent.parentSpanId || null;
    }
    return depth;
  };

  const loadRunDetail = async (runId: string, key = apiKey) => {
    const requestId = ++detailRequestId.current;
    setDetailLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/runs/${encodeURIComponent(runId)}`, {
        headers: { Authorization: `Bearer ${key.trim()}`, Accept: "application/json" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || `读取运行详情失败（HTTP ${response.status}）`);
      }
      const detail = await response.json() as RunDetail;
      if (requestId === detailRequestId.current) setSelectedDetail(detail);
    } catch (cause) {
      if (requestId === detailRequestId.current) {
        setError(cause instanceof Error ? cause.message : "读取运行详情失败。");
        setSelectedDetail(null);
      }
    } finally {
      if (requestId === detailRequestId.current) setDetailLoading(false);
    }
  };

  const runJudge = async () => {
    if (!selected || !apiKey.trim()) return;
    setJudgeLoading(true);
    setJudgeError("");
    setJudgeResult(null);
    try {
      const response = await fetch(`${API_BASE}/api/v1/traces/${encodeURIComponent(selected.run.traceId)}/judge`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          task: "请仅根据本次运行 Trace 中实际采集的请求、模型响应、工具调用、工具结果和异常评估 Agent 执行质量。",
          answer: "",
          rubric: "任务完成度、指令遵循、回答正确性、工具使用合理性、执行可靠性。只根据 Trace 证据评分；证据不足时明确指出，不得推测未采集内容。",
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || `AI Judge 请求失败（HTTP ${response.status}）`);
      setJudgeResult(payload);
    } catch (cause) {
      setJudgeError(cause instanceof Error ? cause.message : "AI Judge 请求失败");
    } finally {
      setJudgeLoading(false);
    }
  };

  const downloadRunJson = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ownagent-run-${selected.run.runId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const loadRuns = async () => {
    if (!apiKey.trim()) {
      setError("请输入 Agent API Key。密钥只保存在当前页面内存中，不会写入浏览器存储。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/runs`, {
        headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: "application/json" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || `请求失败（HTTP ${response.status}）`);
      }
      const data = await response.json() as RunSummary[];
      if (!Array.isArray(data)) throw new Error("后端返回的数据格式不正确。");
      setRuns(data);
      const nextId = data.some((run) => run.runId === selectedRunId) ? selectedRunId : data[0]?.runId || null;
      setSelectedRunId(nextId);
      setSelectedDetail(null);
      if (nextId) await loadRunDetail(nextId, apiKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取运行记录失败。");
      setRuns([]);
      setSelectedRunId(null);
      setSelectedDetail(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-6 py-5">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity size={17} className="text-indigo-600" /> 外部 Agent 执行记录</div>
              <p className="mt-1 text-xs text-slate-500">查看通过 OwnAgent SDK 或 OTLP 上报的真实 Trace。记录按 Agent API Key 隔离；当前预览版需要先在后端为目标 Agent 配置密钥。</p>
            </div>
            {onClose && <button onClick={onClose} aria-label="关闭外部 Agent 记录" className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"><X size={17} /></button>}
          </div>
          <div className="flex w-full max-w-xl items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1">
              <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void loadRuns(); }}
                placeholder="Agent API Key"
                autoComplete="off"
                className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
              />
            </div>
            <button onClick={() => void loadRuns()} disabled={loading} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "读取中" : "读取记录"}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold">Runs</h2>
            <span className="text-xs tabular-nums text-slate-400">{filteredRuns.length} / {runs.length} 条</span>
          </div>
          <div className="border-b border-slate-100 p-3 space-y-2">
            <input value={runQuery} onChange={(event) => setRunQuery(event.target.value)} placeholder="搜索 Run / Trace / Session ID" className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            <div className="flex flex-wrap gap-1.5">
              {(["ALL", "RUNNING", "COMPLETED", "ERROR", "UNKNOWN"] as const).map((status) => <button key={status} onClick={() => setRunStatus(status)} className={`rounded-full px-2.5 py-1 text-[10px] font-medium transition ${runStatus === status ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>{status === "ALL" ? "全部" : statusLabel[status]}</button>)}
            </div>
          </div>
          <div className="max-h-[65vh] overflow-auto lg:max-h-full">
            {runs.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <Activity size={25} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-medium text-slate-700">还没有运行记录</p>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-slate-500">输入目标 Agent 的 API Key 并读取记录。若仍为空，请先用 Python SDK 或 OTLP 向这个 Agent 上报 Span。</p>
                <details className="mx-auto mt-5 max-w-lg rounded-lg border border-slate-200 bg-slate-50 p-4 text-left">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-700">如何连接自己的 Agent？</summary>
                  <ol className="mt-3 list-decimal space-y-2 pl-4 text-xs leading-5 text-slate-600">
                    <li>在后端为目标 Agent 配置 API Key（当前预览版使用服务端 bootstrap 配置）。</li>
                    <li>在 Agent 项目安装 <code>ownagent-sdk</code>，并设置 <code>OWNAGENT_BASE_URL</code> 和 <code>OWNAGENT_AGENT_API_KEY</code>。</li>
                    <li>用 <code>agent_run()</code> 包住一次任务，用 <code>run.span()</code> 记录真实模型调用和工具执行。</li>
                    <li>模型 Token 必须使用 Provider 实际返回值；Prompt 和响应内容默认不采集。</li>
                  </ol>
                  <pre className="mt-3 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">{[
                    "with OwnAgentClient(BASE_URL, API_KEY) as client:",
                    '    with client.agent_run("my-agent", session_id="conversation-1") as run:',
                    '        with run.span("llm.chat.completions", span_kind="CLIENT") as span:',
                    "            response = call_your_model()",
                    "            span.set_usage(input_tokens=usage.prompt_tokens,",
                    "                           output_tokens=usage.completion_tokens)",
                  ].join("\n")}</pre>
                  <a className="mt-3 inline-flex text-xs font-medium text-indigo-600 hover:text-indigo-700" href="https://github.com/cpttbtptp2812/ownsudo/tree/main/sdk/python" target="_blank" rel="noreferrer">查看 Python SDK 接入文档 ↗</a>
                </details>
              </div>
            ) : filteredRuns.length === 0 ? (
              <div className="px-5 py-12 text-center"><p className="text-sm font-medium text-slate-600">没有匹配的运行记录</p><p className="mt-1 text-xs text-slate-400">调整搜索关键词或状态筛选。</p><button onClick={() => { setRunQuery(""); setRunStatus("ALL"); }} className="mt-3 text-xs font-medium text-indigo-600">清除筛选</button></div>
            ) : filteredRuns.map((run) => (
              <button key={run.runId} onClick={() => { setSelectedRunId(run.runId); setSelectedDetail(null); setJudgeResult(null); setJudgeError(""); void loadRunDetail(run.runId); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${selected?.run.runId === run.runId ? "bg-indigo-50/70" : "bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{run.name || "Agent run"}</span>
                  <span className={`shrink-0 text-[11px] ${run.status === "ERROR" ? "text-rose-600" : run.status === "COMPLETED" ? "text-emerald-600" : "text-amber-600"}`}>{statusLabel[run.status]}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{run.runId}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{run.spanCount} spans</span>
                  {run.sessionId && <span className="max-w-28 truncate" title={`Session ${run.sessionId}`}>Session {run.sessionId}</span>}
                  <span>{run.totalTokens == null ? "Token —" : `${run.totalTokens.toLocaleString()} tokens`}</span>
                  <span className="ml-auto">{dateLabel(run.startedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-[420px] min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {!selected ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
              {detailLoading ? <RefreshCw size={26} className="animate-spin text-indigo-400" /> : <Activity size={28} className="text-slate-300" />}
              <p className="mt-3 text-sm font-medium text-slate-700">{detailLoading ? "正在读取运行详情…" : "选择一条运行记录"}</p>
              <p className="mt-1 text-xs text-slate-500">{detailLoading ? "正在从后端加载真实 Span 和事件。" : "每个 Span 都来自后端已保存的 Trace 数据。"}</p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h2 className="text-base font-semibold">{selected.run.name || "Agent run"}</h2><p className="mt-1 break-all font-mono text-[11px] text-slate-400">{selected.run.traceId}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{statusLabel[selected.run.status]}</span>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] ${liveStatus === "LIVE" ? "bg-emerald-50 text-emerald-700" : liveStatus === "CONNECTING" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}><span className={`h-1.5 w-1.5 rounded-full ${liveStatus === "LIVE" ? "bg-emerald-500" : liveStatus === "CONNECTING" ? "bg-amber-500" : "bg-slate-400"}`} />{liveStatus === "LIVE" ? "实时监听中" : liveStatus === "CONNECTING" ? "正在连接" : selected.run.status === "RUNNING" || selected.run.status === "UNKNOWN" ? "实时监听已断开" : "历史记录"}</span>
                    <button onClick={() => void runJudge()} disabled={judgeLoading} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-50">
                      <Activity size={13} /> {judgeLoading ? "评估中…" : "AI Judge"}
                    </button>
                    <button onClick={downloadRunJson} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700">
                      <Download size={13} /> 导出 JSON
                    </button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-6">
                  <div><p className="text-slate-400">开始时间</p><p className="mt-1 text-slate-700">{dateLabel(selected.run.startedAt)}</p></div>
                  <div><p className="text-slate-400">Span 数量</p><p className="mt-1 tabular-nums text-slate-700">{selected.spans.length}</p></div>
                  <div><p className="text-slate-400">输入 / 输出 Token</p><p className="mt-1 tabular-nums text-slate-700">{selected.run.inputTokens?.toLocaleString() ?? "—"} / {selected.run.outputTokens?.toLocaleString() ?? "—"}</p></div>
                  <div><p className="text-slate-400">失败 Span</p><p className="mt-1 tabular-nums text-slate-700">{selected.run.errorCount}</p></div>
                  <div><p className="text-slate-400">Run ID</p><p className="mt-1 break-all font-mono text-slate-700">{selected.run.runId || "—"}</p></div>
                  <div><p className="text-slate-400">Session ID</p><p className="mt-1 break-all font-mono text-slate-700">{selected.run.sessionId || "—"}</p></div>
                </div>
              </div>
              <div className="max-h-[70vh] space-y-3 overflow-auto p-4">
                {selected.spans.length > 0 && (
                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-700">执行瀑布流</h3>
                      <span className="text-[10px] text-slate-400">按真实 Span 起止时间排列；未结束的 Span 不补造结束时间</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {selected.spans.map((span) => {
                        const start = Date.parse(span.startedAt || "") || timelineStart;
                        const end = span.endedAt ? (Date.parse(span.endedAt) || start) : start;
                        const left = Math.max(0, Math.min(100, ((start - timelineStart) / timelineRange) * 100));
                        const width = span.endedAt ? Math.max(0.8, Math.min(100 - left, ((end - start) / timelineRange) * 100)) : 0.8;
                        const depth = spanDepth(span);
                        const barColor = span.status === "ERROR" ? "bg-rose-500" : span.status === "OK" ? "bg-emerald-500" : "bg-amber-400";
                        return (
                          <div key={span.spanId} className="grid grid-cols-[minmax(120px,220px)_minmax(100px,1fr)_64px] items-center gap-3">
                            <div className="min-w-0" style={{ paddingLeft: depth * 12 }}>
                              <p className="truncate text-[11px] font-medium text-slate-700" title={span.name}>{span.name}</p>
                              <p className="truncate font-mono text-[9px] text-slate-400">{span.spanKind || "INTERNAL"} · {span.status || "UNSET"}</p>
                            </div>
                            <div className="relative h-5 rounded bg-slate-50">
                              <div className={`absolute top-1/2 h-2 -translate-y-1/2 rounded ${barColor}`} style={{ left: `${left}%`, width: `${width}%` }} title={span.endedAt ? `${span.durationMs ?? "?"} ms` : "结束时间未上报"} />
                            </div>
                            <span className="text-right text-[10px] tabular-nums text-slate-500">{span.durationMs == null ? "—" : `${span.durationMs} ms`}</span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-[10px] text-slate-400">
                      <span>{timelineStart ? dateLabel(new Date(timelineStart).toISOString()) : "开始时间未上报"}</span>
                      <span>{timelineEnd > timelineStart ? dateLabel(new Date(timelineEnd).toISOString()) : "结束时间未上报"}</span>
                    </div>
                  </section>
                )}
                {(judgeError || judgeResult) && (
                  <section className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-indigo-900">AI Judge · Trace 证据评估</h3>
                      {judgeResult?.judgeModel && <span className="text-[10px] text-indigo-500">模型：{judgeResult.judgeModel}</span>}
                    </div>
                    {judgeError && <p className="mt-2 text-xs text-rose-700">{judgeError}</p>}
                    {judgeResult?.scores && (
                      <>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                          {[
                            ["综合", judgeResult.scores.overall],
                            ["任务完成", judgeResult.scores.taskCompletion],
                            ["指令遵循", judgeResult.scores.instructionFollowing],
                            ["回答正确", judgeResult.scores.answerCorrectness],
                            ["工具使用", judgeResult.scores.toolUse],
                          ].map(([label, score]) => <div key={String(label)} className="rounded-lg border border-indigo-100 bg-white p-3">
                            <p className="text-[10px] text-slate-500">{label}</p>
                            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{typeof score === "number" ? score : "—"}</p>
                          </div>)}
                        </div>
                        {judgeResult.scores.summary && <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-700">{judgeResult.scores.summary}</p>}
                        {!!judgeResult.scores.issues?.length && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-rose-700">{judgeResult.scores.issues.map((issue: unknown, index: number) => <li key={index}>{String(issue)}</li>)}</ul>}
                      </>
                    )}
                  </section>
                )}
                {selected.events.length > 0 && (
                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-xs font-semibold text-slate-700">运行事件</h3>
                    <div className="mt-3 space-y-2">
                      {selected.events.map((event, index) => (
                        <div key={`${event.eventType}-${event.spanId || index}`} className="rounded-md border border-slate-200 bg-white px-3 py-2">
                          <div className="flex items-start justify-between gap-3 text-xs">
                            <span className="font-medium text-slate-700">{event.eventType} · {event.status}</span>
                            <span className="shrink-0 text-slate-400">{dateLabel(event.eventTime)}</span>
                          </div>
                          {event.spanId && <p className="mt-1 break-all font-mono text-[10px] text-slate-400">Span {event.spanId}</p>}
                          {event.payload && <details className="mt-2">
                            <summary className="cursor-pointer text-[11px] text-indigo-600">查看事件详情</summary>
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-2 text-[10px] leading-4 text-slate-200">{(() => { try { return JSON.stringify(JSON.parse(event.payload), null, 2); } catch { return event.payload; } })()}</pre>
                          </details>}
                        </div>
                      ))}
                    </div>
                  </section>
                )}
                <section className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="relative min-w-[180px] flex-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={spanQuery} onChange={(event) => setSpanQuery(event.target.value)} placeholder="搜索 Span、模型、Provider、工具…" className="h-9 w-full rounded-lg border border-slate-200 pl-8 pr-3 text-xs outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  </div>
                  <button onClick={() => setSpanErrorsOnly((value) => !value)} className={`rounded-lg px-3 py-2 text-xs font-medium transition ${spanErrorsOnly ? "bg-rose-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    仅看失败
                  </button>
                  <span className="ml-auto text-[11px] tabular-nums text-slate-400">{visibleSpans.length} / {selected.spans.length} 个 Span</span>
                </section>
                {visibleSpans.map((span) => (
                  <article key={span.spanId} className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
                      {span.status === "ERROR" ? <XCircle size={15} className="text-rose-500" /> : span.status === "OK" ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Clock3 size={15} className="text-amber-500" />}
                      <strong className="min-w-0 flex-1 text-sm text-slate-800">{span.name}</strong>
                      <span className="text-[11px] text-slate-500">{span.status || "UNSET"}</span>
                      <span className="text-[11px] text-slate-400">{span.durationMs == null ? "耗时 —" : `${span.durationMs} ms`}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs sm:grid-cols-6">
                      <div><p className="text-slate-400">开始</p><p className="mt-1 text-slate-700">{dateLabel(span.startedAt)}</p></div>
                      <div><p className="text-slate-400">结束</p><p className="mt-1 text-slate-700">{dateLabel(span.endedAt)}</p></div>
                      <div><p className="text-slate-400">输入 / 输出 Token</p><p className="mt-1 text-slate-700">{span.inputTokens ?? "—"} / {span.outputTokens ?? "—"}</p></div>
                      <div><p className="text-slate-400">Token 来源</p><p className="mt-1 text-slate-700">{span.usageSource || "MISSING"}</p></div>
                      <div><p className="text-slate-400">模型</p><p className="mt-1 break-all text-slate-700">{String(span.attributes?.model ?? span.attributes?.["gen_ai.request.model"] ?? span.attributes?.["gen_ai.response.model"] ?? "—")}</p></div>
                      <div><p className="text-slate-400">Provider</p><p className="mt-1 break-all text-slate-700">{String(span.attributes?.provider ?? span.attributes?.["gen_ai.provider.name"] ?? span.attributes?.["gen_ai.system"] ?? "—")}</p></div>
                    </div>
                    {span.status === "ERROR" && (span.attributes?.error_message || span.attributes?.["exception.message"]) && (
                      <div className="border-t border-rose-100 bg-rose-50/70 px-4 py-3 text-xs text-rose-700">
                        <strong>执行错误</strong>
                        <p className="mt-1 whitespace-pre-wrap break-words">{String(span.attributes?.error_message ?? span.attributes?.["exception.message"])}</p>
                      </div>
                    )}
                    {([
                      ["prompt_messages", "实际请求消息"],
                      ["model_response", "模型响应"],
                      ["tool_schema", "工具定义"],
                      ["tool_arguments", "工具参数"],
                      ["tool_result", "工具结果"],
                      ["gen_ai.input.messages", "实际请求消息（OpenTelemetry）"],
                      ["gen_ai.output.messages", "模型响应（OpenTelemetry）"],
                      ["gen_ai.tool.definitions", "工具定义（OpenTelemetry）"],
                      ["gen_ai.tool.call.arguments", "工具参数（OpenTelemetry）"],
                      ["gen_ai.tool.call.result", "工具结果（OpenTelemetry）"],
                      ["gen_ai.provider.name", "Provider（OpenTelemetry）"],
                      ["gen_ai.operation.name", "模型操作类型"],
                      ["gen_ai.agent.name", "Agent 名称"],
                      ["gen_ai.conversation.id", "会话 ID"],
                      ["gen_ai.tool.name", "工具名称"],
                    ] as const).filter(([key]) => span.attributes?.[key] != null).map(([key, label]) => (
                      <details key={key} className="border-t border-slate-100 px-4 py-2">
                        <summary className="cursor-pointer text-xs font-medium text-slate-600">{label}</summary>
                        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">{JSON.stringify(span.attributes?.[key], null, 2)}</pre>
                      </details>
                    ))}
                    {(span.name.toLowerCase().includes("llm") || span.name.toLowerCase().includes("chat.completions") || span.attributes?.model || span.attributes?.["gen_ai.request.model"] || span.attributes?.["gen_ai.response.model"]) &&
                      span.attributes?.prompt_messages == null && span.attributes?.model_response == null &&
                      span.attributes?.["gen_ai.input.messages"] == null && span.attributes?.["gen_ai.output.messages"] == null && (
                        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">模型消息内容未采集（默认关闭）；可在 Agent 接入端显式开启并脱敏后上报。</p>
                      )}
                    <details className="border-t border-slate-100 px-4 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-slate-500">Span 属性与原始数据</summary>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">{JSON.stringify({ traceId: span.traceId, spanId: span.spanId, parentSpanId: span.parentSpanId, runId: span.runId, spanKind: span.spanKind, attributes: span.attributes }, null, 2)}</pre>
                    </details>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>

      {error && <div className="fixed bottom-5 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700 shadow-lg"><AlertCircle size={16} />{error}</div>}
    </div>
  );
}
