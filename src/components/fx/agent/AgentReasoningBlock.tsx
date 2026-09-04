import { useEffect, useState } from "react";

/** Reasoning 折叠块 — 对齐 tianyangAgent ReasoningMessage */
export function AgentReasoningBlock({
  text,
  thinking,
  defaultOpen,
}: {
  text: string;
  thinking?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? thinking ?? false);
  const wasThinking = thinking;

  useEffect(() => {
    if (wasThinking && !thinking) setOpen(false);
  }, [thinking, wasThinking]);

  if (!text && !thinking) return null;

  return (
    <div className="agent-reasoning-block">
      <button type="button" className="agent-reasoning-toggle" onClick={() => setOpen((o) => !o)}>
        {thinking ? (
          <span className="agent-text-shimmer">思考中…</span>
        ) : (
          <span>思考过程</span>
        )}
        <em>{open ? "▾" : "▸"}</em>
      </button>
      {open && (
        <div className="agent-reasoning-body">
          <p>{text || (thinking ? "" : "分析意图并选择 MCP 工具…")}</p>
        </div>
      )}
    </div>
  );
}
