import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

import {

  EXTENSION_CATALOG,

  extensionDownloadUrl,

  extensionStatusLabel,

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

        <p className="clip-hub-version">

          {EXTENSION_CATALOG.length} 款扩展 · 无需账号 · 本地运行

        </p>

      </header>



      <section className="clip-hub-panel">

        <div className="clip-hub-ext-section-head">

          <h2>扩展目录</h2>

          <span>Chrome / Edge · MV3 · 开发者模式加载</span>

        </div>

        {!ready ? (

          <p className="clip-hub-soon">安装包整理中，敬请期待。</p>

        ) : (

          <div className="clip-hub-ext-grid">

            {EXTENSION_CATALOG.map((ext) => (

              <article

                key={ext.id}

                className="clip-hub-ext-card"

                style={{ "--ext-accent": ext.accent } as CSSProperties}

              >

                <div className="clip-hub-ext-head">

                  <span className="clip-hub-ext-icon" aria-hidden>

                    {ext.icon}

                  </span>

                  <div>

                    <h3>{ext.name}</h3>

                    <p className="clip-hub-ext-tagline">{ext.tagline}</p>

                  </div>

                  <span className="clip-hub-ext-badge clip-hub-ext-badge--shipped">

                    {extensionStatusLabel()} v{ext.version}

                  </span>

                </div>

                <p className="clip-hub-ext-desc">{ext.desc}</p>

                <ul className="clip-hub-ext-features">

                  {ext.features.map((f) => (

                    <li key={f}>{f}</li>

                  ))}

                </ul>

                <p className="clip-hub-ext-use">

                  <strong>适用：</strong>

                  {ext.useCases.join(" · ")}

                </p>

                <div className="clip-hub-ext-foot">

                  <span className="clip-hub-ext-stack">

                    {ext.stack.map((s) => (

                      <em key={s}>{s}</em>

                    ))}

                  </span>

                  <a

                    href={extensionDownloadUrl(ext)}

                    className="clip-hub-ext-dl"

                    download

                    rel="noopener noreferrer"

                  >

                    下载 zip

                  </a>

                </div>

              </article>

            ))}

          </div>

        )}

      </section>



      <section className="clip-hub-panel clip-hub-panel-highlight">
        <h2>片段库</h2>
        <p>
          安装 ClipHub 并配置同步 token 后，可在网页查看、搜索、导出 Markdown。
          需运行 <code>npm run dev:clip</code> 或 <code>dev:full</code>。
        </p>
        <Link to="/tools/clips" className="clip-hub-dl-btn primary">
          打开片段库
          <span>标签 · 分组 · 导出</span>
        </Link>
      </section>



      <section className="clip-hub-panel clip-hub-panel-highlight">

        <h2>安装步骤</h2>

        <ol className="clip-hub-steps">

          <li>下载需要的扩展 zip 并解压到本地文件夹。</li>

          <li>

            Chrome / Edge → 扩展程序 → 开启「开发者模式」→「加载已解压的扩展程序」→ 选解压后的文件夹。

          </li>

          <li>每个扩展独立安装，可只装你需要的几款。</li>

        </ol>

      </section>



      <section className="clip-hub-panel clip-hub-panel-muted">

        <h2>隐私说明</h2>

        <p>

          所有扩展数据保存在浏览器本地（chrome.storage / sessionStorage），不会上传到任何服务器。

          Env / Wire 仅在当前标签页注入调试逻辑，不收集浏览历史。

        </p>

      </section>



      <p className="clip-hub-back">

        <Link to="/">← 返回作品集</Link>

      </p>



      <SiteFooter />

    </SiteShell>

  );

}


