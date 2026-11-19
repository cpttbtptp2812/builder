import React, { useMemo, useState } from "react";
import { sortTimeline } from "@/lib/agentTimeline";
import {
  Activity, CheckCircle2, Clock3, Copy, Loader2, RotateCcw, XCircle,
  ChevronDown, BrainCircuit, Wrench, Database, Search, AlertTriangle,
  GitBranch, Eye, Sparkles, Terminal, FileOutput, CircleHelp
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
  done: { label: "完成", tone: "done" }, passed: { label: "通过", tone: "done" },
  running: { label: "进行中", tone: "running" }, failed: { label: "失败", tone: "failed" },
  pending: { label: "等待", tone: "waiting" }, unknown: { label: "未知", tone: "unknown" },
};
const durationText = (ms?: number) => typeof ms !== "number" || !Number.isFinite(ms) || ms < 0 ? "—" : ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
const tokenText = (detail?: Record<string, any>) => {
  const usage = detail?.usage ?? detail?.tokenUsage ?? detail?.token_usage ?? detail?.response?.usage ?? detail?.metadata?.usage;
  const total = detail?.totalTokens ?? detail?.total_tokens ?? usage?.totalTokens ?? usage?.total_tokens;
  const input = detail?.inputTokens ?? detail?.input_tokens ?? detail?.promptTokens ?? detail?.prompt_tokens ?? usage?.inputTokens ?? usage?.input_tokens ?? usage?.promptTokens ?? usage?.prompt_tokens;
  const output = detail?.outputTokens ?? detail?.output_tokens ?? detail?.completionTokens ?? detail?.completion_tokens ?? usage?.outputTokens ?? usage?.output_tokens ?? usage?.completionTokens ?? usage?.completion_tokens;
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

// Agent SDKs may place captured payloads directly on the event or inside
// OpenTelemetry-style attributes. Read both shapes without inventing content.
const readCaptured = (detail: Record<string, any>, keys: string[]) => {
  const attrs = detail.attributes && typeof detail.attributes === "object" ? detail.attributes : {};
  const nested = detail.rightDetail && typeof detail.rightDetail === "object" ? detail.rightDetail : {};
  const nestedAttrs = nested.attributes && typeof nested.attributes === "object" ? nested.attributes : {};
  return pick(detail, keys) ?? pick(attrs, keys) ?? pick(nested, keys) ?? pick(nestedAttrs, keys);
};
const messageRoleLabel = (role: unknown) => {
  const labels: Record<string, string> = { system: "系统提示词", developer: "开发者指令", user: "用户消息", assistant: "模型回复", tool: "工具返回" };
  return typeof role === "string" ? labels[role] || role : "消息";
};
const messageContent = (message: any) => {
  if (message == null) return "未提供";
  if (typeof message === "string") return message;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) return message.content.map((part: any) => typeof part === "string" ? part : part?.text ?? pretty(part)).join("\n");
  return pretty(message);
};

export const MissionControlTimeline: React.FC<Props> = ({
  timeline, message, activeStepId, onSelectStep, isThinking, onRetryRun
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  // Use the same chronological ordering as the SSE reducer. Legacy history
  // without complete timestamps still falls back to sequence order.
  const ordered = useMemo(() => sortTimeline(timeline || []), [timeline]);
  const selected = ordered.find(s => s.stepId === (activeStepId || selectedId));
  const completed = ordered.filter(s => s.status === "done" || s.status === "passed").length;
  const failures = ordered.filter(s => s.status === "failed").length;
  const running = ordered.some(s => s.status === "running");
  const unknown = ordered.filter(s => s.status === "unknown").length;
  const state = isThinking || running ? {label:"正在执行",tone:"running"} : failures ? {label:"存在异常",tone:"failed"} : unknown ? {label:"部分状态未知",tone:"unknown"} : ordered.length && completed === ordered.length ? {label:"已完成",tone:"done"} : {label:"等待事件",tone:"waiting"};
  const stateClass: Record<string,string> = {
    done:"bg-emerald-50 text-emerald-700 border-emerald-200",
    running:"bg-indigo-50 text-indigo-700 border-indigo-200",
    failed:"bg-rose-50 text-rose-700 border-rose-200",
    unknown:"bg-amber-50 text-amber-700 border-amber-200",
    waiting:"bg-slate-50 text-slate-600 border-slate-200",
  };
  const select = (step: AgentStep) => {
    const next = selected?.stepId === step.stepId ? null : step.stepId;
    setSelectedId(next);
    setShowRaw(false);
    if (next) onSelectStep?.(next);
  };
  const detail = selected?.rightDetail || {};
  const promptMessages = readCaptured(detail, ["prompt_messages","promptMessages","messages","llm_messages"]);
  const modelResponse = readCaptured(detail, ["model_response","modelResponse","completion","assistant_message"]);
  const modelName = readCaptured(detail, ["actual_model","model"]);
  const providerName = readCaptured(detail, ["provider","provider_route"]);
  const modelRound = readCaptured(detail, ["model_step","modelStep"]);
  const toolSchema = readCaptured(detail, ["tool_schema","toolSchema","tools"]);
  const toolArguments = readCaptured(detail, ["tool_arguments","toolArguments","arguments","args","parameters","tool_input"]);
  const toolResult = readCaptured(detail, ["tool_result","toolResult","result","tool_output"]);
  const input = pick(detail, ["arguments","args","input","parameters","request","tool_input","toolArguments","tool_arguments","prompt"]) ?? readCaptured(detail, ["prompt"]);
  const output = pick(detail, ["result","output","response","content","tool_output","toolResult","tool_result"]);
  const why = pick(detail, ["reason","why","rationale","decision_summary","decisionSummary","reasoning_summary","reasoningSummary"]);
  const error = pick(detail, ["error","errorMessage","error_message","exception"]) ?? readCaptured(detail, ["error_message","errorMessage"]);
  const meta = selected ? (phaseMeta[selected.phase] || phaseMeta.external) : phaseMeta.external;
  const SelectedIcon = meta.icon;
  const selectedStatus = selected ? statusMeta[selected.status] || statusMeta.unknown : statusMeta.unknown;
  const description = selected ? selected.rightSubtitle || selected.leftSummary || (selected.status === "running" ? meta.verb : selected.status === "failed" ? "该步骤失败，可查看已上报的错误信息" : selected.status === "done" || selected.status === "passed" ? "步骤已结束，执行端未提供更多说明" : "执行端未提供这一步的具体说明") : "";
  const tokenEvents = ordered.filter(s => tokenText(s.rightDetail) !== null).length;
  const copySelected = async () => {
    if (!selected) return;
    try { await navigator.clipboard.writeText(JSON.stringify(selected.rightDetail || {}, null, 2)); setCopied(true); window.setTimeout(() => setCopied(false), 1400); } catch {}
  };
  const toneForStep = (status: string) => status === "failed" ? "failed" : status === "running" ? "running" : status === "done" || status === "passed" ? "done" : status === "unknown" ? "unknown" : "waiting";

  return (
    <section className="agent-journey relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm">
      <style>{`
        .agent-journey{background:radial-gradient(ellipse at 78% 0%,rgba(129,140,248,.13),transparent 42%),radial-gradient(ellipse at 8% 35%,rgba(34,211,238,.08),transparent 38%),linear-gradient(145deg,#080f25 0%,#111a38 52%,#0b1530 100%);border-color:rgba(129,140,248,.28);color:#e8edff;box-shadow:0 18px 60px rgba(20,30,80,.22)}
        .agent-journey:before{content:"";position:absolute;inset:0;background-image:radial-gradient(rgba(165,180,252,.18) .7px,transparent .7px);background-size:24px 24px;mask-image:linear-gradient(120deg,rgba(0,0,0,.7),transparent 82%);pointer-events:none}.agent-journey header{border-color:rgba(165,180,252,.16)}.agent-journey h2,.agent-journey h3,.agent-journey .text-slate-900,.agent-journey .text-slate-800,.agent-journey .text-slate-700{color:#edf2ff}.agent-journey .text-slate-600,.agent-journey .text-slate-500,.agent-journey .text-slate-400{color:#9ba9cf}.agent-journey .journey-row{border-color:rgba(165,180,252,.12);background:rgba(255,255,255,.035)}.agent-journey .journey-row:hover{background:rgba(129,140,248,.12)}.agent-journey .journey-row-active{background:linear-gradient(110deg,rgba(99,102,241,.24),rgba(34,211,238,.08));border-color:rgba(129,140,248,.58);box-shadow:inset 0 0 24px rgba(99,102,241,.08),0 0 24px rgba(99,102,241,.09)}.agent-journey .journey-json{background:rgba(3,8,24,.72);border-color:rgba(165,180,252,.2);color:#dbeafe}
        .agent-journey .journey-row{transition:background .16s ease,border-color .16s ease}
        .agent-journey .journey-row:hover{background:#f8faff}
        .agent-journey .journey-row-active{background:#f3f5ff;border-color:#c7d2fe}
        .agent-journey .journey-pulse{animation:journeyPulse 1.8s ease-in-out infinite}
        @keyframes journeyPulse{0%,100%{box-shadow:0 0 0 0 rgba(79,70,229,.16)}50%{box-shadow:0 0 0 5px rgba(79,70,229,0)}}
        .agent-journey .journey-json{background:#f8fafc;border:1px solid #e2e8f0;color:#334155}
        @media(prefers-reduced-motion:reduce){.agent-journey *{animation:none!important;transition:none!important}}
      `}</style>

      <header className="relative border-b border-indigo-200/15 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-600"><Activity className="h-4 w-4"/></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-slate-900">Agent 执行旅程</h2><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateClass[state.tone]}`}>{state.label}</span></div>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">{message?.userPrompt || "从任务理解到工具执行，逐步呈现实际发生的过程"}</p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-3 text-[10px] text-slate-500 sm:flex">
            <span><b className="font-mono text-slate-800">{completed}/{ordered.length}</b> 完成</span>
            <span><b className="font-mono text-slate-800">{tokenEvents || "—"}</b> Token 上报</span>
            <span className={failures ? "text-rose-600" : ""}><b className="font-mono">{failures}</b> 异常</span>
          </div>
        </div>
        <div className="mt-2.5 flex h-1 items-center overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500" style={{width:`${ordered.length ? completed / ordered.length * 100 : 0}%`}}/>
        </div>
      </header>

      {ordered.length === 0 ? (
        <div className="relative flex min-h-48 flex-col items-center justify-center px-6 py-9 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-500"><Activity className="h-5 w-5"/></span>
          <h3 className="text-sm font-semibold text-slate-800">{isThinking ? "正在等待 Agent 的第一条执行信号" : "这次运行还没有可展示的执行事件"}</h3>
          <p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-500">这里只呈现 Agent 或执行端实际上报的步骤，不会用推测内容补齐过程。</p>
        </div>
      ) : (
        <div className="relative grid gap-3 px-3 py-3 sm:px-4 lg:grid-cols-[minmax(250px,0.82fr)_minmax(0,1.18fr)] lg:items-start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700"><GitBranch className="h-3.5 w-3.5 text-indigo-500"/>执行路径 <span className="font-normal text-slate-400">· {ordered.length} 个事件</span></div>
            <span className="text-[9px] text-slate-400">选择步骤查看详情</span>
          </div>
          <div className="relative">
            <div className="absolute bottom-4 left-[13px] top-4 w-px bg-gradient-to-b from-indigo-300 via-indigo-200 to-slate-100"/>
            <div className="space-y-1">
              {ordered.map((step,index)=>{
                const info=phaseMeta[step.phase]||phaseMeta.external;
                const Icon=info.icon;
                const active=selected?.stepId===step.stepId;
                const tone=toneForStep(step.status);
                const stateLabel=(statusMeta[step.status]||statusMeta.unknown).label;
                const token=tokenText(step.rightDetail);
                return <button key={step.stepId} type="button" onClick={()=>select(step)} aria-expanded={active} className={`journey-row relative flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left ${active?"journey-row-active":"border-transparent"}`}>
                  <span className={`relative z-[1] flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border bg-white ${tone==="running"?"journey-pulse border-indigo-300 text-indigo-600":tone==="done"?"border-emerald-200 text-emerald-600":tone==="failed"?"border-rose-200 text-rose-600":tone==="unknown"?"border-amber-200 text-amber-600":"border-slate-200 text-slate-400"}`}>
                    {tone==="running"?<Loader2 className="h-3.5 w-3.5 animate-spin"/>:tone==="done"?<CheckCircle2 className="h-3.5 w-3.5"/>:tone==="failed"?<XCircle className="h-3.5 w-3.5"/>:tone==="unknown"?<CircleHelp className="h-3.5 w-3.5"/>:<Icon className="h-3.5 w-3.5"/>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5"><span className="font-mono text-[9px] text-slate-400">{String(step.seq).padStart(2,"0")}</span><span className="truncate text-[11px] font-semibold text-slate-800">{step.rightTitle||step.leftTitle||`步骤 ${index+1}`}</span><span className={`shrink-0 text-[9px] font-medium ${tone==="done"?"text-emerald-600":tone==="running"?"text-indigo-600":tone==="failed"?"text-rose-600":tone==="unknown"?"text-amber-600":"text-slate-400"}`}>{stateLabel}</span></span>
                    <span className="mt-0.5 block truncate text-[10px] leading-4 text-slate-500">{step.rightSubtitle||step.leftSummary||(step.status==="running"?info.verb:step.status==="done"||step.status==="passed"?"步骤已完成":step.status==="failed"?"执行失败":step.status==="pending"?"等待执行":"执行端未提供说明")}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[9px] text-slate-400"><span>{durationText(step.durationMs)}</span>{token&&<span className="hidden font-mono text-indigo-500 sm:inline">{token} tok</span>}<ChevronDown className={`h-3 w-3 transition ${active?"rotate-180 text-indigo-500":"text-slate-300"}`}/></span>
                </button>;
              })}
            </div>
          </div>

          {selected && (
            <div className="min-w-0 overflow-hidden rounded-2xl border border-indigo-300/25 bg-slate-950/45 shadow-[0_12px_48px_rgba(0,0,0,.24)] lg:sticky lg:top-3 lg:max-h-[min(72vh,720px)] lg:overflow-y-auto [scrollbar-width:thin]">
              <div className="flex items-center justify-between gap-2 border-b border-indigo-200/15 bg-indigo-400/10 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 shadow-sm"><SelectedIcon className="h-3.5 w-3.5"/></span><div className="min-w-0"><div className="flex items-center gap-1.5 text-[9px] font-bold tracking-wide text-indigo-600">STEP {String(selected.seq).padStart(2,"0")}<span className={`rounded-full border px-1.5 py-0.5 font-medium tracking-normal ${stateClass[selectedStatus.tone]}`}>{selectedStatus.label}</span></div><div className="truncate text-xs font-semibold text-slate-800">{selected.rightTitle||selected.leftTitle}</div></div></div>
                <div className="flex shrink-0 items-center gap-2 text-[9px] text-slate-500"><span><Clock3 className="mr-1 inline h-3 w-3"/>{durationText(selected.durationMs)}</span><span>Token <b className="font-mono text-slate-700">{tokenText(detail)??"未上报"}</b></span></div>
              </div>
              <div className="px-3 py-3">
                <p className="mb-2 text-[10px] leading-4 text-slate-600">{description}</p>
                <div className="space-y-2">
                  {(modelName !== undefined || providerName !== undefined || modelRound !== undefined) && <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[9px] text-slate-600">
                    {modelName !== undefined && <span><b className="font-semibold text-slate-700">模型</b> {pretty(modelName)}</span>}
                    {providerName !== undefined && <span><b className="font-semibold text-slate-700">渠道</b> {pretty(providerName)}</span>}
                    {modelRound !== undefined && <span><b className="font-semibold text-slate-700">轮次</b> {pretty(modelRound)}</span>}
                  </div>}
                  {Array.isArray(promptMessages) && promptMessages.length > 0 && <section className="rounded-xl border border-indigo-300/20 bg-indigo-400/10 p-3">
                    <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-800"><BrainCircuit className="h-3.5 w-3.5"/>实际发送给模型的提示词</div><span className="text-[9px] text-indigo-500">{Array.isArray(promptMessages) ? `${promptMessages.length} 条消息` : "内容预览（已截断）"}</span></div>
                    {Array.isArray(promptMessages) ? <div className="space-y-2">{promptMessages.map((msg: any, index: number) => <div key={index} className="overflow-hidden rounded-md border border-indigo-100 bg-white">
                      <div className="border-b border-slate-100 px-2 py-1 text-[9px] font-semibold text-slate-500">{messageRoleLabel(msg?.role)}{msg?.name ? ` · ${msg.name}` : ""}</div>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-2 py-2 text-[10px] leading-5 text-slate-700">{messageContent(msg)}</pre>
                    </div>)}</div> : <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-white px-2 py-2 text-[10px] leading-5 text-slate-700">{pretty(promptMessages)}</pre>}
                  </section>}
                  {modelResponse !== undefined && <section className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-800"><Sparkles className="h-3.5 w-3.5"/>模型实际返回</div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-slate-700">{pretty(modelResponse)}</pre>
                  </section>}
                  {toolSchema !== undefined && <details className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <summary className="cursor-pointer text-[10px] font-semibold text-slate-700">本轮提供给模型的工具定义</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(toolSchema)}</pre>
                  </details>}
                  {toolArguments !== undefined && <section className="rounded-xl border border-sky-300/20 bg-sky-400/10 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-sky-800"><Terminal className="h-3.5 w-3.5"/>工具实际收到的参数</div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-700">{pretty(toolArguments)}</pre>
                  </section>}
                  {toolResult !== undefined && <section className="rounded-xl border border-teal-300/20 bg-teal-400/10 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-teal-800"><Eye className="h-3.5 w-3.5"/>工具实际执行结果</div>
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-700">{pretty(toolResult)}</pre>
                  </section>}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {why!==undefined&&<div className="min-w-0 rounded-lg border border-violet-100 bg-violet-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-violet-700"><Sparkles className="h-3 w-3"/>决策摘要</div><div className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-600">{pretty(why)}</div></div>}
                  {error!==undefined&&<div className="min-w-0 rounded-lg border border-rose-100 bg-rose-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-rose-700"><AlertTriangle className="h-3 w-3"/>错误信息</div><div className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-rose-700">{pretty(error)}</div></div>}
                  {input!==undefined&&<div className="min-w-0 rounded-lg border border-sky-100 bg-sky-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-sky-700"><Terminal className="h-3 w-3"/>实际输入</div><pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(input)}</pre></div>}
                  {output!==undefined&&<div className="min-w-0 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Eye className="h-3 w-3"/>实际返回</div><pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(output)}</pre></div>}
                </div>
                {input===undefined&&output===undefined&&why===undefined&&error===undefined&&promptMessages===undefined&&modelResponse===undefined&&toolSchema===undefined&&toolArguments===undefined&&toolResult===undefined&&<div className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2 text-[10px] leading-4 text-amber-800">这条事件没有附带提示词、模型响应或工具 I/O 内容。需要在 Agent 实际调用模型和工具的位置启用内容采集；Studio 不会根据阶段名称补写。</div>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={()=>setShowRaw(v=>!v)} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-indigo-600"><ChevronDown className={`h-3 w-3 transition ${showRaw?"rotate-180":""}`}/>{showRaw?"收起原始事件":"查看原始事件"}</button>
                  <div className="flex items-center gap-2">
                    {selected.status==="failed"&&onRetryRun&&!isThinking&&<button type="button" onClick={onRetryRun} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold text-rose-700"><RotateCcw className="h-3 w-3"/>重新运行</button>}
                    <button type="button" onClick={()=>void copySelected()} className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-500 hover:border-indigo-200 hover:text-indigo-600"><Copy className="h-3 w-3"/>{copied?"已复制":"复制"}</button>
                  </div>
                </div>
                {showRaw&&<pre className="journey-json mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg p-2 text-[9px] leading-4">{pretty(detail)}</pre>}
              </div>
            </div>
          )}
          <div className="mt-2 flex items-center justify-between px-1 text-[9px] text-slate-400"><span>{running?"Agent 正在推进当前步骤":failures?`${failures} 个步骤执行失败`:unknown?`${unknown} 个步骤状态未知`:"展示已接收的全部执行事件"}</span><span>仅呈现实际上报的数据</span></div>
        </div>
      )}
    </section>
  );
};
