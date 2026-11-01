import React, { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Check, Loader2, Minus } from "lucide-react";
import type { TraceDrawerMessage } from "./TraceInspectorDrawer";

type StepStatus = "running" | "done";

export interface FlowNode {
  id: string;
  label: string;
  detail: string;
  lane: string;
  status: StepStatus;
}

type PipelineDef = { id: string; label: string; detail: string; lane: string; phase: number };

const FULL_PIPELINE: PipelineDef[] = [
  { phase: 1, id: "gw", label: "网关接入", detail: "建立 SSE 长连接", lane: "接入" },
  { phase: 1, id: "sess", label: "会话绑定", detail: "Session / 参数校验", lane: "接入" },
  { phase: 2, id: "hash", label: "请求指纹", detail: "规范化缓存键", lane: "调度" },
  { phase: 2, id: "intent", label: "意图路由", detail: "匹配业务流 DSL", lane: "调度" },
  { phase: 3, id: "rag-q", label: "知识召回", detail: "检索企业规程", lane: "上下文" },
  { phase: 3, id: "rag-i", label: "上下文注入", detail: "组装 System Prompt", lane: "上下文" },
  { phase: 4, id: "llm-h", label: "模型握手", detail: "通道鉴权与排队", lane: "认知" },
  { phase: 4, id: "llm-t", label: "推理推流", detail: "Thinking / Delta", lane: "认知" },
  { phase: 5, id: "tool", label: "技能沙箱", detail: "Tool / Git / MCP", lane: "执行" },
  { phase: 6, id: "sse", label: "流式下行", detail: "逐 Token 推送", lane: "交付" },
  { phase: 6, id: "audit", label: "审计归档", detail: "Trace 落库", lane: "交付" },
];

const CACHE_PIPELINE: PipelineDef[] = [
  { phase: 1, id: "gw", label: "网关接入", detail: "接收提问", lane: "接入" },
  { phase: 2, id: "hash", label: "指纹比对", detail: "与历史问答对齐", lane: "缓存" },
  { phase: 2, id: "hit", label: "命中缓存", detail: "跳过 LLM 调用", lane: "缓存" },
  { phase: 6, id: "replay", label: "回放答案", detail: "读取标准答复", lane: "交付" },
  { phase: 6, id: "audit", label: "闭环完成", detail: "0 算力消耗", lane: "交付" },
];

function maxTraceStep(traceSteps?: Record<number, unknown>): number {
  if (!traceSteps) return 0;
  const nums = Object.keys(traceSteps)
    .map((k) => parseInt(k, 10))
    .filter((n) => !Number.isNaN(n));
  return nums.length ? Math.max(...nums) : 0;
}

/** 将后端 phase(1-6) 映射到流水线中的「当前步」下标（含 phase 内子步） */
function resolveActiveIndex(
  pipeline: PipelineDef[],
  maxPhase: number,
  subTick: number,
  running: boolean,
  isCacheHit: boolean,
  hasTools: boolean
): number {
  if (isCacheHit) {
    if (!running && maxPhase >= 2) return pipeline.length - 1;
    if (maxPhase <= 0) return running ? 0 : -1;
    if (maxPhase === 1) return Math.min(1, pipeline.length - 1);
    if (maxPhase >= 2 && running) return Math.min(2 + (subTick % 2), pipeline.length - 1);
    if (maxPhase >= 6) return pipeline.length - 1;
    return Math.min(3 + (subTick % 2), pipeline.length - 1);
  }

  if (!running && maxPhase <= 0) return pipeline.length - 1;

  const phaseToStart: Record<number, number> = {};
  pipeline.forEach((p, i) => {
    if (phaseToStart[p.phase] === undefined) phaseToStart[p.phase] = i;
  });

  let idx = 0;
  if (maxPhase <= 0) {
    idx = running ? 0 : pipeline.length - 1;
  } else {
    const start = phaseToStart[maxPhase] ?? 0;
    const nextPhaseStart = phaseToStart[maxPhase + 1] ?? pipeline.length;
    const span = Math.max(1, nextPhaseStart - start);
    const sub = running ? subTick % span : span - 1;
    idx = Math.min(start + sub, pipeline.length - 1);
  }

  if (!hasTools && maxPhase >= 4 && pipeline[idx]?.id === "tool" && running) {
    idx = Math.min(idx + 1, pipeline.length - 1);
  }

  if (!running) return pipeline.length - 1;
  return idx;
}

export function buildVisibleFlowNodes(
  message: TraceDrawerMessage,
  isCacheHit: boolean,
  subTick: number
): FlowNode[] {
  const pipeline = isCacheHit ? CACHE_PIPELINE : FULL_PIPELINE;
  const maxPhase = maxTraceStep(message.traceSteps);
  const running = !!message.isThinking;
  const hasTools = (message.toolCalls?.length ?? 0) > 0;

  const activeIdx = resolveActiveIndex(pipeline, maxPhase, subTick, running, isCacheHit, hasTools);

  if (activeIdx < 0) return [];

  const visibleEnd = running ? activeIdx : pipeline.length - 1;

  return pipeline.slice(0, visibleEnd + 1).map((step, i) => ({
    id: step.id,
    label: step.label,
    detail: step.detail,
    lane: step.lane,
    status: i < activeIdx ? "done" : "running",
  }));
}

interface ExecutionFlowLivePanelProps {
  message: TraceDrawerMessage;
  isCacheHit: boolean;
  totalMs: number;
  ttftMs: number;
  tokens: number;
  llmConnected?: boolean;
}

export const ExecutionFlowLivePanel: React.FC<ExecutionFlowLivePanelProps> = ({
  message,
  isCacheHit,
  totalMs,
  ttftMs,
  tokens,
  llmConnected = true,
}) => {
  const [tickMs, setTickMs] = useState(0);
  const [subTick, setSubTick] = useState(0);

  useEffect(() => {
    if (!message.isThinking) {
      setTickMs(totalMs);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => {
      setTickMs(totalMs + (Date.now() - start));
    }, 120);
    return () => window.clearInterval(id);
  }, [message.isThinking, message.id, totalMs]);

  useEffect(() => {
    if (!message.isThinking) return;
    const id = window.setInterval(() => setSubTick((n) => n + 1), 700);
    return () => window.clearInterval(id);
  }, [message.isThinking, message.id]);

  const nodes = useMemo(
    () => buildVisibleFlowNodes(message, isCacheHit, subTick),
    [message, isCacheHit, subTick]
  );

  const displayMs = message.isThinking ? tickMs : totalMs;
  const runningNode = nodes.find((n) => n.status === "running") || nodes[nodes.length - 1];
  const doneCount = nodes.filter((n) => n.status === "done").length;

  const thinkingPreview = useMemo(() => {
    if (message.reasoning?.trim()) {
      const t = message.reasoning.trim();
      return t.length > 1400 ? t.slice(-1400) : t;
    }
    if (message.isThinking && runningNode) {
      return `[${runningNode.lane}] ${runningNode.label}\n${runningNode.detail}`;
    }
    if (isCacheHit) {
      return "命中历史相同问答，直接从缓存回放标准答案，未调用大模型。";
    }
    if (!llmConnected) {
      return "大模型通道未连通：当前仅执行接入、缓存与知识库链路；请在设置中配置 API Key 后重试推理。";
    }
    return "处理完成。技术字段与逐步清单见「详细」。";
  }, [message.reasoning, message.isThinking, runningNode, isCacheHit, llmConnected]);

  return (
    <div className="flex flex-col gap-3 min-h-[380px]">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-slate-700 tracking-wide">实时处理</span>
        <span className="font-mono text-slate-500 tabular-nums text-[10px]">
          {nodes.length} 步显现 · {(displayMs / 1000).toFixed(1)}s
          {ttftMs > 0 && !message.isThinking ? ` · TTFT ${ttftMs}ms` : ""}
          {tokens > 0 ? ` · ${tokens} 字` : ""}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-3 flex-1">
        {/* 左：思考流 */}
        <div className="rounded-2xl border border-cyan-500/20 bg-[#070b14] p-3.5 flex flex-col min-h-[300px] shadow-[inset_0_0_40px_rgba(34,211,238,0.06)] relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(34,211,238,0.03) 2px, rgba(34,211,238,0.03) 4px)",
            }}
          />
          <div className="relative flex items-center gap-2 mb-2">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                message.isThinking
                  ? "border-cyan-400/50 bg-cyan-500/10 text-cyan-300"
                  : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              {message.isThinking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BrainCircuit className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-cyan-50">
                {message.isThinking ? "思考中" : isCacheHit ? "缓存秒回" : "已完成"}
              </div>
              <div className="text-[10px] text-cyan-200/50 truncate font-mono">
                {runningNode ? `${runningNode.lane} / ${runningNode.label}` : "—"}
              </div>
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto rounded-lg bg-black/50 border border-white/5 p-2.5">
            <pre className="text-[11px] leading-relaxed text-slate-400 whitespace-pre-wrap font-mono m-0">
              {thinkingPreview}
            </pre>
            {message.isThinking && (
              <span className="inline-block w-2 h-3.5 ml-0.5 bg-cyan-400 animate-pulse align-middle" />
            )}
          </div>

          {message.isThinking && (
            <div className="relative mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 transition-all duration-500"
                style={{ width: `${Math.min(95, 12 + doneCount * 8 + 8)}%` }}
              />
            </div>
          )}
        </div>

        {/* 右：逐步显现流程图 */}
        <div className="rounded-2xl border border-slate-800/10 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-3 min-h-[300px] relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 20%, rgba(56,189,248,0.12), transparent 45%), radial-gradient(circle at 80% 80%, rgba(167,139,250,0.1), transparent 40%)",
            }}
          />
          <div className="relative flex flex-col gap-0 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
            {nodes.length === 0 && (
              <div className="text-[11px] text-slate-500 font-mono py-8 text-center">等待链路启动…</div>
            )}
            {nodes.map((node, idx) => {
              const isRun = node.status === "running";
              const isDone = node.status === "done";
              return (
                <div
                  key={node.id}
                  className="flex gap-2.5 animate-in fade-in slide-in-from-right-2 duration-300 fill-mode-both"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex flex-col items-center w-7 shrink-0 pt-1">
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold border transition-all duration-300 ${
                        isRun
                          ? "border-cyan-400 bg-cyan-500/20 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.45)]"
                          : isDone
                          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-200"
                          : "border-slate-600 text-slate-500"
                      }`}
                    >
                      {isDone ? <Check className="w-3 h-3" strokeWidth={3} /> : isRun ? <Loader2 className="w-3 h-3 animate-spin" /> : idx + 1}
                    </div>
                    {idx < nodes.length - 1 && (
                      <div
                        className={`w-px flex-1 min-h-[20px] my-0.5 ${
                          isDone ? "bg-gradient-to-b from-emerald-400/80 to-cyan-400/40" : "bg-slate-700"
                        }`}
                      />
                    )}
                  </div>
                  <div className={`pb-3 flex-1 min-w-0 ${isRun ? "opacity-100" : "opacity-90"}`}>
                    <div
                      className={`rounded-lg px-2.5 py-2 border backdrop-blur-sm transition-all ${
                        isRun
                          ? "border-cyan-400/40 bg-cyan-500/10 ring-1 ring-cyan-400/20"
                          : "border-white/5 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-bold truncate ${isRun ? "text-cyan-100" : "text-slate-200"}`}>
                          {node.label}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500 shrink-0 uppercase tracking-wider">
                          {node.lane}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate font-mono">{node.detail}</p>
                      {isRun && (
                        <div className="mt-1.5 flex items-center gap-1 text-[9px] text-cyan-300/90 font-mono">
                          <span className="w-1 h-1 rounded-full bg-cyan-400 animate-ping" />
                          SYNC
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {message.isThinking && (
              <div className="flex items-center gap-2 pl-9 pb-2 text-[10px] text-slate-600 font-mono">
                <Minus className="w-3 h-3" />
                <span>后续步骤随链路推进依次显现</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
