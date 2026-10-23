import { useEffect, useRef, useState } from "react";

const CLOSE_AFTER_MS = 1000;

/** 思考区只留中文。模型自带的英文草稿不展示。 */
function chineseThought(text: string): string {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (latin > 40 && latin > cjk * 2) return "";
  return text;
}

/**
 * 思考在回复上方。生成时只显示「思考中…」。
 * 模型整理完之前不展示正文；英文思考草稿不展示。
 */
export function AgentReasoningBlock({
  text,
  thinking = false,
}: {
  text: string;
  thinking?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [seconds, setSeconds] = useState<number | null>(null);
  const startRef = useRef<number | null>(thinking ? Date.now() : null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thinking) {
      if (startRef.current == null) startRef.current = Date.now();
      return;
    }
    if (startRef.current != null) {
      setSeconds(Math.max(1, Math.ceil((Date.now() - startRef.current) / 1000)));
      startRef.current = null;
    }
  }, [thinking]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !open) return;
    el.scrollTop = el.scrollHeight;
  }, [text, open]);

  const shown = chineseThought(text);
  if (!shown && !thinking) return null;

  const preview = shown
    ? shown
        .split("\n")
        .map((line) => line.trim().replace(/^\*+|\*+$/g, ""))
        .find(Boolean)
    : "";
  const label = thinking ? "正在深度思考…" : seconds != null ? `已深度思考 ${seconds}s` : "深度推理过程";

  return (
    <div className={`agent-reasoning-block${open ? " is-open" : ""}${thinking ? " is-thinking" : ""}`}>
      {open ? (
        <div className="agent-reasoning-terminal-head">
          <div className="agent-terminal-dots" aria-hidden="true">
            <span className="agent-terminal-dot is-cyan" />
            <span className="agent-terminal-dot is-indigo" />
            <span className="agent-terminal-dot is-emerald" />
          </div>
          <div className="agent-terminal-title">
            <svg className="agent-reasoning-spark" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v14M1 8h14M3 3l10 10M3 13L13 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <span>NEURAL REASONING // 思考链路</span>
            {seconds != null ? <span className="agent-terminal-time">{seconds}s</span> : null}
          </div>
          <button
            type="button"
            className="agent-terminal-toggle-btn"
            onClick={() => setOpen(false)}
            title="收起推理过程"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M4 10l4-4 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>收起</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="agent-reasoning-toggle"
          onClick={() => setOpen((value) => !value)}
          title="展开查看模型深度推理链路"
        >
          <span className="agent-reasoning-title">
            <svg className="agent-reasoning-spark" width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v14M1 8h14M3 3l10 10M3 13L13 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity="0.9" />
            </svg>
            {thinking ? (
              <span className="agent-text-shimmer">{label}</span>
            ) : (
              <span className="agent-reasoning-label-badge">{label}</span>
            )}
            {preview ? <em className="agent-reasoning-preview">{preview}</em> : null}
          </span>
          <svg
            className="agent-reasoning-chevron"
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}

      {open && shown ? (
        <div className="agent-reasoning-body" ref={bodyRef}>
          <div className="agent-reasoning-code">
            <span className="agent-reasoning-line-accent" aria-hidden="true" />
            <p>
              {shown}
              {thinking ? <span className="ua-caret" /> : null}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
