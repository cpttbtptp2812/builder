import type { CSSProperties, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { FRONTEND_DEBUG_TOOLKIT, toolkitDownloadUrl } from "../../data/clipHubExtensions";

function triggerDownload(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  const a = document.createElement("a");
  a.href = toolkitDownloadUrl();
  a.download = FRONTEND_DEBUG_TOOLKIT.zip;
  a.rel = "noopener noreferrer";
  a.click();
}

/** 首页 — 前端联调工具包（与个人扩展同款紧凑卡片） */
export function ToolkitHomeCard() {
  const tk = FRONTEND_DEBUG_TOOLKIT;

  return (
    <article className="ext-home-card ext-home-card--toolkit" style={{ "--ext-accent": tk.accent } as CSSProperties}>
      <Link to="/tools/extensions" className="ext-home-card-link">
        <span className="ext-home-icon" aria-hidden>
          {tk.icon}
        </span>
        <h3>{tk.name}</h3>
        <p className="ext-home-tagline">{tk.tagline}</p>
        <span className="ext-home-enter">
          安装说明
          <span aria-hidden>→</span>
        </span>
      </Link>
      <button type="button" className="ext-home-dl" onClick={triggerDownload}>
        下载 v{tk.version}
      </button>
    </article>
  );
}
