import React, { useMemo, useState } from "react";
import {
  ArrowLeft, Activity, AlertTriangle, BarChart3, CheckCircle2, Clock3,
  Cpu, Database, Gauge, GitBranch, ShieldCheck, Sparkles, Target,
  Wrench, XCircle, CircleDollarSign, Info, Timer, Layers3
} from "lucide-react";
import { AgentStep } from "@/lib/agentTimeline";
import { judgeAgentRun } from "@/services/api";

type ToolCall = { tool: string; status?: string; duration?: string; durationMs?: number; result?: unknown };
export interface EvaluationMessage {
  id: string;
  userPrompt?: string;
  content: string;
  tokens?: number;
  duration?: string;
  trace?: any;
  traceSteps?: Record<number, any>;
  agentTimeline?: AgentStep[];
  toolCalls?: ToolCall[];
  citations?: unknown[];
  enableRAG?: boolean;
  modelName?: string;
}
type Metric = { label: string; value: string; detail: string; icon: React.ElementType; tone?: "good" | "bad" | "neutral" };

const asNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    const n = typeof value === "string" && value.trim() ? Number(value) : value;
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) return n;
  }
  return undefined;
};
const parseMs = (value?: string): number | undefined => {
  if (!value) return undefined;
  const seconds = value.match(/^\s*([\d.]+)\s*s\s*$/i);
  if (seconds) return Number(seconds[1]) * 1000;
  const ms = value.match(/^\s*([\d.]+)\s*ms\s*$/i);
  return ms ? Number(ms[1]) : undefined;
};
const fmtMs = (n?: number) => n === undefined ? "未上报" : n >= 1000 ? (n / 1000).toFixed(2) + "s" : Math.round(n) + "ms";
const fmtInt = (n?: number) => n === undefined ? "未上报" : Math.round(n).toLocaleString();
const pct = (n: number, total: number) => total ? (n / total * 100).toFixed(1) + "%" : "暂无数据";
const normalize = (v: unknown) => String(v ?? "").toLowerCase();
const isSuccess = (v: unknown) => ["done", "passed", "completed", "success", "succeeded", "ok", "hit"].includes(normalize(v));
const isFailure = (v: unknown) => ["failed", "failure", "error", "blocked", "execution_failed"].includes(normalize(v));

function getRecordedSteps(message: EvaluationMessage): AgentStep[] {
  if (message.agentTimeline?.length) return message.agentTimeline;
  return Object.entries(message.traceSteps || {}).flatMap(([key, raw]) => {
    if (!raw || typeof raw !== "object") return [];
    return [{
      stepId: String(raw.stepId ?? raw.spanId ?? "trace-" + key),
      seq: Number(key),
      phase: raw.phase ?? "external",
      status: isSuccess(raw.status) ? "done" : isFailure(raw.status) ? "failed" : "unknown",
      leftTitle: raw.leftTitle ?? raw.title ?? raw.name ?? "执行步骤",
      leftSummary: raw.leftSummary ?? raw.message ?? "",
      rightTitle: raw.rightTitle ?? raw.title ?? raw.name ?? "执行步骤",
      rightSubtitle: raw.rightSubtitle ?? raw.description ?? "",
      rightDetail: raw.rightDetail ?? raw,
      durationMs: asNumber(raw.durationMs, raw.totalMs, raw.duration),
      timestamp: asNumber(raw.timestamp) ?? 0,
    } as AgentStep];
  }).sort((a, b) => a.seq - b.seq);
}

function MetricCard({ metric }: { metric: Metric }) {
  const Icon = metric.icon;
  const tone = metric.tone === "good" ? "text-emerald-700 bg-emerald-50" : metric.tone === "bad" ? "text-rose-700 bg-rose-50" : "text-indigo-600 bg-indigo-50";
  return <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}><Icon className="h-4 w-4"/></span>{metric.label}</div>
    <div className="mt-4 text-xl font-semibold tracking-tight text-slate-900 tabular-nums">{metric.value}</div>
    <p className="mt-1 text-[10px] leading-4 text-slate-400">{metric.detail}</p>
  </div>;
}
function Row({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0"><div><div className="text-xs text-slate-600">{label}</div>{detail && <div className="mt-0.5 text-[10px] text-slate-400">{detail}</div>}</div><b className="shrink-0 font-mono text-xs text-slate-800 tabular-nums">{value}</b></div>;
}
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><h2 className="text-sm font-semibold text-slate-900">{title}</h2><div className="mt-3">{children}</div></section>;
}
function Empty({ title, desc }: { title: string; desc: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center"><p className="text-xs font-medium text-slate-500">{title}</p><p className="mt-1 text-[10px] text-slate-400">{desc}</p></div>;
}

export default function EvaluationPage({ message, onBack }: { message: EvaluationMessage; onBack: () => void }) {
  const [judge, setJudge] = useState<any>(null);
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeError, setJudgeError] = useState("");
  const [gate, setGate] = useState(() => { try { return JSON.parse(localStorage.getItem("ownagent_eval_gate") || '{"minOverall":85,"minTask":85,"minReliability":90}'); } catch { return { minOverall: 85, minTask: 85, minReliability: 90 }; } });
  const data = useMemo(() => {
    const steps = getRecordedSteps(message);
    const tools = message.toolCalls?.length ? message.toolCalls : steps.filter(s => s.phase === "skill").map(s => ({
      tool: s.rightTitle, status: s.status, durationMs: s.durationMs
    }));
    const successfulSteps = steps.filter(s => isSuccess(s.status)).length;
    const failedSteps = steps.filter(s => isFailure(s.status)).length;
    const unknownSteps = steps.length - successfulSteps - failedSteps;
    const knownSteps = successfulSteps + failedSteps;
    const successfulTools = tools.filter(t => isSuccess(t.status)).length;
    const failedTools = tools.filter(t => isFailure(t.status)).length;
    const knownTools = successfulTools + failedTools;
    const toolDurations = tools.map(t => asNumber(t.durationMs) ?? parseMs(t.duration)).filter((n): n is number => n !== undefined);
    const stepDurations = steps.map(s => asNumber(s.durationMs)).filter((n): n is number => n !== undefined);
    const trace = message.trace || {};
    const totalMs = asNumber(trace.totalMs, trace.durationMs) ?? parseMs(message.duration);
    const ttftMs = asNumber(trace.ttftMs, trace.firstTokenLatencyMs);
    const tokensIn = asNumber(trace.promptTokens, trace.inputTokens, trace.usage?.prompt_tokens);
    const tokensOut = asNumber(trace.completionTokens, trace.outputTokens, trace.usage?.completion_tokens);
    const totalTokens = asNumber(message.tokens, trace.totalTokens, trace.tokens,
      tokensIn !== undefined && tokensOut !== undefined ? tokensIn + tokensOut : undefined);
    const cost = asNumber(trace.cost, trace.costCny, trace.usage?.cost);
    const stepDurationSum = stepDurations.length ? stepDurations.reduce((a, b) => a + b, 0) : undefined;
    const toolDurationSum = toolDurations.length ? toolDurations.reduce((a, b) => a + b, 0) : undefined;
    const timestamps = steps.map(s => s.timestamp).filter(t => t > 0);
    const observedWindowMs = timestamps.length > 1 ? Math.max(...timestamps) - Math.min(...timestamps) : undefined;
    return { steps, tools, successfulSteps, failedSteps, unknownSteps, knownSteps, successfulTools, failedTools, knownTools,
      totalMs, ttftMs, tokensIn, tokensOut, totalTokens, cost, stepDurationSum, toolDurationSum, observedWindowMs,
      avgStepMs: stepDurations.length ? stepDurationSum! / stepDurations.length : undefined,
      maxStepMs: stepDurations.length ? Math.max(...stepDurations) : undefined };
  }, [message]);

  const runJudge = async () => {
    setJudgeLoading(true); setJudgeError("");
    try {
      const result = await judgeAgentRun({
        task: message.userPrompt || "", answer: message.content || "",
        evidence: { trace: message.trace || null, timeline: data.steps, toolCalls: data.tools, citations: message.citations || [], rag: message.enableRAG ?? null,
          deterministic: { totalMs: data.totalMs, ttftMs: data.ttftMs, totalTokens: data.totalTokens, successfulSteps: data.successfulSteps, failedSteps: data.failedSteps, successfulTools: data.successfulTools, failedTools: data.failedTools } },
        rubric: "任务完成度、指令遵循、回答正确性、工具使用合理性。只根据给定证据评分，并解释扣分原因。",
      });
      setJudge(result);
    } catch (e: any) { setJudgeError(e?.message || "Judge 调用失败"); } finally { setJudgeLoading(false); }
  };
  const judgeScores = judge?.scores || {};
  const overall = typeof judgeScores.overall === "number" ? judgeScores.overall : null;
  const taskScore = typeof judgeScores.taskCompletion === "number" ? judgeScores.taskCompletion : null;
  const reliability = data.knownSteps ? Math.round(data.successfulSteps / data.knownSteps * 100) : null;
  const gatePass = overall !== null && taskScore !== null && reliability !== null && overall >= gate.minOverall && taskScore >= gate.minTask && reliability >= gate.minReliability;
  const persistGate = (next: any) => { setGate(next); try { localStorage.setItem("ownagent_eval_gate", JSON.stringify(next)); } catch {} };
  const metrics: Metric[] = [
    { label: "执行总耗时", value: fmtMs(data.totalMs), detail: data.totalMs !== undefined ? "后端 trace.totalMs / 消息 duration" : "运行记录未提供总耗时", icon: Clock3 },
    { label: "Token 总量", value: fmtInt(data.totalTokens), detail: data.tokensIn !== undefined || data.tokensOut !== undefined ? `输入 ${fmtInt(data.tokensIn)} · 输出 ${fmtInt(data.tokensOut)}` : "读取消息或 Provider usage", icon: Cpu },
    { label: "工具调用", value: String(data.tools.length), detail: data.knownTools ? `${data.successfulTools} 成功 · ${data.failedTools} 失败` : "按本次实际工具事件计数", icon: Wrench },
    { label: "步骤成功率", value: data.knownSteps ? pct(data.successfulSteps, data.knownSteps) : "暂无数据", detail: data.knownSteps ? `${data.successfulSteps} 成功 / ${data.failedSteps} 失败 · ${data.unknownSteps} 未知` : "仅统计明确成功或失败的步骤", icon: ShieldCheck, tone: data.failedSteps ? "bad" : "good" },
    { label: "实际费用", value: data.cost !== undefined ? data.cost.toFixed(6) : "未上报", detail: data.cost !== undefined ? "读取 Provider / 后端记录，不做价格猜测" : "没有真实费用字段，不估算", icon: CircleDollarSign },
  ];

  return <div className="ownagent-eval h-full overflow-y-auto text-slate-100">
    <div className="mx-auto max-w-6xl px-5 py-6 lg:px-8">
      <button onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-500 transition hover:bg-white hover:text-indigo-600"><ArrowLeft className="h-4 w-4"/>返回对话</button>
      <header className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5 p-5 md:p-6">
          <div className="min-w-0"><div className="flex items-center gap-2 text-[10px] font-bold tracking-[.18em] text-indigo-600"><BarChart3 className="h-3.5 w-3.5"/> AGENT RUN ANALYTICS</div><h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">对话运行分析</h1><p className="mt-1 max-w-3xl truncate text-sm text-slate-500">{message.userPrompt || "本次 Agent 执行记录"}</p><div className="mt-3 flex flex-wrap gap-2">{message.modelName && <Pill>{message.modelName}</Pill>}<Pill>{data.steps.length} 个事件步骤</Pill><Pill>{data.tools.length} 次工具调用</Pill>{message.enableRAG !== undefined && <Pill>RAG {message.enableRAG ? "开启" : "关闭"}</Pill>}</div></div>
          <div className={`min-w-[210px] rounded-xl ${judge ? "bg-indigo-50" : "bg-slate-50"} px-4 py-3`}>
            <div className="text-[10px] font-semibold tracking-wider text-indigo-600">SEMANTIC EVALUATION</div>
            <div className="mt-1 text-xl font-semibold text-slate-800">{overall === null ? "尚未评判" : overall + " / 100"}</div>
            <button onClick={runJudge} disabled={judgeLoading} className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50">{judgeLoading ? "Judge 运行中…" : judge ? "重新评估" : "运行真实 AI Judge"}</button>
          </div>
        </div>
        <div className="grid grid-cols-2 border-t border-slate-100 md:grid-cols-4">
          {[
            ["总耗时", fmtMs(data.totalMs)], ["Token", fmtInt(data.totalTokens)],
            ["工具调用", String(data.tools.length)], ["失败步骤", String(data.failedSteps)]
          ].map(([label, value], i) => <div key={label} className={`p-4 ${i % 2 ? "border-l border-slate-100" : ""} ${i > 1 ? "border-t border-slate-100 md:border-t-0" : ""} ${i > 0 ? "md:border-l" : ""}`}><div className="text-[10px] text-slate-400">{label}</div><div className="mt-1 font-mono text-lg font-semibold text-slate-800 tabular-nums">{value}</div></div>)}
        </div>
      </header>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-3.5"><Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600"/><p className="text-[11px] leading-5 text-sky-800">以下统计直接读取本次消息持久化的 Agent Timeline、工具调用和 Provider usage。成功率只把明确成功/失败的记录纳入分母；未知状态不会被当成成功。费用仅展示后端实际上报值。</p></div>

      <section className="mt-5"><div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">本次运行指标</h2><p className="mt-1 text-[11px] text-slate-400">每个数字均有数据来源；未采集到的字段保持为空</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{metrics.map(m => <MetricCard key={m.label} metric={m}/>)}</div></section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <Panel title="执行事件明细">
          {data.steps.length ? <div className="space-y-0">{data.steps.map((s, i) => {
            const failed = isFailure(s.status), succeeded = isSuccess(s.status);
            return <div key={s.stepId} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="relative flex w-7 shrink-0 justify-center"><div className={`z-10 flex h-7 w-7 items-center justify-center rounded-full ${failed ? "bg-rose-50 text-rose-600" : succeeded ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>{failed ? <XCircle className="h-4 w-4"/> : succeeded ? <CheckCircle2 className="h-4 w-4"/> : <Activity className="h-4 w-4"/>}</div>{i !== data.steps.length - 1 && <div className="absolute top-7 h-full w-px bg-slate-200"/>}</div>
              <div className="min-w-0 flex-1 rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-semibold text-slate-700">{s.rightTitle || s.leftTitle || "执行步骤"}</div><span className="font-mono text-[10px] text-slate-400">{fmtMs(asNumber(s.durationMs))}</span></div><div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-400"><span>{s.phase}</span><span>·</span><span>{s.status}</span></div><p className="mt-1 text-[10px] leading-4 text-slate-500">{s.rightSubtitle || s.leftSummary || "事件未附带描述"}</p></div>
            </div>;
          })}</div> : <Empty title="没有可分析的执行事件" desc="本次运行未持久化 Agent Timeline / traceSteps。不会用演示数据填充。"/>}
        </Panel>
        <div className="space-y-5">
          <Panel title="耗时拆解">
            <Row label="首 Token 延迟（TTFT）" value={fmtMs(data.ttftMs)} detail="Provider / 后端上报的真实首 Token 时间"/>
            <Row label="步骤耗时合计" value={fmtMs(data.stepDurationSum)} detail="仅累加有 durationMs 的事件，可能包含并行区间"/>
            <Row label="步骤平均耗时" value={fmtMs(data.avgStepMs)} detail={data.avgStepMs !== undefined ? "有耗时记录的步骤平均值" : "没有步骤耗时数据"}/>
            <Row label="最慢步骤" value={fmtMs(data.maxStepMs)} detail="本次事件中记录到的最大单步耗时"/>
            <Row label="工具耗时合计" value={fmtMs(data.toolDurationSum)} detail="仅累加工具调用明确上报的耗时"/>
          </Panel>
          <Panel title="执行可靠性">
            <Row label="步骤成功" value={String(data.successfulSteps)}/>
            <Row label="步骤失败" value={String(data.failedSteps)}/>
            <Row label="状态未知" value={String(data.unknownSteps)}/>
            <Row label="明确状态步骤成功率" value={data.knownSteps ? pct(data.successfulSteps, data.knownSteps) : "暂无数据"} detail="成功数 ÷（成功数 + 失败数）"/>
            <Row label="工具成功率" value={data.knownTools ? pct(data.successfulTools, data.knownTools) : "暂无数据"} detail="只计算明确返回成功/失败状态的工具调用"/>
          </Panel>
          <Panel title="Token 与知识检索">
            <Row label="输入 Token" value={fmtInt(data.tokensIn)}/>
            <Row label="输出 Token" value={fmtInt(data.tokensOut)}/>
            <Row label="总 Token" value={fmtInt(data.totalTokens)}/>
            <Row label="RAG 开关" value={message.enableRAG === undefined ? "未知" : message.enableRAG ? "开启" : "关闭"}/>
            <Row label="引用来源数" value={message.citations ? String(message.citations.length) : "未上报"} detail="来自本次消息 citations 数据"/>
          </Panel>
        </div>
      </div>

      <section className="mt-5 grid gap-4 md:grid-cols-2"><ContentPanel title="用户任务" content={message.userPrompt || "未保存原始任务文本"}/><ContentPanel title="Agent 最终回复" content={message.content || "暂无最终回复"}/></section>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
  <Panel title="AI Judge 语义评估">
    {judgeError && <div className="mb-3 rounded-lg bg-rose-50 p-3 text-[11px] text-rose-700">{judgeError}</div>}
    {judge ? <div className="grid gap-3 sm:grid-cols-2">
      {[["任务完成度", judgeScores.taskCompletion], ["指令遵循", judgeScores.instructionFollowing], ["回答正确性", judgeScores.answerCorrectness], ["工具使用", judgeScores.toolUse], ["综合评分", judgeScores.overall]].map(([label, score]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="text-[11px] text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold text-slate-900">{typeof score === "number" ? score : "—"}</div></div>)}
      <div className="sm:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3"><div className="text-[11px] font-semibold text-indigo-900">Judge 结论</div><p className="mt-1 text-[11px] leading-5 text-indigo-900/75">{judgeScores.summary || "无总结"}</p><div className="mt-2 flex flex-wrap gap-2">{(judgeScores.issues || []).map((x: any, i: number) => <span key={i} className="rounded-full bg-white px-2 py-1 text-[10px] text-rose-700">{String(x)}</span>)}</div></div>
    </div> : <Empty title="尚未运行 Judge" desc="点击右上角“运行真实 AI Judge”，使用当前任务、最终回答和执行证据进行语义评估。"/>}
  </Panel>
  <Panel title="Evaluation Gate">
    <Row label="综合评分门槛" value={gate.minOverall + " 分"}/><Row label="任务完成门槛" value={gate.minTask + " 分"}/><Row label="可靠性门槛" value={gate.minReliability + " %"}/>
    <div className="mt-3 flex gap-2"><button onClick={() => persistGate({...gate,minOverall:Math.max(0,gate.minOverall-5)})} className="rounded-lg border px-2 py-1 text-[10px]">降低 5</button><button onClick={() => persistGate({...gate,minOverall:Math.min(100,gate.minOverall+5)})} className="rounded-lg border px-2 py-1 text-[10px]">提高 5</button></div>
    <div className={`mt-4 rounded-xl p-4 ${gatePass ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-600"}`}><div className="text-xs font-semibold">{judge ? (gatePass ? "PASS · 可以进入发布" : "FAILED · 不满足发布门禁") : "WAITING · 等待 Judge"}</div><p className="mt-1 text-[10px] leading-4">门禁基于真实 Judge 分数 + 本次真实执行可靠性，不使用静态演示分数。</p></div>
  </Panel>
</div>
<div className="mt-5 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><Target className="h-4 w-4 text-indigo-500"/>评估原则</div><p className="mt-2 text-[11px] leading-5 text-slate-500">运行遥测来自真实 Trace；语义评分来自实际 Judge 模型；发布门禁由明确阈值计算。没有数据就显示暂无数据，不用启发式公式伪造质量分。</p></div>
    </div>
  </div>;
}
function Pill({ children }: { children: React.ReactNode }) { return <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-500">{children}</span>; }
function ContentPanel({ title, content }: { title: string; content: string }) { return <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><h3 className="text-xs font-semibold text-slate-800">{title}</h3><p className="mt-3 whitespace-pre-wrap break-words text-xs leading-6 text-slate-600">{content}</p></div>; }
