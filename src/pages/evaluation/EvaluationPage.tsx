import React from "react";
import { ArrowLeft, Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3, Cpu, Database, Gauge, GitBranch, ShieldCheck, Sparkles, Target, Wrench, XCircle, CircleDollarSign, Info } from "lucide-react";
import { AgentStep } from "@/lib/agentTimeline";

export interface EvaluationMessage {
 id:string; userPrompt?:string; content:string; tokens?:number; duration?:string; trace?:any;
 agentTimeline?:AgentStep[]; toolCalls?:Array<{tool:string;status?:string;duration?:string}>; enableRAG?:boolean; modelName?:string;
}
const durationMs=(value?:string,trace?:any)=>{if(typeof trace?.totalMs==="number")return trace.totalMs;if(!value)return 0;const s=value.match(/([\\d.]+)\\s*s/i);if(s)return Number(s[1])*1000;const ms=value.match(/([\\d.]+)\\s*ms/i);return ms?Number(ms[1]):0};
const fmt=(n:number)=>n>=1000?(n/1000).toFixed(2)+"s":Math.round(n)+"ms";
export default function EvaluationPage({message,onBack}:{message:EvaluationMessage;onBack:()=>void}) {
 const steps=message.agentTimeline||[];
 const failed=steps.filter(s=>s.status==="failed").length;
 const succeeded=steps.filter(s=>["done","passed","completed","success"].includes(String(s.status).toLowerCase())).length;
 const known=succeeded+failed;
 const tools=message.toolCalls?.length||steps.filter(s=>s.phase==="skill").length;
 const tokens=message.tokens??message.trace?.tokens??message.trace?.totalTokens??0;
 const elapsed=durationMs(message.duration,message.trace);
 const successRate=known?Math.round(succeeded/known*100):null;
 const metrics=[
  {label:"任务完成度",value:"待评估",detail:"需要任务目标与验收标准",icon:Target},
  {label:"回答质量",value:"待评估",detail:"需要 Judge 或人工标注",icon:Sparkles},
  {label:"工具调用",value:String(tools),detail:message.toolCalls?.length?"来自本次对话的工具调用记录":"根据执行步骤统计",icon:Wrench},
  {label:"执行可靠性",value:successRate===null?"暂无数据":successRate+"%",detail:known? `${succeeded} 成功 / ${failed} 失败`:"尚无可识别的完成/失败状态",icon:ShieldCheck},
  {label:"执行效率",value:elapsed?fmt(elapsed):"未上报",detail:tokens?tokens.toLocaleString()+" tokens":"Token 用量未上报",icon:Gauge},
 ];
 return <div className="h-full overflow-y-auto bg-[#f6f8fc] text-slate-800"><div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
  <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-indigo-600"><ArrowLeft className="h-4 w-4"/>返回对话</button>
  <header className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
   <div className="flex flex-wrap items-start justify-between gap-5 p-5 md:p-6"><div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-indigo-600"><BarChart3 className="h-3.5 w-3.5"/> AGENT RUN ANALYTICS</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">对话评估</h1><p className="mt-1 max-w-3xl truncate text-sm text-slate-500">{message.userPrompt||"本次 Agent 执行记录"}</p><div className="mt-3 flex flex-wrap gap-2">{message.modelName&&<Pill>{message.modelName}</Pill>}<Pill>{steps.length} 个执行步骤</Pill>{message.enableRAG!==undefined&&<Pill>RAG {message.enableRAG?"开启":"关闭"}</Pill>}</div></div><div className="min-w-[150px] rounded-xl bg-indigo-50/70 px-4 py-3"><div className="text-[10px] font-semibold tracking-wider text-indigo-500">SEMANTIC SCORE</div><div className="mt-1 text-2xl font-semibold text-indigo-800">待评估</div><div className="mt-1 text-[10px] leading-4 text-indigo-600/80">尚未运行 AI Judge，不生成虚构总分</div></div></div>
   <div className="grid grid-cols-2 border-t border-slate-100 md:grid-cols-4">{[
    {label:"总耗时",value:elapsed?fmt(elapsed):"未上报",icon:Clock3},
    {label:"Token 用量",value:tokens?tokens.toLocaleString():"未上报",icon:Cpu},
    {label:"工具调用",value:String(tools),icon:Wrench},
    {label:"失败步骤",value:String(failed),icon:AlertTriangle},
   ].map((x,i)=><div key={x.label} className={`p-4 ${i%2===1?"border-l border-slate-100 md:border-l":""} ${i>1?"border-t border-slate-100 md:border-t-0":""} ${i>0?"md:border-l":""}`}><div className="flex items-center gap-1.5 text-[10px] text-slate-400"><x.icon className="h-3.5 w-3.5"/>{x.label}</div><div className="mt-1 font-mono text-lg font-semibold text-slate-800">{x.value}</div></div>)}</div>
  </header>
  <div className="mt-5 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3.5"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"/><p className="text-[11px] leading-5 text-sky-800">本页区分<strong>运行遥测</strong>与<strong>语义评估</strong>：耗时、Token、工具调用和执行状态来自本次运行记录；任务完成度、回答准确性等需要 Judge 或人工标准答案，目前不会用启发式公式伪造分数。</p></div>
  <section className="mt-5"><div className="mb-3 flex items-end justify-between"><div><h2 className="text-sm font-semibold text-slate-900">评估维度</h2><p className="mt-1 text-[11px] text-slate-400">每项指标均标注当前数据来源和可用状态</p></div><span className="text-[10px] text-slate-400">5 个维度</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(m=><div key={m.label} className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><m.icon className="h-4 w-4 text-indigo-500"/>{m.label}</div><div className="mt-4 text-xl font-semibold tracking-tight text-slate-900">{m.value}</div><p className="mt-1 text-[10px] leading-4 text-slate-400">{m.detail}</p></div>)}</div></section>
  <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_.85fr]">
   <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-slate-900">执行过程诊断</h2><p className="mt-1 text-[11px] text-slate-400">逐步查看 Agent 执行事件与状态</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${failed?"bg-rose-50 text-rose-700":"bg-emerald-50 text-emerald-700"}`}>{failed?failed+" 个失败事件":"未发现失败事件"}</span></div>
    <div className="mt-5 space-y-0">{steps.length?steps.map((s,i)=><div key={s.stepId} className="relative flex gap-3 pb-4 last:pb-0"><div className="relative flex w-7 shrink-0 justify-center"><div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full ${s.status==="failed"?"bg-rose-50 text-rose-600":"bg-emerald-50 text-emerald-600"}`}>{s.status==="failed"?<XCircle className="h-4 w-4"/>:<CheckCircle2 className="h-4 w-4"/>}</div>{i!==steps.length-1&&<div className="absolute top-7 h-full w-px bg-slate-200"/>}</div><div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-semibold text-slate-700">{s.rightTitle||s.leftTitle||"执行步骤"}</div><span className="font-mono text-[10px] text-slate-400">{typeof s.durationMs==="number"?fmt(s.durationMs):"耗时未记录"}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-400">{s.rightSubtitle||s.leftSummary||"暂无事件描述"}</p></div></div>):<Empty title="暂无执行步骤" desc="本次对话没有附带 Agent Timeline 数据。"/>}</div>
   </section>
   <div className="space-y-5"><Panel title="性能与成本"><Row icon={<Clock3/>} label="总耗时" value={elapsed?fmt(elapsed):"未上报"}/><Row icon={<Activity/>} label="首 Token 延迟" value={message.trace?.ttftMs?fmt(message.trace.ttftMs):"未上报"}/><Row icon={<Cpu/>} label="Token 用量" value={tokens?tokens.toLocaleString():"未上报"}/><Row icon={<CircleDollarSign/>} label="费用" value={message.trace?.cost!==undefined?String(message.trace.cost):"未上报"}/></Panel>
    <Panel title="执行可靠性"><Row icon={<GitBranch/>} label="可识别步骤" value={String(known)}/><Row icon={<CheckCircle2/>} label="成功步骤" value={String(succeeded)}/><Row icon={<XCircle/>} label="失败步骤" value={String(failed)}/><Row icon={<Database/>} label="RAG" value={message.enableRAG===undefined?"未知":message.enableRAG?"开启":"关闭"}/></Panel>
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-indigo-900"><Sparkles className="h-4 w-4"/>AI Judge 尚未运行</div><p className="mt-2 text-[11px] leading-5 text-indigo-800/75">下一阶段接入评估模型与可配置评分标准：任务完成度、事实准确性、指令遵循、工具选择合理性，并为每项评分保留证据和解释。</p></div>
   </div>
  </div>
  <section className="mt-5 grid gap-4 md:grid-cols-2"><ContentPanel title="用户任务" content={message.userPrompt||"当前消息未保存原始任务文本"}/><ContentPanel title="Agent 最终回复" content={message.content||"暂无最终回复"}/></section>
 </div></div>
}
function Pill({children}:{children:React.ReactNode}){return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-500">{children}</span>}
function StatIcon({children}:{children:React.ReactNode}){return <span className="text-indigo-500">{children}</span>}
function Row({icon,label,value}:{icon:React.ReactNode;label:string;value:string}){return <div className="flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0"><span className="flex items-center gap-2 text-xs text-slate-500"><StatIcon>{icon}</StatIcon>{label}</span><b className="font-mono text-xs text-slate-700">{value}</b></div>}
function Panel({title,children}:{title:string;children:React.ReactNode}){return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><h3 className="text-xs font-semibold text-slate-800">{title}</h3><div className="mt-2">{children}</div></div>}
function ContentPanel({title,content}:{title:string;content:string}){return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><h3 className="text-xs font-semibold text-slate-800">{title}</h3><p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{content}</p></div>}
function Empty({title,desc}:{title:string;desc:string}){return <div className="rounded-xl border border-dashed border-slate-200 py-12 text-center"><p className="text-xs font-medium text-slate-500">{title}</p><p className="mt-1 text-[10px] text-slate-400">{desc}</p></div>}
