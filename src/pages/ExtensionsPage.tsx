import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  EXTENSION_CATALOG,
  extensionDownloadUrl,
} from "../data/clipHubExtensions";
import { extensionHub } from "../data/clipHubRelease";
import { SiteShell } from "../components/SiteShell";
import { SiteFooter } from "../components/SiteFooter";

export function ExtensionsPage() {
  const { name, tagline, ready } = extensionHub;

  return (
    <SiteShell pageClass="site-clip-hub">
      <header className="clip-hub-page-head">
        <p className="site-home-eyebrow">Browser Extensions</p>
        <h1>{name}</h1>
        <p className="site-tagline">{tagline}</p>
        <ol className="clip-hub-steps clip-hub-steps--inline">
          <li>下载 zip 并解压</li>
          <li>Chrome → 扩展程序 → 开发者模式 → 加载已解压</li>
          <li>按需安装，数据保存在浏览器本地</li>
        </ol>
      </header>

      <section className="clip-hub-panel">
        {!ready ? (
          <p className="clip-hub-soon">安装包整理中，敬请期待。</p>
        ) : (
          <div className="clip-hub-ext-grid clip-hub-ext-grid--simple">
            {EXTENSION_CATALOG.map((ext) => (
              <article
                key={ext.id}
                className="clip-hub-ext-card clip-hub-ext-card--simple"
                style={{ "--ext-accent": ext.accent } as CSSProperties}
              >
                <Link to={`/tools/extensions/${ext.id}`} className="clip-hub-ext-card-link">
                  <div className="clip-hub-ext-head">
                    <span className="clip-hub-ext-icon" aria-hidden>
                      {ext.icon}
                    </span>
                    <div>
                      <h3>{ext.name}</h3>
                      <p className="clip-hub-ext-tagline">{ext.tagline}</p>
                    </div>
                    <span className="clip-hub-ext-go" aria-hidden>
                      →
                    </span>
                  </div>
                  <p className="clip-hub-ext-desc">{ext.desc}</p>
                  <span className="clip-hub-ext-cta">查看演示</span>
                </Link>
                <div className="clip-hub-ext-foot clip-hub-ext-foot--simple">
                  <a
                    href={extensionDownloadUrl(ext)}
                    className="clip-hub-ext-dl"
                    download
                    rel="noopener noreferrer"
                  >
                    下载 v{ext.version}
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="clip-hub-back">
        <Link to="/">← 返回首页</Link>
      </p>

      <SiteFooter />
    </SiteShell>
  );
}
