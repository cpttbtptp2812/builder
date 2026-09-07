import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { EXTENSION_CATALOG } from "../../data/clipHubExtensions";



/** 插件集卡片预览 — 轮播展示各扩展 */

export function MiniClipHubLive() {

  const [idx, setIdx] = useState(0);

  const ext = EXTENSION_CATALOG[idx]!;



  useEffect(() => {

    const tick = window.setInterval(() => {

      setIdx((i) => (i + 1) % EXTENSION_CATALOG.length);

    }, 2600);

    return () => clearInterval(tick);

  }, []);



  return (

    <div className="mini-live mini-clip-hub" onClick={(e) => e.stopPropagation()}>

      <div className="mini-live-head">

        <span className="live-pulse teaser">插件集</span>

        <span className="mini-live-label">{ext.name}</span>

      </div>

      <div className="mini-clip-hub-plugins">

        {EXTENSION_CATALOG.map((e, i) => (

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


