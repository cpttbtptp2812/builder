import React, { useEffect, useRef, useState } from "react";

/** 思考区只留中文。模型自带的英文草稿不展示。 */
function chineseThought(text: string): string {
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  if (latin > 40 && latin > cjk * 2) return "";
  return text;
}

export type AgentReasoningBlockProps = {
  text: string;
  thinking?: boolean;
  className?: string;
};

/**
 * 现代轻量化深度思考微芯片
 * 不再占用大面积黑色终端，而是作为轻量胶囊与顶栏同排展示，点击展开微型思考摘要
 */
export function AgentReasoningBlock({
  text,
  thinking = false,
  className = "",
}: AgentReasoningBlockProps) {
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

  const shown = chineseThought(text);
  if (!shown && !thinking) return null;

  const durationLabel = seconds != null ? `${seconds}s` : "2.1s";

  return (
    <div className={`oa-reasoning-chip-wrap ${open ? "is-expanded" : ""} ${className}`}>
      {/* 顶部微型胶囊按钮，可与顶栏平齐排布 */}
      <button
        type="button"
        className={`oa-reasoning-pill-btn ${thinking ? "thinking" : ""} ${open ? "active" : ""}`}
        onClick={() => setOpen(!open)}
        title={open ? "收起推理详情" : "点击查看大模型思考链 (Reasoning Traces)"}
      >
        <span className="oa-reasoning-spark-icon">{thinking ? "⏳" : "🧠"}</span>
        <span className="oa-reasoning-pill-label">
          {thinking ? "深度推理中…" : `思维链 · ${durationLabel}`}
        </span>
        <span className="oa-reasoning-pill-arrow">{open ? "▴" : "▾"}</span>
      </button>

      {/* 展开时的精致思考链小卡片 */}
      {open && shown && (
        <div className="oa-reasoning-drawer-panel" ref={bodyRef}>
          <div className="oa-reasoning-drawer-head">
            <span className="oa-reasoning-drawer-tag">CoT 思维链分解</span>
            <span className="oa-reasoning-drawer-meta">消耗约 {Math.round(shown.length * 1.3)} tokens</span>
          </div>
          <div className="oa-reasoning-drawer-body">
            <p className="oa-reasoning-drawer-p">
              {shown}
              {thinking && <span className="oa-reasoning-cursor" />}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
