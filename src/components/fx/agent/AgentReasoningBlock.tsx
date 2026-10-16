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
  const [open, setOpen] = useState(thinking);
  const [seconds, setSeconds] = useState<number | null>(null);
  const startRef = useRef<number | null>(thinking ? Date.now() : null);
  const streamedRef = useRef(thinking);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (thinking) {
      streamedRef.current = true;
      if (startRef.current == null) startRef.current = Date.now();
      setOpen(true);
      return;
    }
    if (!streamedRef.current) return;
    if (startRef.current != null) {
      setSeconds(Math.max(1, Math.ceil((Date.now() - startRef.current) / 1000)));
      startRef.current = null;
    }
    const timer = window.setTimeout(() => setOpen(false), CLOSE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [thinking]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el || !thinking) return;
    el.scrollTop = el.scrollHeight;
  }, [text, thinking]);

  const shown = chineseThought(text);
  if (!shown && !thinking) return null;

  const preview = shown
    .split("\n")
    .map((line) => line.trim().replace(/^\*+|\*+$/g, ""))
    .find(Boolean);
  const label = thinking ? "思考中…" : seconds != null ? `已思考 ${seconds} 秒` : "思考";

  return (
    <div className="agent-reasoning-block">
      <button type="button" className="agent-reasoning-toggle" onClick={() => setOpen((value) => !value)}>
        <span className="agent-reasoning-title">
          {thinking ? <span className="agent-text-shimmer">{label}</span> : <span>{label}</span>}
          {!open && preview ? <em className="agent-reasoning-preview">{preview}</em> : null}
        </span>
        <em aria-hidden>{open ? "▾" : "▸"}</em>
      </button>
      {open && shown ? (
        <div className="agent-reasoning-body" ref={bodyRef}>
          <p>
            {shown}
            {thinking ? <span className="ua-caret" /> : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
