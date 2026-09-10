import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  FRONTEND_DEBUG_TOOLKIT,
  extensionDownloadUrl,
  type ExtensionItem,
} from "../../data/clipHubExtensions";

/** 扩展目录页统一卡片 — 标题 + 一句 tagline + 操作，不铺长描述 */
export function ExtensionCatalogCard({
  ext,
  showDownload = false,
}: {
  ext: ExtensionItem;
  showDownload?: boolean;
}) {
  return (
    <article
      className={`clip-hub-ext-card clip-hub-ext-card--simple${ext.toolkitMember ? " clip-hub-ext-card--tool" : ""}`}
      style={{ "--ext-accent": ext.accent } as CSSProperties}
    >
      <Link to={`/tools/extensions/${ext.id}`} className="clip-hub-ext-card-link">
        <div className="clip-hub-ext-head">
          <span className="clip-hub-ext-icon" aria-hidden>
            {ext.icon}
          </span>
          <div className="clip-hub-ext-head-text">
            <h3>
              {ext.name}
              {ext.personal ? (
                <span className="clip-hub-ext-badge clip-hub-ext-badge--personal">个人</span>
              ) : null}
            </h3>
            <p className="clip-hub-ext-tagline">{ext.tagline}</p>
          </div>
          <span className="clip-hub-ext-go" aria-hidden>
            →
          </span>
        </div>
        <span className="clip-hub-ext-cta">查看演示</span>
      </Link>

      {showDownload ? (
        <div className="clip-hub-ext-foot clip-hub-ext-foot--simple">
          <a
            href={extensionDownloadUrl(ext)}
            className="clip-hub-ext-dl"
            download
            rel="noopener noreferrer"
          >
            下载 v{ext.version}
          </a>
          {ext.workSlug ? (
            <Link to={`/work/${ext.workSlug}`} className="clip-hub-ext-side">
              产品介绍
            </Link>
          ) : null}
        </div>
      ) : ext.toolkitMember ? (
        <p className="clip-hub-ext-in-bundle">含在 {FRONTEND_DEBUG_TOOLKIT.name} 内</p>
      ) : null}
    </article>
  );
}
