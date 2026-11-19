import React, { useMemo, useState } from "react";
import { sortTimeline } from "@/lib/agentTimeline";
import {
  Activity, CheckCircle2, Clock3, Copy, Loader2, RotateCcw, XCircle,
  ChevronDown, ChevronRight, BrainCircuit, Wrench, Database, Search, AlertTriangle,
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
const humanizeKey = (key: string) => {
  const labels: Record<string, string> = {
    repoId: "仓库标识", repoName: "仓库", branch: "分支", commitCount: "提交数量",
    commits: "提交记录", limit: "查询数量", owner: "所有者", path: "文件路径",
    status: "执行状态", success: "是否成功", message: "说明", error: "错误",
    tool: "工具", query: "查询内容", url: "地址", total: "总数",
  };
  if (labels[key]) return labels[key];
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]/g, " ").replace(/^./, c => c.toUpperCase());
};
const readableEntries = (value: unknown): Array<[string, unknown]> => {
  let parsed: any = value;
  if (typeof parsed === "string") {
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return Object.entries(parsed).filter(([, v]) => v !== undefined && v !== null).slice(0, 8);
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
  const selected = ordered.find(s => s.stepId === (activeStepId || selectedId)) || ordered[0];
  const completed = ordered.filter(s => s.status === "done" || s.status === "passed").length;
  const failures = ordered.filter(s => s.status === "failed").length;
  const running = ordered.some(s => s.status === "running");
  const unknown = ordered.filter(s => s.status === "unknown").length;
  const state = isThinking || running ? {label:"正在执行",tone:"running"} : failures ? {label:"存在异常",tone:"failed"} : unknown ? {label:"部分状态未知",tone:"unknown"} : ordered.length && completed === ordered.length ? {label:"已完成",tone:"done"} : {label:"等待事件",tone:"waiting"};
  const stateClass: Record<string,string> = {
    done:"bg-emerald-400/10 text-emerald-200 border-emerald-300/25",
    running:"bg-indigo-400/10 text-indigo-200 border-indigo-300/25",
    failed:"bg-rose-400/10 text-rose-200 border-rose-300/25",
    unknown:"bg-amber-400/10 text-amber-200 border-amber-300/25",
    waiting:"bg-white/5 text-slate-300 border-white/10",
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
        .agent-journey{isolation:isolate;background:radial-gradient(ellipse at 48% 38%,rgba(111,74,255,.19),transparent 38%),radial-gradient(ellipse at 95% 0%,rgba(34,211,238,.12),transparent 34%),linear-gradient(150deg,#08091f 0%,#111338 48%,#090d27 100%);border-color:rgba(167,139,250,.32);color:#e8eaff;box-shadow:0 24px 70px rgba(7,8,35,.34),inset 0 1px rgba(255,255,255,.08)}
        .agent-journey:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;background-image:radial-gradient(rgba(205,190,255,.48) .65px,transparent .9px),radial-gradient(rgba(103,232,249,.28) .8px,transparent 1px);background-size:29px 29px,47px 47px;background-position:0 0,13px 19px;mask-image:linear-gradient(180deg,black,transparent 96%)}
        .agent-journey:after{content:"";position:absolute;z-index:-1;pointer-events:none;width:65%;height:48%;left:18%;top:20%;background:radial-gradient(ellipse,rgba(124,58,237,.16),transparent 68%);filter:blur(28px)}
        .agent-journey header{border-color:rgba(196,181,253,.16)}
        .agent-journey h2,.agent-journey h3,.agent-journey .text-slate-900,.agent-journey .text-slate-800,.agent-journey .text-slate-700{color:#f1efff}
        .agent-journey .text-slate-600,.agent-journey .text-slate-500,.agent-journey .text-slate-400{color:#a5add2}
        .agent-journey .journey-json{background:rgba(3,5,24,.86);border:1px solid rgba(167,139,250,.22);color:#e3e7ff}
        .agent-journey pre{color:#e3e7ff}.agent-journey details{border-color:rgba(196,181,253,.2);background:rgba(255,255,255,.045)}.agent-journey details summary{color:#e7e5ff}
        .agent-journey .orbit-stage{position:relative;min-height:310px;overflow:hidden;border:1px solid rgba(167,139,250,.16);border-radius:22px;background:radial-gradient(ellipse at 50% 50%,rgba(91,55,180,.2),transparent 42%),linear-gradient(145deg,rgba(19,20,58,.72),rgba(7,12,39,.5));box-shadow:inset 0 0 42px rgba(124,58,237,.08)}
        .agent-journey .orbit-stage:before{content:"";position:absolute;inset:0;background:radial-gradient(rgba(196,181,253,.28) .7px,transparent .9px);background-size:19px 19px;opacity:.32;mask-image:radial-gradient(ellipse,black,transparent 78%)}
        .agent-journey .orbit-ring{position:absolute;left:50%;top:50%;width:69%;height:58%;border:1px solid rgba(167,139,250,.32);border-radius:50%;transform:translate(-50%,-50%) rotate(-19deg);box-shadow:0 0 22px rgba(124,58,237,.12),inset 0 0 18px rgba(34,211,238,.05)}
        .agent-journey .orbit-ring.ring-two{width:88%;height:76%;border-color:rgba(103,232,249,.15);transform:translate(-50%,-50%) rotate(24deg);border-style:dashed;animation:orbitDrift 46s linear infinite}
        .agent-journey .orbit-core{position:absolute;left:50%;top:50%;width:74px;height:74px;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:50%;border:1px solid rgba(196,181,253,.62);background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.95),rgba(196,181,253,.78) 9%,rgba(124,58,237,.55) 33%,rgba(19,20,70,.95) 72%);box-shadow:0 0 18px rgba(167,139,250,.7),0 0 48px rgba(124,58,237,.46),inset 0 0 18px rgba(255,255,255,.32);animation:coreBreathe 4s ease-in-out infinite}
        .agent-journey .orbit-core:after{content:"";position:absolute;inset:-12px;border:1px solid rgba(103,232,249,.34);border-radius:50%;box-shadow:0 0 24px rgba(34,211,238,.16);animation:coreHalo 3.2s ease-out infinite}
        .agent-journey .orbit-node{position:absolute;z-index:2;width:min(46%,132px);min-height:43px;transform:translate(-50%,-50%);display:flex;align-items:center;gap:7px;padding:7px 9px;border:1px solid rgba(196,181,253,.28);border-radius:14px;background:linear-gradient(135deg,rgba(38,36,91,.92),rgba(14,21,57,.92));color:#e9e8ff;text-align:left;box-shadow:0 7px 22px rgba(0,0,0,.24),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(12px);transition:transform .22s,border-color .22s,box-shadow .22s}
        .agent-journey .orbit-node:hover{transform:translate(-50%,-50%) scale(1.055);border-color:rgba(196,181,253,.72);box-shadow:0 0 22px rgba(139,92,246,.28)}
        .agent-journey .orbit-node.active{border-color:rgba(103,232,249,.86);background:linear-gradient(135deg,rgba(91,57,177,.96),rgba(19,53,91,.96));box-shadow:0 0 0 1px rgba(103,232,249,.2),0 0 28px rgba(139,92,246,.48),inset 0 0 18px rgba(103,232,249,.12)}
        .agent-journey .orbit-node.running{border-color:rgba(103,232,249,.75);box-shadow:0 0 22px rgba(34,211,238,.32);animation:nodeGlow 2.4s ease-in-out infinite}
        .agent-journey .orbit-node .node-icon{width:22px;height:22px;flex:0 0 auto;display:grid;place-items:center;border-radius:50%;background:rgba(255,255,255,.08)}
        .agent-journey .detail-glass{border:1px solid rgba(167,139,250,.28);border-radius:18px;background:linear-gradient(145deg,rgba(24,25,65,.91),rgba(8,14,42,.94));box-shadow:0 16px 42px rgba(0,0,0,.25),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(16px)}
        .agent-journey .journey-progress{background:linear-gradient(90deg,#8b5cf6,#c084fc,#67e8f9);box-shadow:0 0 14px rgba(103,232,249,.6)}
        @keyframes coreBreathe{0%,100%{filter:brightness(.92);transform:translate(-50%,-50%) scale(.96)}50%{filter:brightness(1.22);transform:translate(-50%,-50%) scale(1.04)}}
        @keyframes coreHalo{0%{transform:scale(.86);opacity:.8}100%{transform:scale(1.45);opacity:0}}
        @keyframes nodeGlow{0%,100%{box-shadow:0 0 12px rgba(34,211,238,.18)}50%{box-shadow:0 0 27px rgba(34,211,238,.42)}}
        @keyframes orbitDrift{to{transform:translate(-50%,-50%) rotate(384deg)}}
        @media(max-width:640px){.agent-journey .orbit-stage{min-height:280px}.agent-journey .orbit-node{width:min(48%,126px);padding:6px 7px}.agent-journey .orbit-core{width:60px;height:60px}}
        @media(prefers-reduced-motion:reduce){.agent-journey *{animation:none!important;transition:none!important}}
        .agent-journey{background:transparent!important;border-color:transparent!important;box-shadow:none!important;color:#e9eaff!important}
        .agent-journey:before{opacity:.48}
        .agent-journey:after{opacity:.5}
        .agent-journey .orbit-stage{border-color:rgba(177,164,255,.12);background:radial-gradient(ellipse at 50% 50%,rgba(102,75,196,.14),transparent 48%);box-shadow:inset 0 0 48px rgba(124,58,237,.06)}
        .agent-journey .detail-glass{background:linear-gradient(145deg,rgba(25,29,73,.74),rgba(9,19,46,.78));border-color:rgba(177,164,255,.2);box-shadow:0 16px 42px rgba(0,0,0,.18),inset 0 1px rgba(255,255,255,.07)}
        .agent-journey .journey-json{background:rgba(4,9,29,.64);border-color:rgba(177,164,255,.18)}
        .agent-journey header{border-color:rgba(177,164,255,.12)}
        .agent-journey .orbit-node{background:linear-gradient(135deg,rgba(38,37,91,.78),rgba(14,25,59,.82));backdrop-filter:blur(16px)}
        .agent-journey .journey-track:before{content:"";position:absolute;left:34px;right:34px;top:31px;height:2px;background:linear-gradient(90deg,rgba(52,211,153,.8),rgba(56,189,248,.7),rgba(139,92,246,.24));z-index:0}.agent-journey .journey-row{border-color:rgba(177,164,255,.18);background:rgba(18,22,58,.56);min-height:132px;width:168px;min-width:168px;max-width:168px;flex-direction:column;gap:8px;justify-content:flex-start}.agent-journey .journey-row>span:first-child{margin-top:0}.agent-journey .journey-row>span:last-child{display:none}.agent-journey .journey-row .text-sm{font-size:12px;line-height:1.45}.agent-journey .journey-row .text-xs{font-size:11px;line-height:1.45}.agent-journey .journey-row .text-\\[11px\\]{font-size:10px}
        .agent-journey .journey-row:hover{background:rgba(57,55,118,.48);border-color:rgba(177,164,255,.38)}
        .agent-journey .journey-row-active{background:linear-gradient(110deg,rgba(91,65,173,.42),rgba(21,65,91,.34));border-color:rgba(103,232,249,.62);box-shadow:inset 0 0 0 1px rgba(103,232,249,.12),0 0 22px rgba(124,58,237,.12)}
        .agent-journey .detail-glass{background:rgba(12,17,46,.78);border-color:rgba(177,164,255,.22);box-shadow:0 12px 32px rgba(0,0,0,.16)}
        .agent-journey .detail-glass .text-slate-800,.agent-journey .detail-glass .text-slate-700{color:#f0efff!important}
        .agent-journey .detail-glass .text-slate-600,.agent-journey .detail-glass .text-slate-500{color:#b8c0e2!important}
        .agent-journey .detail-glass{font-size:12px}.agent-journey .detail-glass pre{font-size:11px;line-height:1.7}.agent-journey .detail-glass .text-[9px]{font-size:11px}.agent-journey .detail-glass .text-[10px]{font-size:12px}
        .agent-journey .detail-glass section{color:#e9eaff}
        .agent-journey .detail-glass .text-indigo-100,.agent-journey .detail-glass .text-emerald-100,.agent-journey .detail-glass .text-sky-100,.agent-journey .detail-glass .text-teal-100{color:#e8eaff!important}
        .agent-journey .detail-glass .text-indigo-500{color:#bfc8ff!important}
        .agent-journey .journey-layout{grid-template-columns:minmax(0,1fr)}.agent-journey .detail-glass{margin-top:14px}
      `}</style>

      <header className="relative border-b border-violet-200/15 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-indigo-300/30 bg-indigo-400/15 text-cyan-200"><Activity className="h-4 w-4"/></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-bold text-slate-900">执行观察</h2><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateClass[state.tone]}`}>{state.label}</span></div>
              <p className="mt-0.5 truncate text-[10px] text-slate-400">{message?.userPrompt || "Agent 的实际执行过程与每一步详情"}</p>
            </div>
          </div>
          <div className="hidden shrink-0 items-center gap-3 text-[10px] text-slate-400 sm:flex">
            <span><b className="font-mono text-slate-800">{completed}/{ordered.length}</b> 完成</span>
            <span><b className="font-mono text-slate-800">{tokenEvents || "—"}</b> Token 上报</span>
            <span className={failures ? "text-rose-600" : ""}><b className="font-mono">{failures}</b> 异常</span>
          </div>
        </div>
        <div className="mt-3 flex h-1 items-center overflow-hidden rounded-full bg-white/10">
          <div className="journey-progress h-full rounded-full transition-all duration-500" style={{width:`${ordered.length ? completed / ordered.length * 100 : 0}%`}}/>
        </div>
      </header>

      {ordered.length === 0 ? (
        <div className="relative flex min-h-48 flex-col items-center justify-center px-6 py-9 text-center">
          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-indigo-300/25 bg-indigo-400/10 text-cyan-200"><Activity className="h-5 w-5"/></span>
          <h3 className="text-sm font-semibold text-slate-800">{isThinking ? "正在等待 Agent 的第一条执行信号" : "这次运行还没有可展示的执行事件"}</h3>
          <p className="mt-1.5 max-w-xs text-xs leading-5 text-slate-500">这里只呈现 Agent 或执行端实际上报的步骤，不会用推测内容补齐过程。</p>
        </div>
      ) : (
        <div className="journey-layout relative grid grid-cols-1 gap-4 px-3 py-4 sm:px-4">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-violet-100">
                <GitBranch className="h-4 w-4 text-cyan-200"/>
                执行时间线
                <span className="text-xs font-normal text-violet-200/65">· {ordered.length} 条实际事件</span>
              </div>
              <span className="text-xs text-violet-200/60">按发生顺序排列 · 选择事件查看详情</span>
            </div>
            <div className="relative max-h-[min(52vh,560px)] overflow-y-auto pr-1 [scrollbar-width:thin]">
              <div className="absolute bottom-4 left-[15px] top-4 w-px bg-gradient-to-b from-cyan-300/70 via-violet-400/45 to-transparent"/>
              <div className="space-y-2">
                {ordered.map((step,index)=>{
                  const info=phaseMeta[step.phase]||phaseMeta.external;
                  const Icon=info.icon;
                  const active=selected?.stepId===step.stepId;
                  const tone=toneForStep(step.status);
                  const stateLabel=(statusMeta[step.status]||statusMeta.unknown).label;
                  const toneClass=tone==="done"?"text-emerald-300 border-emerald-300/35":tone==="running"?"text-cyan-200 border-cyan-300/45":tone==="failed"?"text-rose-300 border-rose-300/40":tone==="unknown"?"text-amber-200 border-amber-300/40":"text-violet-200 border-violet-300/25";
                  return <button key={`${step.stepId}-${index}`} type="button" onClick={()=>select(step)} aria-expanded={active} className={`journey-row relative flex items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${active?"journey-row-active":""}`}>
                    <span className={`relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-[#111735] ${toneClass}`}>
                      {tone==="running"?<Loader2 className="h-4 w-4 animate-spin"/>:tone==="done"?<CheckCircle2 className="h-4 w-4"/>:tone==="failed"?<XCircle className="h-4 w-4"/>:tone==="unknown"?<CircleHelp className="h-4 w-4"/>:<Icon className="h-4 w-4"/>}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[11px] font-mono text-violet-200/55">事件 {String(index+1).padStart(2,"0")}</span>
                        <span className="text-sm font-semibold leading-5 text-violet-50">{step.rightTitle||step.leftTitle||`步骤 ${index+1}`}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${toneClass}`}>{stateLabel}</span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-violet-100/65">{step.rightSubtitle||step.leftSummary||(step.status==="running"?info.verb:step.status==="done"||step.status==="passed"?"步骤已完成":step.status==="failed"?"执行失败":step.status==="pending"?"等待执行":"执行端未提供说明")}</span>
                    </span>
                    <span className="shrink-0 pt-1 text-[11px] text-violet-200/60">{durationText(step.durationMs)}</span>
                    <ChevronRight className={`mt-1 h-4 w-4 shrink-0 ${active?"text-cyan-200":"text-violet-200/40"}`}/>
                  </button>;
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-violet-200/60">
              <span>{running?"Agent 正在执行":failures?`${failures} 条事件执行失败`:unknown?`${unknown} 条事件状态未知`:"已展示本次运行收到的事件"}</span>
              <span>仅呈现实际上报的数据</span>
            </div>
          </div>
          {selected && (
            <div className="detail-glass min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-indigo-200/15 bg-indigo-400/10 px-3 py-3">
                <div className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-indigo-200/20 bg-indigo-300/10 text-cyan-200 shadow-sm"><SelectedIcon className="h-3.5 w-3.5"/></span><div className="min-w-0"><div className="flex items-center gap-1.5 text-[9px] font-bold tracking-wide text-cyan-200">事件详情<span className={`rounded-full border px-1.5 py-0.5 font-medium tracking-normal ${stateClass[selectedStatus.tone]}`}>{selectedStatus.label}</span></div><div className="truncate text-xs font-semibold text-slate-800">{selected.rightTitle||selected.leftTitle}</div></div></div>
                <div className="flex shrink-0 items-center gap-2 text-[9px] text-slate-500"><span><Clock3 className="mr-1 inline h-3 w-3"/>{durationText(selected.durationMs)}</span><span>Token <b className="font-mono text-slate-700">{tokenText(detail)??"未上报"}</b></span></div>
              </div>
              <div className="px-3 py-3">
                <p className="mb-2 text-[10px] leading-4 text-slate-600">{description}</p>
                <div className="space-y-2">
                  {(modelName !== undefined || providerName !== undefined || modelRound !== undefined) && <div className="flex flex-wrap items-center gap-2 rounded-lg border border-indigo-200/15 bg-white/[0.045] px-2.5 py-2 text-[9px] text-slate-300">
                    {modelName !== undefined && <span><b className="font-semibold text-slate-700">模型</b> {pretty(modelName)}</span>}
                    {providerName !== undefined && <span><b className="font-semibold text-slate-700">渠道</b> {pretty(providerName)}</span>}
                    {modelRound !== undefined && <span><b className="font-semibold text-slate-700">轮次</b> {pretty(modelRound)}</span>}
                  </div>}
                  {Array.isArray(promptMessages) && promptMessages.length > 0 && <section className="rounded-xl border border-indigo-300/20 bg-indigo-400/10 p-3">
                    <div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-100"><BrainCircuit className="h-3.5 w-3.5"/>实际发送给模型的提示词</div><span className="text-[9px] text-indigo-500">{Array.isArray(promptMessages) ? `${promptMessages.length} 条消息` : "内容预览（已截断）"}</span></div>
                    {Array.isArray(promptMessages) ? <div className="space-y-2">{promptMessages.map((msg: any, index: number) => <div key={index} className="overflow-hidden rounded-lg border border-indigo-200/15 bg-slate-900/80">
                      <div className="border-b border-indigo-200/10 bg-white/5 px-2 py-1 text-[9px] font-semibold text-indigo-200/70">{messageRoleLabel(msg?.role)}{msg?.name ? ` · ${msg.name}` : ""}</div>
                      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words px-2 py-2 text-[10px] leading-5 text-slate-100">{messageContent(msg)}</pre>
                    </div>)}</div> : <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-md bg-slate-900/80 px-2 py-2 text-[10px] leading-5 text-slate-100">{pretty(promptMessages)}</pre>}
                  </section>}
                  {modelResponse !== undefined && <section className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-3">
                    <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-emerald-100"><Sparkles className="h-3.5 w-3.5"/>模型实际返回</div>
                    <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-slate-100">{pretty(modelResponse)}</pre>
                  </section>}
                  {toolSchema !== undefined && <details className="rounded-lg border border-indigo-200/15 bg-white/[0.045] p-2.5">
                    <summary className="cursor-pointer text-[10px] font-semibold text-slate-700">本轮提供给模型的工具定义</summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(toolSchema)}</pre>
                  </details>}
                  {toolArguments !== undefined && <section className="rounded-xl border border-sky-300/20 bg-sky-400/10 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-sky-100"><Terminal className="h-3.5 w-3.5"/>这次操作收到了什么</div>
                    {readableEntries(toolArguments).length > 0 ? <div className="grid grid-cols-2 gap-2">{readableEntries(toolArguments).map(([key,value])=><div key={key} className="min-w-0 rounded-lg bg-slate-950/25 px-2.5 py-2"><div className="text-[10px] text-sky-200/70">{humanizeKey(key)}</div><div className="mt-1 break-words text-xs font-medium text-white">{typeof value==="object"?pretty(value):String(value)}</div></div>)}</div> : <p className="text-xs leading-5 text-slate-100">{typeof toolArguments==="string"?toolArguments:"已收到工具参数，具体结构可在技术详情中查看。"}</p>}
                    <details className="mt-2 rounded-lg border border-white/10 bg-slate-950/20 p-2"><summary className="cursor-pointer text-[10px] text-sky-100/80">查看原始参数</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-slate-100">{pretty(toolArguments)}</pre></details>
                  </section>}
                  {toolResult !== undefined && <section className="rounded-xl border border-teal-300/20 bg-teal-400/10 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-teal-100"><Eye className="h-3.5 w-3.5"/>执行后得到了什么</div>
                    {readableEntries(toolResult).length > 0 ? <div className="grid grid-cols-2 gap-2">{readableEntries(toolResult).map(([key,value])=><div key={key} className="min-w-0 rounded-lg bg-slate-950/25 px-2.5 py-2"><div className="text-[10px] text-teal-200/70">{humanizeKey(key)}</div><div className="mt-1 break-words text-xs font-medium text-white">{typeof value==="object"?pretty(value):String(value)}</div></div>)}</div> : <p className="text-xs leading-5 text-slate-100">{typeof toolResult==="string"?toolResult:"工具已返回结果，具体结构可在技术详情中查看。"}</p>}
                    <details className="mt-2 rounded-lg border border-white/10 bg-slate-950/20 p-2"><summary className="cursor-pointer text-[10px] text-teal-100/80">查看原始结果</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-5 text-slate-100">{pretty(toolResult)}</pre></details>
                  </section>}
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {why!==undefined&&<div className="min-w-0 rounded-lg border border-violet-300/20 bg-violet-400/10 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-violet-200"><Sparkles className="h-3 w-3"/>决策摘要</div><div className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-slate-600">{pretty(why)}</div></div>}
                  {error!==undefined&&<div className="min-w-0 rounded-lg border border-rose-300/20 bg-rose-400/10 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-rose-700"><AlertTriangle className="h-3 w-3"/>错误信息</div><div className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[10px] leading-4 text-rose-700">{pretty(error)}</div></div>}
                  {input!==undefined&&<div className="min-w-0 rounded-lg border border-sky-300/20 bg-sky-400/10 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-sky-200"><Terminal className="h-3 w-3"/>实际输入</div><pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(input)}</pre></div>}
                  {output!==undefined&&<div className="min-w-0 rounded-lg border border-emerald-300/20 bg-emerald-400/10 p-2"><div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-emerald-700"><Eye className="h-3 w-3"/>实际返回</div><pre className="max-h-20 overflow-auto whitespace-pre-wrap break-words text-[9px] leading-4 text-slate-600">{pretty(output)}</pre></div>}
                </div>
                {input===undefined&&output===undefined&&why===undefined&&error===undefined&&promptMessages===undefined&&modelResponse===undefined&&toolSchema===undefined&&toolArguments===undefined&&toolResult===undefined&&<div className="rounded-lg border border-dashed border-amber-300/25 bg-amber-400/10 px-3 py-2 text-[10px] leading-4 text-amber-100">{selected.phase==="llm"?"本次模型调用没有上报提示词或模型响应。":selected.phase==="skill"?"本次工具事件没有上报调用参数或返回结果。":"这条事件目前只包含状态、时间等基础信息。"}</div>}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={()=>setShowRaw(v=>!v)} className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-500 hover:text-indigo-600"><ChevronDown className={`h-3 w-3 transition ${showRaw?"rotate-180":""}`}/>{showRaw?"收起原始事件":"查看原始事件"}</button>
                  <div className="flex items-center gap-2">
                    {selected.status==="failed"&&onRetryRun&&!isThinking&&<button type="button" onClick={onRetryRun} className="inline-flex items-center gap-1 rounded-md border border-rose-300/25 bg-rose-400/10 px-2 py-1 text-[10px] font-semibold text-rose-200"><RotateCcw className="h-3 w-3"/>重新运行</button>}
                    <button type="button" onClick={()=>void copySelected()} className="inline-flex items-center gap-1 rounded-md border border-indigo-200/20 px-2 py-1 text-[10px] text-slate-300 hover:border-indigo-300/40 hover:text-cyan-200"><Copy className="h-3 w-3"/>{copied?"已复制":"复制"}</button>
                  </div>
                </div>
                {showRaw&&<pre className="journey-json mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-lg p-2 text-[9px] leading-4">{pretty(detail)}</pre>}
              </div>
            </div>
          )}
          <div className="col-span-full mt-0 flex items-center justify-between px-1 text-[9px] text-slate-400"><span>{running?"Agent 正在推进当前步骤":failures?`${failures} 个步骤执行失败`:unknown?`${unknown} 个步骤状态未知`:"展示已接收的全部执行事件"}</span><span>仅呈现实际上报的数据</span></div>
        </div>
      )}
    </section>
  );
};
