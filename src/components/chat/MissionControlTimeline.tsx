import React, { useMemo, useState } from "react";
import {
  Activity, CheckCircle2, Clock3, Copy, Loader2, RotateCcw, XCircle,
  ChevronDown, BrainCircuit, Wrench, Database, Search, AlertTriangle,
  GitBranch, Eye, Sparkles, Terminal, FileOutput
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
const phaseMeta: Record<string, { label: string; verb: string; icon: React.ComponentType<{className?: string}> }> = {
  intent: { label: "理解任务", verb: "正在理解目标", icon: Search },
  workflow: { label: "规划步骤", verb: "正在安排执行顺序", icon: GitBranch },
  context: { label: "读取上下文", verb: "正在获取所需资料", icon: Database },
  llm: { label: "模型判断", verb: "正在分析并决定下一步", icon: BrainCircuit },
  skill: { label: "执行操作", verb: "正在调用工具", icon: Wrench },
  delivery: { label: "整理结果", verb: "正在组织输出", icon: FileOutput },
  closure: { label: "完成任务", verb: "正在结束本轮任务", icon: CheckCircle2 },
  degraded: { label: "处理异常", verb: "执行过程中遇到问题", icon: AlertTriangle },
  external: { label: "执行事件", verb: "收到一条执行事件", icon: Activity },
};
const statusMeta: Record<string, { label: string; tone: string }> = {
  done: { label: "已完成", tone: "emerald" },
  passed: { label: "已通过", tone: "emerald" },
  running: { label: "执行中", tone: "blue" },
  failed: { label: "失败", tone: "rose" },
  pending: { label: "等待中", tone: "slate" },
  unknown: { label: "状态未知", tone: "amber" },
};
const durationText = (ms?: number) => typeof ms !== "number" || !Number.isFinite(ms) || ms < 0 ? "未记录" : ms >= 1000 ? `${(ms / 1000).toFixed(2)} 秒` : `${Math.round(ms)} 毫秒`;
const tokenText = (detail?: Record<string, any>) => {
  const usage = detail?.usage ?? detail?.tokenUsage ?? detail?.token_usage
    ?? detail?.response?.usage ?? detail?.metadata?.usage;
  const total = detail?.totalTokens ?? detail?.total_tokens ?? usage?.totalTokens ?? usage?.total_tokens;
  const input = detail?.inputTokens ?? detail?.input_tokens ?? detail?.promptTokens ?? detail?.prompt_tokens
    ?? usage?.inputTokens ?? usage?.input_tokens ?? usage?.promptTokens ?? usage?.prompt_tokens;
  const output = detail?.outputTokens ?? detail?.output_tokens ?? detail?.completionTokens ?? detail?.completion_tokens
    ?? usage?.outputTokens ?? usage?.output_tokens ?? usage?.completionTokens ?? usage?.completion_tokens;
  if (typeof total === "number" && Number.isFinite(total)) return total.toLocaleString();
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
  const [showRaw, setShowRaw] = useState(false);

  const ordered = useMemo(() => [...(timeline || [])].sort((a, b) => a.seq - b.seq || a.timestamp - b.timestamp), [timeline]);
  const selected = ordered.find(s => s.stepId === (activeStepId || selectedId)) || ordered.find(s => s.status === "running") || ordered[ordered.length - 1];
  const filtered = ordered.filter(s => filter === "all" || (filter === "llm" && s.phase === "llm") || (filter === "tools" && s.phase === "skill") || (filter === "errors" && s.status === "failed"));
  const failures = ordered.filter(s => s.status === "failed").length;
  const completed = ordered.filter(s => s.status === "done" || s.status === "passed").length;
  const runningCount = ordered.filter(s => s.status === "running").length;
  const pendingCount = ordered.filter(s => s.status === "pending").length;
  const unknownCount = ordered.filter(s => s.status === "unknown").length;
  const currentStep = ordered.find(s => s.status === "running");
  const recordedCompletion = ordered.length ? completed / ordered.length : 0;
  const runState = isThinking || runningCount > 0
    ? { label: "正在执行", tone: "blue" }
    : pendingCount > 0 ? { label: "仍有步骤等待", tone: "slate" }
    : unknownCount > 0 ? { label: "部分状态未知", tone: "amber" }
    : failures > 0 ? { label: "存在失败步骤", tone: "rose" }
    : ordered.length > 0 && completed === ordered.length ? { label: "已记录步骤完成", tone: "emerald" }
    : { label: "等待执行事件", tone: "slate" };

  const select = (step: AgentStep) => {
    setSelectedId(step.stepId);
    setShowRaw(false);
    onSelectStep?.(step.stepId);
  };
  const detail = selected?.rightDetail || {};
  const input = pick(detail, ["arguments", "args", "input", "parameters", "request", "tool_input", "toolArguments", "tool_arguments", "prompt"]);
  const output = pick(detail, ["result", "output", "response", "content", "tool_output", "toolResult", "tool_result"]);
  const why = pick(detail, ["reason", "why", "rationale", "decision", "decision_summary", "decisionSummary", "reasoning_summary", "reasoningSummary"]);
  const error = pick(detail, ["error", "errorMessage", "error_message", "exception"]);
  const meta = selected ? (phaseMeta[selected.phase] || phaseMeta.external) : phaseMeta.external;
  const SelectedIcon = meta.icon;
  const selectedDescription = selected
    ? selected.rightSubtitle || selected.leftSummary || (selected.status === "running" ? meta.verb : selected.status === "done" || selected.status === "passed" ? "该步骤已完成，未提供更多说明" : selected.status === "failed" ? "该步骤失败，展开查看已上报的错误信息" : selected.status === "pending" ? "该步骤正在等待执行" : "执行端未提供这一步的具体说明")
    : "";
  const selectedStatus = selected ? (statusMeta[selected.status] || statusMeta.unknown) : statusMeta.unknown;
  const tokenEvents = ordered.filter(step => tokenText(step.rightDetail) !== null).length;

  const copySelected = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(selected.rightDetail || {}, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const toneClass = (tone: string) => ({
    emerald: "text-emerald-700 bg-emerald-50 border-emerald-200",
    blue: "text-blue-700 bg-blue-50 border-blue-200",
    rose: "text-rose-700 bg-rose-50 border-rose-200",
    amber: "text-amber-700 bg-amber-50 border-amber-200",
    slate: "text-slate-600 bg-slate-50 border-slate-200",
  }[tone] || "text-slate-600 bg-slate-50 border-slate-200");

  return (
    <section className="journey-shell relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm">
      <style>{`
        .journey-shell{background:linear-gradient(145deg,#fff 0%,#fbfcff 58%,#f7f9ff 100%);box-shadow:0 8px 28px rgba(37,55,99,.06)}
        .journey-shell:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(99,102,241,.10) .8px,transparent .8px);background-size:18px 18px;mask-image:linear-gradient(120deg,rgba(0,0,0,.48),transparent 70%);pointer-events:none}
        .journey-shell .journey-step{transition:background .18s ease,border-color .18s ease,box-shadow .18s ease}
        .journey-shell .journey-step:hover{background:#f8faff}
        .journey-shell .journey-step-active{background:linear-gradient(100deg,#eef2ff,#f8faff);border-color:#a5b4fc;box-shadow:0 0 0 2px rgba(99,102,241,.07)}
        .journey-shell .journey-line{background:linear-gradient(180deg,#a5b4fc,#c7d2fe 75%,transparent)}
        .journey-shell .journey-code{background:#f8fafc;border:1px solid #e2e8f0;color:#334155}
        .journey-shell .journey-activity{animation:journeyActivity 1.8s ease-in-out infinite}
        @keyframes journeyActivity{0%,100%{box-shadow:0 0 0 0 rgba(79,70,229,.18)}50%{box-shadow:0 0 0 6px rgba(79,70,229,0)}}
        .journey-shell .journey-scroll{scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}
        .journey-shell .journey-scroll::-webkit-scrollbar{width:4px}.journey-shell .journey-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:8px}
        @media(prefers-reduced-motion:reduce){.journey-shell *{animation:none!important;transition:none!important}}
      `}</style>

      <div className="relative border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600"><Activity className="h-4 w-4"/></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2"><h2 className="text-sm font-bold tracking-tight text-slate-900">Agent 执行过程</h2><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${toneClass(runState.tone)}`}>{runState.label}</span></div>
              <p className="mt-0.5 truncate text-[11px] text-slate-500">{message?.userPrompt || "实时记录 Agent 的判断、工具调用与执行结果"}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3 text-[10px] text-slate-500">
            <span><b className="font-mono text-slate-800">{completed}/{ordered.length}</b> 已完成</span>
            <span><b className="font-mono text-slate-800">{tokenEvents || "—"}</b> Token 上报</span>
            <span className={failures ? "font-semibold text-rose-600" : ""}><b className="font-mono">{failures}</b> 异常</span>
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 transition-all duration-500" style={{width:`${recordedCompletion*100}%`}}/>
        </div>
        <div className="mt-1 flex justify-between text-[9px] text-slate-400"><span>{ordered.length} 条已接收事件</span><span>完成比例仅基于已记录事件</span></div>
      </div>

      {ordered.length === 0 ? (
        <div className="relative flex min-h-56 flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-500"><Activity className="h-6 w-6"/></div>
          <h3 className="text-sm font-semibold text-slate-800">{isThinking ? "正在等待 Agent 的第一条执行信号" : "这次运行还没有可展示的执行事件"}</h3>
          <p className="mt-1.5 max-w-sm text-xs leading-5 text-slate-500">这里只展示 Agent 或执行端实际上报的步骤。收到真实事件后，执行路径会从这里逐步展开。</p>
        </div>
      ) : (
        <div className="relative px-3 py-3 sm:px-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"><GitBranch className="h-3.5 w-3.5 text-indigo-500"/>执行路径</div>
            <div className="flex gap-1">
              {([{id:"all",label:"全部"},{id:"llm",label:"判断"},{id:"tools",label:"操作"},{id:"errors",label:"异常"}] as const).map(item => <button key={item.id} type="button" onClick={()=>setFilter(item.id)} className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition ${filter===item.id ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-500 hover:border-indigo-200 hover:text-indigo-700"}`}>{item.label}</button>)}
            </div>
          </div>

          <div className="relative space-y-1">
            <div className="journey-line absolute bottom-4 left-[15px] top-4 w-px"/>
            {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 p-5 text-center text-xs text-slate-500">没有符合筛选条件的步骤</div> : filtered.map((step,index)=>{
              const info=phaseMeta[step.phase]||phaseMeta.external;
              const Icon=info.icon;
              const active=selected?.stepId===step.stepId;
              const state=statusMeta[step.status]||statusMeta.unknown;
              const stateTone=step.status==="failed"?"text-rose-600":step.status==="running"?"text-indigo-600":step.status==="done"||step.status==="passed"?"text-emerald-600":"text-slate-500";
              return <button key={step.stepId} type="button" onClick={()=>select(step)} className={`journey-step relative flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left ${active?"journey-step-active border-indigo-200":"border-transparent"}`}>
                <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white ${step.status==="running"?"journey-activity border-indigo-300 text-indigo-600":step.status==="failed"?"border-rose-200 text-rose-600":step.status==="done"||step.status==="passed"?"border-emerald-200 text-emerald-600":"border-slate-200 text-slate-400"}`}>
                  {step.status==="running"?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:step.status==="failed"?<XCircle className="h-3.5 w-3.5"/>:step.status==="done"||step.status==="passed"?<CheckCircle2 className="h-3.5 w-3.5"/>:<Icon className="h-3.5 w-3.5"/>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="font-mono text-[9px] text-slate-400">{String(step.seq).padStart(2,"0")}</span><span className="text-xs font-semibold text-slate-800">{step.rightTitle||step.leftTitle||`步骤 ${index+1}`}</span><span className={`text-[9px] font-medium ${stateTone}`}>{state.label}</span></span>
                  <span className="mt-0.5 block truncate text-[10px] leading-4 text-slate-500">{step.rightSubtitle||step.leftSummary||(step.status==="running"?info.verb:step.status==="done"||step.status==="passed"?"该步骤已完成，未提供更多说明":step.status==="failed"?"该步骤失败，展开查看错误信息":step.status==="pending"?"该步骤正在等待执行":"执行端未提供具体说明")}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[9px] text-slate-400"><span>{durationText(step.durationMs)}</span>{tokenText(step.rightDetail)&&<span className="font-mono text-indigo-500">{tokenText(step.rightDetail)} tok</span>}<ChevronDown className={`h-3 w-3 transition ${active?"rotate-180 text-indigo-500":"text-slate-300"}`}/></span>
              </button>;
            })}
          </div>

          {selected && (
            <div className="mt-3 overflow-hidden rounded-xl border border-indigo-100 bg-white shadow-[0_3px_14px_rgba(79,70,229,.05)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-gradient-to-r from-indigo-50/70 to-white px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"><SelectedIcon className="h-3.5 w-3.5"/></span>
                  <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="text-[9px] font-bold tracking-wider text-indigo-600">STEP {String(selected.seq).padStart(2,"0")}</span><span className={`rounded-full border px-1.5 py-0.5 text-[9px] ${toneClass(selectedStatus.tone)}`}>{selectedStatus.label}</span></div><div className="truncate text-xs font-semibold text-slate-800">{selected.rightTitle||selected.leftTitle}</div></div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-500"><span><Clock3 className="mr-1 inline h-3 w-3"/>{durationText(selected.durationMs)}</span><span>Token：<b className="font-mono text-slate-700">{tokenText(detail)??"未上报"}</b></span></div>
              </div>
              <div className="px-3 py-2.5">
                <p className="mb-2 text-[11px] leading-4 text-slate-600">{selectedDescription}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {why!==undefined&&<div className="min-w-0 rounded-lg border border-violet-100 bg-violet-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-violet-700"><Sparkles className="h-3 w-3"/>决策依据</div><div className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-600">{pretty(why)}</div></div>}
                  {error!==undefined&&<div className="min-w-0 rounded-lg border border-rose-100 bg-rose-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-rose-700"><AlertTriangle className="h-3 w-3"/>错误信息</div><div className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-rose-700">{pretty(error)}</div></div>}
                  {input!==undefined&&<div className="min-w-0 rounded-lg border border-sky-100 bg-sky-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-sky-700"><Terminal className="h-3 w-3"/>实际输入</div><pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(input)}</pre></div>}
                  {output!==undefined&&<div className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Eye className="h-3 w-3"/>实际返回</div><pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(output)}</pre></div>}
                </div>
                {input===undefined&&output===undefined&&why===undefined&&error===undefined&&<div className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-[10px] leading-4 text-slate-500">该事件没有单独提供输入、返回或决策依据。不会用推测内容补齐。</div>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={()=>setShowRaw(v=>!v)} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-indigo-600"><ChevronDown className={`h-3 w-3 transition ${showRaw?"rotate-180":""}`}/>{showRaw?"收起原始事件":"查看原始事件数据"}</button>
                  <button type="button" onClick={()=>void copySelected()} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:border-indigo-200 hover:text-indigo-600"><Copy className="h-3 w-3"/>{copied?"已复制":"复制数据"}</button>
                  {selected.status==="failed"&&onRetryRun&&!isThinking&&<button type="button" onClick={onRetryRun} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"><RotateCcw className="h-3 w-3"/>重新运行</button>}
                </div>
                {showRaw&&<pre className="journey-code mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg p-2 text-[9px] leading-4">{pretty(detail)}</pre>}
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[9px] text-slate-400"><span>{currentStep? `当前执行：第 ${currentStep.seq} 步`:pendingCount>0?`${pendingCount} 步等待执行`:unknownCount>0?`${unknownCount} 步状态未知`:isThinking?"等待下一条事件":"已展示当前收到的全部事件"}</span><span>仅展示实际上报的数据</span></div>
        </div>
      )}
    </section>
  );
};
