import { useState } from "react";

const MAX_TEXT = 600;

export function UserMessageBubble({
  text,
  timeLabel,
}: {
  text: string;
  timeLabel?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const isLong = text.length > MAX_TEXT;
  const display = expanded || !isLong ? text : `${text.slice(0, MAX_TEXT)}…`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // fallback
    }
  };

  return (
    <div className="oa-user-msg-row">
      <div className={`oa-user-card${isLong && !expanded ? " is-clamped" : ""}`}>
        <div className="oa-user-meta-bar">
          <span className="oa-user-cyber-badge">
            <span className="oa-user-beacon" aria-hidden="true" />
            <span>USER // COMMAND</span>
          </span>
          {timeLabel && <span className="oa-user-time-pill">{timeLabel}</span>}
        </div>
        <div className="oa-user-bubble">
          <p className="oa-user-text">{display}</p>
          {isLong && (
            <button
              type="button"
              className="oa-user-more-btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "收起 ↑" : "展开全文 ↓"}
            </button>
          )}
          <div className="oa-user-action-overlay" aria-hidden={!copied}>
            <button
              type="button"
              className={`oa-user-copy-btn${copied ? " is-copied" : ""}`}
              onClick={handleCopy}
              title="复制此消息"
              aria-label="复制"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <path d="M3.5 8.5l3 3 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>已复制</span>
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3 11V4a1 1 0 011-1h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                  <span>复制</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
