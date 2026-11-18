import React, { useMemo, useState } from "react";
import {
  Activity, CheckCircle2, Clock3, Copy, Loader2, RotateCcw,
  XCircle, ChevronDown, Zap, Cpu, Wrench, Database, Search,
  AlertTriangle, Radio, GitBranch
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
  done: { label: "已完成", tone: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  passed: { label: "已通过", tone: "text-emerald-700 bg-emerald-50", dot: "bg-emerald-500" },
  running: { label: "执行中", tone: "text-blue-700 bg-blue-50", dot: "bg-blue-500 animate-pulse" },
  failed: { label: "失败", tone: "text-rose-700 bg-rose-50", dot: "bg-rose-500" },
  pending: { label: "等待中", tone: "text-slate-500 bg-slate-100", dot: "bg-slate-400" },
  unknown: { label: "状态未知", tone: "text-amber-700 bg-amber-50", dot: "bg-amber-500" },
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
  const select = (step: AgentStep) => {
    setSelectedId(step.stepId === selected?.stepId ? null : step.stepId);
    onSelectStep?.(step.stepId);
  };
  const copySelected = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(JSON.stringify(selected.rightDetail || {}, null, 2)); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch {}
  };

  return (
    <section className="mc-shell space-y-5 text-slate-800">
      <style>{`
        .mc-shell{--mc-line:#e8edf4;--mc-muted:#7b8798;color:#1e293b}
        .mc-summary{background:linear-gradient(135deg,#fff 0%,#f8faff 100%);border:1px solid #e8edf4;box-shadow:0 2px 8px rgba(15,23,42,.025)}
        .mc-event{transition:background .16s ease,border-color .16s ease,box-shadow .16s ease}
        .mc-event:hover{background:#fafbff;border-color:#cbd5e1}
        .mc-event-active{background:#f5f8ff!important;border-color:#a5b4fc!important;box-shadow:0 0 0 2px rgba(99,102,241,.07)}
        .mc-rail{background:linear-gradient(180deg,#c7d2fe 0%,#e2e8f0 80%,transparent 100%)}
        .mc-detail{animation:mc-detail-in .18s ease-out}
        @keyframes mc-detail-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .mc-json{background:#f8fafc;border:1px solid #e8edf4}
        @media(prefers-reduced-motion:reduce){.mc-event,.mc-detail{animation:none;transition:none}}
      `}</style>

      <div className="mc-summary rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-semibold tracking-[.16em] text-indigo-600">
              <Radio className="h-3.5 w-3.5" /> RUN OBSERVATORY
            </div>
            <h2 className="mt-1.5 text-base font-semibold tracking-tight text-slate-900">执行时间线</h2>
            <p className="mt-1 max-w-2xl truncate text-xs text-slate-500">{message?.userPrompt || "Agent execution trace"} <span className="mx-1 text-slate-300">·</span> {ordered.length} 条真实事件</p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[10px] font-medium ${isThinking ? "bg-blue-50 text-blue-700" : failures ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${isThinking ? "animate-pulse bg-blue-500" : failures ? "bg-rose-500" : "bg-emerald-500"}`} />
            {isThinking ? "实时执行中" : failures ? "存在异常" : "记录完成"}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Metric icon={<Activity className="h-3.5 w-3.5"/>} label="事件总数" value={String(ordered.length)} />
          <Metric icon={<CheckCircle2 className="h-3.5 w-3.5"/>} label="已完成" value={String(completed)} />
          <Metric icon={<Zap className="h-3.5 w-3.5"/>} label="已知 Tokens" value={tokenCount ? knownTokens.toLocaleString() : "—"} />
          <Metric icon={<AlertTriangle className="h-3.5 w-3.5"/>} label="失败事件" value={String(failures)} danger={failures > 0} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">执行过程</h3>
          <p className="mt-0.5 text-[11px] text-slate-400">按事件发生顺序排列，选择步骤查看完整数据</p>
        </div>
        <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100/80 p-1">
          {([{id:"all",label:"全部"},{id:"llm",label:"模型"},{id:"tools",label:"工具"},{id:"errors",label:"异常"}] as const).map(item => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${filter===item.id ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>{item.label}</button>
          ))}
        </div>
      </div>

      {ordered.length === 0 ? (
        <div className="mc-summary flex min-h-56 flex-col items-center justify-center rounded-2xl px-6 py-10 text-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">{isThinking ? <Loader2 className="h-5 w-5 animate-spin"/> : <Activity className="h-5 w-5"/>}</div>
          <h3 className="text-sm font-semibold text-slate-800">{isThinking ? "正在等待 Agent 信号" : "暂无执行事件"}</h3>
          <p className="mt-1.5 max-w-sm text-xs leading-5 text-slate-500">这里只展示后端或 SDK 实际上报的事件。收到事件后，执行步骤会按顺序出现在这里。</p>
          {isThinking && <div className="mt-4 h-1 w-32 overflow-hidden rounded-full bg-slate-100"><div className="h-full w-1/2 animate-pulse rounded-full bg-indigo-400"/></div>}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1 text-[10px] text-slate-400">
            <span>EVENT STREAM</span>
            <span>{filtered.length} / {ordered.length} 条</span>
          </div>
          {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">当前筛选条件下没有事件</div> : (
            <div className="relative space-y-2">
              <div className="mc-rail absolute bottom-7 left-[17px] top-7 w-px"/>
              {filtered.map((step,index) => {
                const meta = statusMeta[step.status] || statusMeta.unknown;
                const Icon = phaseIcon(step.phase);
                const isActive = selected?.stepId === step.stepId;
                const detail = step.rightDetail || {};
                const tokens = tokenText(detail);
                return (
                  <div key={step.stepId} className="relative">
                    <button type="button" onClick={() => select(step)} className={`mc-event relative flex w-full min-w-0 items-start gap-3 rounded-xl border px-3.5 py-3 text-left ${isActive ? "mc-event-active border-indigo-200" : "border-transparent bg-white hover:border-slate-200"}`}>
                      <span className={`relative z-[1] mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${step.status==="running" ? "bg-blue-50 text-blue-600" : step.status==="failed" ? "bg-rose-50 text-rose-600" : step.status==="done" || step.status==="passed" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
                        {step.status==="running" ? <Loader2 className="h-4 w-4 animate-spin"/> : step.status==="failed" ? <XCircle className="h-4 w-4"/> : step.status==="done" || step.status==="passed" ? <CheckCircle2 className="h-4 w-4"/> : <Icon className="h-4 w-4"/>}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-[10px] text-slate-400">#{String(step.seq).padStart(2,"0")}</span>
                          <span className="break-words text-[13px] font-semibold text-slate-800">{step.rightTitle || step.leftTitle || `执行步骤 ${index+1}`}</span>
                          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${meta.tone}`}>{meta.label}</span>
                        </span>
                        {(step.rightSubtitle || step.leftSummary) && <span className="mt-1 block break-words text-xs leading-5 text-slate-500">{step.rightSubtitle || step.leftSummary}</span>}
                        <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3"/>{durationText(step.durationMs)}</span>
                          {tokens && <span className="font-mono text-indigo-600">{tokens} tokens</span>}
                          <span>{phaseLabel[step.phase] || step.phase}</span>
                          {typeof detail.parentSpanId === "string" && <span className="inline-flex items-center gap-1"><GitBranch className="h-3 w-3"/>父级 Span</span>}
                        </span>
                      </span>
                      <ChevronDown className={`mt-2 h-4 w-4 shrink-0 text-slate-400 transition-transform ${isActive ? "rotate-180 text-indigo-600" : ""}`}/>
                    </button>
                    {isActive && (
                      <div className="mc-detail ml-11 mt-1 rounded-xl border border-indigo-100 bg-[#fbfcff] p-3.5 sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[10px] font-semibold tracking-wider text-indigo-600">STEP DETAILS</div>
                            <div className="mt-0.5 text-sm font-semibold text-slate-800">{step.rightTitle || step.leftTitle}</div>
                          </div>
                          <span className={`rounded-md px-2 py-1 text-[10px] font-medium ${meta.tone}`}>{meta.label}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <DetailMetric label="执行耗时" value={durationText(step.durationMs)}/>
                          <DetailMetric label="Tokens" value={tokens ?? "未上报"}/>
                          <DetailMetric label="事件阶段" value={phaseLabel[step.phase] || step.phase}/>
                        </div>
                        {step.rightSubtitle && <p className="mt-3 text-xs leading-5 text-slate-600">{step.rightSubtitle}</p>}
                        <div className="mt-3">
                          <div className="mb-1.5 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-semibold tracking-wider text-slate-500">原始事件数据</span>
                            <button type="button" onClick={() => void copySelected()} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 hover:text-indigo-700"><Copy className="h-3 w-3"/>{copied ? "已复制" : "复制 JSON"}</button>
                          </div>
                          <pre className="mc-json max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg p-3 font-mono text-[10px] leading-5 text-slate-600">{JSON.stringify(step.rightDetail || {}, null, 2)}</pre>
                        </div>
                        {step.status === "failed" && onRetryRun && !isThinking && (
                          <button type="button" onClick={onRetryRun} className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"><RotateCcw className="h-3.5 w-3.5"/>重新运行整个任务</button>
                        )}
                        {typeof step.rightDetail?.parentSpanId === "string" && <p className="mt-2 text-[10px] text-slate-400">Parent Span: <code className="text-slate-600">{step.rightDetail.parentSpanId}</code></p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {failures > 0 && <p className="px-1 text-[10px] leading-5 text-slate-400">重试会重新提交整轮任务，而不是重放单个步骤。单步重试需由执行端确认幂等性和副作用边界，避免重复执行外部操作。</p>}
    </section>
  );
};

const Metric: React.FC<{icon: React.ReactNode;label:string;value:string;danger?:boolean}> = ({icon,label,value,danger}) => (
  <div className="min-w-0">
    <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">{icon}{label}</div>
    <div className={`mt-1 font-mono text-lg font-semibold tracking-tight ${danger ? "text-rose-600" : "text-slate-800"}`}>{value}</div>
  </div>
);
const DetailMetric: React.FC<{label:string;value:string}> = ({label,value}) => (
  <div className="rounded-lg border border-slate-200/80 bg-white px-3 py-2.5">
    <div className="text-[9px] font-semibold tracking-wider text-slate-400">{label}</div>
    <div className="mt-1 break-words font-mono text-xs font-medium text-slate-700">{value}</div>
  </div>
);
