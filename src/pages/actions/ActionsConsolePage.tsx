import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, KeyRound, Plus, RefreshCw, Shield, ShieldAlert, Wrench, Play, ListTree, X } from "lucide-react";

type Tool = {
  toolId: string; toolName: string; description: string;
  inputSchema: Record<string, unknown>; riskLevel: string; enabled: boolean; createdAt?: string;
};
type Action = {
  actionId: string; toolName: string; status: string; decision: string;
  riskLevel: string; arguments: Record<string, unknown>; output?: Record<string, unknown> | null;
  errorCode?: string | null; errorMessage?: string | null; attemptCount?: number;
  approvalStatus?: string | null; approvalDecidedBy?: string | null;
  approvalDecidedAt?: string | null; approvalReason?: string | null;
  createdAt: string; startedAt?: string | null; completedAt?: string | null;
};
type ActionEvent = { eventId: string; actionId: string; eventType: string; details?: Record<string, unknown>; createdAt: string };
type Identity = { agentId?: string; status?: string };
type TraceSpan = {
  traceId: string; spanId: string; parentSpanId?: string | null; runId?: string | null;
  name: string; spanKind: string; status: string; startedAt: string; endedAt?: string | null;
  durationMs?: number | null; inputTokens?: number | null; outputTokens?: number | null;
  totalTokens?: number | null; usageSource: string; attributes?: Record<string, unknown> | null;
};

const API = "/api/v1";
const riskOptions = ["READ_ONLY", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

function pretty(value: unknown) { return JSON.stringify(value, null, 2); }
function statusTone(value: string) {
  if (["ALLOW", "READY", "APPROVED", "SUCCEEDED"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["REQUIRE_APPROVAL", "PENDING_APPROVAL", "PENDING_POLICY", "RUNNING", "UNKNOWN"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

type SpanRow = { span: TraceSpan; depth: number; left: number; width: number };

function buildSpanRows(spans: TraceSpan[]): SpanRow[] {
  if (spans.length === 0) return [];
  const byId = new Map(spans.map(span => [span.spanId, span]));
  const children = new Map<string, TraceSpan[]>();
  const roots: TraceSpan[] = [];
  for (const span of spans) {
    const parent = span.parentSpanId ? byId.get(span.parentSpanId) : undefined;
    if (parent && parent.spanId !== span.spanId) {
      const list = children.get(parent.spanId) || [];
      list.push(span); children.set(parent.spanId, list);
    } else roots.push(span);
  }
  const start = Math.min(...spans.map(span => new Date(span.startedAt).getTime()));
  const end = Math.max(...spans.map(span => {
    const started = new Date(span.startedAt).getTime();
    const ended = span.endedAt ? new Date(span.endedAt).getTime() : started + (span.durationMs || 0);
    return Math.max(started, ended);
  }));
  const range = Math.max(1, end - start);
  const rows: SpanRow[] = [];
  const visited = new Set<string>();
  const visit = (span: TraceSpan, depth: number) => {
    if (visited.has(span.spanId)) return;
    visited.add(span.spanId);
    const started = new Date(span.startedAt).getTime();
    const ended = span.endedAt ? new Date(span.endedAt).getTime() : started + (span.durationMs || 0);
    const left = Math.max(0, ((started - start) / range) * 100);
    const width = Math.max(1.2, (Math.max(0, ended - started) / range) * 100);
    rows.push({ span, depth, left, width: Math.min(width, 100 - left) });
    (children.get(span.spanId) || []).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).forEach(child => visit(child, depth + 1));
  };
  roots.sort((a, b) => a.startedAt.localeCompare(b.startedAt)).forEach(root => visit(root, 0));
  spans.filter(span => !visited.has(span.spanId)).sort((a, b) => a.startedAt.localeCompare(b.startedAt)).forEach(orphan => visit(orphan, 0));
  return rows;
}
export default function ActionsConsolePage() {
  const [agentKey, setAgentKey] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [approverKey, setApproverKey] = useState("");
  const [approvalReason, setApprovalReason] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"actions" | "tools" | "worker" | "traces">("actions");
  const [traceSpans, setTraceSpans] = useState<TraceSpan[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState("");
  const [selectedTraceSpans, setSelectedTraceSpans] = useState<TraceSpan[]>([]);
  const [loadingTraces, setLoadingTraces] = useState(false);\n  const [traceStreamStatus, setTraceStreamStatus] = useState<"idle" | "connecting" | "connected" | "disconnected">("idle");\n  const traceStreamAbortRef = useRef<AbortController | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [toolName, setToolName] = useState("demo.echo");
  const [description, setDescription] = useState("Echo a message using the built-in safe demo handler");
  const [riskLevel, setRiskLevel] = useState("LOW");
  const [schemaText, setSchemaText] = useState(pretty({
    type: "object", properties: { message: { type: "string" } },
    required: ["message"], additionalProperties: false
  }));
  const [actionTool, setActionTool] = useState("demo.echo");
  const [argumentsText, setArgumentsText] = useState(pretty({ message: "Hello from OwnAgent" }));
  const [creating, setCreating] = useState(false);
  const [runningAction, setRunningAction] = useState("");
  const [traceAction, setTraceAction] = useState<Action | null>(null);
  const [traceEvents, setTraceEvents] = useState<ActionEvent[]>([]);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${agentKey.trim()}`,
    "Content-Type": "application/json"
  }), [agentKey]);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!agentKey.trim()) throw new Error("请先填写 Agent API Key");
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: { ...headers, ...(init.headers || {}) }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error?.message || body?.message || `请求失败：HTTP ${response.status}`);
    return body;
  }, [agentKey, headers]);

  const load = useCallback(async () => {
    if (!agentKey.trim()) {
      setIdentity(null); setTools([]); setActions([]);
      return;
    }
    setLoading(true); setError("");
    try {
      const [who, toolList, actionList] = await Promise.all([
        request("/identity"), request("/tools"), request("/actions?limit=50")
      ]);
      setIdentity(who as Identity);
      setTools(Array.isArray(toolList) ? toolList : []);
      setActions(Array.isArray(actionList) ? actionList : []);
      if (!actionTool && Array.isArray(toolList) && toolList.length) setActionTool(toolList[0].toolName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setIdentity(null); setTools([]); setActions([]);
    } finally { setLoading(false); }
  }, [agentKey, request, actionTool]);

  const loadTraces = useCallback(async () => {
    if (!agentKey.trim()) return;
    setLoadingTraces(true);
    setError("");
    try {
      const spans = await request("/traces");
      setTraceSpans(Array.isArray(spans) ? spans : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载 Trace 列表失败");
      setTraceSpans([]);
    } finally {
      setLoadingTraces(false);
    }
  }, [agentKey, request]);

  const startTraceStream = async (traceId: string) => {
    traceStreamAbortRef.current?.abort();
    const controller = new AbortController();
    traceStreamAbortRef.current = controller;
    setTraceStreamStatus("connecting");
    try {
      const response = await fetch(`${API}/traces/${encodeURIComponent(traceId)}/events`, {
        headers: { Authorization: `Bearer ${agentKey.trim()}`, Accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message || `实时订阅失败：HTTP ${response.status}`);
      }
      if (!response.body) throw new Error("当前浏览器不支持读取实时事件流");
      setTraceStreamStatus("connected");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const consume = async () => {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const lines = block.split("\n");
            const eventName = lines.find(line => line.startsWith("event:"))?.slice(6).trim();
            const dataText = lines.filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
            if (eventName === "trace_span" && dataText) {
              try {
                const span = JSON.parse(dataText) as TraceSpan;
                setSelectedTraceSpans(current => {
                  const byId = new Map(current.map(item => [item.spanId, item]));
                  byId.set(span.spanId, span);
                  return Array.from(byId.values()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
                });
                setTraceSpans(current => {
                  const byId = new Map(current.map(item => [item.spanId, item]));
                  byId.set(span.spanId, span);
                  return Array.from(byId.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
                });
              } catch {
                setError("收到无法解析的 Trace 事件");
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
        if (!controller.signal.aborted) setTraceStreamStatus("disconnected");
      };
      void consume().catch(error => {
        if (!controller.signal.aborted) {
          setTraceStreamStatus("disconnected");
          setError(error instanceof Error ? error.message : "Trace 实时连接中断");
        }
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setTraceStreamStatus("disconnected");
        setError(error instanceof Error ? error.message : "Trace 实时连接失败");
      }
    }
  };

  useEffect(() => {
    traceStreamAbortRef.current?.abort();
    setTraceStreamStatus("idle");
  }, [agentKey]);

  useEffect(() => () => traceStreamAbortRef.current?.abort(), []);

  const inspectRunTrace = async (traceId: string) => {
    setError("");
    setSelectedTraceId(traceId);
    setSelectedTraceSpans([]);
    // Establish the live subscription before loading the snapshot; merge by spanId
    // so an event arriving during the snapshot request is not overwritten.
    await startTraceStream(traceId);
    try {
      const spans = await request(`/traces/${encodeURIComponent(traceId)}/spans`);
      if (Array.isArray(spans)) {
        setSelectedTraceSpans(current => {
          const byId = new Map(current.map(item => [item.spanId, item]));
          spans.forEach((span: TraceSpan) => byId.set(span.spanId, span));
          return Array.from(byId.values()).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载 Run Trace 失败");
    }
  };

  const registerTool = async () => {
    setError(""); setNotice("");
    let inputSchema: unknown;
    try { inputSchema = JSON.parse(schemaText); }
    catch { setError("Input Schema 不是有效 JSON"); return; }
    setLoading(true);
    try {
      await request("/tools", {
        method: "POST",
        headers: { "X-OwnAgent-Tool-Admin-Key": adminKey },
        body: JSON.stringify({ toolName, description, riskLevel, enabled: true, inputSchema })
      });
      setNotice("工具定义已保存。只有服务端安装了对应 Handler 的工具才能执行；元数据本身不会执行代码。");
      setShowRegister(false);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "注册失败"); }
    finally { setLoading(false); }
  };

  const createAction = async () => {
    setError(""); setNotice("");
    let args: unknown;
    try { args = JSON.parse(argumentsText); }
    catch { setError("Arguments 不是有效 JSON"); return; }
    if (!actionTool) { setError("请先选择工具"); return; }
    setCreating(true);
    try {
      const result = await request("/actions", {
        method: "POST",
        body: JSON.stringify({
          toolName: actionTool, arguments: args,
          idempotencyKey: `console-${crypto.randomUUID()}`,
          metadata: { source: "ownagent-console" }
        })
      });
      setNotice(`Action ${result.actionId} 已创建：${result.decision} / ${result.status}`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "创建 Action 失败"); }
    finally { setCreating(false); }
  };

  const executeAction = async (action: Action) => {
    setError(""); setNotice(""); setRunningAction(action.actionId);
    try {
      const result = await request(`/actions/${encodeURIComponent(action.actionId)}/execute`, { method: "POST" });
      setNotice(`Action ${result.actionId} 执行结束：${result.status}`);
      await load();
      await inspectTrace({ ...action, ...result } as Action);
    } catch (e) { setError(e instanceof Error ? e.message : "执行 Action 失败"); }
    finally { setRunningAction(""); }
  };

  const decideApproval = async (action: Action, decision: "approve" | "reject") => {
    setError(""); setNotice("");
    if (!approverKey.trim()) {
      setError("请先填写 Approver API Key");
      return;
    }
    try {
      const result = await request(`/actions/${encodeURIComponent(action.actionId)}/${decision}`, {
        method: "POST",
        headers: { "X-OwnAgent-Approver-Key": approverKey },
        body: JSON.stringify({ reason: approvalReason })
      });
      setNotice(decision === "approve"
        ? `Action ${result.actionId} 已批准，现已进入 READY 队列`
        : `Action ${result.actionId} 已拒绝`);
      setApprovalReason("");
      await load();
      await inspectTrace({ ...action, ...result } as Action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "审批操作失败");
    }
  };

  const inspectTrace = async (action: Action) => {
    setError("");
    try {
      const [latest, events] = await Promise.all([
        request(`/actions/${encodeURIComponent(action.actionId)}`),
        request(`/actions/${encodeURIComponent(action.actionId)}/events`)
      ]);
      setTraceAction(latest as Action);
      setTraceEvents(Array.isArray(events) ? events : []);
    } catch (e) { setError(e instanceof Error ? e.message : "加载 Trace 失败"); }
  };

  const summary = [
    { label: "已注册工具", value: tools.length, icon: Wrench },
    { label: "Actions", value: actions.length, icon: Activity },
    { label: "待审批", value: actions.filter(a => a.status === "PENDING_APPROVAL").length, icon: ShieldAlert }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f6f8fc] text-slate-800 p-5 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold tracking-[0.16em] uppercase"><Shield className="w-4 h-4" /> Agent Engineering Platform</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-2">Agent 执行与观测</h1>
          <p className="text-sm text-slate-500 mt-1">提交 Action、运行已安装的安全 Handler，并检查持久化执行事件。</p>
        </div>
        <button onClick={() => void load()} disabled={loading || !agentKey.trim()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold hover:border-indigo-300 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 刷新数据
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900"><KeyRound className="w-4 h-4 text-indigo-600" /> API 连接</div>
        <p className="text-xs text-slate-500">凭证只保存在当前页面内存中，不写入 localStorage。Agent、Tool Admin 和 Approver 使用不同密钥；审批密钥只用于批准或拒绝高风险 Action。</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-xs font-semibold text-slate-600 space-y-1.5">Agent API Key
            <input type="password" value={agentKey} onChange={e => setAgentKey(e.target.value)} placeholder="oa_live_..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-400" />
          </label>
          <label className="text-xs font-semibold text-slate-600 space-y-1.5">Tool Admin Key（仅注册工具需要）
            <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="开发者管理密钥" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-400" />
          </label>
          <label className="text-xs font-semibold text-slate-600 space-y-1.5">Approver API Key（审批需要）
            <input type="password" value={approverKey} onChange={e => setApproverKey(e.target.value)} placeholder="审批专用密钥" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-400" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={() => void load()} disabled={!agentKey.trim() || loading} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold disabled:opacity-50">连接并加载</button>
          {identity?.agentId && <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> 已认证 Agent：{identity.agentId}</span>}
        </div>
      </section>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />{notice}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {summary.map(item => {
          const Icon = item.icon;
          return <div key={item.label} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center"><Icon className="w-5 h-5" /></div>
            <div><div className="text-2xl font-black text-slate-900">{item.value}</div><div className="text-xs text-slate-500">{item.label}</div></div>
          </div>;
        })}
      </div>

      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex gap-1">
          <button onClick={() => setTab("actions")} className={`px-4 py-3 text-sm font-bold border-b-2 ${tab === "actions" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Actions & Runs</button>
          <button onClick={() => setTab("tools")} className={`px-4 py-3 text-sm font-bold border-b-2 ${tab === "tools" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Tool Registry</button>
          <button onClick={() => setTab("worker")} className={`px-4 py-3 text-sm font-bold border-b-2 ${tab === "worker" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Local Worker</button>
          <button onClick={() => { setTab("traces"); void loadTraces(); }} className={`px-4 py-3 text-sm font-bold border-b-2 ${tab === "traces" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Run Traces</button>
        </div>
        {tab === "tools" && <button onClick={() => setShowRegister(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"><Plus className="w-4 h-4" /> 注册工具</button>}
      </div>

      {tab === "actions" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div className="font-bold text-slate-900">最近 Actions</div><span className="text-xs text-slate-400">最多 50 条</span></div>
              {actions.length === 0 ? <div className="py-16 text-center text-sm text-slate-400"><Clock3 className="w-8 h-8 mx-auto mb-2 opacity-40" />暂无 Action 记录</div> :
                <div className="divide-y divide-slate-100">{actions.map(action => <div key={action.actionId} className="px-5 py-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="min-w-0"><div className="font-mono text-sm font-bold text-slate-800">{action.toolName}</div><div className="text-[11px] text-slate-400 mt-1">{action.actionId} · {action.createdAt ? new Date(action.createdAt).toLocaleString() : "时间未知"}</div><pre className="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap break-all">{pretty(action.arguments)}</pre>
                      {action.output && <pre className="text-[11px] text-emerald-700 mt-2 whitespace-pre-wrap break-all">Output: {pretty(action.output)}</pre>}
                      {action.errorMessage && <p className={`text-xs mt-2 ${action.status === "UNKNOWN" ? "text-amber-800" : "text-rose-700"}`}>{action.errorCode}: {action.errorMessage}</p>}
                      {action.approvalStatus && action.approvalStatus !== "NOT_REQUIRED" && <p className="text-[11px] text-indigo-700 mt-2">Approval: {action.approvalStatus}{action.approvalDecidedBy ? ` · by ${action.approvalDecidedBy}` : ""}{action.approvalReason ? ` · ${action.approvalReason}` : ""}</p>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 shrink-0 items-center">
                      <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${statusTone(action.decision)}`}>{action.decision}</span>
                      <span className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${statusTone(action.status)}`}>{action.status}</span>
                      <span className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[10px] font-bold">{action.riskLevel}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {action.status === "READY" && ["ALLOW", "REQUIRE_APPROVAL"].includes(action.decision) && ["demo.echo", "text.transform"].includes(action.toolName) && <button onClick={() => void executeAction(action)} disabled={!!runningAction} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold disabled:opacity-50"><Play className="w-3 h-3" />{runningAction === action.actionId ? "执行中..." : "执行 Action"}</button>}
                    {action.status === "READY" && !["demo.echo", "text.transform"].includes(action.toolName) && <span className="text-xs text-indigo-700 self-center">等待 Local Worker 领取</span>}
                    {action.status === "PENDING_APPROVAL" && action.approvalStatus === "PENDING" && <div className="w-full rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                      <div className="text-xs font-bold text-amber-900">需要人工审批 · {action.riskLevel}</div>
                      <textarea value={approvalReason} onChange={e => setApprovalReason(e.target.value)} rows={2} placeholder="填写审批原因（可选）" className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400" />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => void decideApproval(action, "approve")} disabled={!approverKey.trim()} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-40">批准并放入执行队列</button>
                        <button onClick={() => void decideApproval(action, "reject")} disabled={!approverKey.trim()} className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 text-xs font-bold disabled:opacity-40">拒绝</button>
                      </div>
                    </div>}
                    <button onClick={() => void inspectTrace(action)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"><ListTree className="w-3 h-3" />查看 Trace</button>
                    {typeof action.attemptCount === "number" && <span className="text-[11px] text-slate-400 self-center">Attempts: {action.attemptCount}</span>}
                  </div>
                </div>)}</div>}
            </section>
            <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 h-fit">
              <div className="font-bold text-slate-900">创建 Action</div>
              <p className="text-xs text-slate-500">先创建并执行策略判断。只有 ALLOW / READY 的 Action 才能调用已安装的服务端 Handler。</p>
              <label className="block text-xs font-semibold text-slate-600">目标工具
                <select value={actionTool} onChange={e => setActionTool(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                  <option value="">请选择工具</option>{tools.map(tool => <option key={tool.toolId} value={tool.toolName}>{tool.toolName} · {tool.riskLevel}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-slate-600">Arguments（JSON）
                <textarea value={argumentsText} onChange={e => setArgumentsText(e.target.value)} rows={7} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono outline-none focus:border-indigo-400" />
              </label>
              <button onClick={() => void createAction()} disabled={creating || !identity?.agentId || !actionTool} className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40">{creating ? "提交中..." : "提交 Action"}</button>
            </section>
          </div>

          {traceAction && <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><div className="font-bold text-slate-900">Execution Trace</div><div className="text-[11px] text-slate-400 font-mono mt-1">{traceAction.actionId}</div></div><button onClick={() => { setTraceAction(null); setTraceEvents([]); }} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
            <div className="p-5 grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-5">
              <div className="space-y-2 text-xs"><div className="text-slate-500">状态</div><span className={`inline-flex px-2 py-1 rounded-lg border font-bold ${statusTone(traceAction.status)}`}>{traceAction.status}</span>{traceAction.approvalStatus && <><div className="text-slate-500 pt-2">审批状态</div><b>{traceAction.approvalStatus}</b>{traceAction.approvalDecidedBy && <span>审批人：{traceAction.approvalDecidedBy}</span>}{traceAction.approvalReason && <span>审批原因：{traceAction.approvalReason}</span>}</>}<div className="text-slate-500 pt-2">Attempt count</div><b>{traceAction.attemptCount ?? 0}</b>{traceAction.status === "UNKNOWN" && <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 leading-relaxed">执行超时、请求中断或租约过期，无法确认外部操作是否已经发生。OwnAgent 不会自动重试；请先核对外部系统，再决定后续处理。</p>}<div className="text-slate-500 pt-2">开始时间</div><span>{traceAction.startedAt ? new Date(traceAction.startedAt).toLocaleString() : "—"}</span><div className="text-slate-500 pt-2">结束时间</div><span>{traceAction.completedAt ? new Date(traceAction.completedAt).toLocaleString() : "—"}</span></div>
              <div className="space-y-3">
                {traceEvents.length === 0 ? <p className="text-sm text-slate-400">暂无执行事件。READY 状态尚未执行时，这是正常的。</p> : traceEvents.map(event => <div key={event.eventId} className="flex gap-3 border-l-2 border-indigo-200 pl-4 py-1"><div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 -ml-[21px]" /><div><div className="text-sm font-bold text-slate-800">{event.eventType}</div><div className="text-[11px] text-slate-400 mt-0.5">{new Date(event.createdAt).toLocaleString()}</div>{event.details && <pre className="text-[11px] text-slate-500 mt-1 whitespace-pre-wrap">{pretty(event.details)}</pre>}</div></div>)}
                {traceAction.output && <div><div className="text-xs font-bold text-emerald-700 mb-1">Output</div><pre className="bg-emerald-50 rounded-xl p-3 text-xs whitespace-pre-wrap break-all">{pretty(traceAction.output)}</pre></div>}
                {traceAction.errorMessage && <div className="text-xs text-rose-700">{traceAction.errorCode}: {traceAction.errorMessage}</div>}
              </div>
            </div>
          </section>}
        </div>
      ) : tab === "tools" ? (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100"><div className="font-bold text-slate-900">Agent 工具注册表</div><p className="text-xs text-slate-500 mt-1">工具定义只声明输入契约和风险等级；只有服务端安装了对应 Handler 才能执行。</p></div>
          {tools.length === 0 ? <div className="py-16 text-center text-sm text-slate-400"><Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />还没有注册工具</div> :
            <div className="divide-y divide-slate-100">{tools.map(tool => <div key={tool.toolId} className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div><div className="font-mono text-sm font-bold text-slate-900">{tool.toolName}</div><p className="text-xs text-slate-500 mt-1">{tool.description}</p><div className="text-[11px] text-slate-400 mt-2">Schema：{Object.keys((tool.inputSchema?.properties || {}) as object).length} 个字段 · {tool.enabled ? "Enabled" : "Disabled"}</div></div>
              <div className="flex gap-2"><span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">{tool.riskLevel}</span><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${tool.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{tool.enabled ? "启用" : "停用"}</span></div>
            </div>)}</div>}
        </section>
      ) : tab === "traces" ? (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="text-lg font-black text-slate-950">真实 Run Trace</h2><p className="text-xs text-slate-500 mt-1">来自 SDK 上报的持久化 Span；Token 只显示 Provider 实际返回的 Usage。</p></div>
            <button onClick={() => void loadTraces()} disabled={loadingTraces || !agentKey.trim()} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold disabled:opacity-50"><RefreshCw className={`w-3.5 h-3.5 inline mr-1 ${loadingTraces ? "animate-spin" : ""}`} />刷新 Trace</button>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.4fr)] gap-4">
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 font-bold text-sm">最近 Span / Run</div>
              {traceSpans.length === 0 ? <div className="p-8 text-center text-xs text-slate-400">{loadingTraces ? "正在加载..." : "暂无 Trace。运行 Python Demo Agent 后，这里会出现真实的模型调用和 Action Span。"}</div> :
                <div className="divide-y divide-slate-100">{Array.from(new Map(traceSpans.map(span => [span.traceId, span] as const)).entries()).map(([traceId, span]) => {
                  const count = traceSpans.filter(item => item.traceId === traceId).length;
                  const tokens = traceSpans.filter(item => item.traceId === traceId).reduce((sum, item) => sum + (item.totalTokens || 0), 0);
                  return <button key={traceId} onClick={() => void inspectRunTrace(traceId)} className={`w-full text-left px-4 py-3 hover:bg-slate-50 ${selectedTraceId === traceId ? "bg-indigo-50" : ""}`}>
                    <div className="font-mono text-xs font-bold text-slate-800 break-all">{traceId}</div>
                    <div className="flex flex-wrap gap-3 text-[11px] text-slate-500 mt-2"><span>{count} spans</span><span>{tokens} provider tokens</span><span>{span.runId || "no run id"}</span></div>
                  </button>;
                })}</div>}
            </section>
            <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100"><div className="font-bold text-sm text-slate-900">Span Waterfall</div><div className="flex items-center gap-2 mt-1"><div className="text-[11px] text-slate-400 font-mono truncate">{selectedTraceId || "选择左侧 Run 查看完整 Span"}</div>{selectedTraceId && <span className={`text-[10px] font-semibold ${traceStreamStatus === "connected" ? "text-emerald-600" : traceStreamStatus === "connecting" ? "text-blue-600" : "text-amber-600"}`}>{traceStreamStatus === "connected" ? "● 实时连接" : traceStreamStatus === "connecting" ? "连接中…" : traceStreamStatus === "disconnected" ? "连接已断开" : "未连接"}</span>}</div></div>
              {!selectedTraceId ? <div className="p-10 text-center text-xs text-slate-400">选择一个 Run 查看真实时间线</div> :
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)] gap-3 text-[10px] uppercase tracking-wide text-slate-400"><span>Span hierarchy</span><span>Relative execution time</span></div>
                  {buildSpanRows(selectedTraceSpans).map(({ span, depth, left, width }) => <div key={span.spanId} className="rounded-xl border border-slate-100 p-3">
                    <div className="grid grid-cols-[minmax(120px,0.8fr)_minmax(0,1.2fr)] gap-3 items-center">
                      <div className="min-w-0" style={{ paddingLeft: `${Math.min(depth, 6) * 12}px` }}>
                        <div className="text-xs font-bold text-slate-800 truncate" title={span.name}>{depth > 0 ? "↳ " : ""}{span.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{span.spanKind} · {span.status}</div>
                      </div>
                      <div className="relative h-5 rounded-md bg-slate-100 overflow-hidden">
                        <div className={`absolute top-0.5 bottom-0.5 rounded ${span.status === "ERROR" ? "bg-rose-500" : span.status === "OK" ? "bg-indigo-500" : "bg-amber-400"}`} style={{ left: `${left}%`, width: `${width}%` }} title={`${span.name}: ${span.durationMs ?? "unknown"} ms`} />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 text-[10px] mt-2 text-slate-500"><span>{new Date(span.startedAt).toLocaleTimeString()}</span><span>{span.durationMs == null ? "duration unknown" : `${span.durationMs} ms`}</span><span>Tokens: {span.totalTokens ?? "—"}</span><span>Input {span.inputTokens ?? "—"} / Output {span.outputTokens ?? "—"}</span><span className={span.usageSource === "PROVIDER" ? "text-emerald-700" : "text-amber-700"}>{span.usageSource}</span></div>
                    {span.attributes && <details className="mt-2"><summary className="cursor-pointer text-[10px] text-slate-400">Span attributes</summary><pre className="mt-1 p-2 rounded-lg bg-slate-50 text-[10px] text-slate-500 whitespace-pre-wrap break-all">{pretty(span.attributes)}</pre></details>}
                  </div>)}
                </div>}
            </section>
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-5 lg:p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="text-xs font-bold uppercase tracking-wider text-indigo-600">Developer execution</div><h2 className="text-lg font-black text-slate-950 mt-1">在自己的机器运行 Python 工具</h2></div>
              <span className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold">Backend API available</span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">Local Worker 会领取属于当前 Agent 的 ALLOW / READY Action，并在本机执行你明确注册的 Python 函数。OwnAgent 服务端不会下载或执行你的 Python 源码。</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-xs font-bold text-slate-800">1. 安装 SDK</div><pre className="text-[11px] mt-2 whitespace-pre-wrap break-all text-slate-600">cd sdk/python{"\n"}python -m pip install -e .</pre></div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-xs font-bold text-slate-800">2. 配置环境变量</div><pre className="text-[11px] mt-2 whitespace-pre-wrap break-all text-slate-600">OWNAGENT_BASE_URL{"\n"}OWNAGENT_AGENT_API_KEY{"\n"}OWNAGENT_TOOL_ADMIN_API_KEY</pre></div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3"><div className="text-xs font-bold text-slate-800">3. 启动 Worker</div><pre className="text-[11px] mt-2 whitespace-pre-wrap break-all text-slate-600">python examples/local_worker.py</pre></div>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
            <div className="font-bold text-slate-900">注册自己的 Handler</div>
            <p className="text-xs text-slate-500">工具名称必须与 Tool Registry 中的名称一致。Worker 只领取本地进程明确注册的工具。</p>
            <pre className="bg-slate-950 text-slate-100 rounded-xl p-4 text-xs overflow-x-auto">{`from ownagent import LocalWorker, OwnAgentClient

client = OwnAgentClient(
    "http://localhost:8080",
    api_key=AGENT_API_KEY,
    tool_admin_api_key=TOOL_ADMIN_KEY,
)

worker = LocalWorker(client)
worker.register(
    "my.tools.greet",
    lambda args: {"message": f"Hello, {args['name']}"},
)
worker.run_forever()`}</pre>
            <p className="text-xs text-slate-500">Agent 通过 create_action 提交同名工具的 Action。只有策略允许的 Action 才会被 Worker 领取。</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 leading-relaxed"><b>安全边界：</b>当前 Worker 运行在启动它的 Python 进程中，不是安全沙箱。它拥有该进程的操作系统权限。不要执行不可信代码；生产环境还需要独立 Worker 身份、隔离执行、审批恢复和人工对账能力。</div>
        </section>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /><div><b>当前阶段边界：</b>Runtime 支持服务端显式安装的安全示例 Handler，以及开发者本机运行的 Python Local Worker。Action 执行支持租约、心跳、超时和 UNKNOWN 状态；无法确认外部副作用时不会自动重试。Worker 当前不是沙箱；审批后恢复执行、独立 Worker 身份、OS 级隔离和人工对账仍在开发中。</div></div>

      {showRegister && <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><div className="font-bold text-slate-900">注册 Agent 工具</div><div className="text-xs text-slate-500 mt-1">工具定义由开发者管理密钥授权</div></div><button onClick={() => setShowRegister(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
          <div className="p-5 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">工具名称<input value={toolName} onChange={e => setToolName(e.target.value)} placeholder="demo.echo" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono" /></label>
            <label className="block text-xs font-semibold text-slate-600">描述<input value={description} onChange={e => setDescription(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm" /></label>
            <label className="block text-xs font-semibold text-slate-600">风险等级<select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">{riskOptions.map(level => <option key={level}>{level}</option>)}</select></label>
            <label className="block text-xs font-semibold text-slate-600">Input Schema（JSON Schema 子集）<textarea value={schemaText} onChange={e => setSchemaText(e.target.value)} rows={10} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono" /></label>
          </div>
          <div className="px-5 py-4 border-t border-slate-100 flex justify-end gap-2"><button onClick={() => setShowRegister(false)} className="px-4 py-2 rounded-xl text-sm text-slate-600 hover:bg-slate-100">取消</button><button onClick={() => void registerTool()} disabled={loading || !toolName.trim() || !description.trim() || !adminKey.trim()} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-40">保存工具定义</button></div>
        </div>
      </div>}
    </div>
  );
}
