import React, { useMemo, useState } from "react";
import {
  Activity, CheckCircle2, Circle, Clock3, Copy, Loader2, RotateCcw,
  XCircle, ChevronRight, Zap, Cpu, Wrench, Database, Search,
  AlertTriangle, Radio, TerminalSquare, Filter, Eye, GitBranch
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
const phaseLabel: Record<string, string> = {
  intent: "任务理解", workflow: "工作流", context: "上下文", llm: "模型推理",
  skill: "工具执行", delivery: "结果交付", closure: "结束", degraded: "异常处理", external: "外部事件"
};
const phaseIcon = (phase: string) => {
  if (phase === "llm") return Cpu;
  if (phase === "skill") return Wrench;
  if (phase === "context") return Database;
  if (phase === "degraded") return AlertTriangle;
  if (phase === "intent") return Search;
  return Activity;
};
const statusMeta: Record<string, { label: string; tone: string; dot: string }> = {
  done: { label: "已完成", tone: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", dot: "bg-emerald-300" },
  passed: { label: "已通过", tone: "text-emerald-300 border-emerald-400/30 bg-emerald-400/10", dot: "bg-emerald-300" },
  running: { label: "执行中", tone: "text-cyan-200 border-cyan-300/40 bg-cyan-300/10", dot: "bg-cyan-300 animate-pulse" },
  failed: { label: "失败", tone: "text-rose-300 border-rose-400/40 bg-rose-400/10", dot: "bg-rose-400" },
  pending: { label: "等待中", tone: "text-slate-400 border-slate-500/30 bg-slate-500/10", dot: "bg-slate-500" },
  unknown: { label: "状态未知", tone: "text-amber-200 border-amber-300/30 bg-amber-300/10", dot: "bg-amber-300" },
};
const durationText = (ms?: number) => typeof ms !== "number" || !Number.isFinite(ms) || ms < 0 ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
const tokenText = (detail?: Record<string, any>) => {
  const total = detail?.totalTokens ?? detail?.total_tokens;
  const input = detail?.inputTokens ?? detail?.input_tokens;
  const output = detail?.outputTokens ?? detail?.output_tokens;
  if (typeof total === "number") return total.toLocaleString();
  if (typeof input === "number" || typeof output === "number") return `${typeof input === "number" ? input.toLocaleString() : "—"} / ${typeof output === "number" ? output.toLocaleString() : "—"}`;
  return null;
};

export const MissionControlTimeline: React.FC<Props> = ({
  timeline, message, activeStepId, onSelectStep, isThinking, onRetryRun
}) => {
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(activeStepId ?? null);
  const [copied, setCopied] = useState(false);

  const ordered = useMemo(() => [...(timeline || [])].sort((a,b) => a.seq - b.seq || a.timestamp - b.timestamp), [timeline]);
  const selected = ordered.find(s => s.stepId === (activeStepId || selectedId)) || ordered.find(s => s.status === "running") || ordered[ordered.length - 1];
  const filtered = ordered.filter(s => filter === "all" || (filter === "llm" && s.phase === "llm") || (filter === "tools" && s.phase === "skill") || (filter === "errors" && s.status === "failed"));
  const failures = ordered.filter(s => s.status === "failed").length;
  const knownTokens = ordered.reduce((sum,s) => {
    const n = s.rightDetail?.totalTokens ?? s.rightDetail?.total_tokens;
    return sum + (typeof n === "number" ? n : 0);
  }, 0);
  const tokenCount = ordered.filter(s => typeof (s.rightDetail?.totalTokens ?? s.rightDetail?.total_tokens) === "number").length;
  const completed = ordered.filter(s => s.status === "done" || s.status === "passed").length;
  const select = (step: AgentStep) => { setSelectedId(step.stepId); onSelectStep?.(step.stepId); };
  const copySelected = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(JSON.stringify(selected.rightDetail || {}, null, 2)); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch {}
  };

  return (
    <section className="mc-shell space-y-4 text-slate-100">
      <style>{`
        .mc-shell{color:#e5f1ff}
        .mc-grid{background-image:linear-gradient(rgba(100,160,210,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(100,160,210,.045) 1px,transparent 1px);background-size:28px 28px}
        .mc-glass{background:linear-gradient(145deg,rgba(17,39,68,.86),rgba(8,21,41,.9));border:1px solid rgba(112,169,218,.19);box-shadow:inset 0 1px rgba(255,255,255,.035),0 16px 44px rgba(0,0,0,.16);backdrop-filter:blur(14px)}
        .mc-node{transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}
        .mc-node:hover{transform:translateY(-1px);border-color:rgba(104,220,245,.48);box-shadow:0 0 24px rgba(56,189,248,.09)}
        .mc-node-active{border-color:rgba(104,220,245,.72)!important;box-shadow:0 0 0 1px rgba(104,220,245,.16),0 0 30px rgba(56,189,248,.13)!important;background:linear-gradient(130deg,rgba(22,70,96,.72),rgba(14,34,60,.92))!important}
        .mc-signal{background:linear-gradient(180deg,rgba(94,220,245,.85),rgba(129,112,245,.5),rgba(94,220,245,.08))}
        .mc-running{box-shadow:0 0 0 5px rgba(91,220,245,.08),0 0 22px rgba(91,220,245,.5)}
        .mc-scan{background:linear-gradient(90deg,transparent,rgba(90,213,245,.1),transparent);animation:mc-scan 4.8s ease-in-out infinite}
        @keyframes mc-scan{0%,100%{transform:translateX(-100%)}50%{transform:translateX(100%)}}
        @media(prefers-reduced-motion:reduce){.mc-node,.mc-scan{animation:none;transition:none}}
      `}</style>

      <div className="mc-glass mc-grid relative overflow-hidden rounded-2xl p-4 sm:p-5">
        <div className="mc-scan pointer-events-none absolute inset-y-0 left-0 w-1/3" />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.24em] text-cyan-200/80"><Radio className="h-3.5 w-3.5" /> MISSION CONTROL / RUN OBSERVATORY</div>
            <h2 className="mt-2 text-lg font-semibold tracking-wide text-white">任务执行观测舱</h2>
            <p className="mt-1 max-w-2xl truncate text-xs text-slate-400">{message?.userPrompt || "Agent execution trace"} <span className="mx-1 text-slate-600">/</span> {ordered.length} 个真实采集事件</p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-wider ${isThinking ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200" : failures ? "border-rose-300/30 bg-rose-300/10 text-rose-200" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isThinking ? "animate-pulse bg-cyan-300" : failures ? "bg-rose-300" : "bg-emerald-300"}`} />
            {isThinking ? "LIVE EXECUTION" : failures ? "RUN WITH ERRORS" : "TRACE CAPTURED"}
          </div>
        </div>
        <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric icon={<Activity className="h-3.5 w-3.5"/>} label="OBSERVED EVENTS" value={String(ordered.length).padStart(2,"0")} accent="text-cyan-200"/>
          <Metric icon={<CheckCircle2 className="h-3.5 w-3.5"/>} label="COMPLETED" value={String(completed).padStart(2,"0")} accent="text-emerald-200"/>
          <Metric icon={<Zap className="h-3.5 w-3.5"/>} label="KNOWN TOKENS" value={tokenCount ? knownTokens.toLocaleString() : "—"} accent="text-violet-200"/>
          <Metric icon={<AlertTriangle className="h-3.5 w-3.5"/>} label="FAILED EVENTS" value={String(failures).padStart(2,"0")} accent={failures ? "text-rose-200" : "text-slate-300"}/>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-slate-400"><GitBranch className="h-3.5 w-3.5 text-cyan-300"/> EXECUTION STREAM <span className="font-normal tracking-normal text-slate-500">/ 按真实事件顺序</span></div>
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-700/60 bg-slate-900/50 p-1">
          {([{id:"all",label:"全部"},{id:"llm",label:"模型"},{id:"tools",label:"工具"},{id:"errors",label:"异常"}] as const).map(item => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition ${filter===item.id ? "bg-cyan-300/15 text-cyan-100 shadow-[inset_0_0_0_1px_rgba(103,232,249,.22)]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}>{item.label}</button>
          ))}
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="mc-glass mc-grid flex min-h-64 flex-col items-center justify-center rounded-2xl px-6 py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/5 text-cyan-200">{isThinking ? <Loader2 className="h-6 w-6 animate-spin"/> : <Activity className="h-6 w-6"/>}</div>
          <h3 className="text-sm font-semibold text-slate-100">{isThinking ? "正在等待 Agent 信号" : "尚无执行事件"}</h3>
          <p className="mt-2 max-w-sm text-xs leading-5 text-slate-400">这里仅呈现后端或接入 SDK 实际上报的事件。收到事件后，执行链会在此展开；不会预生成步骤或虚构 Token。</p>
          {isThinking && <div className="mt-5 h-px w-40 overflow-hidden bg-slate-700"><div className="mc-scan h-full w-1/2 bg-cyan-300"/></div>}
        </div>
      ) : (
        <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div className="mc-glass mc-grid relative min-w-0 overflow-hidden rounded-2xl p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="text-[10px] font-semibold tracking-[.18em] text-slate-400">EVENT SEQUENCE <span className="ml-2 font-normal tracking-normal text-slate-500">{filtered.length} / {ordered.length}</span></div>
              {isThinking && <span className="flex items-center gap-1.5 text-[10px] text-cyan-200"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300"/>实时接收中</span>}
            </div>
            {filtered.length === 0 ? <div className="py-12 text-center text-xs text-slate-500">当前筛选条件下没有事件</div> : (
              <div className="relative space-y-2">
                <div className="mc-signal absolute bottom-5 left-[17px] top-5 w-px opacity-50"/>
                {filtered.map((step,index) => {
                  const meta = statusMeta[step.status] || statusMeta.unknown;
                  const Icon = phaseIcon(step.phase);
                  const isActive = selected?.stepId === step.stepId;
                  const detail = step.rightDetail || {};
                  const tokens = tokenText(detail);
                  return (
                    <button key={step.stepId} type="button" onClick={() => select(step)} className={`mc-node relative flex w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-left ${isActive ? "mc-node-active" : "border-slate-700/60 bg-slate-950/35 hover:bg-slate-900/70"}`}>
                      <span className={`relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${step.status==="running" ? "mc-running border-cyan-200/50 bg-cyan-300/10 text-cyan-100" : step.status==="failed" ? "border-rose-300/40 bg-rose-300/10 text-rose-200" : step.status==="done" || step.status==="passed" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-slate-600 bg-slate-800/80 text-slate-400"}`}>
                        {step.status==="running" ? <Loader2 className="h-4 w-4 animate-spin"/> : step.status==="failed" ? <XCircle className="h-4 w-4"/> : step.status==="done" || step.status==="passed" ? <CheckCircle2 className="h-4 w-4"/> : <Icon className="h-4 w-4"/>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] tracking-wider text-slate-500">#{String(step.seq).padStart(2,"0")}</span>
                          <span className="break-words text-xs font-semibold text-slate-100">{step.rightTitle || step.leftTitle || `执行步骤 ${index+1}`}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] ${meta.tone}`}>{meta.label}</span>
                        </span>
                        {(step.rightSubtitle || step.leftSummary) && <span className="mt-1 block break-words text-[11px] leading-5 text-slate-400">{step.rightSubtitle || step.leftSummary}</span>}
                        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-500">
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>{durationText(step.durationMs)}</span>
                          {tokens && <span className="font-mono text-violet-200/80">{tokens} tokens</span>}
                          <span>{phaseLabel[step.phase] || step.phase}</span>
                          {typeof detail.parentSpanId === "string" && <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3"/>有父级 Span</span>}
                        </span>
                      </span>
                      <ChevronRight className={`mt-2 h-4 w-4 shrink-0 ${isActive ? "text-cyan-200" : "text-slate-600"}`}/>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <aside className="mc-glass min-w-0 overflow-hidden rounded-2xl">
            {selected ? (
              <>
                <div className="border-b border-slate-700/60 bg-slate-900/35 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[9px] font-bold tracking-[.2em] text-cyan-200/80"><Eye className="h-3.5 w-3.5"/> STEP INSPECTOR</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] ${(statusMeta[selected.status] || statusMeta.unknown).tone}`}>{(statusMeta[selected.status] || statusMeta.unknown).label}</span>
                  </div>
                  <h3 className="mt-3 break-words text-base font-semibold text-white">{selected.rightTitle || selected.leftTitle}</h3>
                  <p className="mt-1 text-[10px] text-slate-400">{phaseLabel[selected.phase] || selected.phase} · EVENT #{selected.seq}</p>
                </div>
                <div className="space-y-3 p-4">
                  <div className="grid grid-cols-2 gap-2">
                    <DetailMetric label="DURATION" value={durationText(selected.durationMs)}/>
                    <DetailMetric label="TOKENS" value={tokenText(selected.rightDetail) ?? "未上报"}/>
                  </div>
                  {selected.rightSubtitle && <div><div className="mb-1 text-[9px] font-bold tracking-widest text-slate-500">SUMMARY</div><p className="text-xs leading-5 text-slate-300">{selected.rightSubtitle}</p></div>}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[9px] font-bold tracking-widest text-slate-500">RAW EVENT PAYLOAD</span>
                      <button type="button" onClick={() => void copySelected()} className="inline-flex items-center gap-1 rounded-md border border-slate-600/70 px-2 py-1 text-[9px] text-slate-300 hover:border-cyan-300/40 hover:text-cyan-100"><Copy className="h-3 w-3"/>{copied ? "已复制" : "复制 JSON"}</button>
                    </div>
                    <pre className="max-h-[42vh] overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-700/70 bg-[#050d1a] p-3 font-mono text-[10px] leading-5 text-cyan-100/80">{JSON.stringify(selected.rightDetail || {}, null, 2)}</pre>
                  </div>
                  {selected.status === "failed" && onRetryRun && !isThinking && (
                    <button type="button" onClick={onRetryRun} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-300/30 bg-rose-300/10 px-3 py-2.5 text-xs font-semibold text-rose-100 hover:bg-rose-300/15"><RotateCcw className="h-3.5 w-3.5"/>重新运行整个任务</button>
                  )}
                  {typeof selected.rightDetail?.parentSpanId === "string" && <p className="text-[10px] text-slate-500">Parent Span: <code className="text-slate-300">{selected.rightDetail.parentSpanId}</code></p>}
                </div>
              </>
            ) : <div className="p-6 text-center text-xs text-slate-500">选择一个事件查看详情</div>}
          </aside>
        </div>
      )}
      {failures > 0 && <p className="px-1 text-[10px] leading-5 text-slate-500">重试按钮会重新提交整轮任务，而不是重放单个步骤。单步重试需由执行端确认幂等性和副作用边界，避免重复执行外部操作。</p>}
    </section>
  );
};

const Metric: React.FC<{icon: React.ReactNode;label:string;value:string;accent:string}> = ({icon,label,value,accent}) => (
  <div className="rounded-xl border border-slate-700/60 bg-slate-950/35 px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider text-slate-500">{icon}{label}</div>
    <div className={`mt-1 font-mono text-lg font-semibold tracking-tight ${accent}`}>{value}</div>
  </div>
);
const DetailMetric: React.FC<{label:string;value:string}> = ({label,value}) => (
  <div className="rounded-xl border border-slate-700/60 bg-slate-950/40 p-3">
    <div className="text-[9px] font-bold tracking-widest text-slate-500">{label}</div>
    <div className="mt-1 break-words font-mono text-sm text-slate-100">{value}</div>
  </div>
);
