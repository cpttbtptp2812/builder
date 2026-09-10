import { Link } from "react-router-dom";
import { ExtensionCatalogCard } from "../components/extensions/ExtensionCatalogCard";
import {
  DEBUG_TOOLKIT_TOOLS,
  FRONTEND_DEBUG_TOOLKIT,
  STANDALONE_EXTENSIONS,
  toolkitDownloadUrl,
} from "../data/clipHubExtensions";
import { extensionHub } from "../data/clipHubRelease";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";

export function ExtensionsPage() {
  const toolkit = FRONTEND_DEBUG_TOOLKIT;
  const { ready } = extensionHub;

  return (
    <SiteShell pageClass="site-clip-hub">
      <header className="clip-hub-page-head">
        <p className="site-home-eyebrow">Chrome Extensions</p>
        <h1>浏览器扩展</h1>
        <p className="site-tagline">解压 zip 后加载，数据在本地，不联网也能用。</p>
      </header>

      <section className="clip-hub-panel">
        <div className="clip-hub-bundle-head">
          <div className="clip-hub-bundle-title">
            <span className="clip-hub-toolkit-icon" aria-hidden>
              {toolkit.icon}
            </span>
            <div>
              <h2 className="clip-hub-section-title">{toolkit.name}</h2>
              <p className="clip-hub-bundle-tagline">{toolkit.tagline}</p>
            </div>
          </div>
          {ready ? (
            <a
              href={toolkitDownloadUrl()}
              className="clip-hub-toolkit-dl"
              download
              rel="noopener noreferrer"
            >
              下载 v{toolkit.version}
            </a>
          ) : (
            <p className="clip-hub-soon">安装包整理中</p>
          )}
        </div>

        <p className="clip-hub-toolkit-warn" role="note">
          安装前必须先解压 zip，不要直接选 zip 加载。
        </p>

        {ready ? (
          <>
            <div className="clip-hub-ext-grid clip-hub-ext-grid--simple">
              {DEBUG_TOOLKIT_TOOLS.map((ext) => (
                <ExtensionCatalogCard key={ext.id} ext={ext} />
              ))}
            </div>
            <ol className="clip-hub-steps clip-hub-steps--inline">
              {toolkit.installSteps.slice(0, 3).map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </>
        ) : null}
      </section>

      {STANDALONE_EXTENSIONS.length > 0 && (
        <section className="clip-hub-panel clip-hub-panel-muted">
          <div className="clip-hub-ext-section-head">
            <h2 className="clip-hub-section-title">独立扩展</h2>
            <span>单独安装，与工具包无关</span>
          </div>
          <div className="clip-hub-ext-grid clip-hub-ext-grid--simple">
            {STANDALONE_EXTENSIONS.map((ext) => (
              <ExtensionCatalogCard key={ext.id} ext={ext} showDownload />
            ))}
          </div>
        </section>
      )}

      <p className="clip-hub-back">
        <Link to="/">← 返回首页</Link>
      </p>

      <SiteFooter />
    </SiteShell>
  );
}
