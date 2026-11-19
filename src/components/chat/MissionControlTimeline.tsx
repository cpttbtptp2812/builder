import React, { useMemo, useState } from "react";
import { sortTimeline, AgentStep } from "@/lib/agentTimeline";
import { Activity, CheckCircle2, Copy, Loader2, RotateCcw, XCircle, ChevronDown, BrainCircuit, Wrench, Database, Search, AlertTriangle, GitBranch, Eye, Sparkles, Terminal, FileOutput, CircleHelp } from "lucide-react";
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
  intent:{label:"理解任务",verb:"正在理解你提出的任务",icon:Search},
  workflow:{label:"安排步骤",verb:"正在组织执行顺序",icon:GitBranch},
  context:{label:"查找资料",verb:"正在获取完成任务所需的信息",icon:Database},
  llm:{label:"模型处理",verb:"正在处理信息并决定下一步操作",icon:BrainCircuit},
  skill:{label:"执行操作",verb:"正在使用工具完成一项操作",icon:Wrench},
  delivery:{label:"整理结果",verb:"正在整理本次任务的结果",icon:FileOutput},
  closure:{label:"完成任务",verb:"正在结束本轮任务",icon:CheckCircle2},
  degraded:{label:"处理异常",verb:"执行过程中遇到了问题",icon:AlertTriangle},
  external:{label:"执行活动",verb:"收到一条执行记录",icon:Activity}
};
const statusMeta: Record<string,{label:string,tone:string}> = {
  done:{label:"已完成",tone:"done"},passed:{label:"已通过",tone:"done"},
  running:{label:"正在进行",tone:"running"},failed:{label:"执行失败",tone:"failed"},
  pending:{label:"等待中",tone:"waiting"},unknown:{label:"状态未知",tone:"unknown"}
};
const toneClass: Record<string,string> = {
  done:"border-emerald-300/25 bg-emerald-400/10 text-emerald-200",
  running:"border-cyan-300/35 bg-cyan-400/10 text-cyan-100",
  failed:"border-rose-300/30 bg-rose-400/10 text-rose-200",
  unknown:"border-amber-300/30 bg-amber-400/10 text-amber-100",
  waiting:"border-white/10 bg-white/5 text-slate-300"
};
const durationText = (ms?:number) => typeof ms!=="number"||!Number.isFinite(ms)||ms<0 ? "未记录" : ms>=1000 ? (ms/1000).toFixed(2)+" 秒" : Math.round(ms)+" 毫秒";
const pretty = (value:unknown) => {
  if(value==null) return "未采集";
  if(typeof value==="string") return value;
  try{return JSON.stringify(value,null,2)}catch{return String(value)}
};
const labels:Record<string,string> = {repoId:"仓库编号",repoName:"仓库",branch:"分支",commitCount:"提交数量",sha:"提交编号",author:"提交者",commits:"提交记录",limit:"查询数量",owner:"仓库所有者",path:"文件路径",status:"执行状态",success:"是否成功",message:"说明",error:"错误信息",tool:"工具",query:"查询内容",url:"地址",total:"总数"};
const humanize = (key:string) => labels[key] || key.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/[_-]/g," ").replace(/^./,c=>c.toUpperCase());
const pick = (obj:Record<string,any>,keys:string[]) => { for(const key of keys) if(obj[key]!==undefined&&obj[key]!==null) return obj[key]; return undefined; };
const captured = (detail:Record<string,any>,keys:string[]) => {
  const attrs=detail.attributes&&typeof detail.attributes==="object"?detail.attributes:{};
  const nested=detail.rightDetail&&typeof detail.rightDetail==="object"?detail.rightDetail:{};
  const nestedAttrs=nested.attributes&&typeof nested.attributes==="object"?nested.attributes:{};
  return pick(detail,keys)??pick(attrs,keys)??pick(nested,keys)??pick(nestedAttrs,keys);
};
const summarize = (value:any):string => {
  if(value==null) return "未提供";
  if(typeof value==="string"||typeof value==="number"||typeof value==="boolean") return String(value);
  if(Array.isArray(value)) return "共 "+value.length+" 项"+(value.length?"："+value.slice(0,3).map((v:any)=>typeof v==="string"?v:v?.message||v?.title||v?.name||"一条记录").join("、"):"");
  const keys=["repoName","name","title","branch","commitCount","total","status","message","count"];
  const found=keys.filter(k=>value[k]!==undefined&&value[k]!==null).slice(0,3);
  return found.length?found.map(k=>humanize(k)+"："+summarize(value[k])).join(" · "):"已返回包含 "+Object.keys(value).length+" 个字段的数据";
};
const toolLabel = (name:string) => {
  const known:Record<string,string>={get_git_repo_status:"检查代码仓库状态",get_git_commit_history:"读取最近的代码提交",get_git_diff:"查看代码改动",get_git_file:"读取项目文件",search_code:"搜索项目代码"};
  return known[name]||name.replace(/^get_/,"").replace(/_/g," ");
};
const roleLabel = (role:unknown) => ({system:"系统指令",developer:"开发者指令",user:"用户消息",assistant:"模型回复",tool:"工具返回"} as Record<string,string>)[String(role)]||String(role||"消息");
const contentOf = (msg:any) => typeof msg==="string"?msg:typeof msg?.content==="string"?msg.content:Array.isArray(msg?.content)?msg.content.map((p:any)=>typeof p==="string"?p:p?.text||pretty(p)).join("\n"):pretty(msg);

export const MissionControlTimeline:React.FC<Props> = ({timeline,message,activeStepId,onSelectStep,isThinking,onRetryRun}) => {
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showRaw,setShowRaw]=useState(false);
  const [copied,setCopied]=useState(false);
  const ordered=useMemo(()=>sortTimeline(timeline||[]),[timeline]);
  const selected=ordered.find(s=>s.stepId===activeStepId)||ordered.find(s=>s.stepId===selectedId)||ordered.find(s=>s.status==="running")||ordered[ordered.length-1];
  const completed=ordered.filter(s=>s.status==="done"||s.status==="passed").length;
  const failures=ordered.filter(s=>s.status==="failed").length;
  const running=ordered.some(s=>s.status==="running");
  const overall=isThinking||running?{label:"正在执行",tone:"running"}:failures?{label:"执行遇到问题",tone:"failed"}:ordered.length>0&&completed===ordered.length?{label:"本轮已结束",tone:"done"}:ordered.some(s=>s.status==="unknown")?{label:"部分结果待确认",tone:"unknown"}:{label:"等待任务",tone:"waiting"};
  const detail=selected?.rightDetail||{};
  const promptMessages=captured(detail,["prompt_messages","promptMessages","messages","llm_messages"]);
  const modelResponse=captured(detail,["model_response","modelResponse","completion","assistant_message"]);
  const modelName=captured(detail,["actual_model","model"]);
  const provider=captured(detail,["provider","provider_route"]);
  const toolName=String(captured(detail,["tool","name","tool_name"])||"");
  const args=captured(detail,["tool_arguments","toolArguments","arguments","args","parameters","tool_input"]);
  const result=captured(detail,["tool_result","toolResult","result","tool_output"]);
  const input=pick(detail,["input","request","prompt"]);
  const output=pick(detail,["output","response","content"]);
  const error=captured(detail,["error","errorMessage","error_message","exception"]);
  const reason=captured(detail,["reason","why","rationale","decision_summary","decisionSummary","reasoning_summary","reasoningSummary"]);
  const usage=detail.usage||detail.tokenUsage||detail.token_usage||detail.response?.usage;
  const tokens=detail.totalTokens??detail.total_tokens??usage?.totalTokens??usage?.total_tokens;
  const meta=selected?phaseMeta[selected.phase]||phaseMeta.external:phaseMeta.external;
  const Icon=meta.icon;
  const state=selected?statusMeta[selected.status]||statusMeta.unknown:statusMeta.unknown;
  const selectedTitle=toolName?toolLabel(toolName):selected?.rightTitle||selected?.leftTitle||meta.label;
  const explanation=selected?.rightSubtitle||selected?.leftSummary||(selected?.status==="running"?meta.verb:selected?.status==="failed"?"这一步没有成功完成。可以查看实际错误信息，确认原因后再决定是否重试。":selected?.status==="done"||selected?.status==="passed"?"这一步已结束，但执行端没有提供进一步的文字说明。":selected?.status==="pending"?"这一步已被记录为等待状态。":"执行端只上报了基础事件信息，尚未提供具体操作说明。");
  const select=(step:AgentStep)=>{setSelectedId(step.stepId);setShowRaw(false);onSelectStep?.(step.stepId)};
  const copy=async()=>{if(!selected)return;try{await navigator.clipboard.writeText(JSON.stringify(selected.rightDetail||{},null,2));setCopied(true);window.setTimeout(()=>setCopied(false),1400)}catch{}};
  const hasDetail=promptMessages!==undefined||modelResponse!==undefined||args!==undefined||result!==undefined||input!==undefined||output!==undefined||error!==undefined||reason!==undefined;
  return (
    <section className="agent-journey flex h-full min-h-0 flex-col text-slate-100">
      <style>{\`
        .agent-journey{isolation:isolate;background:transparent;color:#e9edff}
        .agent-journey .journey-scroll::-webkit-scrollbar,.agent-journey .detail-scroll::-webkit-scrollbar{width:6px}
        .agent-journey .journey-scroll::-webkit-scrollbar-thumb,.agent-journey .detail-scroll::-webkit-scrollbar-thumb{background:rgba(137,159,231,.28);border-radius:8px}
        .agent-journey .journey-node:before{content:"";position:absolute;left:15px;top:34px;bottom:-18px;width:1px;background:linear-gradient(180deg,rgba(99,220,255,.55),rgba(145,119,255,.12))}
        .agent-journey .journey-node:last-child:before{display:none}
        .agent-journey .journey-node-active{background:linear-gradient(110deg,rgba(83,93,190,.25),rgba(24,133,160,.13));border-color:rgba(91,220,255,.55);box-shadow:inset 0 0 0 1px rgba(91,220,255,.08),0 0 24px rgba(53,122,221,.08)}
        .agent-journey .journey-detail{background:linear-gradient(145deg,rgba(26,37,75,.78),rgba(12,23,53,.82));border:1px solid rgba(151,169,236,.2);box-shadow:inset 0 1px rgba(255,255,255,.045)}
        .agent-journey .tech-data{background:rgba(4,10,27,.62);border:1px solid rgba(151,169,236,.16)}
        @media(prefers-reduced-motion:reduce){.agent-journey *{animation:none!important;transition:none!important}}
      \`}</style>
      <header className="shrink-0 border-b border-indigo-200/10 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><Activity className="h-4 w-4"/></span>
            <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="text-sm font-bold tracking-wide text-white">Agent 行动旅程</h2><span className={"rounded-full border px-2 py-0.5 text-[10px] font-semibold "+toneClass[overall.tone]}>{overall.label}</span></div><p className="mt-0.5 max-w-xl truncate text-xs text-indigo-100/55">{message?.userPrompt||"发送任务后，这里会实时呈现 Agent 实际完成的每一步"}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-indigo-100/65"><span><b className="text-white">{completed}</b> 步已完成</span><span><b className="text-white">{ordered.length}</b> 条实际事件</span>{failures>0&&<span className="text-rose-200"><b>{failures}</b> 项异常</span>}<span>耗时 <b className="text-white">{message?.duration||"未记录"}</b></span><span>Token <b className="text-white">{typeof tokens==="number"?tokens.toLocaleString():"未上报"}</b></span></div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-400 via-blue-400 to-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.45)] transition-all duration-500" style={{width:(ordered.length?Math.min(100,completed/ordered.length*100):0)+"%"}}/></div>
      </header>
      {ordered.length===0?(
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-8 text-center"><div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.06] text-cyan-200"><Activity className="h-7 w-7"/></div><h3 className="text-base font-semibold text-white">{isThinking?"正在等待 Agent 的第一条行动记录":"这里将展示 Agent 的行动过程"}</h3><p className="mt-2 max-w-sm text-sm leading-6 text-indigo-100/55">当 Agent 真正调用模型、使用工具或执行操作时，对应步骤会出现在这里。没有上报的数据不会被补写。</p></div>
      ):(
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(245px,0.82fr)_minmax(0,1.18fr)]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-indigo-200/10 bg-[#0c1732]/35">
            <div className="flex shrink-0 items-center justify-between border-b border-indigo-200/10 px-4 py-3"><div><h3 className="text-sm font-semibold text-white">发生了什么</h3><p className="mt-0.5 text-[11px] text-indigo-100/50">按真实发生顺序排列</p></div><span className="text-[10px] text-indigo-100/45">{ordered.length} 条记录</span></div>
            <div className="journey-scroll min-h-0 flex-1 overflow-y-auto p-3"><div className="space-y-2">{ordered.map((step,index)=>{const info=phaseMeta[step.phase]||phaseMeta.external;const StepIcon=info.icon;const tone=statusMeta[step.status]?.tone||"unknown";const active=selected?.stepId===step.stepId;const rawTool=String(step.rightDetail?.tool||step.rightDetail?.name||step.rightDetail?.tool_name||"");const stepTitle=rawTool?toolLabel(rawTool):step.rightTitle||step.leftTitle||info.label;const summary=step.rightSubtitle||step.leftSummary||info.verb;return <button key={step.stepId} type="button" onClick={()=>select(step)} aria-pressed={active} className={"journey-node relative flex w-full gap-3 rounded-xl border border-transparent px-3 py-3 text-left transition "+(active?"journey-node-active":"hover:border-indigo-200/15 hover:bg-white/[0.035]")}><span className={"relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border "+toneClass[tone]}>{tone==="running"?<Loader2 className="h-4 w-4 animate-spin"/>:tone==="done"?<CheckCircle2 className="h-4 w-4"/>:tone==="failed"?<XCircle className="h-4 w-4"/>:tone==="unknown"?<CircleHelp className="h-4 w-4"/>:<StepIcon className="h-4 w-4"/>}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-[10px] font-mono text-indigo-200/45">{String(index+1).padStart(2,"0")}</span><span className="text-sm font-semibold leading-5 text-white">{stepTitle}</span></span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-indigo-100/60">{summary}</span><span className="mt-2 flex flex-wrap items-center gap-2"><span className={"rounded-full border px-2 py-0.5 text-[10px] "+toneClass[tone]}>{statusMeta[step.status]?.label||"状态未知"}</span><span className="text-[10px] text-indigo-100/40">{durationText(step.durationMs)}</span></span></span></button>})}</div></div>
          </div>
          <div className="journey-detail flex min-h-0 flex-col overflow-hidden rounded-2xl">
            {selected?(
              <>
                <div className="shrink-0 border-b border-indigo-200/10 px-4 py-3"><div className="flex items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-100"><Icon className="h-5 w-5"/></span><div className="min-w-0"><p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/65">STEP {String(ordered.findIndex(s=>s.stepId===selected.stepId)+1).padStart(2,"0")} · 行动详情</p><h3 className="truncate text-base font-bold text-white">{selectedTitle}</h3></div></div><span className={"shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold "+toneClass[state.tone]}>{state.label}</span></div></div>
                <div className="detail-scroll min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
                  <section><h4 className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-cyan-100"><Sparkles className="h-3.5 w-3.5"/>这一步在做什么</h4><p className="text-sm leading-6 text-indigo-50/80">{explanation}</p></section>
                  {reason!==undefined&&<section className="rounded-xl border border-violet-300/15 bg-violet-300/[0.06] p-3"><h4 className="mb-1 text-xs font-semibold text-violet-100">执行依据</h4><p className="whitespace-pre-wrap break-words text-sm leading-6 text-indigo-50/75">{pretty(reason)}</p></section>}
                  {(args!==undefined||input!==undefined)&&<section className="rounded-xl border border-sky-300/15 bg-sky-300/[0.055] p-3"><h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-sky-100"><Terminal className="h-3.5 w-3.5"/>这次操作使用了什么信息</h4><p className="mb-2 text-xs text-indigo-100/50">以下内容来自实际采集的参数。</p><pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#071127]/70 p-3 text-xs leading-5 text-sky-50/85">{pretty(args??input)}</pre></section>}
                  {(result!==undefined||output!==undefined)&&<section className="rounded-xl border border-emerald-300/15 bg-emerald-300/[0.055] p-3"><h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-emerald-100"><Eye className="h-3.5 w-3.5"/>这一步实际得到了什么</h4><p className="mb-2 text-sm leading-6 text-emerald-50/80">{summarize(result??output)}</p><details className="rounded-lg border border-emerald-200/10 bg-[#071127]/45 p-2"><summary className="cursor-pointer text-xs text-emerald-100/75">查看完整返回内容</summary><pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-emerald-50/80">{pretty(result??output)}</pre></details></section>}
                  {error!==undefined&&<section className="rounded-xl border border-rose-300/20 bg-rose-400/[0.07] p-3"><h4 className="mb-1 flex items-center gap-2 text-xs font-semibold text-rose-100"><AlertTriangle className="h-3.5 w-3.5"/>发生了什么问题</h4><p className="whitespace-pre-wrap break-words text-sm leading-6 text-rose-50/85">{pretty(error)}</p></section>}
                  {selected.phase==="llm"&&promptMessages!==undefined&&<section className="space-y-2"><h4 className="text-xs font-semibold text-indigo-100">实际发送给模型的消息</h4>{Array.isArray(promptMessages)?promptMessages.map((item:any,index)=><div key={index} className="overflow-hidden rounded-lg border border-indigo-200/15"><div className="border-b border-indigo-200/10 bg-white/[0.04] px-3 py-2 text-[10px] text-indigo-100/60">{roleLabel(item?.role)}{item?.name?" · "+item.name:""}</div><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-5 text-indigo-50/80">{contentOf(item)}</pre></div>):<pre className="whitespace-pre-wrap break-words text-xs">{pretty(promptMessages)}</pre>}</section>}
                  {modelResponse!==undefined&&<section className="rounded-xl border border-violet-200/15 bg-violet-300/[0.05] p-3"><h4 className="mb-2 text-xs font-semibold text-violet-100">模型实际返回</h4><pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-5 text-violet-50/80">{pretty(modelResponse)}</pre></section>}
                  <section className="grid grid-cols-2 gap-2"><div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-[10px] text-indigo-100/45">实际耗时</p><p className="mt-1 text-sm font-semibold text-white">{durationText(selected.durationMs)}</p></div><div className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-[10px] text-indigo-100/45">Token 用量</p><p className="mt-1 text-sm font-semibold text-white">{typeof tokens==="number"?tokens.toLocaleString():"未上报"}</p></div></section>
                  {(modelName!==undefined||provider!==undefined||toolName)&&<section className="flex flex-wrap gap-2 text-[11px] text-indigo-100/55">{modelName!==undefined&&<span>模型：{String(modelName)}</span>}{provider!==undefined&&<span>服务渠道：{String(provider)}</span>}{toolName&&<span>底层工具：{toolName}</span>}</section>}
                  {!hasDetail&&<div className="rounded-xl border border-dashed border-amber-300/20 bg-amber-300/[0.045] p-3"><p className="text-sm font-medium text-amber-100">这条记录没有附带详细内容</p><p className="mt-1 text-xs leading-5 text-amber-100/60">{selected.phase==="llm"?"执行端没有采集本次模型请求或响应内容。":selected.phase==="skill"?"执行端没有采集工具参数或返回内容。":"目前只收到事件状态和时间等基础信息。"}这里不会根据步骤名称生成虚假的内容。</p></div>}
                  <details className="tech-data rounded-xl p-3"><summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-indigo-100/80"><span>开发者技术详情</span><ChevronDown className="h-4 w-4"/></summary><div className="mt-3 space-y-3">{args!==undefined&&<div><p className="mb-1 text-[10px] text-indigo-100/50">工具参数</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-indigo-50/80">{pretty(args)}</pre></div>}{result!==undefined&&<div><p className="mb-1 text-[10px] text-indigo-100/50">工具返回</p><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-indigo-50/80">{pretty(result)}</pre></div>}<pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-indigo-50/70">{pretty(detail)}</pre></div></details>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3"><button type="button" onClick={()=>setShowRaw(v=>!v)} className="inline-flex items-center gap-1.5 text-xs text-indigo-100/65 hover:text-white"><ChevronDown className={"h-3.5 w-3.5 transition "+(showRaw?"rotate-180":"")}/>{showRaw?"收起原始事件":"查看原始事件"}</button><div className="flex items-center gap-2">{selected.status==="failed"&&onRetryRun&&!isThinking&&<button type="button" onClick={onRetryRun} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300/25 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-rose-100"><RotateCcw className="h-3.5 w-3.5"/>重新运行</button>}<button type="button" onClick={()=>void copy()} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200/15 px-3 py-2 text-xs text-indigo-100/70 hover:text-white"><Copy className="h-3.5 w-3.5"/>{copied?"已复制":"复制技术数据"}</button></div></div>
                  {showRaw&&<pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-[#050d20] p-3 text-[11px] leading-5 text-indigo-50/75">{pretty(selected)}</pre>}
                </div>
              </>
            ):<div className="flex flex-1 items-center justify-center text-sm text-indigo-100/45">选择左侧任意一步，查看它的执行详情</div>}
          </div>
        </div>
      )}
    </section>
  );
};
