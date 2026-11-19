import React, { useMemo, useState } from "react";
import {
  Activity, BrainCircuit, CheckCircle2, CircleHelp, Clock3, Code2, Database, Orbit, Sparkles,
  FileCode2, GitBranch, GitCommitHorizontal, Globe2, Layers3, LockKeyhole,
  Network, Radio, ShieldAlert, Terminal, XCircle, Zap
} from "lucide-react";
import { AgentStep, sortTimeline } from "@/lib/agentTimeline";
import type { TraceDrawerMessage } from "./TraceInspectorDrawer";
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

const phaseLabels:Record<string,string> = {
  intent:"理解目标", workflow:"组织行动", context:"获取信息", llm:"模型调用",
  skill:"执行能力", delivery:"整理交付", closure:"任务收束", degraded:"异常处理", external:"外部事件"
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
  const visiblePromptMessages=toRealityMessageList(promptMessages);
  const visibleModelResponse=parseStructured(modelResponse);
  const decision=read(d,["decision_summary","decisionSummary","action_summary","summary"]);
  const why=read(d,["reason","purpose","explanation"]);
  const nextAction=read(d,["next_action","nextAction","next_step","handoff_target"]);
  const duration=typeof step.durationMs==="number" ? (step.durationMs>=1000?(step.durationMs/1000).toFixed(2)+" 秒":Math.round(step.durationMs)+" 毫秒") : "未上报";
  return <div className="reality-inspector">
    <div className="reality-action-summary">
      <div className="reality-summary-orb"><Zap size={18}/></div>
      <div className="min-w-0 flex-1">
        <div className="reality-eyebrow">OBSERVED EVENT · {adapterMeta[adapter].label}</div>
        <div className="reality-summary-title">{toolOf(step)||step.rightTitle||step.leftTitle}</div>
        <p>{step.rightSubtitle||step.leftSummary||"执行端未上报说明"}</p>
      </div>
      <div className="reality-duration"><Clock3 size={13}/>{duration}</div>
    </div>

    {adapter==="git" && <div className="reality-visual-block">
      <div className="reality-block-head"><GitBranch size={15}/> 仓库状态空间 <span>GIT ADAPTER</span></div>
      <div className="reality-git-target">
        <div><small>仓库</small><strong>{repo?text(repo):"未上报"}</strong></div>
        <div><small>分支</small><strong>{branch?text(branch):"未上报"}</strong></div>
      </div>
      {Array.isArray(commits)&&<div className="reality-data-list">{commits.slice(0,5).map((item:any,i:number)=><div className="reality-data-row" key={i}><GitCommitHorizontal size={14}/><span>{text(item?.message||item?.title||item?.sha||item).slice(0,100)}</span><small>{item?.author||""}</small></div>)}</div>}
      {files!==undefined&&<div className="reality-data-chip"><FileCode2 size={14}/> 变更对象：{summarize(files)}</div>}
      {diff!==undefined&&<pre className="reality-code-preview">{text(diff).slice(0,1600)}</pre>}
    </div>}

    {adapter==="browser" && <div className="reality-visual-block">
      <div className="reality-block-head"><Globe2 size={15}/> 浏览器现场 <span>COMPUTER USE</span></div>
      {url&&<div className="reality-browser-bar"><span/>{text(url)}</div>}
      {title&&<div className="reality-browser-title">{text(title)}</div>}
      {typeof screenshot==="string"&&/^https?:\/\//i.test(screenshot)&&<img className="reality-screenshot" src={screenshot} alt="Agent captured browser state"/>}
      {!url&&!title&&!screenshot&&<div className="reality-empty-visual">已识别为浏览器类动作，但执行端尚未上报页面截图或 URL。</div>}
    </div>}

    {adapter==="retrieval" && <div className="reality-visual-block">
      <div className="reality-block-head"><Database size={15}/> 信息检索现场 <span>RETRIEVAL</span></div>
      {Array.isArray(sources)?<div className="reality-source-list">{sources.slice(0,6).map((item:any,i:number)=><div className="reality-source" key={i}><div className="reality-source-index">{String(i+1).padStart(2,"0")}</div><div><strong>{text(item?.title||item?.name||item?.docTitle||"检索来源")}</strong><p>{text(item?.snippet||item?.content||item?.text||item?.section||"来源已返回，暂无摘要")}</p></div><span>{typeof item?.score==="number"?item.score.toFixed(2):"SOURCE"}</span></div>)}</div>:<div className="reality-empty-visual">{sources===undefined?"检索来源尚未采集":summarize(sources)}</div>}
    </div>}

    {adapter==="code" && <div className="reality-visual-block">
      <div className="reality-block-head"><Code2 size={15}/> 代码变更现场 <span>CODE ADAPTER</span></div>
      {files!==undefined&&<div className="reality-data-chip"><FileCode2 size={14}/>{summarize(files)}</div>}
      {diff!==undefined?<pre className="reality-code-preview">{text(diff).slice(0,2400)}</pre>:<div className="reality-empty-visual">文件操作已识别；执行端未上报 Diff 内容。</div>}
    </div>}

    {adapter==="approval" && <div className="reality-approval">
      <ShieldAlert size={20}/><div><strong>安全边界 / 人工授权</strong><p>{approval!==undefined?text(approval):"未收到明确的审批状态"}</p></div>
    </div>}

    {adapter==="agent" && <div className="reality-visual-block"><div className="reality-block-head"><Network size={15}/> Agent 任务交接 <span>HANDOFF</span></div><div className="reality-empty-visual">{summarize(result??args)}</div></div>}

    {adapter==="terminal" && <div className="reality-visual-block"><div className="reality-block-head"><Terminal size={15}/> 命令执行 <span>RUNTIME</span></div><pre className="reality-code-preview">{text(args??"命令参数未上报")}</pre>{result!==undefined&&<pre className="reality-code-preview">{text(result).slice(0,1800)}</pre>}</div>}

    {adapter==="model" && <div className="reality-visual-block">
      <div className="reality-block-head"><BrainCircuit size={15}/> 模型调用现场 <span>INFERENCE</span></div>
      <div className="reality-git-target"><div><small>模型</small><strong>{model?text(model):"未上报"}</strong></div><div><small>Provider</small><strong>{provider?text(provider):"未上报"}</strong></div></div>
      {decision!==undefined&&<div className="reality-empty-visual mt-3"><strong>显式行动摘要</strong><br/>{text(decision)}</div>}
      {visiblePromptMessages&&<div className="mt-3 grid gap-2">{visiblePromptMessages.map((item:any,index:number)=><div className="reality-data-row items-start" key={index}><span className="!flex-none !w-20 text-cyan-200">{String(item?.role||"message").toUpperCase()}</span><span className="whitespace-pre-wrap break-words !overflow-visible !whitespace-normal">{messageText(item?.content??item?.message??item).slice(0,2400)}</span></div>)}</div>}
      {promptMessages===undefined&&<div className="reality-empty-visual mt-3">模型请求消息未采集。可以在后端启用请求内容采集后显示真实消息。</div>}
      {modelResponse!==undefined&&<div className="reality-code-preview">{(toRealityMessageList(visibleModelResponse)||[visibleModelResponse]).map(messageText).join("\n\n").slice(0,4000)}</div>}
      {(inputTokens!==undefined||outputTokens!==undefined||totalTokens!==undefined)&&<div className="reality-git-target mt-3"><div><small>输入 Token</small><strong>{inputTokens!==undefined?text(inputTokens):"未上报"}</strong></div><div><small>输出 Token</small><strong>{outputTokens!==undefined?text(outputTokens):"未上报"}</strong></div></div>}<div className="mt-3 text-[10px] text-indigo-100/40">展示实际请求与响应，不展示或伪造模型隐藏思维链。</div>
    </div>}

    {adapter==="generic" && <div className="reality-visual-block"><div className="reality-block-head"><Layers3 size={15}/> 执行现场 <span>EVENT DATA</span></div><div className="reality-empty-visual">{step.rightSubtitle||step.leftSummary||"执行端只上报了事件基础信息。"}</div></div>}

    {adapter!=="model" && args!==undefined && <details className="reality-raw"><summary>查看本次动作的真实输入</summary><pre>{text(args)}</pre></details>}
    {adapter!=="model" && result!==undefined && <details className="reality-raw"><summary>查看本次动作的真实返回</summary><pre>{text(result)}</pre></details>}
    {why!==undefined&&<div className="reality-visual-block"><div className="reality-block-head"><Activity size={15}/> 执行端上报的原因</div><div className="reality-empty-visual">{text(why)}</div></div>}
    {nextAction!==undefined&&<div className="reality-visual-block"><div className="reality-block-head"><Activity size={15}/> 执行端上报的后续动作</div><div className="reality-empty-visual">{text(nextAction)}</div></div>}
    <div className="reality-result-strip">
      <div><small>真实返回</small><strong>{result!==undefined?summarize(result):"尚未上报"}</strong></div>
      <div><small>Token 用量</small><strong>{totalTokens!==undefined?text(totalTokens):read(d.usage,["total_tokens","totalTokens"])??"未上报"}</strong></div>
      <div><small>耗时</small><strong>{duration}</strong></div>
    </div>
    <details className="reality-raw"><summary>开发者视图 · 原始事件数据</summary><pre>{text(d)}</pre></details>
  </div>;
};


export const AgentRealityCanvas:React.FC<Props> = ({timeline,message,activeStepId,onSelectStep,isThinking,onRetryRun}) => {
 const ordered=useMemo(()=>sortTimeline(timeline||[]),[timeline]);
 const [localSelected,setLocalSelected]=useState<string|null>(null);
 const selected=ordered.find(s=>s.stepId===activeStepId)||ordered.find(s=>s.stepId===localSelected)||ordered.find(s=>s.status==="running")||ordered[ordered.length-1];
 const running=ordered.find(s=>s.status==="running"), failed=ordered.filter(s=>s.status==="failed").length, completed=ordered.filter(s=>s.status==="done"||s.status==="passed").length;
 const live=!!isThinking||!!running;
 const select=(s:AgentStep)=>{setLocalSelected(s.stepId);onSelectStep?.(s.stepId)};
 const points=ordered.map((step,index)=>{const angle=-Math.PI/2+index*2.399963229728653,r=Math.min(35,12+Math.sqrt(index+1)*8);return {step,x:50+Math.cos(angle)*r,y:50+Math.sin(angle)*r*.72}});
 const get=(obj:any,keys:string[])=>{for(const k of keys){const v=k.split(".").reduce((a:any,p:string)=>a?.[p],obj);if(v!==undefined&&v!==null)return v}return undefined};
 const fmt=(v:any)=>v===undefined||v===null?"未上报":typeof v==="string"?v:JSON.stringify(v,null,2);
 const dur=(v?:number)=>typeof v!=="number"||!Number.isFinite(v)||v<0?"未上报":v>=1000?(v/1000).toFixed(2)+"s":Math.round(v)+"ms";
 const title=(s:AgentStep)=>String(get(s.rightDetail||{},["gen_ai.tool.name","mcp.tool.name","tool","tool_name","toolName"])||s.rightTitle||s.leftTitle||phaseLabels[s.phase]||"执行事件");
 const summary=(s:AgentStep)=>s.rightSubtitle||s.leftSummary||"执行端未上报说明";
 const colors:Record<string,string>={running:"#67e8f9",done:"#6ee7b7",passed:"#6ee7b7",failed:"#fb7185",pending:"#94a3b8",unknown:"#fbbf24"};
 const detail=selected?.rightDetail||{};
 const prompt=get(detail,["gen_ai.input.messages","prompt_messages","promptMessages","messages","llm_messages"]);
 const response=get(detail,["gen_ai.output.messages","model_response","modelResponse","completion","assistant_message"]);
 const args=get(detail,["gen_ai.tool.call.arguments","mcp.tool.arguments","arguments","args","parameters","tool_input","input"]);
 const result=get(detail,["gen_ai.tool.call.result","mcp.tool.result","result","tool_result","tool_output","output","response"]);
 const model=get(detail,["gen_ai.request.model","model","actual_model","modelName"]), provider=get(detail,["gen_ai.system","provider","provider_route"]);
 const inputTokens=get(detail,["gen_ai.usage.input_tokens","input_tokens","prompt_tokens"]), outputTokens=get(detail,["gen_ai.usage.output_tokens","output_tokens","completion_tokens"]), totalTokens=get(detail,["gen_ai.usage.total_tokens","total_tokens","totalTokens"]);
 const error=get(detail,["error","error.message","error_message","exception"]);
 const modelEvent=!!selected&&(selected.phase==="llm"||model!==undefined||prompt!==undefined);
 const Icon=selected?adapterMeta[adapterOf(selected)].icon:BrainCircuit;
 return <section className="dream-orbit h-full min-h-0 flex flex-col text-slate-100" style={{background:"radial-gradient(ellipse at 50% 40%,rgba(54,77,165,.28),transparent 42%),linear-gradient(145deg,#050817,#0b1028 55%,#09091b)",overflow:"hidden",position:"relative"}}>
 <style>{".dream-orbit .dream-node{position:absolute;transform:translate(-50%,-50%);width:clamp(92px,13vw,145px);min-height:54px;display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(143,180,255,.25);border-radius:14px;background:linear-gradient(140deg,rgba(22,37,78,.96),rgba(9,16,40,.96));box-shadow:0 10px 30px #0005;color:#e5f0ff;text-align:left;z-index:3;transition:all .25s}.dream-orbit .dream-node[aria-pressed=true]{border-color:#7debff;box-shadow:0 0 0 1px #69ddff44,0 0 30px #4abfff55;background:linear-gradient(140deg,#23517c,#27215e)}.dream-orbit .dream-node:hover{transform:translate(-50%,-50%) scale(1.05)}.dream-orbit .dream-ring{position:absolute;left:50%;top:50%;width:66%;height:55%;border:1px solid #74c9ff28;border-radius:50%;transform:translate(-50%,-50%) rotate(-22deg)}.dream-orbit .dream-ring.r2{width:84%;height:76%;transform:translate(-50%,-50%) rotate(35deg);border-color:#af8fff28}.dream-orbit .dream-ring.r3{width:46%;height:90%;transform:translate(-50%,-50%) rotate(68deg);border-color:#70e7d81c}.dream-orbit .dream-core{position:absolute;left:50%;top:50%;width:112px;height:112px;transform:translate(-50%,-50%);display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle,#80ebff44,#616ee822 50%,transparent 72%);filter:drop-shadow(0 0 28px #53c2ff55)}.dream-orbit .dream-core:before,.dream-orbit .dream-core:after{content:'';position:absolute;inset:12px;border:1px solid #84e1ff88;border-radius:50%;animation:dreamPulse 4s ease-in-out infinite}.dream-orbit .dream-core:after{inset:-9px;border-color:#b392ff55;transform:rotateX(66deg);animation:dreamSpin 22s linear infinite}.dream-orbit .dream-inspector{border:1px solid #95a8ff2b;border-radius:22px;background:linear-gradient(155deg,#111b3df0,#080d21f5);overflow:auto}.dream-orbit .dream-box{margin:10px 14px;padding:11px;border:1px solid #89a5eb2b;border-radius:12px;background:#040a1c99}.dream-orbit .dream-box pre{max-height:190px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:#c7d9f5;font:10px/1.6 ui-monospace,monospace}.dream-orbit .dream-label{font-size:10px;color:#8fb9dc;font-weight:700;margin-bottom:7px}.dream-orbit .dream-scroll::-webkit-scrollbar{width:5px}.dream-orbit .dream-scroll::-webkit-scrollbar-thumb{background:#849ee455;border-radius:8px}@keyframes dreamPulse{50%{opacity:1;box-shadow:0 0 35px #60caff66}}@keyframes dreamSpin{to{transform:rotateX(66deg) rotateZ(335deg)}}@media(max-width:1050px){.dream-orbit .dream-layout{grid-template-columns:minmax(0,1fr)!important;overflow:auto}.dream-orbit .dream-world{min-height:430px}.dream-orbit .dream-inspector{min-height:380px}}@media(max-width:640px){.dream-orbit .dream-node{width:92px;padding:6px}.dream-orbit .dream-layout{padding:8px!important}.dream-orbit .dream-world{min-height:380px}}@media(prefers-reduced-motion:reduce){.dream-orbit *{animation:none!important;transition:none!important}}"}
 </style>
 <header className="relative z-10 flex items-center gap-4 border-b border-indigo-200/10 bg-indigo-950/30 px-5 py-4">
  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-500/10"><Orbit size={22}/></div>
  <div className="min-w-0"><div className="text-[9px] font-mono tracking-[.22em] text-cyan-200/80">OWNAGENT · REALITY ENGINE</div><h2 className="text-sm font-black tracking-[.14em] text-white">DREAM ORBIT</h2><p className="mt-1 max-w-[48vw] truncate text-[11px] text-indigo-100/55">{message?.userPrompt||"Agent 的每一次真实行动，都会在这里留下轨迹"}</p></div>
  <div className="ml-auto flex items-center gap-4 text-[10px] text-indigo-100/55"><span><b className="block text-base text-white">{ordered.length}</b>已采集事件</span><span><b className="block text-base text-white">{completed}</b>已完成</span>{failed>0&&<span><b className="block text-base text-rose-300">{failed}</b>异常</span>}<span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1.5 font-mono text-cyan-100">{live?"● LIVE":ordered.length?"◉ SESSION":"○ STANDBY"}</span></div>
 </header>
 <div className="dream-layout relative z-10 grid min-h-0 flex-1 grid-cols-[minmax(0,1.12fr)_minmax(330px,.88fr)] gap-4 overflow-hidden p-4">
  <div className="dream-world relative flex min-h-[420px] flex-col overflow-hidden rounded-[24px] border border-indigo-200/15 bg-slate-950/25 shadow-2xl shadow-black/20">
   <div className="relative z-10 flex items-center justify-between px-5 py-4"><div><div className="text-[9px] font-mono tracking-[.2em] text-cyan-200/70">THE EXECUTION UNIVERSE</div><h3 className="mt-1 text-xs font-bold text-white">行动宇宙</h3><p className="mt-1 text-[10px] text-indigo-100/45">真实事件抵达时，星体才会出现</p></div><span className="font-mono text-[9px] text-indigo-100/45">{String(ordered.length).padStart(2,"0")} SIGNALS</span></div>
   <div className="relative min-h-[320px] flex-1 overflow-hidden" style={{backgroundImage:"radial-gradient(1px 1px at 20% 20%,#fff8 50%,transparent),radial-gradient(1px 1px at 70% 15%,#b8eaff99 50%,transparent),radial-gradient(1px 1px at 82% 76%,#fff8 50%,transparent)",backgroundSize:"160px 140px"}}>
    <div className="dream-ring"/><div className="dream-ring r2"/><div className="dream-ring r3"/>
    <div className="dream-core"><div className="relative z-10 grid h-14 w-14 place-items-center rounded-2xl border border-cyan-100/40 bg-gradient-to-br from-cyan-400/20 to-violet-500/30 text-cyan-100 shadow-xl shadow-cyan-400/20"><BrainCircuit size={27}/></div><span className="absolute top-[calc(100%+10px)] whitespace-nowrap font-mono text-[9px] tracking-[.18em] text-cyan-100/70">AGENT CORE</span></div>
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">{points.map(p=><line key={p.step.stepId} x1="50" y1="50" x2={p.x} y2={p.y} stroke="rgba(116,207,255,.34)" strokeWidth=".22" strokeDasharray="1.2 1.8"/>)}</svg>
    {points.map(({step,x,y})=>{const I=adapterMeta[adapterOf(step)].icon;return <button key={step.stepId} type="button" className="dream-node" style={{left:x+"%",top:y+"%","--node-color":colors[step.status]||colors.unknown} as React.CSSProperties} onClick={()=>select(step)} aria-pressed={selected?.stepId===step.stepId}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-cyan-200/20 bg-cyan-300/10 text-cyan-100"><I size={14}/></span><span className="min-w-0"><b className="block truncate text-[10px]">{title(step)}</b><small className="mt-1 block truncate text-[9px] text-indigo-100/50">{phaseLabels[step.phase]||"执行事件"} · {dur(step.durationMs)}</small></span><i className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full" style={{background:colors[step.status]||colors.unknown,boxShadow:"0 0 9px currentColor"}}/></button>})}
    {ordered.length===0&&<div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"><Sparkles size={34} className="text-cyan-200"/><h3 className="mt-4 text-sm font-semibold text-white">{live?"正在等待第一束信号":"等待 Agent 苏醒"}</h3><p className="mt-3 max-w-xs text-xs leading-6 text-indigo-100/55">当 Agent 真正调用模型、使用工具或执行操作时，这里才会生成对应星体。没有上报的步骤不会被虚构。</p></div>}
   </div>
   <div className="relative z-10 flex items-center justify-between border-t border-indigo-200/10 px-5 py-3 text-[10px] text-indigo-100/50"><span>当前聚焦：<b className="text-cyan-100">{active?title(active):"等待任务启动"}</b></span><span>{live?"信号流入中":"事件轨迹已静止"}</span></div>
  </div>
  <aside className="dream-inspector dream-scroll min-h-0">
   {selected?<><div className="flex items-start gap-3 border-b border-indigo-200/10 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-cyan-200/25 bg-cyan-300/10 text-cyan-100">{React.createElement(Icon,{size:21})}</div><div className="min-w-0 flex-1"><div className="text-[9px] font-mono tracking-[.18em] text-cyan-200/70">EVENT DETAIL / {phaseLabels[selected.phase]||"EXECUTION"}</div><h3 className="mt-1 break-words text-sm font-bold text-white">{title(selected)}</h3><p className="mt-1 text-[11px] leading-5 text-indigo-100/55">{summary(selected)}</p></div><span className="text-[10px]" style={{color:colors[selected.status]||colors.unknown}}>{status[selected.status]?.label||"状态未上报"}</span></div>
    <div className="grid grid-cols-2 gap-2 border-b border-indigo-200/10 p-3 sm:grid-cols-4"><div className="rounded-xl border border-indigo-200/10 bg-black/20 p-2"><small className="text-[9px] text-indigo-100/40">持续时间</small><b className="mt-1 block text-[11px] text-white">{dur(selected.durationMs)}</b></div><div className="rounded-xl border border-indigo-200/10 bg-black/20 p-2"><small className="text-[9px] text-indigo-100/40">模型</small><b className="mt-1 block break-all text-[11px] text-white">{fmt(model)}</b></div><div className="rounded-xl border border-indigo-200/10 bg-black/20 p-2"><small className="text-[9px] text-indigo-100/40">Provider</small><b className="mt-1 block break-all text-[11px] text-white">{fmt(provider)}</b></div><div className="rounded-xl border border-indigo-200/10 bg-black/20 p-2"><small className="text-[9px] text-indigo-100/40">Token 总量</small><b className="mt-1 block text-[11px] text-white">{fmt(totalTokens)}</b></div></div>
    {modelEvent?<section className="border-b border-indigo-200/10 p-4"><div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-cyan-100"><BrainCircuit size={15}/>模型这一轮实际收到了什么</div>{Array.isArray(prompt)?prompt.map((m:any,i:number)=><div className="dream-box" key={i}><div className="dream-label">{String(m?.role||"message").toUpperCase()}</div><pre>{fmt(m?.content??m?.message??m)}</pre></div>):<div className="dream-box"><div className="dream-label">实际请求消息</div><pre>{fmt(prompt)}</pre></div>}<div className="dream-box"><div className="dream-label">模型实际响应</div><pre>{fmt(response)}</pre></div><div className="flex gap-4 px-1 text-[10px] text-indigo-100/65"><span>↓ 输入 Token：{fmt(inputTokens)}</span><span>↑ 输出 Token：{fmt(outputTokens)}</span></div><p className="mt-3 text-[9px] text-indigo-100/35">这里只展示实际采集到的请求与响应，不展示或推测模型隐藏思维链。</p></section>:<section className="border-b border-indigo-200/10 p-4"><div className="mb-3 flex items-center gap-2 text-[11px] font-bold text-cyan-100"><Zap size={15}/>这次行动的真实输入与结果</div><div className="dream-box"><div className="dream-label">实际输入 / 参数</div><pre>{fmt(args)}</pre></div><div className="dream-box"><div className="dream-label">执行端实际返回</div><pre>{fmt(result)}</pre></div></section>}
    {error!==undefined&&<div className="dream-box border-rose-300/20"><div className="dream-label text-rose-200">异常详情</div><pre>{fmt(error)}</pre></div>}
    <details className="m-3 rounded-xl border border-indigo-200/10 bg-black/20 p-3"><summary className="cursor-pointer text-[10px] text-indigo-100/60">展开原始事件数据</summary><pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all text-[9px] leading-5 text-indigo-100/60">{fmt(detail)}</pre></details>
   </>:<div className="flex h-full flex-col items-center justify-center p-8 text-center"><Layers3 size={30} className="text-cyan-200"/><h3 className="mt-4 text-sm font-semibold">等待第一条真实事件</h3><p className="mt-2 text-xs leading-6 text-indigo-100/50">选择星体后，这里会展开它的真实请求、输入、输出、Token 和异常信息。</p></div>}
  </aside>
 </div>
 </section>;
};
