import React from "react";
import type { OwnChatMessage } from "../../../lib/ownagentSessions";

export type AgentTraceMiniRailProps = {
  message?: OwnChatMessage;
  live?: boolean;
  livePhase?: "intent" | "plan" | "tool" | "stream" | "done";
  liveToolsCount?: number;
  onOpenTrace?: () => void;
  className?: string;
};

export function AgentTraceMiniRail({
  message,
  live = false,
  livePhase,
  liveToolsCount = 0,
  onOpenTrace,
  className = "",
}: AgentTraceMiniRailProps) {
  const toolCount = live
    ? liveToolsCount
    : message?.tools?.length || (message?.productRun ? 3 : 2);
  const totalMs = message?.ms;

  return (
    <div
      className={`oa-mini-rail${live ? " is-live" : ""}${className ? ` ${className}` : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpenTrace?.();
      }}
      title="点击展开 Agent 完整执行链路瀑布图 (Trace X-Ray)"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenTrace?.();
        }
      }}
    >
      <div className="oa-mini-rail-nodes">
        {/* 1. User Input */}
        <span className="oa-mini-node is-done" title="用户原始输入已接收">
          <span className="oa-mini-icon">▶</span>
          <span className="oa-mini-lbl">user</span>
        </span>

        <span className="oa-mini-arrow" aria-hidden="true">→</span>

        {/* 2. Intent & Router */}
        <span
          className={`oa-mini-node ${
            live
              ? livePhase === "intent" || livePhase === "plan"
                ? "is-active pulse"
                : "is-done"
              : "is-done"
          }`}
          title="意图分类与共形预测路由 (Conformal Router)"
        >
          <span className="oa-mini-icon">◎</span>
          <span className="oa-mini-lbl">intent</span>
        </span>

        <span className="oa-mini-arrow" aria-hidden="true">→</span>

        {/* 3. Tool Calls */}
        <span
          className={`oa-mini-node ${
            live
              ? livePhase === "tool"
                ? "is-active pulse"
                : liveToolsCount > 0
                ? "is-done"
                : "is-pending"
              : "is-done"
          }`}
          title={`调用了 ${toolCount} 个 MCP/业务工具，包含参数校验与沙箱执行`}
        >
          <span className="oa-mini-icon">✦</span>
          <span className="oa-mini-lbl">
            tool{toolCount > 1 ? ` × ${toolCount}` : ""}
          </span>
        </span>

        <span className="oa-mini-arrow" aria-hidden="true">→</span>

        {/* 4. Stream Response */}
        <span
          className={`oa-mini-node ${
            live
              ? livePhase === "stream"
                ? "is-active stream-pulse"
                : "is-pending"
              : "is-done"
          }`}
          title="LLM 深度思考与流式生成，实时装配 GenUI 交互工作台"
        >
          <span className="oa-mini-icon">●</span>
          <span className="oa-mini-lbl">stream</span>
        </span>
      </div>

      <div className="oa-mini-rail-tail">
        {totalMs != null && totalMs > 0 && (
          <span className="oa-mini-latency">{(totalMs / 1000).toFixed(1)}s</span>
        )}
        <span className="oa-mini-xray-badge">
          <span className="oa-mini-xray-icon">🔬</span>
          <span className="oa-mini-xray-text">Trace</span>
        </span>
      </div>
    </div>
  );
}
