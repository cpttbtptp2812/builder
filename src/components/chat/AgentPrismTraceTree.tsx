import React from "react";
import type { AgentStep } from "@/lib/agentTimeline";
import type { TraceSpan } from "@/vendor/agent-prism/packages/types/src/types";
import { getTotalTokens } from "@/vendor/agent-prism/packages/data/src/common/token-usage";
import { toAgentPrismTraceTree } from "@/lib/agentPrismAdapter";

function SpanNode({ span, depth }: { span: TraceSpan; depth: number }) {
  const duration = span.endTime.getTime() > span.startTime.getTime()
    ? span.endTime.getTime() - span.startTime.getTime()
    : undefined;
  const tokens = span.tokenUsage ? getTotalTokens(span.tokenUsage) : undefined;
  const tone = span.status === "error" ? "text-rose-300" : span.status === "success" ? "text-emerald-300" : "text-amber-200";
  return <div className="min-w-0" style={{ marginLeft: depth * 18 }}>
    <div className="flex min-w-0 items-center gap-2 border-l border-cyan-200/15 py-2 pl-3">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${span.status === "error" ? "bg-rose-400" : span.status === "success" ? "bg-emerald-400" : "bg-amber-300"}`} />
      <span className="min-w-0 flex-1 truncate text-[11px] text-slate-200" title={span.title}>{span.title}</span>
      <span className={`shrink-0 text-[9px] ${tone}`}>{span.status}</span>
      <span className="shrink-0 text-[9px] text-slate-500">{duration === undefined ? "耗时未上报" : duration >= 1000 ? (duration / 1000).toFixed(2) + "s" : Math.round(duration) + "ms"}</span>
      <span className="shrink-0 text-[9px] text-cyan-200/70">{tokens === undefined ? "Token 未上报" : tokens + " tokens"}</span>
    </div>
    {span.children?.map(child => <SpanNode key={child.id} span={child} depth={depth + 1} />)}
  </div>;
}

/** AgentPrism's MIT-licensed OpenTelemetry adapter, fed only real trace IDs. */
export function AgentPrismTraceTree({ timeline }: { timeline: readonly AgentStep[] }) {
  const roots = React.useMemo(() => toAgentPrismTraceTree(timeline), [timeline]);
  return <details className="relative z-10 mx-4 mb-3 rounded-xl border border-cyan-200/10 bg-slate-950/35 px-4 py-3">
    <summary className="cursor-pointer list-none text-[10px] font-semibold tracking-wide text-cyan-100/75">
      OpenTelemetry 调用关系 · AgentPrism 解析 {roots.length ? `· ${roots.length} 个根 Span` : "· 等待可关联的真实 Span"}
    </summary>
    <div className="mt-3 max-h-56 overflow-auto">
      {roots.length
        ? roots.map(span => <SpanNode key={span.id} span={span} depth={0} />)
        : <p className="py-3 text-[10px] leading-5 text-slate-500">当前事件尚未同时提供真实 traceId、spanId 和开始时间，因此不生成虚构的调用树。接入 OTLP 后会自动显示父子 Span 关系。</p>}
    </div>
  </details>;
}
