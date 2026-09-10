import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { DEBUG_TOOLKIT_TOOLS, FRONTEND_DEBUG_TOOLKIT } from "../../data/clipHubExtensions";

/** 联调工具包卡片预览 — 轮播 ClipHub / Env / Wire */
export function MiniClipHubLive() {
  const [idx, setIdx] = useState(0);
  const ext = DEBUG_TOOLKIT_TOOLS[idx]!;

  useEffect(() => {
    const tick = window.setInterval(() => {
      setIdx((i) => (i + 1) % DEBUG_TOOLKIT_TOOLS.length);
    }, 2600);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="mini-live mini-clip-hub" onClick={(e) => e.stopPropagation()}>
      <div className="mini-live-head">
        <span className="live-pulse teaser">{FRONTEND_DEBUG_TOOLKIT.name}</span>
        <span className="mini-live-label">{ext.name}</span>
      </div>
      <div className="mini-clip-hub-plugins">
        {DEBUG_TOOLKIT_TOOLS.map((e, i) => (
          <div
            key={e.id}
            className={`mini-clip-hub-plugin${i === idx ? " on" : ""}`}
            style={{ "--ext-accent": e.accent } as CSSProperties}
          >
            <span aria-hidden>{e.icon}</span>
            <strong>{e.name}</strong>
            <p>{e.tagline}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
