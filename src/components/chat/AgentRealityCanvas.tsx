import React, { useMemo, useState } from "react";
import {
  Activity, BrainCircuit, CheckCircle2, CircleHelp, Clock3, Code2, Database,
  FileCode2, GitBranch, GitCommitHorizontal, Globe2, Layers3, LockKeyhole,
  Network, Radio, ShieldAlert, Terminal, XCircle, Zap
} from "lucide-react";
import { AgentStep, sortTimeline } from "@/lib/agentTimeline";
import type { TraceDrawerMessage } from "./TraceInspectorDrawer";

interface Props {
  timeline: AgentStep[];
  message?: TraceDrawerMessage | null;
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  isThinking?: boolean;
  onRetryRun?: () => void;
}

type AdapterKind = "git" | "browser" | "retrieval" | "code" | "approval" | "agent" | "terminal" | "model" | "generic";

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

const get = (source:any, keys:string[]) => {
  if(!source || typeof source!=="object") return undefined;
  for(const key of keys) if(source[key]!==undefined && source[key]!==null && source[key]!=="") return source[key];
  return undefined;
};
const read = (detail:any, keys:string[]) => {
  const attrs=detail?.attributes && typeof detail.attributes==="object" ? detail.attributes : {};
  const nested=detail?.rightDetail && typeof detail.rightDetail==="object" ? detail.rightDetail : {};
  return get(detail,keys) ?? get(attrs,keys) ?? get(nested,keys) ?? get(nested.attributes,keys);
};
const text = (value:any) => {
  if(value===undefined || value===null) return "";
  if(typeof value==="string") return value;
  if(typeof value==="number" || typeof value==="boolean") return String(value);
  try{return JSON.stringify(value,null,2)}catch{return String(value)}
};
const messageText = (message:any):string => {
  if(typeof message==="string") return message;
  if(message && typeof message==="object") {
    if(typeof message.content==="string") return message.content;
    if(typeof message.text==="string") return message.text;
    if(Array.isArray(message.parts)) return message.parts.map((part:any)=>part?.text??part?.content??"").filter(Boolean).join("\n");
  }
  return text(message);
};
const parseStructured = (value:any):any => {
  if(typeof value!=="string") return value;
  const trimmed=value.trim();
  if(!trimmed || !["[","{"].includes(trimmed[0])) return value;
  try{return JSON.parse(trimmed)}catch{return value}
};
const toolOf = (step:AgentStep) => String(read(step.rightDetail,["gen_ai.tool.name","tool","tool_name","toolName","name","mcp.method.name"]) || "");
const operationOf = (step:AgentStep) => String(read(step.rightDetail,["gen_ai.operation.name","operation","operation_name","span.name","spanName"]) || "").toLowerCase();
const adapterOf = (step:AgentStep):AdapterKind => {
  const name=(toolOf(step)+" "+operationOf(step)+" "+step.rightTitle+" "+step.leftTitle).toLowerCase();
  const phase=step.phase;
  if(/git|github|commit|branch|repository/.test(name)) return "git";
  if(/browser|playwright|navigate|click|screenshot|computer/.test(name)) return "browser";
  if(/retriev|search|knowledge|vector|embedding|citation|rag/.test(name) || phase==="context") return "retrieval";
  if(/file|code|diff|edit|write|patch/.test(name)) return "code";
  if(/approv|permission|policy|risk|authorize/.test(name)) return "approval";
  if(/agent|delegate|handoff|transfer/.test(name)) return "agent";
  if(/terminal|shell|command|exec/.test(name)) return "terminal";
  if(/chat|inference|generate_content|invoke_model|model_call|llm/.test(name) || phase==="llm") return "model";
  return "generic";
};
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

const toolNames:Record<string,string> = {
  get_git_repo_status:"检查仓库状态", get_git_commit_history:"读取提交历史",
  get_git_diff:"查看代码改动", get_git_file:"读取项目文件", search_code:"搜索代码",
};

const summarize = (value:any):string => {
  if(value===undefined || value===null) return "执行端尚未提供结果";
  if(typeof value==="string") return value.length>180?value.slice(0,180)+"…":value;
  if(Array.isArray(value)) return value.length ? `返回 ${value.length} 项数据` : "返回空列表";
  const parts=["repoName","repository","branch","commitCount","total","count","status","message","title"]
    .map(k=>value[k]!==undefined?`${k}: ${String(value[k])}`:null).filter(Boolean).slice(0,3);
  return parts.length?parts.join(" · "):`已返回 ${Object.keys(value).length} 个字段`;
};

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
  const args=read(d,["gen_ai.tool.call.arguments","arguments","args","parameters","tool_input","input"]);
  const result=read(d,["gen_ai.tool.call.result","result","tool_result","tool_output","output","response"]);
  const approval=read(d,["approvalStatus","approval_status","decision","riskLevel","risk_level"]);
  const model=read(d,["gen_ai.request.model","model","actual_model","modelName"]);
  const provider=read(d,["gen_ai.system","provider","provider_route"]);
  const promptMessages=read(d,["gen_ai.input.messages","prompt_messages","promptMessages","messages","llm_messages"]);
  const modelResponse=read(d,["gen_ai.output.messages","model_response","modelResponse","completion","assistant_message"]);
  const inputTokens=read(d,["gen_ai.usage.input_tokens","input_tokens","prompt_tokens"]);
  const outputTokens=read(d,["gen_ai.usage.output_tokens","output_tokens","completion_tokens"]);
  const totalTokens=read(d,["gen_ai.usage.total_tokens","total_tokens","totalTokens"]);
  const visiblePromptMessages=parseStructured(promptMessages);
  const visibleModelResponse=parseStructured(modelResponse);
  const decision=read(d,["decision_summary","decisionSummary","action_summary","summary"]);
  const duration=typeof step.durationMs==="number" ? (step.durationMs>=1000?(step.durationMs/1000).toFixed(2)+" 秒":Math.round(step.durationMs)+" 毫秒") : "未上报";
  return <div className="reality-inspector">
    <div className="reality-action-summary">
      <div className="reality-summary-orb"><Zap size={18}/></div>
      <div className="min-w-0 flex-1">
        <div className="reality-eyebrow">REAL ACTION · {adapterMeta[adapter].label}</div>
        <div className="reality-summary-title">{toolOf(step)?(toolNames[toolOf(step)]||toolOf(step)):step.rightTitle||step.leftTitle}</div>
        <p>{step.rightSubtitle||step.leftSummary||adapterMeta[adapter].verb}</p>
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
      {Array.isArray(visiblePromptMessages)&&<div className="mt-3 grid gap-2">{visiblePromptMessages.map((item:any,index:number)=><div className="reality-data-row items-start" key={index}><span className="!flex-none !w-20 text-cyan-200">{String(item?.role||"message").toUpperCase()}</span><span className="whitespace-pre-wrap break-words !overflow-visible !whitespace-normal">{messageText(item?.content??item?.message??item).slice(0,2400)}</span></div>)}</div>}
      {promptMessages===undefined&&<div className="reality-empty-visual mt-3">模型请求消息未采集。可以在后端启用请求内容采集后显示真实消息。</div>}
      {modelResponse!==undefined&&<div className="reality-code-preview">{Array.isArray(visibleModelResponse)?visibleModelResponse.map(messageText).join("\n\n"):messageText(visibleModelResponse).slice(0,4000)}</div>}
      {(inputTokens!==undefined||outputTokens!==undefined||totalTokens!==undefined)&&<div className="reality-git-target mt-3"><div><small>输入 Token</small><strong>{inputTokens!==undefined?text(inputTokens):"未上报"}</strong></div><div><small>输出 Token</small><strong>{outputTokens!==undefined?text(outputTokens):"未上报"}</strong></div></div>}<div className="mt-3 text-[10px] text-indigo-100/40">展示实际请求与响应，不展示或伪造模型隐藏思维链。</div>
    </div>}

    {adapter==="generic" && <div className="reality-visual-block"><div className="reality-block-head"><Layers3 size={15}/> 执行现场 <span>EVENT DATA</span></div><div className="reality-empty-visual">{step.rightSubtitle||step.leftSummary||"执行端只上报了事件基础信息。"}</div></div>}

    {adapter!=="model" && args!==undefined && <details className="reality-raw"><summary>查看本次动作的真实输入</summary><pre>{text(args)}</pre></details>}
    {adapter!=="model" && result!==undefined && <details className="reality-raw"><summary>查看本次动作的真实返回</summary><pre>{text(result)}</pre></details>}
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
  const complete=ordered.filter(s=>s.status==="done"||s.status==="passed").length;
  const failed=ordered.filter(s=>s.status==="failed").length;
  const current=ordered.find(s=>s.status==="running");
  const live=isThinking||!!current;
  const select=(step:AgentStep)=>{setLocalSelected(step.stepId);onSelectStep?.(step.stepId)};
  const total=ordered.length;
  const percent=total?Math.round(complete/total*100):0;
  return <section className="agent-reality h-full min-h-0 flex flex-col text-slate-100">
    <style>{`
      .agent-reality{--ar-line:rgba(116,151,255,.22);background:radial-gradient(ellipse at 48% 0%,rgba(39,75,157,.24),transparent 48%),linear-gradient(155deg,#080f24 0%,#0b1430 52%,#080e20 100%);color:#edf4ff;isolation:isolate;overflow:hidden}
      .agent-reality .ar-top{background:linear-gradient(100deg,rgba(13,28,61,.9),rgba(11,22,48,.55));border-bottom:1px solid var(--ar-line)}
      .agent-reality .ar-grid{background-image:linear-gradient(rgba(116,151,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(116,151,255,.045) 1px,transparent 1px);background-size:28px 28px}
      .agent-reality .ar-orbit{position:relative;border:1px solid rgba(108,153,255,.18);background:radial-gradient(ellipse at 50% 50%,rgba(22,68,124,.2),rgba(8,18,42,.2) 70%);box-shadow:inset 0 0 60px rgba(30,85,170,.07)}
      .agent-reality .ar-orbit:before,.agent-reality .ar-orbit:after{content:"";position:absolute;inset:18px 8%;border:1px solid rgba(93,184,255,.09);border-radius:50%;transform:rotate(-8deg);pointer-events:none}
      .agent-reality .ar-orbit:after{inset:35px 18%;transform:rotate(12deg);border-color:rgba(153,120,255,.12)}
      .agent-reality .ar-node{position:relative;z-index:2;min-width:0;border:1px solid rgba(130,157,232,.2);background:linear-gradient(145deg,rgba(22,39,78,.94),rgba(10,22,48,.96));box-shadow:0 8px 24px rgba(0,0,0,.22),inset 0 1px rgba(255,255,255,.04);transition:transform .2s,border-color .2s,box-shadow .2s}
      .agent-reality .ar-node:hover{transform:translateY(-2px);border-color:rgba(89,210,255,.5)}
      .agent-reality .ar-node[aria-pressed=true]{border-color:rgba(84,218,255,.78);box-shadow:0 0 0 1px rgba(84,218,255,.16),0 0 28px rgba(36,163,235,.14),inset 0 0 24px rgba(46,160,225,.07)}
      .agent-reality .ar-node:after{content:"";position:absolute;left:50%;bottom:-17px;height:16px;width:1px;background:linear-gradient(rgba(94,211,255,.6),transparent)}
      .agent-reality .ar-node:last-child:after{display:none}
      .agent-reality .ar-pulse{animation:arPulse 1.8s ease-in-out infinite}
      @keyframes arPulse{0%,100%{box-shadow:0 0 0 0 rgba(55,210,255,.28)}50%{box-shadow:0 0 0 7px rgba(55,210,255,0)}}
      .agent-reality .ar-panel{border:1px solid rgba(130,157,232,.18);background:linear-gradient(145deg,rgba(16,31,66,.86),rgba(8,18,40,.94));box-shadow:inset 0 1px rgba(255,255,255,.035)}
      .agent-reality .reality-action-summary{display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid rgba(130,157,232,.14)}
      .agent-reality .reality-summary-orb{width:40px;height:40px;display:grid;place-items:center;border-radius:12px;color:#8cecff;background:linear-gradient(145deg,rgba(29,144,194,.24),rgba(99,91,217,.18));border:1px solid rgba(90,211,255,.3);box-shadow:0 0 22px rgba(37,170,228,.12)}
      .agent-reality .reality-eyebrow{font:10px ui-monospace,monospace;letter-spacing:.16em;color:#7ddfff;text-transform:uppercase}
      .agent-reality .reality-summary-title{font-size:16px;font-weight:750;color:#f4f8ff;margin-top:3px}
      .agent-reality .reality-action-summary p{font-size:12px;color:#a9badb;margin-top:4px}
      .agent-reality .reality-duration{display:flex;align-items:center;gap:5px;font:11px ui-monospace,monospace;color:#a9c4e8;white-space:nowrap}
      .agent-reality .reality-visual-block{margin:14px;padding:14px;border:1px solid rgba(112,160,236,.18);border-radius:14px;background:linear-gradient(145deg,rgba(16,37,75,.55),rgba(9,20,45,.72))}
      .agent-reality .reality-block-head{display:flex;align-items:center;gap:8px;color:#bcecff;font-size:12px;font-weight:700;margin-bottom:12px}
      .agent-reality .reality-block-head span{margin-left:auto;color:#6f8dbb;font:9px ui-monospace,monospace;letter-spacing:.12em}
      .agent-reality .reality-git-target{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .agent-reality .reality-git-target>div,.agent-reality .reality-result-strip>div{padding:10px 12px;border:1px solid rgba(127,158,218,.14);border-radius:10px;background:rgba(3,12,30,.45);min-width:0}
      .agent-reality .reality-git-target small,.agent-reality .reality-result-strip small{display:block;color:#7893bd;font-size:10px;margin-bottom:5px}
      .agent-reality .reality-git-target strong,.agent-reality .reality-result-strip strong{display:block;color:#e8f4ff;font-size:12px;overflow-wrap:anywhere}
      .agent-reality .reality-data-list{margin-top:10px;display:grid;gap:6px}
      .agent-reality .reality-data-row{display:flex;align-items:center;gap:8px;padding:8px;border-radius:8px;background:rgba(7,18,39,.72);color:#c9e7ff;font-size:11px}
      .agent-reality .reality-data-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .agent-reality .reality-data-row small{color:#7691b9}
      .agent-reality .reality-data-chip{display:flex;align-items:center;gap:7px;margin-top:10px;padding:9px;border-radius:8px;background:rgba(8,22,46,.72);color:#b9d5f7;font-size:11px}
      .agent-reality .reality-code-preview{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;border-radius:9px;background:#050d1e;border:1px solid rgba(114,151,221,.15);color:#c5e8ff;font:11px/1.6 ui-monospace,monospace;margin-top:10px}
      .agent-reality .reality-browser-bar{padding:9px 12px;border-radius:9px;background:#071329;color:#a9c8eb;font:11px ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .agent-reality .reality-browser-bar span{display:inline-block;width:7px;height:7px;border-radius:50%;background:#55dfb3;margin-right:8px}
      .agent-reality .reality-browser-title{padding:10px 2px;color:#e5efff;font-size:13px;font-weight:650}
      .agent-reality .reality-screenshot{width:100%;max-height:260px;object-fit:contain;border-radius:9px;border:1px solid rgba(133,166,235,.2);background:#050b18}
      .agent-reality .reality-empty-visual{padding:13px;border:1px dashed rgba(131,159,220,.2);border-radius:9px;color:#90a7cb;font-size:12px;line-height:1.7}
      .agent-reality .reality-source-list{display:grid;gap:7px}
      .agent-reality .reality-source{display:flex;align-items:flex-start;gap:10px;padding:9px;border-radius:9px;background:rgba(5,17,39,.65);border:1px solid rgba(111,164,231,.12)}
      .agent-reality .reality-source-index{font:11px ui-monospace,monospace;color:#66d8ff;padding-top:2px}
      .agent-reality .reality-source strong{font-size:11px;color:#d8eaff}.agent-reality .reality-source p{font-size:10px;color:#8fa9ce;margin-top:4px;line-height:1.5}
      .agent-reality .reality-source>span{margin-left:auto;font:9px ui-monospace,monospace;color:#76b9ef}
      .agent-reality .reality-approval{display:flex;gap:12px;align-items:center;margin:14px;padding:16px;border-radius:12px;border:1px solid rgba(246,190,83,.28);background:rgba(120,76,14,.12);color:#f9d58a}
      .agent-reality .reality-approval strong{font-size:13px}.agent-reality .reality-approval p{font-size:12px;margin-top:4px;color:#d9c69e}
      .agent-reality .reality-result-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:0 14px 12px}
      .agent-reality .reality-raw{margin:0 14px 14px;border:1px solid rgba(127,158,218,.15);border-radius:10px;background:rgba(4,11,27,.45);padding:10px}
      .agent-reality .reality-raw summary{cursor:pointer;color:#8da8ce;font-size:11px}.agent-reality .reality-raw pre{max-height:260px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;color:#b6d2f5;font:10px/1.5 ui-monospace,monospace;margin-top:10px}
      @media(max-width:760px){.agent-reality .ar-orbit{min-height:200px}.agent-reality .reality-result-strip{grid-template-columns:1fr}.agent-reality .reality-action-summary{align-items:flex-start;flex-wrap:wrap}}
      @media(prefers-reduced-motion:reduce){.agent-reality *{animation:none!important;transition:none!important}}
    `}</style>

    <header className="ar-top shrink-0 px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><Network size={19}/></div><div><div className="flex items-center gap-2"><h2 className="text-sm font-bold tracking-wide text-white">AGENT REALITY ENGINE</h2><span className={`rounded-full border px-2 py-0.5 text-[10px] ${live?"border-cyan-300/30 bg-cyan-300/10 text-cyan-100":"border-indigo-200/15 bg-indigo-200/5 text-indigo-100/65"}`}>{live?"LIVE EXECUTION":"SESSION TRACE"}</span></div><p className="mt-1 text-xs text-indigo-100/55">{message?.userPrompt||"Agent 的真实行动将在这里形成动态执行空间"}</p></div></div>
        <div className="flex items-center gap-4 text-[11px] text-indigo-100/65"><span><b className="text-white">{complete}</b> / {total} 已完成</span><span><b className="text-white">{failed}</b> 异常</span><span>Token <b className="text-white">{typeof message?.tokens==="number"?message.tokens.toLocaleString():"未上报"}</b></span></div>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 via-blue-400 to-cyan-300 transition-all duration-500" style={{width:percent+"%"}}/></div>
    </header>

    <div className="min-h-0 flex-1 overflow-y-auto ar-grid p-4">
      {ordered.length===0 ? <div className="flex min-h-full flex-col items-center justify-center text-center"><div className="ar-orbit grid h-40 w-40 place-items-center rounded-full"><div className="ar-pulse grid h-16 w-16 place-items-center rounded-2xl border border-cyan-300/35 bg-cyan-300/10 text-cyan-100"><BrainCircuit size={30}/></div></div><h3 className="mt-6 text-lg font-bold text-white">{isThinking?"等待 Agent 发出第一条真实行动":"等待任务启动"}</h3><p className="mt-2 max-w-md text-sm leading-6 text-indigo-100/55">这里不会播放预制动画。每个行动节点都来自 Agent 实际发出的事件；事件到达后，行动网络会逐步展开。</p></div> :
      <div className="grid min-h-full grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1.02fr)_minmax(390px,0.98fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center justify-between"><div><div className="text-[10px] font-mono tracking-[.18em] text-cyan-200/60">LIVE ACTION TOPOLOGY</div><h3 className="mt-1 text-sm font-bold text-white">行动网络 <span className="ml-2 text-xs font-normal text-indigo-100/45">由真实事件动态构建</span></h3></div><div className="flex items-center gap-2 text-[10px] text-indigo-100/45"><span className="h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#67e8f9]"/>{total} EVENTS</div></div>
          <div className="ar-orbit ar-grid rounded-2xl p-4">
            <div className="relative z-10 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {ordered.map((step,index)=>{
                const kind=adapterOf(step), meta=adapterMeta[kind], Icon=meta.icon, state=status[step.status]||status.unknown;
                const StateIcon=state.icon, active=selected?.stepId===step.stepId;
                const label=toolOf(step)?(toolNames[toolOf(step)]||toolOf(step)):step.rightTitle||step.leftTitle||phaseLabels[step.phase]||"执行事件";
                const summary=step.rightSubtitle||step.leftSummary||phaseLabels[step.phase]||"收到执行事件";
                return <button key={step.stepId} type="button" onClick={()=>select(step)} aria-pressed={active} className="ar-node rounded-xl p-3 text-left">
                  <div className="flex items-center justify-between gap-2"><span className="font-mono text-[9px] tracking-widest text-indigo-200/40">NODE {String(index+1).padStart(2,"0")}</span><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] ${state.color==="emerald"?"border-emerald-300/20 bg-emerald-300/10 text-emerald-200":state.color==="cyan"?"border-cyan-300/25 bg-cyan-300/10 text-cyan-100":state.color==="rose"?"border-rose-300/20 bg-rose-300/10 text-rose-200":state.color==="amber"?"border-amber-300/20 bg-amber-300/10 text-amber-100":"border-white/10 bg-white/5 text-slate-300"}`}><StateIcon size={10}/>{state.label}</span></div>
                  <div className="mt-2 flex items-center gap-2"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${kind==="git"?"border-violet-300/25 bg-violet-300/10 text-violet-200":kind==="browser"?"border-cyan-300/25 bg-cyan-300/10 text-cyan-200":kind==="retrieval"?"border-blue-300/25 bg-blue-300/10 text-blue-200":kind==="approval"?"border-amber-300/25 bg-amber-300/10 text-amber-200":"border-indigo-300/20 bg-indigo-300/10 text-indigo-100"}`}><Icon size={17}/></span><span className="min-w-0"><strong className="block truncate text-xs text-white">{label}</strong><small className="mt-1 block truncate text-[10px] text-indigo-100/50">{meta.label} · {phaseLabels[step.phase]||"执行事件"}</small></span></div>
                  <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-indigo-100/60">{summary}</p>
                </button>
              })}
            </div>
            <div className="relative z-10 mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-indigo-200/10 pt-3 text-[10px] text-indigo-100/45"><span>节点仅对应已采集事件，不推测隐藏步骤</span><span>{current?"正在运行："+(toolOf(current)||current.rightTitle):"等待下一条事件"}</span></div>
          </div>
          <div className="ar-panel rounded-xl p-3"><div className="flex items-center gap-2 text-xs font-semibold text-indigo-100"><Activity size={14} className="text-cyan-300"/>执行信号</div><div className="mt-2 grid grid-cols-3 gap-2"><div><small className="text-[10px] text-indigo-100/40">实际事件</small><strong className="block text-lg text-white">{total}</strong></div><div><small className="text-[10px] text-indigo-100/40">完成比例</small><strong className="block text-lg text-white">{percent}%</strong></div><div><small className="text-[10px] text-indigo-100/40">本轮耗时</small><strong className="block text-lg text-white">{message?.duration||"未上报"}</strong></div></div></div>
        </div>
        <div className="ar-panel min-h-[420px] overflow-hidden rounded-2xl">
          {selected?<><div className="flex items-center justify-between border-b border-indigo-200/10 px-4 py-3"><div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_10px_#67e8f9]"/><span className="text-xs font-bold tracking-wide text-white">SELECTED ACTION / 行动现场</span></div><span className="font-mono text-[9px] text-indigo-100/40">#{selected.seq}</span></div><div className="max-h-[calc(100%-48px)] overflow-y-auto"><ActionVisual step={selected}/></div></>:<div className="grid h-full place-items-center text-sm text-indigo-100/45">选择一个真实行动节点</div>}
        </div>
      </div>}
    </div>
  </section>;
};
