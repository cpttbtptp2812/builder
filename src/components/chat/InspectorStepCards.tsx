import React, { useMemo, useState } from "react";
import { Activity, CheckCircle2, Circle, Clock3, Copy, Loader2, RotateCcw, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { AgentStep } from "@/lib/agentTimeline";
import { TraceDrawerMessage } from "./TraceInspectorDrawer";

interface InspectorStepCardsProps {
  timeline: AgentStep[];
  message?: TraceDrawerMessage | null;
  activeStepId?: string | null;
  onSelectStep?: (stepId: string) => void;
  isThinking?: boolean;
  onRetryRun?: () => void;
}

const statusMeta = {
  done: { label: "已完成", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  passed: { label: "已通过", color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  running: { label: "执行中", color: "text-blue-700 bg-blue-50 border-blue-200" },
  failed: { label: "失败", color: "text-rose-700 bg-rose-50 border-rose-200" },
  pending: { label: "等待中", color: "text-slate-500 bg-slate-50 border-slate-200" },
} as const;

function formatTokens(detail?: Record<string, any>): string | null {
  if (!detail) return null;
  const input = detail.inputTokens ?? detail.input_tokens;
  const output = detail.outputTokens ?? detail.output_tokens;
  const total = detail.totalTokens ?? detail.total_tokens;
  if (typeof total === "number") return `${total.toLocaleString()} tokens`;
  if (typeof input === "number" || typeof output === "number") {
    return `${typeof input === "number" ? input.toLocaleString() : "—"} in / ${typeof output === "number" ? output.toLocaleString() : "—"} out`;
  }
  return null;
}

function formatDuration(value?: number): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;
  return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${Math.round(value)}ms`;
}

export const InspectorStepCards: React.FC<InspectorStepCardsProps> = ({
  timeline,
  message,
  activeStepId,
  onSelectStep,
  isThinking,
  onRetryRun,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const ordered = useMemo(
    () => [...(timeline || [])].sort((a, b) => a.seq - b.seq || a.timestamp - b.timestamp),
    [timeline]
  );
  const hasFailure = ordered.some((step) => step.status === "failed");
  const totalKnownTokens = ordered.reduce((sum, step) => {
    const total = step.rightDetail?.totalTokens ?? step.rightDetail?.total_tokens;
    return sum + (typeof total === "number" ? total : 0);
  }, 0);
  const hasKnownTokens = ordered.some((step) =>
    typeof (step.rightDetail?.totalTokens ?? step.rightDetail?.total_tokens) === "number"
  );

  const toggle = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    onSelectStep?.(id);
  };

  const copyDetails = async (id: string, detail: Record<string, any>) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(detail, null, 2));
      setCopiedId(id);
      window.setTimeout(() => setCopiedId((current) => current === id ? null : current), 1500);
    } catch {
      // Clipboard access may be unavailable in insecure contexts.
    }
  };

  if (ordered.length === 0) {
    return (
      <div className="h-full min-h-56 flex flex-col items-center justify-center text-center px-6 text-slate-400">
        <div className="w-11 h-11 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mb-3">
          {isThinking ? <Loader2 className="w-5 h-5 animate-spin text-blue-500" /> : <Activity className="w-5 h-5" />}
        </div>
        <p className="text-sm font-semibold text-slate-700">
          {isThinking ? "正在等待执行事件" : "暂无可展示的执行事件"}
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs leading-5">
          这里仅展示后端或接入 SDK 实际上报的步骤，不会生成预设流程、模拟耗时或估算 Token。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800">本次运行</div>
            <div className="text-[11px] text-slate-500 mt-1 truncate">
              {message?.userPrompt || "外部 Agent Run"} · {ordered.length} 个已采集事件
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {hasKnownTokens && <span className="text-[10px] font-mono text-slate-600">{totalKnownTokens.toLocaleString()} tokens</span>}
            {isThinking && <span className="inline-flex items-center gap-1 text-[10px] text-blue-700"><Loader2 className="w-3 h-3 animate-spin" />实时更新中</span>}
          </div>
        </div>
        {hasFailure && onRetryRun && !isThinking && (
          <button
            type="button"
            onClick={onRetryRun}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            title="重新提交本轮用户任务，创建一次新的运行"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重新运行整个任务
          </button>
        )}
      </div>

      <div className="relative space-y-2">
        <div className="absolute left-[15px] top-4 bottom-4 w-px bg-slate-200" />
        {ordered.map((step, index) => {
          const meta = statusMeta[step.status] || statusMeta.pending;
          const expanded = expandedIds.has(step.stepId) || activeStepId === step.stepId;
          const detail = step.rightDetail || {};
          const duration = formatDuration(step.durationMs);
          const tokens = formatTokens(detail);
          const title = step.rightTitle || step.leftTitle || `执行步骤 ${index + 1}`;
          const summary = step.rightSubtitle || step.leftSummary;
          const Icon = step.status === "failed" ? XCircle : step.status === "running" ? Loader2 : step.status === "done" || step.status === "passed" ? CheckCircle2 : Circle;

          return (
            <div key={step.stepId} className="relative pl-9">
              <div className={`absolute left-[7px] top-3 w-[17px] h-[17px] rounded-full border-2 bg-white flex items-center justify-center z-[1] ${step.status === "failed" ? "border-rose-500 text-rose-500" : step.status === "running" ? "border-blue-500 text-blue-500" : step.status === "done" || step.status === "passed" ? "border-emerald-500 text-emerald-500" : "border-slate-300 text-slate-300"}`}>
                <Icon className={`w-2.5 h-2.5 ${step.status === "running" ? "animate-spin" : ""}`} />
              </div>
              <button
                type="button"
                onClick={() => toggle(step.stepId)}
                className={`w-full text-left rounded-xl border p-3 transition ${activeStepId === step.stepId ? "border-blue-300 bg-blue-50/50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono text-slate-400">#{step.seq}</span>
                      <span className="text-xs font-bold text-slate-800 break-words">{title}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.color}`}>{meta.label}</span>
                    </div>
                    {summary && <p className="text-[11px] text-slate-500 mt-1 leading-5">{summary}</p>}
                  </div>
                  {expanded ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {duration && <span className="inline-flex items-center gap-1 text-[10px] text-slate-500"><Clock3 className="w-3 h-3" />{duration}</span>}
                  {tokens && <span className="text-[10px] text-slate-500 font-mono">{tokens}</span>}
                  <span className="text-[10px] text-slate-400">{step.phase}</span>
                </div>
              </button>
              {expanded && (
                <div className="mt-1 rounded-xl border border-slate-200 bg-slate-950 text-slate-100 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                    <span className="text-[10px] font-semibold text-slate-300">步骤原始详情</span>
                    <button
                      type="button"
                      onClick={() => copyDetails(step.stepId, detail)}
                      className="inline-flex items-center gap-1 text-[10px] text-slate-300 hover:text-white"
                    >
                      <Copy className="w-3 h-3" />{copiedId === step.stepId ? "已复制" : "复制"}
                    </button>
                  </div>
                  <pre className="p-3 text-[10px] leading-5 overflow-x-auto whitespace-pre-wrap break-words max-h-72">
                    {JSON.stringify(detail, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hasFailure && (
        <p className="text-[10px] text-slate-400 leading-5">
          当前按钮会重新提交整轮任务，而不是单独重放失败步骤。单步重试需要执行端确认幂等性和副作用边界，避免重复执行外部操作。
        </p>
      )}
    </div>
  );
};
