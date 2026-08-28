import { useEffect, useState, type CSSProperties } from "react";
import type { Work } from "../../data/works";

/** 通用作品预览 — 循环高亮技术栈 + teaser */
export function MiniTeaserLive({ work }: { work: Work }) {
  const [active, setActive] = useState(0);
  const stack = work.stack.slice(0, 5);

  useEffect(() => {
    if (stack.length <= 1) return;
    const tick = window.setInterval(() => {
      setActive((i) => (i + 1) % stack.length);
    }, 950);
    return () => clearInterval(tick);
  }, [stack.length]);

  return (
    <div
      className="mini-live mini-teaser"
      style={{ "--teaser-accent": work.accent } as CSSProperties}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mini-live-head">
        <span className="live-pulse teaser">PREVIEW</span>
        <span className="mini-live-label">{work.subtitle}</span>
      </div>
      <p className="mini-teaser-text">{work.teaser}</p>
      <div className="mini-teaser-stack">
        {stack.map((tag, i) => (
          <span key={tag} className={i === active ? "on" : ""}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
