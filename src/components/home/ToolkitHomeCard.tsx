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

/** 首页 — 前端联调工具包（与 OwnAgent 卡片同等工业级质感与视觉对齐） */
export function ToolkitHomeCard() {
  const tk = FRONTEND_DEBUG_TOOLKIT;

  return (
    <article
      className="home-featured-card home-featured-card--product"
      style={{ "--card-accent": tk.accent } as CSSProperties}
    >
      <div className="home-featured-top">
        <div className="home-featured-meta">
          <span className="home-featured-badge">Chrome MV3 扩展</span>
          <span className="home-featured-impact">三合一工具箱</span>
        </div>
        <h3>{tk.name}</h3>
        <p className="home-featured-hook">{tk.tagline}</p>
        <p className="home-featured-desc">{tk.desc}</p>
        <div className="home-featured-tech-row" style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", margin: "0.4rem 0 0.6rem" }}>
          {["ClipHub 网页摘录", "Env 域名切环境", "Wire 帧级看 SSE"].map((tag) => (
            <span key={tag} className="tech-badge">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="home-featured-demo">
        <div className="mini-live mini-toolkit-preview">
          <div className="mini-live-head">
            <span className="live-pulse plaza" style={{ background: "#0d9488", color: "#ffffff" }}>解压即用</span>
            <span className="mini-live-label">本地离线 · 数据不外泄</span>
          </div>
          <p className="mini-turn-replay-q" style={{ margin: "0.35rem 0 0.45rem", fontSize: "0.82rem", color: "#1e293b", fontWeight: 600 }}>
            日常联调三件套：随手切环境、查流式帧、记原文定位
          </p>
          <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.74rem", color: "#64748b" }}>
            <span>✓ 开发者模式一键载入</span>
            <span>✓ 本地存储零依赖</span>
          </div>
        </div>
      </div>

      <div className="home-featured-actions">
        <button type="button" className="home-featured-cta" onClick={triggerDownload}>
          下载 v{tk.version}
          <span aria-hidden style={{ marginLeft: "0.3rem" }}>↓</span>
        </button>
        <Link to="/tools/extensions" className="home-note-btn">
          安装说明
          <span aria-hidden style={{ marginLeft: "0.2rem" }}>→</span>
        </Link>
      </div>
    </article>
  );
}
