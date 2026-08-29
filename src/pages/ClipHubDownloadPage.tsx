import { Link } from "react-router-dom";
import { getClipHubDownloadUrls, clipHubRelease } from "../data/clipHubRelease";
import { SiteShell } from "../components/SiteShell";
import { SiteFooter } from "../components/SiteFooter";

export function ClipHubDownloadPage() {
  const { name, version, tagline, ready } = clipHubRelease;
  const { extensionUrl } = getClipHubDownloadUrls();

  return (
    <SiteShell pageClass="site-clip-hub">
      <header className="clip-hub-page-head">
        <p className="site-home-eyebrow">Browser Extension</p>
        <h1>{name}</h1>
        <p className="site-tagline">{tagline}</p>
        <p className="clip-hub-version">v{version} · 数据仅存浏览器本地 · 无需账号</p>
      </header>

      <section className="clip-hub-panel">
        <h2>这是什么？</h2>
        <p>
          {name} 是一款 Chrome / Edge 浏览器插件。在任意网页选中文字即可保存位置，
          下次点击列表条目<strong>跳回原页面、原位置</strong>并高亮。片段存在浏览器本地，不上传云端。
        </p>
      </section>

      <section className="clip-hub-panel">
        <h2>下载</h2>
        {!ready ? (
          <p className="clip-hub-soon">安装包整理中，敬请期待。</p>
        ) : (
          <div className="clip-hub-downloads">
            <a href={extensionUrl} className="clip-hub-dl-btn primary" download rel="noopener noreferrer">
              浏览器插件
              <span>ClipHub-Extension-v{version}.zip</span>
            </a>
          </div>
        )}
      </section>

      <section className="clip-hub-panel clip-hub-panel-highlight">
        <h2>怎么用？</h2>
        <div className="clip-hub-flow">
          <div className="clip-hub-flow-col">
            <h3>① 保存</h3>
            <ul>
              <li>网页选中文字 → 右键 →「保存到 ClipHub（含页面位置）」</li>
              <li>点工具栏 ClipHub 图标，列表里立刻出现条目</li>
            </ul>
          </div>
          <div className="clip-hub-flow-col">
            <h3>② 跳回</h3>
            <ul>
              <li>点 ClipHub 图标 → <strong>点击列表条目</strong></li>
              <li>自动打开页面，按<strong>文字匹配</strong>定位（坐标辅助消歧）并高亮</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="clip-hub-panel">
        <h2>安装步骤</h2>
        <ol className="clip-hub-steps">
          <li>下载上方插件 zip 并解压。</li>
          <li>
            Chrome / Edge → 扩展程序 → 开启「开发者模式」→「加载已解压的扩展程序」→ 选解压后的文件夹。
          </li>
          <li>选中网页文字 → 右键「保存到 ClipHub」→ 点插件图标查看列表 → 点击条目跳回。</li>
        </ol>
      </section>

      <section className="clip-hub-panel clip-hub-panel-muted">
        <h2>隐私说明</h2>
        <p>
          片段数据保存在浏览器本地存储（chrome.storage），不会上传到任何服务器。
          本页面<strong>仅提供插件安装包下载</strong>，不包含源代码。
        </p>
      </section>

      <p className="clip-hub-back">
        <Link to="/">← 返回作品集</Link>
      </p>

      <SiteFooter />
    </SiteShell>
  );
}
