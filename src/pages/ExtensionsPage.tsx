import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  DEBUG_TOOLKIT_TOOLS,
  FRONTEND_DEBUG_TOOLKIT,
  STANDALONE_EXTENSIONS,
  extensionDownloadUrl,
  toolkitDownloadUrl,
} from "../data/clipHubExtensions";
import { extensionHub } from "../data/clipHubRelease";
import { STREAM_PROBE, streamProbeDownloadUrl } from "../data/streamProbe";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";

export function ExtensionsPage() {
  const toolkit = FRONTEND_DEBUG_TOOLKIT;
  const { ready } = extensionHub;

  return (
    <SiteShell pageClass="site-clip-hub">
      <header className="clip-hub-page-head clip-hub-page-head--toolkit">
        <p className="site-home-eyebrow">Chrome Extensions</p>
        <h1>
          <span className="clip-hub-toolkit-icon" aria-hidden>
            {toolkit.icon}
          </span>
          {toolkit.name}
        </h1>
        <p className="site-tagline">{toolkit.tagline}</p>
        <p className="clip-hub-toolkit-desc">{toolkit.desc}</p>
        <p className="clip-hub-toolkit-warn" role="note">
          安装前必须先解压 zip。不要直接选 zip 加载，Chrome 会报
          <code>Could not unzip extension for install</code>。
        </p>
        {ready ? (
          <a
            href={toolkitDownloadUrl()}
            className="clip-hub-toolkit-dl"
            download
            rel="noopener noreferrer"
          >
            下载工具包 v{toolkit.version}
          </a>
        ) : null}
        <ol className="clip-hub-steps clip-hub-steps--inline">
          {toolkit.installSteps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </header>

      <section className="clip-hub-panel clip-hub-panel-streamprobe">
        <h2 className="clip-hub-section-title">
          {STREAM_PROBE.icon} {STREAM_PROBE.name}
          <span className="clip-hub-sp-badge">个人项目</span>
        </h2>
        <p className="clip-hub-section-hint">{STREAM_PROBE.desc}</p>
        <ul className="clip-hub-toolkit-features">
          {STREAM_PROBE.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        {ready ? (
          <div className="clip-hub-sp-actions">
            <a
              href={streamProbeDownloadUrl()}
              className="clip-hub-toolkit-dl"
              download
              rel="noopener noreferrer"
            >
              下载 StreamProbe v{STREAM_PROBE.version}
            </a>
            <Link to="/work/streamprobe" className="clip-hub-sp-demo">
              产品介绍 →
            </Link>
          </div>
        ) : null}
      </section>

      <section className="clip-hub-panel">
        {!ready ? (
          <p className="clip-hub-soon">安装包整理中，敬请期待。</p>
        ) : (
          <>
            <h2 className="clip-hub-section-title">包里的三个扩展</h2>
            <p className="clip-hub-section-hint">点卡片看演示；安装时解压 zip，三个文件夹各加载一次。</p>
            <div className="clip-hub-ext-grid clip-hub-ext-grid--simple">
              {DEBUG_TOOLKIT_TOOLS.map((ext) => (
                <article
                  key={ext.id}
                  className="clip-hub-ext-card clip-hub-ext-card--simple clip-hub-ext-card--tool"
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
                </article>
              ))}
            </div>

            <ul className="clip-hub-toolkit-features">
              {toolkit.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      {STANDALONE_EXTENSIONS.length > 0 && (
        <section className="clip-hub-panel clip-hub-panel-muted">
          <h2 className="clip-hub-section-title">其他扩展</h2>
          <p className="clip-hub-section-hint">和联调工具包分开安装，按需下载。</p>
          <div className="clip-hub-ext-grid clip-hub-ext-grid--simple">
            {STANDALONE_EXTENSIONS.map((ext) => (
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
                    单独下载 v{ext.version}
                  </a>
                </div>
              </article>
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
