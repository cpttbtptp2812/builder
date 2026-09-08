import type { CSSProperties, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { type ExtensionItem, extensionDownloadUrl } from "../../data/clipHubExtensions";

function triggerDownload(ext: ExtensionItem, e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation();
  const a = document.createElement("a");
  a.href = extensionDownloadUrl(ext);
  a.download = ext.zip;
  a.rel = "noopener noreferrer";
  a.click();
}

/** 首页扩展卡片 — 点击进入详情 + 动态演示 */
export function ExtensionHomeCard({ ext }: { ext: ExtensionItem }) {
  return (
    <article className="ext-home-card" style={{ "--ext-accent": ext.accent } as CSSProperties}>
      <Link to={`/tools/extensions/${ext.id}`} className="ext-home-card-link">
        <span className="ext-home-icon" aria-hidden>
          {ext.icon}
        </span>
        <h3>{ext.name}</h3>
        <p className="ext-home-tagline">{ext.tagline}</p>
        <span className="ext-home-enter">
          查看演示
          <span aria-hidden>→</span>
        </span>
      </Link>
      <button type="button" className="ext-home-dl" onClick={(e) => triggerDownload(ext, e)}>
        下载 v{ext.version}
      </button>
    </article>
  );
}
