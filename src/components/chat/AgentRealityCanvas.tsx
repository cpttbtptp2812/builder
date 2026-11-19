import React, { useMemo, useState } from "react";
import {
  Activity, BrainCircuit, CheckCircle2, CircleHelp, Clock3, Code2, Database, Orbit, Sparkles,
  FileCode2, GitBranch, GitCommitHorizontal, Globe2, Layers3, LockKeyhole,
  Network, Radio, ShieldAlert, Terminal, XCircle, Zap
} from "lucide-react";
import { AgentStep, sortTimeline } from "@/lib/agentTimeline";
import type { TraceDrawerMessage } from "./TraceInspectorDrawer";
import { AgentPrismTraceTree } from "./AgentPrismTraceTree";
import { classifyRealityAdapter, parseRealityPayload, readRealityAttribute, realityMessageText, toRealityMessageList, type RealityAdapterKind, summarizeRealityResult } from "@/lib/agentRealityAdapters";

interface Props {
  timeline: AgentStep[];
  message?: TraceDrawerMessage | null;
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  isThinking?: boolean;
  onRetryRun?: () => void;
}

type AdapterKind = RealityAdapterKind;

const status: Record<string, {label:string; color:string; icon:React.ElementType}> = {
  done:{label:"已完成",color:"emerald",icon:CheckCircle2},
  passed:{label:"已通过",color:"emerald",icon:CheckCircle2},
  running:{label:"正在执行",color:"cyan",icon:Radio},
  failed:{label:"执行失败",color:"rose",icon:XCircle},
  pending:{label:"等待中",color:"slate",icon:Clock3},
  unknown:{label:"状态未上报",color:"amber",icon:CircleHelp},
};

const read = readRealityAttribute;
const text = (value:any) => {
  if(value===undefined || value===null) return "";
  if(typeof value==="string") return value;
  if(typeof value==="number" || typeof value==="boolean") return String(value);
  try{return JSON.stringify(value,null,2)}catch{return String(value)}
};
const messageText = realityMessageText;
const parseStructured = parseRealityPayload;
const INTERNAL_REASONING_KEYS = new Set(["analysis", "reasoning", "chain_of_thought", "chainofthought", "internal_thought", "thoughts", "scratchpad"]);
const stripInternalReasoning = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(stripInternalReasoning).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== "object") return value;
  const channel = String(value.channel ?? value.type ?? value.kind ?? value.message_type ?? "").toLowerCase();
  const role = String(value.role ?? "").toLowerCase();
  if (/(analysis|reasoning|thought|internal)/.test(channel) && (!role || role === "assistant")) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !INTERNAL_REASONING_KEYS.has(key.toLowerCase()))
      .map(([key, item]) => [key, stripInternalReasoning(item)])
      .filter(([, item]) => item !== undefined)
  );
};
const toolOf = (step:AgentStep) => String(read(step.rightDetail,["gen_ai.tool.name","mcp.tool.name","tool","tool_name","toolName"]) || "");
const operationOf = (step:AgentStep) => String(read(step.rightDetail,["gen_ai.operation.name","operation","operation_name"]) || "").toLowerCase();
const adapterOf = (step:AgentStep):AdapterKind => classifyRealityAdapter({
  tool: toolOf(step),
  operation: operationOf(step),
  kind: String(read(step.rightDetail,["adapter_kind","adapterKind"]) ?? ""),
  title: step.rightTitle+" "+step.leftTitle,
  phase: step.phase,
});

const adapterMeta:Record<AdapterKind,{label:string;icon:React.ElementType;accent:string;verb:string}> = {
  git:{label:"代码仓库",icon:GitBranch,accent:"violet",verb:"正在读取或改变代码仓库"},
  browser:{label:"浏览器操作",icon:Globe2,accent:"cyan",verb:"正在与网页交互"},
  retrieval:{label:"知识与检索",icon:Database,accent:"blue",verb:"正在寻找可用信息"},
  code:{label:"代码操作",icon:FileCode2,accent:"purple",verb:"正在读取或修改项目文件"},
  approval:{label:"安全与权限",icon:LockKeyhole,accent:"amber",verb:"正在检查或等待授权"},
  agent:{label:"Agent 协作",icon:Network,accent:"pink",verb:"正在交接任务"},
  terminal:{label:"终端执行",icon:Terminal,accent:"emerald",verb:"正在运行命令"},
  model:{label:"模型推理调用",icon:BrainCircuit,accent:"indigo",verb:"正在请求模型处理信息"},
  generic:{label:"行动事件",icon:Activity,accent:"slate",verb:"收到一条执行事件"},
};

const summarize = summarizeRealityResult;

const ActionVisual:React.FC<{step:AgentStep}> = ({step}) => {
  const d=step.rightDetail||{};
  const adapter=adapterOf(step);
  const repo=read(d,["repository","repoName","repo_name","repo"]);
  const branch=read(d,["branch","ref"]);
  const commits=read(d,["commits","items","entries"]);
  const url=read(d,["url","pageUrl","page_url","current_url"]);
  const title=read(d,["pageTitle","page_title","title"]);
  const screenshot=read(d,["screenshotUrl","screenshot_url","imageUrl","image_url"]);
  const sources=read(d,["gen_ai.retrieval.documents","sources","documents","citations","items"]);
  const files=read(d,["files","changedFiles","changed_files","path"]);
  const diff=read(d,["diff","patch","unified_diff"]);
  const args=read(d,["gen_ai.tool.call.arguments","mcp.tool.arguments","arguments","args","parameters","tool_input","input"]);
  const result=read(d,["gen_ai.tool.call.result","mcp.tool.result","result","tool_result","tool_output","output","response"]);
  const approval=read(d,["approvalStatus","approval_status","decision","riskLevel","risk_level"]);
  const model=read(d,["gen_ai.request.model","model","actual_model","modelName"]);
  const provider=read(d,["gen_ai.system","provider","provider_route"]);
  const promptMessages=read(d,["gen_ai.input.messages","prompt_messages","promptMessages","messages","llm_messages"]);
  const modelResponse=read(d,["gen_ai.output.messages","model_response","modelResponse","completion","assistant_message"]);
  const inputTokens=read(d,["gen_ai.usage.input_tokens","input_tokens","prompt_tokens"]);
  const outputTokens=read(d,["gen_ai.usage.output_tokens","output_tokens","completion_tokens"]);
  const totalTokens=read(d,["gen_ai.usage.total_tokens","total_tokens","totalTokens"]);
  const visiblePromptMessages=toRealityMessageList(stripInternalReasoning(parseStructured(promptMessages)));
  const visibleModelResponse=stripInternalReasoning(parseStructured(modelResponse));
  const decision=read(d,["decision_summary","decisionSummary","action_summary","summary"]);
  const why=read(d,["reason","purpose","explanation"]);
  const nextAction=read(d,["next_action","nextAction","next_step","handoff_target"]);
  const duration=typeof step.durationMs==="number" ? (step.durationMs>=1000?(step.durationMs/1000).toFixed(2)+" 秒":Math.round(step.durationMs)+" 毫秒") : "未上报";
  return <div className="reality-inspector">
    <div className="reality-action-summary">
      <div className="reality-summary-orb"><Zap size={18}/></div>
      <div className="min-w-0 flex-1">
        <div className="reality-eyebrow">执行事件 · {adapterMeta[adapter].label}</div>
        <div className="reality-summary-title">{toolOf(step)||step.rightTitle||step.leftTitle}</div>
        {(step.rightSubtitle||step.leftSummary)&&<p>{step.rightSubtitle||step.leftSummary}</p>}
      </div>
      <div className="reality-duration"><Clock3 size={13}/>{duration}</div>
    </div>

    {adapter==="git" && <div className="reality-visual-block">
      <div className="reality-block-head"><GitBranch size={15}/> 仓库信息</div>
      <div className="reality-git-target">
        <div><small>仓库</small><strong>{repo?text(repo):"未上报"}</strong></div>
        <div><small>分支</small><strong>{branch?text(branch):"未上报"}</strong></div>
      </div>
      {Array.isArray(commits)&&<div className="reality-data-list">{commits.slice(0,5).map((item:any,i:number)=><div className="reality-data-row" key={i}><GitCommitHorizontal size={14}/><span>{text(item?.message||item?.title||item?.sha||item).slice(0,100)}</span><small>{item?.author||""}</small></div>)}</div>}
      {files!==undefined&&<div className="reality-data-chip"><FileCode2 size={14}/> 变更对象：{summarize(files)}</div>}
      {diff!==undefined&&<pre className="reality-code-preview">{text(diff).slice(0,1600)}</pre>}
    </div>}

    {adapter==="browser" && <div className="reality-visual-block">
      <div className="reality-block-head"><Globe2 size={15}/> 浏览器信息</div>
      {url&&<div className="reality-browser-bar"><span/>{text(url)}</div>}
      {title&&<div className="reality-browser-title">{text(title)}</div>}
      {typeof screenshot==="string"&&/^https?:\/\//i.test(screenshot)&&<img className="reality-screenshot" src={screenshot} alt="Agent captured browser state"/>}
      {!url&&!title&&!screenshot&&<div className="reality-empty-visual">已识别为浏览器类动作，但执行端尚未上报页面截图或 URL。</div>}
    </div>}

    {adapter==="retrieval" && <div className="reality-visual-block">
      <div className="reality-block-head"><Database size={15}/> 检索结果</div>
      {Array.isArray(sources)?<div className="reality-source-list">{sources.slice(0,6).map((item:any,i:number)=><div className="reality-source" key={i}><div className="reality-source-index">{String(i+1).padStart(2,"0")}</div><div><strong>{text(item?.title||item?.name||item?.docTitle||"检索来源")}</strong><p>{text(item?.snippet||item?.content||item?.text||item?.section||"来源已返回，暂无摘要")}</p></div><span>{typeof item?.score==="number"?item.score.toFixed(2):"SOURCE"}</span></div>)}</div>:<div className="reality-empty-visual">{sources===undefined?"检索来源尚未采集":summarize(sources)}</div>}
    </div>}

    {adapter==="code" && <div className="reality-visual-block">
      <div className="reality-block-head"><Code2 size={15}/> 代码变更</div>
      {files!==undefined&&<div className="reality-data-chip"><FileCode2 size={14}/>{summarize(files)}</div>}
      {diff!==undefined?<pre className="reality-code-preview">{text(diff).slice(0,2400)}</pre>:<div className="reality-empty-visual">文件操作已识别；执行端未上报 Diff 内容。</div>}
    </div>}

    {adapter==="approval" && <div className="reality-approval">
      <ShieldAlert size={20}/><div><strong>安全边界 / 人工授权</strong><p>{approval!==undefined?text(approval):"未收到明确的审批状态"}</p></div>
    </div>}

    {adapter==="agent" && <div className="reality-visual-block"><div className="reality-block-head"><Network size={15}/> Agent 交接</div><div className="reality-empty-visual">{summarize(result??args)}</div></div>}

    {adapter==="terminal" && <div className="reality-visual-block"><div className="reality-block-head"><Terminal size={15}/> 命令执行</div><pre className="reality-code-preview">{text(args??"命令参数未上报")}</pre>{result!==undefined&&<pre className="reality-code-preview">{text(result).slice(0,1800)}</pre>}</div>}

    {adapter==="model" && <div className="reality-visual-block">
      <div className="reality-block-head"><BrainCircuit size={15}/> 模型请求</div>
      <div className="reality-git-target"><div><small>模型</small><strong>{model?text(model):"未上报"}</strong></div><div><small>Provider</small><strong>{provider?text(provider):"未上报"}</strong></div></div>
      {decision!==undefined&&<div className="reality-empty-visual mt-3"><strong>显式行动摘要</strong><br/>{text(decision)}</div>}
      {visiblePromptMessages&&<div className="mt-3 grid gap-2">{visiblePromptMessages.map((item:any,index:number)=><div className="reality-data-row items-start" key={index}><span className="!flex-none !w-20 text-cyan-200">{String(item?.role||"message").toUpperCase()}</span><span className="whitespace-pre-wrap break-words !overflow-visible !whitespace-normal">{messageText(item?.content??item?.message??item).slice(0,2400)}</span></div>)}</div>}
      {promptMessages===undefined&&<div className="reality-empty-visual mt-3">模型请求消息未采集。可以在后端启用请求内容采集后显示真实消息。</div>}
      {modelResponse!==undefined&&<div className="reality-code-preview">{(toRealityMessageList(visibleModelResponse)||[visibleModelResponse]).map(messageText).join("\n\n").slice(0,4000)}</div>}
      {(inputTokens!==undefined||outputTokens!==undefined||totalTokens!==undefined)&&<div className="reality-git-target mt-3"><div><small>输入 Token</small><strong>{inputTokens!==undefined?text(inputTokens):"未上报"}</strong></div><div><small>输出 Token</small><strong>{outputTokens!==undefined?text(outputTokens):"未上报"}</strong></div></div>}<div className="mt-3 text-[10px] text-indigo-100/40">展示实际请求与响应，不展示或伪造模型隐藏思维链。</div>
    </div>}

    {adapter==="generic" && (step.rightSubtitle||step.leftSummary) && <div className="reality-visual-block"><div className="reality-block-head"><Layers3 size={15}/> 事件说明</div><div className="reality-empty-visual">{step.rightSubtitle||step.leftSummary}</div></div>}

    {adapter!=="model" && args!==undefined && <details className="reality-raw"><summary>查看本次动作的真实输入</summary><pre>{text(args)}</pre></details>}
    {adapter!=="model" && result!==undefined && <details className="reality-raw"><summary>工具返回</summary><pre>{text(result)}</pre></details>}
    {adapter!=="model"&&why!==undefined&&<div className="reality-visual-block"><div className="reality-block-head"><Activity size={15}/> 执行端上报的原因</div><div className="reality-empty-visual">{text(why)}</div></div>}
    {nextAction!==undefined&&<div className="reality-visual-block"><div className="reality-block-head"><Activity size={15}/> 执行端上报的后续动作</div><div className="reality-empty-visual">{text(nextAction)}</div></div>}
    {(result!==undefined||totalTokens!==undefined||read(d.usage,["total_tokens","totalTokens"])!==undefined||typeof step.durationMs==="number")&&<div className="reality-result-strip">
      {result!==undefined&&<div><small>工具返回</small><strong>{summarize(result)}</strong></div>}
      {(totalTokens!==undefined||read(d.usage,["total_tokens","totalTokens"])!==undefined)&&<div><small>Token</small><strong>{text(totalTokens??read(d.usage,["total_tokens","totalTokens"]))}</strong></div>}
      {typeof step.durationMs==="number"&&<div><small>耗时</small><strong>{duration}</strong></div>}
    </div>}
    <details className="reality-raw"><summary>原始事件数据（已隐藏内部推理字段）</summary><pre>{text(stripInternalReasoning(d))}</pre></details>
  </div>;
};


export const AgentRealityCanvas:React.FC<Props> = ({timeline,message,activeStepId,onSelectStep,isThinking,onRetryRun}) => {
  const ordered=useMemo(()=>sortTimeline(timeline||[]),[timeline]);
  const [localSelected,setLocalSelected]=useState<string|null>(null);
  const selected=ordered.find(s=>s.stepId===activeStepId)||ordered.find(s=>s.stepId===localSelected)||ordered.find(s=>s.status==="running")||ordered[ordered.length-1];
  const running=ordered.filter(s=>s.status==="running").length;
  const failed=ordered.filter(s=>s.status==="failed").length;
  const completed=ordered.filter(s=>s.status==="done"||s.status==="passed").length;
  const live=!!isThinking||running>0;
  const select=(s:AgentStep)=>{setLocalSelected(s.stepId);onSelectStep?.(s.stepId)};
  const getTitle=(s:AgentStep)=>toolOf(s)||s.rightTitle||s.leftTitle||"执行事件";
  const getSummary=(s:AgentStep)=>s.rightSubtitle||s.leftSummary||"";
  const fmtDuration=(v?:number)=>typeof v!=="number"||!Number.isFinite(v)||v<0?"未上报":v>=1000?(v/1000).toFixed(2)+" 秒":Math.round(v)+" 毫秒";
  const tone=(s:AgentStep)=>s.status==="failed"?"rose":s.status==="running"?"cyan":s.status==="done"||s.status==="passed"?"emerald":s.status==="pending"?"slate":"amber";
  const statusLabel=(s:AgentStep)=>status[s.status]?.label||"状态未上报";
  return <section className="reality-flow h-full min-h-0 flex flex-col text-slate-100">
    <style>{`
      .reality-flow{background:radial-gradient(ellipse at 22% 0%,rgba(55,103,184,.22),transparent 38%),linear-gradient(145deg,#070b18,#0b1225 58%,#090d1b);position:relative;isolation:isolate}
      .reality-flow:before{content:"";position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.32;background-image:linear-gradient(rgba(138,175,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(138,175,255,.045) 1px,transparent 1px);background-size:42px 42px;mask-image:linear-gradient(180deg,#000,transparent)}
      .reality-flow .flow-scroll{scrollbar-width:thin;scrollbar-color:#607aa866 transparent}
      .reality-flow .flow-event{position:relative;display:grid;grid-template-columns:30px minmax(0,1fr);gap:13px;width:100%;text-align:left}
      .reality-flow .flow-event:not(:last-child):before{content:"";position:absolute;left:14px;top:31px;bottom:-16px;width:1px;background:linear-gradient(#68c9ed66,#7182b522)}
      .reality-flow .flow-dot{position:relative;z-index:1;width:29px;height:29px;display:grid;place-items:center;border-radius:50%;border:1px solid #7894c655;background:#101b31;color:#a8c9ec}
      .reality-flow .flow-event[aria-pressed=true] .flow-dot{border-color:#77e2ff;background:#12334a;color:#c5f5ff;box-shadow:0 0 0 4px #62d8ff12,0 0 24px #42caff35}
      .reality-flow .flow-body{border:1px solid #91a8d51b;border-radius:15px;background:linear-gradient(110deg,#111b2dcc,#0b1323cc);padding:13px 15px;transition:border-color .2s,background .2s}
      .reality-flow .flow-event[aria-pressed=true] .flow-body{border-color:#6acdf366;background:linear-gradient(110deg,#132b40,#101b32);box-shadow:inset 2px 0 #67d8f4}
      .reality-flow .flow-event:hover .flow-body{border-color:#8ebde044}
      .reality-flow .flow-inspector{background:linear-gradient(155deg,#111b30,#080e1c);border:1px solid #91a8d51c;border-radius:20px;overflow:auto}
      .reality-flow .flow-inspector pre{white-space:pre-wrap;overflow-wrap:anywhere}
      @media(max-width:900px){.reality-flow .flow-layout{grid-template-columns:minmax(0,1fr)!important;overflow:auto}.reality-flow .flow-inspector{min-height:320px}}
      @media(prefers-reduced-motion:reduce){.reality-flow *{transition:none!important;animation:none!important}}
    `}</style>
    <header className="relative z-10 flex flex-wrap items-center gap-4 border-b border-slate-300/10 px-5 py-4">
      <div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100"><Orbit size={20}/></div>
      <div className="min-w-0 flex-1"><div className="text-[9px] font-mono tracking-[.2em] text-cyan-200/65">OWNAGENT / EXECUTION SPACE</div><h2 className="mt-1 text-sm font-bold tracking-wide text-white">任务执行现场</h2><p className="mt-1 truncate text-[11px] text-slate-400">{message?.userPrompt||"从 Agent 的真实事件中，还原任务如何一步步完成"}</p></div>
      <div className="flex items-center gap-4 text-center text-[10px] text-slate-400"><span><b className="block text-base text-white">{ordered.length}</b>已采集事件</span><span><b className="block text-base text-emerald-300">{completed}</b>已完成</span>{failed>0&&<span><b className="block text-base text-rose-300">{failed}</b>异常</span>}<span className={`rounded-full border px-3 py-1.5 font-mono ${live?"border-cyan-300/30 bg-cyan-300/10 text-cyan-100":"border-slate-400/20 bg-slate-400/5 text-slate-400"}`}>{live?"● LIVE":ordered.length?"◉ RECORDED":"○ STANDBY"}</span></div>
    </header>
    <AgentPrismTraceTree timeline={ordered}/>
    <div className="flow-layout relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1.05fr)_minmax(300px,.95fr)] gap-4 overflow-hidden p-4">
      <section className="flow-scroll min-h-0 overflow-y-auto pr-2">
        <div className="mb-4 flex items-end justify-between"><div><div className="text-[9px] font-mono tracking-[.2em] text-cyan-200/55">TASK NARRATIVE</div><h3 className="mt-1 text-xs font-semibold text-white">发生了什么</h3></div><span className="text-[10px] text-slate-500">按采集顺序呈现 · 非隐藏思维链</span></div>
        {ordered.length===0?<div className="flex min-h-[330px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-400/20 bg-slate-900/30 px-8 text-center"><div className="grid h-16 w-16 place-items-center rounded-full border border-cyan-200/20 bg-cyan-300/5 text-cyan-100"><Orbit size={28}/></div><h3 className="mt-5 text-sm font-semibold text-white">{live?"正在等待第一条执行事件":"等待 Agent 启动"}</h3><p className="mt-2 max-w-sm text-xs leading-6 text-slate-400">真实模型请求、工具调用和执行结果抵达后，会按发生顺序出现在这里。尚未采集到的步骤不会被补造。</p></div>:<div className="space-y-4 pb-6">{ordered.map((step,index)=>{const I=adapterMeta[adapterOf(step)].icon;return <button key={step.stepId} type="button" className="flow-event" onClick={()=>select(step)} aria-pressed={selected?.stepId===step.stepId}><span className="flow-dot"><I size={14}/></span><span className="flow-body block min-w-0"><span className="flex flex-wrap items-center gap-2"><b className="min-w-0 flex-1 truncate text-[12px] text-white">{getTitle(step)}</b><span className={`text-[9px] font-medium ${tone(step)==="rose"?"text-rose-300":tone(step)==="cyan"?"text-cyan-200":tone(step)==="emerald"?"text-emerald-300":tone(step)==="amber"?"text-amber-200":"text-slate-400"}`}>{statusLabel(step)}</span></span><span className="mt-1 block text-[10px] text-cyan-100/55">{fmtDuration(step.durationMs)}</span>{getSummary(step)&&<span className="mt-2 block whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-400">{getSummary(step)}</span>}<span className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-[9px] text-slate-500"><span>查看详情</span><span>{selected?.stepId===step.stepId?"正在查看":"查看执行证据 →"}</span></span></span></button>})}</div>}
      </section>
      <aside className="flow-inspector flow-scroll min-h-0">
        {selected?<><div className="border-b border-slate-300/10 p-4"><div className="text-[9px] font-mono tracking-[.2em] text-cyan-200/60">EXECUTION EVIDENCE / EVENT {ordered.findIndex(s=>s.stepId===selected.stepId)+1}</div><h3 className="mt-2 break-words text-sm font-bold text-white">{getTitle(selected)}</h3><p className="mt-1 text-[11px] leading-5 text-slate-400">{getSummary(selected)}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full border border-slate-400/20 px-2.5 py-1 text-[10px] text-slate-300">{statusLabel(selected)}</span><span className="rounded-full border border-slate-400/20 px-2.5 py-1 text-[10px] text-slate-300">{fmtDuration(selected.durationMs)}</span></div></div><div className="p-3"><ActionVisual step={selected}/></div></>:<div className="flex h-full min-h-[280px] flex-col items-center justify-center p-8 text-center"><Layers3 size={28} className="text-cyan-200"/><h3 className="mt-4 text-sm font-semibold text-white">选择一条执行事件</h3><p className="mt-2 text-xs leading-6 text-slate-400">这里会显示该事件实际采集到的模型请求、工具输入输出、Token、异常和原始数据。</p></div>}
      </aside>
    </div>
    {failed>0&&<footer className="relative z-10 flex items-center justify-between border-t border-rose-300/10 bg-rose-950/15 px-5 py-3"><span className="text-[11px] text-rose-200/80">检测到 {failed} 条失败事件。可回到任务对话查看并决定是否重试。</span>{onRetryRun&&<button type="button" onClick={onRetryRun} className="rounded-lg border border-rose-200/20 px-3 py-1.5 text-[10px] font-semibold text-rose-100 hover:bg-rose-300/10">重新执行</button>}</footer>}
  </section>;
};
