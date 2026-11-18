import React, { useMemo, useState } from "react";
import {
  Activity, CheckCircle2, Clock3, Copy, Loader2, RotateCcw, XCircle,
  ChevronDown, Zap, BrainCircuit, Wrench, Database, Search, AlertTriangle,
  Radio, GitBranch, ArrowDown, Eye, Sparkles, Terminal, FileOutput
} from "lucide-react";
import { AgentStep } from "@/lib/agentTimeline";
import { TraceDrawerMessage } from "./TraceInspectorDrawer";

interface Props {
  timeline: AgentStep[];
  message?: TraceDrawerMessage | null;
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  isThinking?: boolean;
  onRetryRun?: () => void;
}

type FilterKey = "all" | "llm" | "tools" | "errors";
const phaseMeta: Record<string, { label: string; verb: string; icon: React.ComponentType<{className?: string}>; tint: string }> = {
  intent: { label: "理解任务", verb: "正在理解目标", icon: Search, tint: "violet" },
  workflow: { label: "规划步骤", verb: "正在安排执行顺序", icon: GitBranch, tint: "violet" },
  context: { label: "读取上下文", verb: "正在获取所需资料", icon: Database, tint: "cyan" },
  llm: { label: "模型判断", verb: "正在分析并决定下一步", icon: BrainCircuit, tint: "violet" },
  skill: { label: "执行操作", verb: "正在调用工具", icon: Wrench, tint: "cyan" },
  delivery: { label: "整理结果", verb: "正在组织输出", icon: FileOutput, tint: "emerald" },
  closure: { label: "完成任务", verb: "正在结束本轮任务", icon: CheckCircle2, tint: "emerald" },
  degraded: { label: "处理异常", verb: "执行过程中遇到问题", icon: AlertTriangle, tint: "rose" },
  external: { label: "执行事件", verb: "收到一条执行事件", icon: Activity, tint: "slate" },
};
const statusMeta: Record<string, { label: string; color: string }> = {
  done: { label: "已完成", color: "emerald" },
  passed: { label: "已通过", color: "emerald" },
  running: { label: "正在执行", color: "cyan" },
  failed: { label: "执行失败", color: "rose" },
  pending: { label: "等待执行", color: "slate" },
  unknown: { label: "状态未知", color: "amber" },
};
const durationText = (ms?: number) => typeof ms !== "number" || !Number.isFinite(ms) || ms < 0 ? "未记录" : ms >= 1000 ? `${(ms / 1000).toFixed(2)} 秒` : `${Math.round(ms)} 毫秒`;
const tokenText = (detail?: Record<string, any>) => {
  const total = detail?.totalTokens ?? detail?.total_tokens;
  const input = detail?.inputTokens ?? detail?.input_tokens;
  const output = detail?.outputTokens ?? detail?.output_tokens;
  if (typeof total === "number") return total.toLocaleString();
  if (typeof input === "number" || typeof output === "number") return `${typeof input === "number" ? input.toLocaleString() : "—"} / ${typeof output === "number" ? output.toLocaleString() : "—"}`;
  return null;
};
const pretty = (value: unknown) => {
  if (value == null) return "未提供";
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
};
const pick = (detail: Record<string, any>, keys: string[]) => {
  for (const key of keys) if (detail[key] !== undefined && detail[key] !== null) return detail[key];
  return undefined;
};

export const MissionControlTimeline: React.FC<Props> = ({
  timeline, message, activeStepId, onSelectStep, isThinking, onRetryRun
}) => {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(activeStepId ?? null);
  const [copied, setCopied] = useState(false);

  const ordered = useMemo(() => [...(timeline || [])].sort((a, b) => a.seq - b.seq || a.timestamp - b.timestamp), [timeline]);
  const selected = ordered.find(s => s.stepId === (activeStepId || selectedId)) || ordered.find(s => s.status === "running") || ordered[ordered.length - 1];
  const filtered = ordered.filter(s => filter === "all" || (filter === "llm" && s.phase === "llm") || (filter === "tools" && s.phase === "skill") || (filter === "errors" && s.status === "failed"));
  const failures = ordered.filter(s => s.status === "failed").length;
  const completed = ordered.filter(s => s.status === "done" || s.status === "passed").length;
  const currentIndex = ordered.findIndex(s => s.status === "running");
  const progress = ordered.length ? Math.round((completed / ordered.length) * 100) : 0;
  const select = (step: AgentStep) => {
    setSelectedId(step.stepId === selected?.stepId ? null : step.stepId);
    onSelectStep?.(step.stepId);
  };
  const copySelected = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(JSON.stringify(selected.rightDetail || {}, null, 2)); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch {}
  };

  const detail = selected?.rightDetail || {};
  const input = pick(detail, ["arguments", "input", "parameters", "request", "tool_input", "prompt"]);
  const output = pick(detail, ["result", "output", "response", "content", "tool_output"]);
  const why = pick(detail, ["reason", "why", "rationale", "decision", "thought"]);
  const meta = selected ? (phaseMeta[selected.phase] || phaseMeta.external) : phaseMeta.external;
  const SelectedIcon = meta.icon;
  const selectedStatus = selected ? (statusMeta[selected.status] || statusMeta.unknown) : statusMeta.unknown;
  const knownTokens = ordered.reduce((sum, step) => {
    const n = step.rightDetail?.totalTokens ?? step.rightDetail?.total_tokens;
    return sum + (typeof n === "number" ? n : 0);
  }, 0);
  const tokenEvents = ordered.filter(step => typeof (step.rightDetail?.totalTokens ?? step.rightDetail?.total_tokens) === "number").length;

  return (
    <section className="journey-shell relative space-y-4 overflow-hidden rounded-2xl text-slate-100">
      <style>{`
        .journey-shell{--j-line:rgba(148,163,184,.2);background:radial-gradient(ellipse at 12% 0%,rgba(59,130,246,.17),transparent 42%),radial-gradient(ellipse at 100% 32%,rgba(124,58,237,.13),transparent 38%),linear-gradient(155deg,#07111f 0%,#0a1424 54%,#0b1020 100%);border:1px solid rgba(125,155,205,.22);color:#e6edf8}
        .journey-grid{background-image:linear-gradient(rgba(148,163,184,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.035) 1px,transparent 1px);background-size:28px 28px}
        .journey-glow{box-shadow:0 0 0 1px rgba(96,165,250,.22),0 0 28px rgba(59,130,246,.12)}
        .journey-node{transition:transform .2s ease,border-color .2s ease,background .2s ease,box-shadow .2s ease}
        .journey-node:hover{transform:translateX(3px);background:rgba(30,49,76,.75)}
        .journey-node-active{background:linear-gradient(110deg,rgba(30,64,110,.68),rgba(31,41,75,.5));border-color:rgba(96,165,250,.65)!important;box-shadow:0 0 0 1px rgba(96,165,250,.14),0 8px 28px rgba(2,8,23,.22)}
        .journey-pulse{animation:journey-pulse 1.8s ease-in-out infinite}
        @keyframes journey-pulse{0%,100%{box-shadow:0 0 0 0 rgba(56,189,248,.38)}50%{box-shadow:0 0 0 7px rgba(56,189,248,0)}}
        .journey-scan{background:linear-gradient(90deg,transparent,rgba(125,211,252,.8),transparent);animation:journey-scan 2.8s linear infinite}
        @keyframes journey-scan{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
        .journey-code{background:rgba(2,8,23,.72);border:1px solid rgba(148,163,184,.17);color:#cbd5e1}
        .journey-scroll{scrollbar-width:thin;scrollbar-color:rgba(100,116,139,.55) transparent}
        .journey-scroll::-webkit-scrollbar{width:5px}.journey-scroll::-webkit-scrollbar-thumb{background:rgba(100,116,139,.55);border-radius:8px}
        @media(prefers-reduced-motion:reduce){.journey-node,.journey-pulse,.journey-scan{animation:none;transition:none}}
      `}</style>

      <div className="journey-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="relative border-b border-slate-700/50 px-4 pb-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.22em] text-cyan-300/90">
              <span className="relative flex h-2 w-2"><span className={`absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60 ${isThinking ? "animate-ping" : ""}`} /><span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-300" /></span>
              AGENT JOURNEY / 执行轨迹
            </div>
            <h2 className="mt-2 text-lg font-semibold tracking-tight text-white sm:text-xl">看见 Agent 的每一步</h2>
            <p className="mt-1 max-w-2xl break-words text-xs leading-5 text-slate-400">{message?.userPrompt || "当前任务"} </p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold ${isThinking ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200" : failures ? "border-rose-400/30 bg-rose-400/10 text-rose-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isThinking ? "bg-cyan-300 animate-pulse" : failures ? "bg-rose-300" : "bg-emerald-300"}`} />
            {isThinking ? "正在执行" : failures ? "执行中存在失败" : "本轮已结束"}
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] tracking-widest text-slate-500">EXECUTION PROGRESS</div>
            <div className="mt-1 flex items-baseline gap-2"><span className="font-mono text-2xl font-semibold text-white">{completed}<span className="text-sm text-slate-500">/{ordered.length}</span></span><span className="text-xs text-slate-400">步已完成</span></div>
          </div>
          <div className="text-right"><div className="font-mono text-lg text-cyan-200">{ordered.length ? `${progress}%` : "—"}</div><div className="text-[10px] text-slate-500">基于已记录步骤</div></div>
        </div>
        <div className="relative mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-violet-400 transition-all duration-500" style={{ width: `${progress}%` }} />
          {isThinking && <div className="journey-scan absolute inset-y-0 left-0 w-1/3" />}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-2.5 py-2"><div className="text-[9px] tracking-wider text-slate-500">执行步骤</div><div className="mt-0.5 font-mono text-sm text-slate-100">{ordered.length}</div></div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-2.5 py-2"><div className="text-[9px] tracking-wider text-slate-500">已知 Token</div><div className="mt-0.5 font-mono text-sm text-slate-100">{tokenEvents ? knownTokens.toLocaleString() : "未上报"}</div></div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-900/45 px-2.5 py-2"><div className="text-[9px] tracking-wider text-slate-500">异常步骤</div><div className={`mt-0.5 font-mono text-sm ${failures ? "text-rose-300" : "text-slate-100"}`}>{failures}</div></div>
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="relative flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/25 bg-cyan-300/5 text-cyan-200"><Activity className="h-7 w-7" />{isThinking && <span className="journey-pulse absolute inset-0 rounded-full border border-cyan-300/40" />}</div>
          <h3 className="text-sm font-semibold text-white">{isThinking ? "正在等待 Agent 的第一条执行信号" : "这次运行还没有可展示的执行事件"}</h3>
          <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">这里仅展示 Agent 或执行端实际上报的步骤。收到真实事件后，任务轨迹会从这里逐步展开。</p>
          {isThinking && <div className="mt-4 h-1 w-36 overflow-hidden rounded-full bg-slate-800"><div className="journey-scan h-full w-1/2" /></div>}
        </div>
      ) : (
        <div className="relative grid min-w-0 grid-cols-1 gap-4 px-3 pb-4 sm:px-4 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,.98fr)]">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-1">
              <div><div className="text-[10px] font-bold tracking-[.18em] text-slate-500">THE JOURNEY</div><div className="mt-0.5 text-sm font-semibold text-white">执行路线</div></div>
              <div className="flex flex-wrap gap-1">
                {([{id:"all",label:"全部"},{id:"llm",label:"判断"},{id:"tools",label:"操作"},{id:"errors",label:"异常"}] as const).map(item => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full border px-2.5 py-1 text-[10px] transition ${filter===item.id ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-slate-700/70 text-slate-400 hover:border-slate-500 hover:text-white"}`}>{item.label}</button>)}
              </div>
            </div>
            <div className="journey-scroll relative max-h-[62vh] space-y-1 overflow-y-auto pr-1">
              <div className="absolute bottom-5 left-[19px] top-5 w-px bg-gradient-to-b from-cyan-300/60 via-blue-400/25 to-transparent" />
              {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-xs text-slate-500">没有符合筛选条件的步骤</div> : filtered.map((step, index) => {
                const info = phaseMeta[step.phase] || phaseMeta.external;
                const Icon = info.icon;
                const active = selected?.stepId === step.stepId;
                const state = statusMeta[step.status] || statusMeta.unknown;
                return <button key={step.stepId} type="button" onClick={() => select(step)} className={`journey-node relative flex w-full items-center gap-3 rounded-xl border border-transparent px-2.5 py-3 text-left ${active ? "journey-node-active" : "hover:border-slate-700/70"}`}>
                  <span className={`relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${step.status==="running" ? "journey-pulse border-cyan-300/50 bg-cyan-300/10 text-cyan-200" : step.status==="failed" ? "border-rose-400/35 bg-rose-400/10 text-rose-300" : step.status==="done" || step.status==="passed" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" : "border-slate-600/50 bg-slate-800/80 text-slate-400"}`}>
                    {step.status==="running" ? <Loader2 className="h-4 w-4 animate-spin"/> : step.status==="failed" ? <XCircle className="h-4 w-4"/> : step.status==="done" || step.status==="passed" ? <CheckCircle2 className="h-4 w-4"/> : <Icon className="h-4 w-4"/>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-mono text-[9px] text-slate-500">{String(step.seq).padStart(2,"0")}</span><span className="break-words text-xs font-semibold text-slate-100">{step.rightTitle || step.leftTitle || `步骤 ${index+1}`}</span><span className={`text-[9px] ${step.status==="failed" ? "text-rose-300" : step.status==="running" ? "text-cyan-200" : step.status==="done" || step.status==="passed" ? "text-emerald-300" : "text-slate-500"}`}>{state.label}</span></span>
                    <span className="mt-1 block break-words text-[11px] leading-4 text-slate-400">{step.rightSubtitle || step.leftSummary || info.verb}</span>
                    <span className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-slate-500"><span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>{durationText(step.durationMs)}</span><span>{info.label}</span>{tokenText(step.rightDetail) && <span className="font-mono text-cyan-300/80">{tokenText(step.rightDetail)} tokens</span>}</span>
                  </span>
                  <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition ${active ? "-rotate-90 text-cyan-200" : "-rotate-90 opacity-40"}`}/>
                </button>;
              })}
            </div>
            <div className="mt-3 flex items-center gap-2 px-1 text-[9px] text-slate-500"><span className="h-px flex-1 bg-slate-700/70"/><span>{currentIndex >= 0 ? `当前运行到第 ${currentIndex + 1} 步` : isThinking ? "等待下一条执行事件" : "已展示本轮全部已记录步骤"}</span><span className="h-px flex-1 bg-slate-700/70"/></div>
          </div>

          <div className="min-w-0">
            <div className="mb-3 px-1"><div className="text-[10px] font-bold tracking-[.18em] text-slate-500">STEP FOCUS</div><div className="mt-0.5 text-sm font-semibold text-white">当前步骤详情</div></div>
            {selected ? <div className="journey-glow overflow-hidden rounded-2xl border border-blue-400/30 bg-slate-900/65">
              <div className="relative overflow-hidden border-b border-slate-700/70 px-4 py-4">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/80 to-transparent"/>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><SelectedIcon className="h-5 w-5"/></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-[9px] font-bold tracking-[.18em] text-cyan-300">STEP {String(selected.seq).padStart(2,"0")}</span><span className={`rounded-full border px-2 py-0.5 text-[9px] ${selectedStatus.color==="emerald" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : selectedStatus.color==="rose" ? "border-rose-400/25 bg-rose-400/10 text-rose-200" : selectedStatus.color==="cyan" ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-200" : "border-slate-600 bg-slate-800 text-slate-300"}`}>{selectedStatus.label}</span></div>
                    <h3 className="mt-1 break-words text-base font-semibold text-white">{selected.rightTitle || selected.leftTitle}</h3>
                    <p className="mt-1 break-words text-xs leading-5 text-slate-400">{selected.rightSubtitle || selected.leftSummary || meta.verb}</p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-700/70 bg-slate-950/45 px-3 py-2"><div className="text-[9px] text-slate-500">执行耗时</div><div className="mt-1 text-xs font-semibold text-slate-100">{durationText(selected.durationMs)}</div></div>
                  <div className="rounded-lg border border-slate-700/70 bg-slate-950/45 px-3 py-2"><div className="text-[9px] text-slate-500">Token 使用</div><div className="mt-1 text-xs font-semibold text-slate-100">{tokenText(detail) ?? "未上报"}</div></div>
                </div>
              </div>
              <div className="journey-scroll max-h-[42vh] space-y-3 overflow-y-auto p-3.5">
                {why !== undefined && <div><div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-violet-200"><Sparkles className="h-3 w-3"/>决策依据（事件有提供时显示）</div><div className="rounded-lg border border-violet-400/20 bg-violet-400/5 p-3 text-xs leading-5 text-slate-300">{pretty(why)}</div></div>}
                {input !== undefined && <div><div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-cyan-200"><Terminal className="h-3 w-3"/>实际输入</div><pre className="journey-code max-h-44 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 text-[10px] leading-5">{pretty(input)}</pre></div>}
                {output !== undefined && <div><div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-200"><Eye className="h-3 w-3"/>实际返回</div><pre className="journey-code max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 text-[10px] leading-5">{pretty(output)}</pre></div>}
                {input === undefined && output === undefined && why === undefined && <div className="rounded-lg border border-dashed border-slate-700 p-3 text-xs leading-5 text-slate-400">当前事件没有单独提供输入、返回或决策依据。不会用推测内容补齐；可在下方查看原始事件数据。</div>}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-[10px] font-semibold text-slate-400">事件原始数据</span><button type="button" onClick={() => void copySelected()} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white"><Copy className="h-3 w-3"/>{copied ? "已复制" : "复制"}</button></div>
                  <pre className="journey-code max-h-52 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 text-[9px] leading-4">{pretty(detail)}</pre>
                </div>
                {selected.status === "failed" && onRetryRun && !isThinking && <button type="button" onClick={onRetryRun} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-400/15"><RotateCcw className="h-3.5 w-3.5"/>重新运行整个任务</button>}
              </div>
            </div> : <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-700 text-xs text-slate-500">选择左侧任意一步查看详情</div>}
          </div>
        </div>
      )}
      <div className="relative flex items-center justify-between gap-3 border-t border-slate-700/50 px-4 py-2.5 text-[9px] text-slate-500"><span>仅展示已接收到的执行事件；未上报的数据保持未知。</span><span className="shrink-0 font-mono tracking-wider">OWNAGENT / OBSERVER</span></div>
      {failures > 0 && <p className="relative px-4 pb-3 text-[10px] leading-4 text-slate-500">重新运行会重新提交整轮任务；如果步骤可能产生外部副作用，请先确认不会重复执行。</p>}
    </section>
  );
};
