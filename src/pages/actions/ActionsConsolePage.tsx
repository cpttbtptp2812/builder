import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock3, KeyRound, Plus, RefreshCw, Shield, ShieldAlert, Wrench } from "lucide-react";

type Tool = {
  toolId: string; toolName: string; description: string;
  inputSchema: Record<string, unknown>; riskLevel: string; enabled: boolean; createdAt?: string;
};
type Action = {
  actionId: string; toolName: string; status: string; decision: string;
  riskLevel: string; arguments: Record<string, unknown>; createdAt: string;
};
type Identity = { agentId?: string; status?: string };

const API = "/api/v1";
const riskOptions = ["READ_ONLY", "LOW", "MEDIUM", "HIGH", "CRITICAL"];

function pretty(value: unknown) { return JSON.stringify(value, null, 2); }
function statusTone(value: string) {
  if (["ALLOW", "READY", "APPROVED"].includes(value)) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (["REQUIRE_APPROVAL", "PENDING_APPROVAL", "PENDING_POLICY"].includes(value)) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-rose-50 text-rose-700 border-rose-200";
}

export default function ActionsConsolePage() {
  const [agentKey, setAgentKey] = useState("");
  const [adminKey, setAdminKey] = useState("");
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"actions" | "tools">("actions");
  const [showRegister, setShowRegister] = useState(false);
  const [toolName, setToolName] = useState("file.read");
  const [description, setDescription] = useState("Read a file from the agent workspace");
  const [riskLevel, setRiskLevel] = useState("READ_ONLY");
  const [schemaText, setSchemaText] = useState(pretty({
    type: "object",
    properties: { path: { type: "string" } },
    required: ["path"],
    additionalProperties: false
  }));
  const [actionTool, setActionTool] = useState("");
  const [argumentsText, setArgumentsText] = useState(pretty({ path: "/workspace/README.md" }));
  const [creating, setCreating] = useState(false);

  const headers = useMemo(() => ({
    Authorization: `Bearer ${agentKey.trim()}`,
    "Content-Type": "application/json"
  }), [agentKey]);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!agentKey.trim()) throw new Error("请先填写 Agent API Key");
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers || {})
      }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error?.message || body?.message || `请求失败：HTTP ${response.status}`);
    }
    return body;
  }, [agentKey, headers]);

  const load = useCallback(async () => {
    if (!agentKey.trim()) {
      setIdentity(null); setTools([]); setActions([]);
      return;
    }
    setLoading(true); setError(""); setNotice("");
    try {
      const [who, toolList, actionList] = await Promise.all([
        request("/identity"),
        request("/tools"),
        request("/actions?limit=50")
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

  useEffect(() => { if (agentKey.trim()) void load(); }, [agentKey, load]);

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
      setNotice("工具定义已保存。注意：注册工具不等于已提供可执行 Handler。");
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
    if (!actionTool) { setError("请先注册至少一个工具"); return; }
    setCreating(true);
    try {
      const result = await request("/actions", {
        method: "POST",
        body: JSON.stringify({
          toolName: actionTool,
          arguments: args,
          idempotencyKey: `console-${crypto.randomUUID()}`,
          metadata: { source: "ownagent-console" }
        })
      });
      setNotice(`Action ${result.actionId} 已创建：${result.decision} / ${result.status}。此版本尚不会执行工具。`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "创建 Action 失败"); }
    finally { setCreating(false); }
  };

  const summary = [
    { label: "已注册工具", value: tools.length, icon: Wrench },
    { label: "Actions", value: actions.length, icon: Activity },
    { label: "待审批", value: actions.filter(a => a.decision === "REQUIRE_APPROVAL").length, icon: ShieldAlert }
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-[#f6f8fc] text-slate-800 p-5 lg:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 text-xs font-bold tracking-[0.16em] uppercase">
            <Shield className="w-4 h-4" /> Action Control Plane
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-950 mt-2">执行控制台</h1>
          <p className="text-sm text-slate-500 mt-1">管理 Agent 可调用的工具，并在真正执行前检查每一次 Action。</p>
        </div>
        <button onClick={() => void load()} disabled={loading || !agentKey.trim()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold hover:border-indigo-300 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> 刷新数据
        </button>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 lg:p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 font-bold text-slate-900"><KeyRound className="w-4 h-4 text-indigo-600" /> API 连接</div>
        <p className="text-xs text-slate-500">凭证只保存在当前页面内存中，不写入 localStorage。请使用测试环境的 Agent Key 和独立的 Tool Admin Key。</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-xs font-semibold text-slate-600 space-y-1.5">Agent API Key
            <input type="password" value={agentKey} onChange={e => setAgentKey(e.target.value)} placeholder="oa_live_..." className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-400" />
          </label>
          <label className="text-xs font-semibold text-slate-600 space-y-1.5">Tool Admin Key（仅注册工具需要）
            <input type="password" value={adminKey} onChange={e => setAdminKey(e.target.value)} placeholder="开发者管理密钥" className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-indigo-400" />
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
          <button onClick={() => setTab("actions")} className={`px-4 py-3 text-sm font-bold border-b-2 ${tab === "actions" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Actions</button>
          <button onClick={() => setTab("tools")} className={`px-4 py-3 text-sm font-bold border-b-2 ${tab === "tools" ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500"}`}>Tool Registry</button>
        </div>
        {tab === "tools" && <button onClick={() => setShowRegister(true)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"><Plus className="w-4 h-4" /> 注册工具</button>}
      </div>

      {tab === "actions" ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
          <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div className="font-bold text-slate-900">最近 Actions</div><span className="text-xs text-slate-400">最多 50 条</span></div>
            {actions.length === 0 ? <div className="py-16 text-center text-sm text-slate-400"><Clock3 className="w-8 h-8 mx-auto mb-2 opacity-40" />暂无 Action 记录</div> :
              <div className="divide-y divide-slate-100">{actions.map(action => <div key={action.actionId} className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0"><div className="font-mono text-sm font-bold text-slate-800">{action.toolName}</div><div className="text-[11px] text-slate-400 mt-1">{action.actionId} · {action.createdAt ? new Date(action.createdAt).toLocaleString() : "时间未知"}</div><pre className="text-[11px] text-slate-500 mt-2 whitespace-pre-wrap break-all">{pretty(action.arguments)}</pre></div>
                <div className="flex flex-wrap gap-1.5 shrink-0"><span className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${statusTone(action.decision)}`}>{action.decision}</span><span className={`px-2 py-1 rounded-lg border text-[10px] font-bold ${statusTone(action.status)}`}>{action.status}</span><span className="px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-[10px] font-bold">{action.riskLevel}</span></div>
              </div>)}</div>}
          </section>
          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 h-fit">
            <div className="font-bold text-slate-900">创建 Action</div>
            <p className="text-xs text-slate-500">模拟你的 Agent 提交一次工具调用请求。这里只做策略判断和记录，不会执行文件或外部操作。</p>
            <label className="block text-xs font-semibold text-slate-600">目标工具
              <select value={actionTool} onChange={e => setActionTool(e.target.value)} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm bg-white">
                <option value="">请选择工具</option>{tools.map(tool => <option key={tool.toolId} value={tool.toolName}>{tool.toolName} · {tool.riskLevel}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-600">Arguments（JSON）
              <textarea value={argumentsText} onChange={e => setArgumentsText(e.target.value)} rows={7} className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-mono outline-none focus:border-indigo-400" />
            </label>
            <button onClick={() => void createAction()} disabled={creating || !identity?.agentId || !actionTool} className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold disabled:opacity-40">{creating ? "提交中..." : "提交 Action 并检查策略"}</button>
          </section>
        </div>
      ) : (
        <section className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100"><div className="font-bold text-slate-900">Agent 工具注册表</div><p className="text-xs text-slate-500 mt-1">每个工具声明输入契约和风险等级。工具 Handler / Runtime 尚未接通。</p></div>
          {tools.length === 0 ? <div className="py-16 text-center text-sm text-slate-400"><Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />还没有注册工具</div> :
            <div className="divide-y divide-slate-100">{tools.map(tool => <div key={tool.toolId} className="px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div><div className="font-mono text-sm font-bold text-slate-900">{tool.toolName}</div><p className="text-xs text-slate-500 mt-1">{tool.description}</p><div className="text-[11px] text-slate-400 mt-2">Schema：{Object.keys((tool.inputSchema?.properties || {}) as object).length} 个字段 · {tool.enabled ? "Enabled" : "Disabled"}</div></div>
              <div className="flex gap-2"><span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">{tool.riskLevel}</span><span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${tool.enabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{tool.enabled ? "启用" : "停用"}</span></div>
            </div>)}</div>}
        </section>
      )}

      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 flex gap-2"><ShieldAlert className="w-4 h-4 shrink-0" /><div><b>当前阶段边界：</b>OwnAgent 已能注册工具、校验参数并给出 ALLOW / REQUIRE_APPROVAL / DENY 决策；尚未实现真实工具执行、人工审批流程和结果验证。请勿将 READY 理解为工具已经运行。</div></div>

      {showRegister && <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><div><div className="font-bold text-slate-900">注册 Agent 工具</div><div className="text-xs text-slate-500 mt-1">工具定义由开发者管理密钥授权</div></div><button onClick={() => setShowRegister(false)} className="p-2 rounded-lg hover:bg-slate-100"><X className="w-4 h-4" /></button></div>
          <div className="p-5 space-y-3">
            <label className="block text-xs font-semibold text-slate-600">工具名称<input value={toolName} onChange={e => setToolName(e.target.value)} placeholder="file.read" className="mt-1 w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-mono" /></label>
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
