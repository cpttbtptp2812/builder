import { useEffect, useRef, useState } from "react";

type TimelineItem = {
  whisper?: string;
  time: string;
  title: string;
  body: string;
};

/** 时间线卡片 — 滚入后自动浮现心里话 */
export function TimelineMemoryCard({
  item,
  index,
  visible,
  onBurst,
}: {
  item: TimelineItem;
  index: number;
  visible: boolean;
  onBurst?: (x: number, y: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const burst = useRef(false);
  const whisper = item.whisper;

  useEffect(() => {
    if (!visible || !whisper || open) return;
    const t = window.setTimeout(() => {
      setOpen(true);
      if (!burst.current) {
        burst.current = true;
        onBurst?.(window.innerWidth / 2, window.innerHeight * 0.5);
      }
    }, 900 + index * 200);
    return () => clearTimeout(t);
  }, [visible, whisper, index, open, onBurst]);

  return (
    <article
      className={`secret-timeline-card${visible ? " in" : ""}${open ? " open" : ""}${whisper ? " has-whisper" : ""}`}
      style={{ transitionDelay: `${index * 0.06}s` }}
    >
      <div className="secret-timeline-card-glow" aria-hidden="true" />
      <time>{item.time}</time>
      <h3>{item.title}</h3>
      <p>{item.body}</p>
      {whisper && (
        <>
          <p className="secret-timeline-whisper">{open ? whisper : ""}</p>
          <span className="secret-timeline-heart" aria-hidden="true">
            {open ? "♥" : "♡"}
          </span>
        </>
      )}
    </article>
  );
}
