import React, { useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, KeyRound, RefreshCw, X, XCircle } from "lucide-react";

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

type Run = {
  traceId: string;
  runId?: string | null;
  sessionId?: string;
  spans: TraceSpan[];
  startedAt?: string;
  root?: TraceSpan;
  status: "ERROR" | "OK" | "RUNNING" | "UNKNOWN";
  tokens?: number;
};

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/+$/, "");

function groupRuns(spans: TraceSpan[]): Run[] {
  const groups = new Map<string, TraceSpan[]>();
  for (const span of spans) {
    if (!span?.traceId || !span?.spanId) continue;
    const list = groups.get(span.traceId) || [];
    list.push(span);
    groups.set(span.traceId, list);
  }
  return [...groups.entries()].map(([traceId, items]) => {
    const ordered = [...items].sort((a, b) =>
      new Date(a.startedAt || 0).getTime() - new Date(b.startedAt || 0).getTime()
    );
    const root = ordered.find((span) => !span.parentSpanId);
    const hasError = ordered.some((span) => span.status === "ERROR");
    const allClosed = ordered.every((span) => span.endedAt);
    const tokens = ordered.reduce((sum, span) => sum + (span.totalTokens ?? 0), 0);
    const sessionId = ordered.map((span) => span.attributes?.["session.id"] ?? span.attributes?.["conversation.id"])
      .find((value): value is string => typeof value === "string" && value.length > 0);
    const hasTokens = ordered.some((span) => span.totalTokens != null);
    return {
      traceId,
      runId: root?.runId || ordered.find((span) => span.runId)?.runId,
      sessionId,
      spans: ordered,
      startedAt: root?.startedAt || ordered[0]?.startedAt,
      root,
      status: hasError ? "ERROR" : allClosed && ordered.every((span) => span.status === "OK") ? "OK" : allClosed ? "UNKNOWN" : "RUNNING",
      tokens: hasTokens ? tokens : undefined,
    };
  }).sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
}

const dateLabel = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const statusLabel: Record<Run["status"], string> = {
  ERROR: "失败",
  OK: "成功",
  RUNNING: "进行中",
  UNKNOWN: "状态未知",
};

export default function RunsPage({ onClose }: { onClose?: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [spans, setSpans] = useState<TraceSpan[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const runs = useMemo(() => groupRuns(spans), [spans]);
  const selected = runs.find((run) => run.traceId === selectedTrace) || runs[0];

  const loadRuns = async () => {
    if (!apiKey.trim()) {
      setError("请输入 Agent API Key。密钥只保存在当前页面内存中，不会写入浏览器存储。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/v1/traces`, {
        headers: { Authorization: `Bearer ${apiKey.trim()}`, Accept: "application/json" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || `请求失败（HTTP ${response.status}）`);
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("后端返回的数据格式不正确。");
      setSpans(data);
      const nextRuns = groupRuns(data);
      setSelectedTrace((current) => nextRuns.some((run) => run.traceId === current) ? current : nextRuns[0]?.traceId || null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "读取运行记录失败。");
      setSpans([]);
      setSelectedTrace(null);
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
            <span className="text-xs tabular-nums text-slate-400">{runs.length} 条</span>
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
                  <pre className="mt-3 overflow-auto rounded-md bg-slate-950 p-3 text-[11px] leading-5 text-slate-200">{'with OwnAgentClient(BASE_URL, API_KEY) as client:\\n    with client.agent_run("my-agent", session_id="conversation-1") as run:\\n        with run.span("llm.chat.completions", span_kind="CLIENT") as span:\\n            response = call_your_model()\\n            span.set_usage(input_tokens=usage.prompt_tokens,\\n                           output_tokens=usage.completion_tokens)'}</pre>
                  <a className="mt-3 inline-flex text-xs font-medium text-indigo-600 hover:text-indigo-700" href="https://github.com/cpttbtptp2812/ownsudo/tree/main/sdk/python" target="_blank" rel="noreferrer">查看 Python SDK 接入文档 ↗</a>
                </details>
              </div>
            ) : runs.map((run) => (
              <button key={run.traceId} onClick={() => setSelectedTrace(run.traceId)} className={`block w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${selected?.traceId === run.traceId ? "bg-indigo-50/70" : "bg-white"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-800">{run.root?.name || run.spans[0]?.name || "Agent run"}</span>
                  <span className={`shrink-0 text-[11px] ${run.status === "ERROR" ? "text-rose-600" : run.status === "OK" ? "text-emerald-600" : "text-amber-600"}`}>{statusLabel[run.status]}</span>
                </div>
                <p className="mt-1 truncate font-mono text-[10px] text-slate-400">{run.traceId}</p>
                <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                  <span>{run.spans.length} spans</span>
                  {run.sessionId && <span className="max-w-28 truncate" title={`Session ${run.sessionId}`}>Session {run.sessionId}</span>}
                  <span>{run.tokens == null ? "Token —" : `${run.tokens.toLocaleString()} tokens`}</span>
                  <span className="ml-auto">{dateLabel(run.startedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-[420px] min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {!selected ? (
            <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
              <Activity size={28} className="text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-700">选择一条运行记录</p>
              <p className="mt-1 text-xs text-slate-500">每个 Span 都来自后端已保存的 Trace 数据。</p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h2 className="text-base font-semibold">{selected.root?.name || "Agent run"}</h2><p className="mt-1 break-all font-mono text-[11px] text-slate-400">{selected.traceId}</p></div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{statusLabel[selected.status]}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                  <div><p className="text-slate-400">开始时间</p><p className="mt-1 text-slate-700">{dateLabel(selected.startedAt)}</p></div>
                  <div><p className="text-slate-400">Span 数量</p><p className="mt-1 tabular-nums text-slate-700">{selected.spans.length}</p></div>
                  <div><p className="text-slate-400">Token（已上报）</p><p className="mt-1 tabular-nums text-slate-700">{selected.tokens?.toLocaleString() ?? "—"}</p></div>
                  <div><p className="text-slate-400">Run ID</p><p className="mt-1 break-all font-mono text-slate-700">{selected.runId || "—"}</p></div>
                  <div><p className="text-slate-400">Session ID</p><p className="mt-1 break-all font-mono text-slate-700">{selected.sessionId || "—"}</p></div>
                </div>
              </div>
              <div className="max-h-[70vh] space-y-3 overflow-auto p-4">
                {selected.spans.map((span) => (
                  <article key={span.spanId} className="rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
                      {span.status === "ERROR" ? <XCircle size={15} className="text-rose-500" /> : span.status === "OK" ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Clock3 size={15} className="text-amber-500" />}
                      <strong className="min-w-0 flex-1 text-sm text-slate-800">{span.name}</strong>
                      <span className="text-[11px] text-slate-500">{span.status || "UNSET"}</span>
                      <span className="text-[11px] text-slate-400">{span.durationMs == null ? "耗时 —" : `${span.durationMs} ms`}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 px-4 py-3 text-xs sm:grid-cols-4">
                      <div><p className="text-slate-400">开始</p><p className="mt-1 text-slate-700">{dateLabel(span.startedAt)}</p></div>
                      <div><p className="text-slate-400">结束</p><p className="mt-1 text-slate-700">{dateLabel(span.endedAt)}</p></div>
                      <div><p className="text-slate-400">输入 / 输出 Token</p><p className="mt-1 text-slate-700">{span.inputTokens ?? "—"} / {span.outputTokens ?? "—"}</p></div>
                      <div><p className="text-slate-400">Token 来源</p><p className="mt-1 text-slate-700">{span.usageSource || "MISSING"}</p></div>
                    </div>
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
