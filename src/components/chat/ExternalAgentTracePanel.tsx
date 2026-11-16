import React, { useEffect, useRef, useState } from "react";
import { Activity, ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";

type Span = {
  traceId: string; spanId: string; parentSpanId?: string | null; name: string;
  status: string; startedAt: string; durationMs?: number | null;
  inputTokens?: number | null; outputTokens?: number | null; totalTokens?: number | null;
  usageSource?: string; attributes?: Record<string, unknown> | null;
};

const KEY_STORAGE = "ownagent_external_trace_api_key";

export const ExternalAgentTracePanel: React.FC = () => {
  const [apiKey, setApiKey] = useState(() => { try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; } });
  const [traceId, setTraceId] = useState("");
  const [spans, setSpans] = useState<Span[]>([]);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const stop = () => { abortRef.current?.abort(); abortRef.current = null; setConnected(false); };
  useEffect(() => () => abortRef.current?.abort(), []);

  const connect = async () => {
    if (!apiKey.trim() || !traceId.trim()) { setError("请填写 Agent API Key 和 Trace ID"); return; }
    stop();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setError(""); setSpans([]);
    try {
      localStorage.setItem(KEY_STORAGE, apiKey.trim());
      const headers = { Authorization: "Bearer " + apiKey.trim() };
      const initial = await fetch("/api/v1/traces/" + encodeURIComponent(traceId.trim()) + "/spans", { headers, signal: controller.signal });
      if (!initial.ok) throw new Error(initial.status === 401 ? "Agent API Key 无效或无权访问该 Trace" : "读取 Trace 失败：HTTP " + initial.status);
      setSpans(await initial.json() as Span[]);
      const response = await fetch("/api/v1/traces/" + encodeURIComponent(traceId.trim()) + "/events", { headers: { ...headers, Accept: "text/event-stream" }, signal: controller.signal });
      if (!response.ok || !response.body) throw new Error("实时订阅失败：HTTP " + response.status);
      setConnected(true); setLoading(false);
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = "";
      while (!controller.signal.aborted) {
        const item = await reader.read(); if (item.done) break;
        buffer += decoder.decode(item.value, { stream: true });
        const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() || "";
        for (const block of blocks) {
          const eventName = block.split(/\r?\n/).find(line => line.startsWith("event:"))?.slice(6).trim();
          if (eventName !== "trace_span") continue;
          const data = block.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
          try {
            const span = JSON.parse(data) as Span;
            setSpans(current => { const i = current.findIndex(x => x.spanId === span.spanId); if (i < 0) return [...current, span].sort((a,b) => a.startedAt.localeCompare(b.startedAt)); const next = [...current]; next[i] = span; return next; });
          } catch { /* Ignore malformed event. */ }
        }
      }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Trace 连接失败"); }
    finally { setLoading(false); setConnected(false); }
  };

  const retry = async (span: Span) => {
    const actionId = span.attributes?.action_id;
    if (typeof actionId !== "string" || !actionId) return;
    if (!window.confirm("该步骤失败，但外部操作可能已经产生部分副作用。重试可能重复执行，请先核对外部系统。确认继续？")) return;
    try {
      const response = await fetch("/api/v1/actions/" + encodeURIComponent(actionId) + "/retry?confirmPossibleDuplicateSideEffect=true", { method: "POST", headers: { Authorization: "Bearer " + apiKey.trim() } });
      if (!response.ok) throw new Error("重试失败：HTTP " + response.status + " " + (await response.text()).slice(0, 160));
      setError("已创建新的 Action。请使用新 Trace ID 查看后续执行过程。");
    } catch (e) { setError(e instanceof Error ? e.message : "重试失败"); }
  };

  const ordered = [...spans].sort((a,b) => a.startedAt.localeCompare(b.startedAt));
  const totalTokens = spans.reduce((sum, span) => sum + (span.totalTokens || 0), 0);
  return <section className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
    <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-b border-indigo-100">
      <div className="flex items-center gap-2"><Activity className="w-4 h-4 text-indigo-600" /><b className="text-xs text-slate-800">外部 Agent 实时监控</b><span className={"text-[10px] rounded-full px-2 py-0.5 border " + (connected ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-slate-500 bg-white border-slate-200")}>{connected ? "实时连接中" : "未连接"}</span></div>
      <span className="text-[10px] text-slate-500">{spans.length} spans · {totalTokens.toLocaleString()} tokens</span>
    </div>
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Agent API Key" autoComplete="off" className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono" />
        <input value={traceId} onChange={e => setTraceId(e.target.value)} placeholder="Trace ID" className="min-w-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono" />
        <button type="button" onClick={connected ? stop : () => void connect()} disabled={loading} className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-2 inline-flex items-center justify-center gap-1.5">{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{loading ? "连接中" : connected ? "断开" : "连接 Trace"}</button>
      </div>
      <p className="text-[10px] text-slate-500">填写接入 Agent 时使用的 API Key 和 Trace ID。Key 仅保存在当前浏览器本地；Token 和事件仅展示实际收到的数据。</p>
      {error && <div className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</div>}
      {ordered.length === 0 ? <div className="py-5 text-center text-[11px] text-slate-400">连接后，这里会显示该 Agent 已上报的真实执行步骤</div> :
        <div className="space-y-1.5 max-h-[42vh] overflow-y-auto">{ordered.map((span, index) => {
          const open = expanded.has(span.spanId);
          return <div key={span.spanId} className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <button type="button" onClick={() => setExpanded(current => { const next = new Set(current); open ? next.delete(span.spanId) : next.add(span.spanId); return next; })} className="w-full text-left p-2.5 flex items-center gap-2">
              <span className={"w-2 h-2 rounded-full shrink-0 " + (span.status === "ERROR" ? "bg-rose-500" : span.status === "OK" ? "bg-emerald-500" : "bg-blue-400 animate-pulse")} />
              <span className="text-[10px] text-slate-400 font-mono">#{index + 1}</span><b className="text-xs text-slate-800 flex-1 truncate">{span.name}</b>
              <span className="text-[10px] text-slate-500">{span.durationMs == null ? "运行中" : span.durationMs >= 1000 ? (span.durationMs / 1000).toFixed(2) + "s" : span.durationMs + "ms"}</span>
              <span className="text-[10px] text-slate-500">{span.totalTokens ?? "—"} tokens</span>
              {open ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
            </button>
            {open && <div className="border-t border-slate-100 p-2.5 space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px]">
                <div className="bg-slate-50 rounded p-2"><div className="text-slate-400">状态</div><b>{span.status}</b></div>
                <div className="bg-slate-50 rounded p-2"><div className="text-slate-400">输入 / 输出</div><b>{span.inputTokens ?? "—"} / {span.outputTokens ?? "—"}</b></div>
                <div className="bg-slate-50 rounded p-2"><div className="text-slate-400">Usage 来源</div><b>{span.usageSource || "MISSING"}</b></div>
                <div className="bg-slate-50 rounded p-2"><div className="text-slate-400">Span ID</div><b className="font-mono break-all">{span.spanId}</b></div>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 text-slate-100 p-2 text-[10px]">{JSON.stringify(span.attributes || {}, null, 2)}</pre>
              {span.status === "ERROR" && typeof span.attributes?.action_id === "string" && <button type="button" onClick={() => void retry(span)} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-800">确认风险并重试关联 Action</button>}
            </div>}
          </div>;
        })}</div>}
    </div>
  </section>;
};
