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

const stripInternalReasoning = (value: any): any => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try { return stripInternalReasoning(JSON.parse(trimmed)); } catch { return value; }
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(stripInternalReasoning).filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return value;
  const channel = String(value.channel ?? value.type ?? value.kind ?? value.message_type ?? "").toLowerCase();
  const role = String(value.role ?? "").toLowerCase();
  if (/(analysis|reasoning|thought|internal)/.test(channel) && (!role || role === "assistant")) return undefined;
  const isInternalKey = (key: string) => /^(analysis|reasoning|chain_of_thought|chainofthought|internal_thought|thoughts?|scratchpad)/i.test(key);
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !isInternalKey(key))
    .map(([key, item]) => [key, stripInternalReasoning(item)])
    .filter(([, item]) => item !== undefined));
};

export default function RunsPage({ onClose }: { onClose?: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [viewMode, setViewMode] = useState<"external" | "chat">("external");
  const [chatSessions, setChatSessions] = useState<any[]>([]);
  const [selectedChatSessionId, setSelectedChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatRuns, setChatRuns] = useState<any[]>([]);
  const [selectedChatRunId, setSelectedChatRunId] = useState<string | null>(null);
  const [selectedChatRunDetail, setSelectedChatRunDetail] = useState<any>(null);
  const [chatRunJudge, setChatRunJudge] = useState<any>(null);
  const [chatRunJudgeLoading, setChatRunJudgeLoading] = useState(false);
  const [chatRunJudgeError, setChatRunJudgeError] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
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
  const [judgeHistory, setJudgeHistory] = useState<any[]>([]);
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
          buffer = (buffer + decoder.decode(value, { stream: true })).replace(/\r\n/g, "\n");
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

  useEffect(() => {
    const run = runs.find((item) => item.runId === selectedRunId);
    if (!run || !apiKey.trim()) {
      setJudgeHistory([]);
      setJudgeResult(null);
      return;
    }
    const controller = new AbortController();
    setJudgeHistory([]);
    setJudgeResult(null);
    const loadHistory = async () => {
      try {
        const response = await fetch(API_BASE + "/api/v1/traces/" + encodeURIComponent(run.traceId) + "/evaluations", {
          headers: { Authorization: "Bearer " + apiKey.trim(), Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) return;
        const history = await response.json() as any[];
        if (controller.signal.aborted) return;
        setJudgeHistory(history);
        if (history.length > 0) {
          setJudgeResult({
            traceId: run.traceId,
            judgeModel: history[0].judgeModel,
            scores: history[0].scores,
            evaluation: history[0],
          });
        }
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          console.warn("Judge history load failed", cause);
        }
      }
    };
    void loadHistory();
    return () => controller.abort();
  }, [selectedRunId, apiKey, runs]);

  const judgeMetrics = judgeResult?.scores
    ? Object.entries(judgeResult.scores).filter(([key, value]) => key !== "overall" && !["reasoning", "analysis", "chain_of_thought", "thoughts"].includes(key.toLowerCase()) && typeof value === "number")
    : [];
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
      if (payload?.evaluation) setJudgeHistory((current) => [payload.evaluation, ...current]);
    } catch (cause) {
      setJudgeError(cause instanceof Error ? cause.message : "AI Judge 请求失败");
    } finally {
      setJudgeLoading(false);
    }
  };

  const downloadRunJson = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(stripInternalReasoning(selected), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ownagent-run-${selected.run.runId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const parseStoredJson = (value: any) => {
    if (typeof value !== "string") return value ?? {};
    try { return JSON.parse(value); } catch { return {}; }
  };

  const loadInternalChatRunDetail = async (runId: string) => {
    setSelectedChatRunId(runId);
    setSelectedChatRunDetail(null);
    setChatRunJudge(null);
    setChatRunJudgeError("");
    try {
      const response = await fetch(API_BASE + "/api/chat/runs/" + encodeURIComponent(runId));
      if (!response.ok) throw new Error("读取内置 Run 详情失败（HTTP " + response.status + "）");
      const detail = await response.json();
      setSelectedChatRunDetail(detail);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取内置 Run 详情失败");
    }
  };

  const loadInternalChatRuns = async (sessionId: string) => {
    try {
      const response = await fetch(API_BASE + "/api/chat/runs?sessionId=" + encodeURIComponent(sessionId));
      if (!response.ok) throw new Error("读取内置运行记录失败（HTTP " + response.status + "）");
      const rows = await response.json();
      const nextRuns = Array.isArray(rows) ? rows : [];
      setChatRuns(nextRuns);
      const nextId = nextRuns.some((run: any) => run.runId === selectedChatRunId)
        ? selectedChatRunId : nextRuns[0]?.runId ?? null;
      setSelectedChatRunId(nextId);
      if (nextId) await loadInternalChatRunDetail(nextId);
      else setSelectedChatRunDetail(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取内置运行记录失败");
      setChatRuns([]);
      setSelectedChatRunId(null);
      setSelectedChatRunDetail(null);
    }
  };

  const judgeInternalChatRun = async () => {
    if (!selectedChatRunId) return;
    setChatRunJudgeLoading(true);
    setChatRunJudgeError("");
    try {
      const response = await fetch(API_BASE + "/api/chat/runs/" + encodeURIComponent(selectedChatRunId) + "/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          task: "请仅根据内置 Agent 本次运行中真实持久化的模型请求、模型响应、工具调用、工具结果和错误事件评估执行质量。",
          answer: "",
          rubric: "任务完成度、指令遵循、工具使用合理性、执行可靠性。只依据已采集证据评分；证据不足时明确说明，不得推测未采集内容。"
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || "内置 Run 评估失败（HTTP " + response.status + "）");
      setChatRunJudge(payload);
      await loadInternalChatRunDetail(selectedChatRunId);
    } catch (cause) {
      setChatRunJudgeError(cause instanceof Error ? cause.message : "内置 Run 评估失败");
    } finally {
      setChatRunJudgeLoading(false);
    }
  };

  const loadInternalChatMessages = async (sessionId: string) => {
    setChatLoading(true);
    try {
      const response = await fetch(API_BASE + "/api/chat/messages?sessionId=" + encodeURIComponent(sessionId));
      if (!response.ok) throw new Error("读取内置对话失败（HTTP " + response.status + "）");
      const rows = await response.json();
      setChatMessages((Array.isArray(rows) ? rows : []).map((message: any) => ({
        ...message,
        // The legacy chat entity also stores a "reasoning" field. It is not part
        // of the observable execution record and must not enter this UI state.
        reasoning: undefined,
        traceSteps: stripInternalReasoning(parseStoredJson(message.traceStepsJson ?? message.traceSteps)),
        toolCalls: stripInternalReasoning(parseStoredJson(message.toolCallsJson ?? message.toolCalls)),
      })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取内置对话失败");
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const loadInternalChats = async () => {
    setChatLoading(true);
    setError("");
    try {
      const response = await fetch(API_BASE + "/api/chat/sessions");
      if (!response.ok) throw new Error("读取内置会话失败（HTTP " + response.status + "）");
      const rows = await response.json();
      const sessions = Array.isArray(rows) ? rows : [];
      setChatSessions(sessions);
      const nextId = sessions.some((item: any) => item.id === selectedChatSessionId)
        ? selectedChatSessionId : sessions[0]?.id ?? null;
      setSelectedChatSessionId(nextId);
      if (nextId) {
        await loadInternalChatMessages(nextId);
        await loadInternalChatRuns(nextId);
      } else {
        setChatMessages([]);
        setChatRuns([]);
        setSelectedChatRunId(null);
        setSelectedChatRunDetail(null);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取内置会话失败");
      setChatSessions([]);
      setChatMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedChatRunId || selectedChatRunDetail?.run?.status !== "RUNNING") return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(API_BASE + "/api/chat/runs/" + encodeURIComponent(selectedChatRunId));
        if (!response.ok) return;
        const detail = await response.json();
        if (!active) return;
        setSelectedChatRunDetail(detail);
        if (detail?.run) {
          setChatRuns((current) => current.map((run) => run.runId === selectedChatRunId
            ? { ...run, ...detail.run, spanCount: detail.spans?.length ?? run.spanCount }
            : run));
        }
      } catch (cause) {
        console.warn("Built-in Run refresh failed", cause);
      }
    };
    const timer = window.setInterval(() => void refresh(), 1800);
    return () => { active = false; window.clearInterval(timer); };
  }, [selectedChatRunId, selectedChatRunDetail?.run?.status]);

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
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Activity size={17} className="text-indigo-600" /> 运行观测</div>
              <p className="mt-1 text-xs text-slate-500">在同一工作区查看外部 Agent 的真实 Trace，以及平台内置聊天的持久化执行记录；两类数据保持各自真实来源。</p>
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

      <div className="mx-auto flex w-full max-w-7xl gap-2 px-4 pt-3">
        <button onClick={() => setViewMode("external")} className={`rounded-lg px-3 py-2 text-xs font-medium ${viewMode === "external" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>外部 Agent Runs</button>
        <button onClick={() => { setViewMode("chat"); void loadInternalChats(); }} className={`rounded-lg px-3 py-2 text-xs font-medium ${viewMode === "chat" ? "bg-indigo-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>内置聊天记录</button>
      </div>

      {viewMode === "external" ? (
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
              <button key={run.runId} onClick={() => { setSelectedRunId(run.runId); setSelectedDetail(null); setJudgeResult(null); setJudgeError(""); setJudgeHistory([]); void loadRunDetail(run.runId); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${selected?.run.runId === run.runId ? "bg-indigo-50/70" : "bg-white"}`}>
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
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="rounded-lg border border-indigo-100 bg-white p-3">
                            <p className="text-[10px] text-slate-500">综合</p>
                            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{typeof judgeResult.scores.overall === "number" ? judgeResult.scores.overall : "—"}</p>
                          </div>
                          {judgeMetrics.map(([key, score]) => <div key={String(key)} className="rounded-lg border border-indigo-100 bg-white p-3">
                            <p className="text-[10px] text-slate-500">{String(key).replace(/([A-Z])/g, " $1")}</p>
                            <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{String(score)}</p>
                          </div>)}
                        </div>
                        {(judgeResult.scores.summary) && <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-700">{String(judgeResult.scores.summary || judgeResult.scores.explanation)}</p>}

                        {!!judgeResult.scores.issues?.length && <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-rose-700">{judgeResult.scores.issues.map((issue: unknown, index: number) => <li key={index}>{String(issue)}</li>)}</ul>}
                      </>
                    )}
                  </section>
                )}
                {judgeHistory.length > 1 && (
                  <section className="rounded-lg border border-slate-200 bg-white p-4">
                    <h3 className="text-xs font-semibold text-slate-700">历史评估记录</h3>
                    <div className="mt-3 space-y-2">
                      {judgeHistory.slice(1, 6).map((item) => (
                        <div key={item.evaluationId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2">
                          <div>
                            <p className="text-[11px] font-medium text-slate-700">{item.judgeModel || "Judge"} · 综合分 {typeof item.scores?.overall === "number" ? item.scores.overall : "—"}</p>
                            <p className="mt-0.5 text-[10px] text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "时间未知"}</p>
                          </div>
                          <span className="font-mono text-[10px] text-slate-400">{String(item.evaluationId || "").slice(0, 8)}</span>
                        </div>
                      ))}
                    </div>
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
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-2 text-[10px] leading-4 text-slate-200">{(() => { try { return JSON.stringify(stripInternalReasoning(JSON.parse(event.payload)), null, 2); } catch { return "非 JSON 事件内容已隐藏"; } })()}</pre>
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
                        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">{JSON.stringify(stripInternalReasoning(span.attributes?.[key]), null, 2)}</pre>
                      </details>
                    ))}
                    {(span.name.toLowerCase().includes("llm") || span.name.toLowerCase().includes("chat.completions") || span.attributes?.model || span.attributes?.["gen_ai.request.model"] || span.attributes?.["gen_ai.response.model"]) &&
                      span.attributes?.prompt_messages == null && span.attributes?.model_response == null &&
                      span.attributes?.["gen_ai.input.messages"] == null && span.attributes?.["gen_ai.output.messages"] == null && (
                        <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">模型消息内容未采集（默认关闭）；可在 Agent 接入端显式开启并脱敏后上报。</p>
                      )}
                    <details className="border-t border-slate-100 px-4 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-slate-500">Span 属性（已过滤内部推理字段）</summary>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">{JSON.stringify(stripInternalReasoning({ traceId: span.traceId, spanId: span.spanId, parentSpanId: span.parentSpanId, runId: span.runId, spanKind: span.spanKind, attributes: span.attributes }), null, 2)}</pre>
                    </details>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
      ) : (
        <div className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
          <section className="min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="text-sm font-semibold">内置会话</h2>
              <button onClick={() => void loadInternalChats()} className="text-xs text-indigo-600">刷新</button>
            </div>
            <div className="max-h-[70vh] overflow-auto">
              {chatSessions.length === 0 ? <p className="px-4 py-10 text-center text-xs text-slate-400">{chatLoading ? "读取中…" : "暂无内置会话"}</p> :
                chatSessions.map((session: any) => <button key={session.id} onClick={() => { setSelectedChatSessionId(session.id); void loadInternalChatMessages(session.id); void loadInternalChatRuns(session.id); }} className={`block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 ${selectedChatSessionId === session.id ? "bg-indigo-50" : "bg-white"}`}>
                  <p className="truncate text-xs font-medium text-slate-800">{session.title || "未命名会话"}</p>
                  <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{session.id}</p>
                  <p className="mt-1 text-[10px] text-slate-400">{dateLabel(session.updatedAt || session.createdAt)}</p>
                </button>)}
            </div>
          </section>
          <section className="min-h-[420px] min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {!selectedChatSessionId ? <div className="flex h-full items-center justify-center text-xs text-slate-400">选择一条内置会话</div> : (
              <>
                <div className="border-b border-slate-100 px-5 py-4">
                  <h2 className="text-sm font-semibold">内置 Agent 对话</h2>
                  <p className="mt-1 break-all font-mono text-[10px] text-slate-400">Session ID: {selectedChatSessionId}</p>
                  <p className="mt-2 text-[11px] text-slate-500">内置 Agent 的每次真实执行都有独立 Run / Trace ID，模型轮次、工具调用、结果和失败事件会实时落库；与外部 Agent 使用不同的数据来源。</p>
                </div>
                <div className="max-h-[70vh] space-y-3 overflow-auto p-4">
                  <section className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-slate-800">内置 Agent 运行记录 · {chatRuns.length}</h3>
                      <button onClick={() => selectedChatSessionId && void loadInternalChatRuns(selectedChatSessionId)} className="text-[11px] font-medium text-indigo-600">刷新运行记录</button>
                    </div>
                    {chatRuns.length === 0 ? <p className="mt-3 text-[11px] text-slate-500">此会话还没有可查询的 Run。新的聊天执行开始后会自动创建。</p> :
                      <div className="mt-3 flex flex-wrap gap-2">
                        {chatRuns.map((run: any) => <button key={run.runId} onClick={() => void loadInternalChatRunDetail(run.runId)} className={"min-w-[190px] rounded-lg border px-3 py-2 text-left transition " + (selectedChatRunId === run.runId ? "border-indigo-300 bg-white shadow-sm" : "border-slate-200 bg-white/70 hover:border-indigo-200")}>
                          <div className="flex items-center justify-between gap-2"><strong className="truncate text-[11px] text-slate-800">{run.name || "内置 Agent Run"}</strong><span className={"text-[10px] " + (run.status === "ERROR" ? "text-rose-600" : run.status === "COMPLETED" ? "text-emerald-600" : "text-amber-600")}>{run.status}</span></div>
                          <p className="mt-1 break-all font-mono text-[9px] text-slate-400">{run.runId}</p>
                          <p className="mt-1 text-[10px] text-slate-500">{run.spanCount ?? 0} spans · {run.totalTokens == null ? "Token 未上报" : run.totalTokens + " tokens"}</p>
                        </button>)}
                      </div>}
                    {selectedChatRunDetail?.run && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div><p className="text-[11px] font-semibold text-slate-800">Run 详情 · {selectedChatRunDetail.run.status}</p><p className="mt-1 break-all font-mono text-[9px] text-slate-400">Trace {selectedChatRunDetail.run.traceId}</p></div>
                          <button onClick={() => void judgeInternalChatRun()} disabled={chatRunJudgeLoading} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-medium text-white disabled:opacity-50">{chatRunJudgeLoading ? "评估中…" : "AI Judge"}</button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                          <div><span className="text-slate-400">模型</span><p className="mt-0.5 text-slate-700">{selectedChatRunDetail.run.model || "未记录"}</p></div>
                          <div><span className="text-slate-400">Provider</span><p className="mt-0.5 text-slate-700">{selectedChatRunDetail.run.provider || "未记录"}</p></div>
                          <div><span className="text-slate-400">输入 / 输出 Token</span><p className="mt-0.5 text-slate-700">{selectedChatRunDetail.run.inputTokens ?? "—"} / {selectedChatRunDetail.run.outputTokens ?? "—"}</p></div>
                          <div><span className="text-slate-400">耗时</span><p className="mt-0.5 text-slate-700">{selectedChatRunDetail.run.durationMs == null ? "—" : selectedChatRunDetail.run.durationMs + " ms"}</p></div>
                        </div>
                        {chatRunJudgeError && <p className="mt-2 text-[10px] text-rose-600">{chatRunJudgeError}</p>}
                        {chatRunJudge?.scores && <div className="mt-2 rounded-md bg-indigo-50 p-2 text-[10px] text-indigo-900">评估模型：{chatRunJudge.judgeModel} · 综合分：{chatRunJudge.scores.overall ?? "—"}<p className="mt-1 whitespace-pre-wrap">{chatRunJudge.scores.summary || "评估已保存。"}</p></div>}
                        <details className="mt-3" open>
                          <summary className="cursor-pointer text-[11px] font-semibold text-slate-700">执行 Span · {selectedChatRunDetail.spans?.length ?? 0}</summary>
                          <div className="mt-2 space-y-2">
                            {(selectedChatRunDetail.spans || []).map((span: any) => <div key={span.spanId} className="rounded-md border border-slate-100 bg-slate-50 p-2">
                              <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-[10px] text-slate-700">{span.name}</strong><span className="text-[10px] text-slate-500">{span.status} · {span.durationMs == null ? "进行中" : span.durationMs + " ms"}</span></div>
                              <p className="mt-1 text-[9px] text-slate-400">{span.spanKind} · {span.inputTokens ?? "—"} / {span.outputTokens ?? "—"} tokens · {span.usageSource}</p>
                              <details className="mt-1"><summary className="cursor-pointer text-[10px] text-indigo-600">查看执行证据</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-2 text-[9px] text-slate-200">{JSON.stringify(stripInternalReasoning(parseStoredJson(span.attributes)), null, 2)}</pre></details>
                            </div>)}
                          </div>
                        </details>
                        <details className="mt-3">
                          <summary className="cursor-pointer text-[11px] font-semibold text-slate-700">事件时间线 · {selectedChatRunDetail.events?.length ?? 0}</summary>
                          <div className="mt-2 space-y-1.5">
                            {(selectedChatRunDetail.events || []).map((event: any, index: number) => <div key={event.sequence ?? index} className="rounded-md bg-slate-50 p-2">
                              <div className="flex items-center justify-between gap-2"><strong className="text-[10px] text-slate-700">{event.eventType} · {event.status}</strong><span className="text-[9px] text-slate-400">{dateLabel(event.eventTime)}</span></div>
                              <details className="mt-1"><summary className="cursor-pointer text-[10px] text-indigo-600">事件内容</summary><pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-950 p-2 text-[9px] text-slate-200">{JSON.stringify(stripInternalReasoning(parseStoredJson(event.payload)), null, 2)}</pre></details>
                            </div>)}
                          </div>
                        </details>
                      </div>
                    )}
                  </section>
                  {chatLoading && <p className="text-xs text-slate-400">正在读取会话消息…</p>}
                  {chatMessages.map((message: any, index: number) => {
                    const steps = message.traceSteps && typeof message.traceSteps === "object" ? Object.values(message.traceSteps) : [];
                    const toolCalls = Array.isArray(message.toolCalls) ? message.toolCalls : [];
                    return <article key={message.id || index} className="rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2">
                        <span className="text-xs font-semibold text-slate-700">{message.role === "user" ? "用户" : "Agent 回复"}</span>
                        <span className="text-[10px] text-slate-400">{dateLabel(message.createdAt)}</span>
                      </div>
                      <div className="whitespace-pre-wrap break-words px-4 py-3 text-xs leading-6 text-slate-700">{String(message.content || "")}</div>
                      {steps.length > 0 && <details className="border-t border-slate-100 px-4 py-3">
                        <summary className="cursor-pointer text-xs font-medium text-indigo-600">执行步骤 · {steps.length}</summary>
                        <div className="mt-2 space-y-2">
                          {steps.map((step: any, stepIndex: number) => <div key={step?.id || step?.step || stepIndex} className="rounded-md bg-slate-50 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]"><strong>{String(step?.title || step?.name || "步骤 " + (stepIndex + 1))}</strong><span className="text-slate-400">{String(step?.status || "状态未知")}</span></div>
                            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] text-slate-600">{JSON.stringify(stripInternalReasoning(step), null, 2)}</pre>
                          </div>)}
                        </div>
                      </details>}
                      {toolCalls.length > 0 && <details className="border-t border-slate-100 px-4 py-3">
                        <summary className="cursor-pointer text-xs font-medium text-indigo-600">工具调用 · {toolCalls.length}</summary>
                        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-950 p-3 text-[10px] text-slate-200">{JSON.stringify(stripInternalReasoning(toolCalls), null, 2)}</pre>
                      </details>}
                      {(message.tokens != null || message.duration) && <div className="border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400">消息元数据：{message.tokens != null ? "记录 Token " + message.tokens : "Token 未记录"} · {message.duration || "耗时未记录"}</div>}
                    </article>;
                  })}
                  {!chatLoading && chatMessages.length === 0 && <p className="py-10 text-center text-xs text-slate-400">此会话暂无持久化消息。</p>}
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {error && <div className="fixed bottom-5 left-1/2 z-50 flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm text-rose-700 shadow-lg"><AlertCircle size={16} />{error}</div>}
    </div>
  );
}
