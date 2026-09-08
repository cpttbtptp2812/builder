import type { CSSProperties } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { EXTENSION_DEMOS } from "../components/extensions";
import { SiteFooter } from "../components/SiteFooter";
import { SiteShell } from "../components/SiteShell";
import {
  extensionDownloadUrl,
  getExtension,
  type ExtensionItem,
} from "../data/clipHubExtensions";

const STEPS: Record<string, string[]> = {
  "clip-hub": [
    "在任意网页选中一段文字，右键「保存到 ClipHub」",
    "扩展记住页面 URL、滚动位置与文字片段",
    "从 popup 列表点击，自动打开页面并高亮匹配文字",
    "配置 token 后可同步到网页片段库",
  ],
  env: [
    "打开 popup，为当前 hostname 新建环境配置",
    "填写 API Base、Bearer Token、自定义 Header",
    "刷新页面 — 该域下的 fetch 自动重写 URL 并注入鉴权",
    "切换环境只需换 profile，不用改项目代码",
  ],
  wire: [
    "安装后刷新要调试的页面",
    "页面里的 EventSource 会被劫持并上报事件",
    "popup 实时列出 OPEN / MESSAGE / ERROR 帧",
    "调试 AI 流式输出、排查 SSE 断连时比 Network 更直观",
  ],
};

function ExtensionHeader({ ext }: { ext: ExtensionItem }) {
  return (
    <header className="ext-detail-head">
      <Link to="/tools/extensions" className="ext-detail-back">
        ← 全部扩展
      </Link>
      <div className="ext-detail-title" style={{ "--ext-accent": ext.accent } as CSSProperties}>
        <span className="ext-detail-icon" aria-hidden>
          {ext.icon}
        </span>
        <div>
          <h1>{ext.name}</h1>
          <p>{ext.tagline}</p>
        </div>
        <a
          href={extensionDownloadUrl(ext)}
          className="ext-detail-dl"
          download
          rel="noopener noreferrer"
        >
          下载 v{ext.version}
        </a>
      </div>
      <p className="ext-detail-desc">{ext.desc}</p>
    </header>
  );
}

export function ExtensionDetailPage() {
  const { extId } = useParams();
  const ext = extId ? getExtension(extId) : undefined;
  if (!ext) return <Navigate to="/tools/extensions" replace />;

  const Demo = EXTENSION_DEMOS[ext.id];
  const steps = STEPS[ext.id] ?? [];

  return (
    <SiteShell pageClass="site-ext-detail">
      <ExtensionHeader ext={ext} />

      <section className="ext-detail-demo-panel">
        <h2>怎么用</h2>
        <p className="ext-detail-demo-hint">自动演示 · 循环播放</p>
        {Demo ? <Demo /> : null}
      </section>

      <section className="ext-detail-steps clip-hub-panel">
        <h2>步骤</h2>
        <ol className="clip-hub-steps">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        {ext.id === "clip-hub" && (
          <p className="ext-detail-extra">
            <Link to="/tools/clips">打开网页片段库 →</Link>
          </p>
        )}
      </section>

      <section className="ext-detail-install clip-hub-panel clip-hub-panel-muted">
        <h2>安装</h2>
        <ol className="clip-hub-steps">
          <li>下载 zip 并解压到本地文件夹</li>
          <li>Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序</li>
          <li>刷新目标网页后开始使用</li>
        </ol>
      </section>

      <SiteFooter />
    </SiteShell>
  );
}
