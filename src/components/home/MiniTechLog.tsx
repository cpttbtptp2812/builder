import { useEffect, useState } from "react";

type Accent = "amber" | "indigo" | "teal" | "sky";

const ACCENT_CLASS: Record<Accent, string> = {
  amber: "amber",
  indigo: "indigo",
  teal: "",
  sky: "sky",
};

/** 首页卡片 — 终端式技术日志轮播 */
export function MiniTechLog({
  label,
  lines,
  accent = "teal",
  intervalMs = 1200,
}: {
  label: string;
  lines: string[];
  accent?: Accent;
  intervalMs?: number;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setIdx((i) => (i + 1) % lines.length);
    }, intervalMs);
    return () => clearInterval(tick);
  }, [lines.length, intervalMs]);

  return (
    <div className="mini-live mini-tech-log" onClick={(e) => e.stopPropagation()}>
      <div className="mini-live-head">
        <span className={`live-pulse ${ACCENT_CLASS[accent]}`}>LIVE</span>
        <span className="mini-live-label">{label}</span>
      </div>
      <div className="mini-tech-log-body">
        {lines.map((line, i) => (
          <div
            key={line}
            className={`mini-tech-log-line${i === idx ? " active" : i < idx ? " done" : ""}`}
          >
            <span className="mini-tech-log-prompt">{i <= idx ? "›" : " "}</span>
            <code>{line}</code>
          </div>
        ))}
      </div>
    </div>
  );
}
