import { useState } from "react";

const MAX_TEXT = 600;

/** 用户气泡 — 对齐 tianyangAgent user-message */
export function UserMessageBubble({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > MAX_TEXT;
  const display = expanded || !isLong ? text : `${text.slice(0, MAX_TEXT)}…`;

  return (
    <div className={`ua-bubble user${isLong && !expanded ? " clamped" : ""}`}>
      {isLong && !expanded && <div className="ua-bubble-fade" aria-hidden />}
      <p>{display}</p>
      {isLong && (
        <button type="button" className="ua-bubble-more" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "显示更少 ↑" : "显示更多 ↓"}
        </button>
      )}
    </div>
  );
}
