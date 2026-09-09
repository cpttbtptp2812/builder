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
  skilltap: [
    "打开要教的页面，或打开出 bug 的页面；写标题。若是给开发看，填上「出了什么问题」",
    "开始录制，按平时那样点击、填写、跳转；登录、验证码、选文件点「请你自己做」",
    "停下来预览：同事路线导出 HTML，用浏览器打开即可阅读，也可点「演示一遍」",
    "开发路线导出复现包。对方打开 HTML 的「给开发看」，或把 repro.json 导入步骤记录器，即可看分析并打开入口页，不必先起本地项目",
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
      {ext.story?.map((p) => (
        <p key={p.slice(0, 24)} className="ext-detail-desc ext-detail-desc--more">
          {p}
        </p>
      ))}
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
        {ext.id === "skilltap" && (
          <p className="ext-detail-extra">
            同事只发 HTML 即可。开发可打开同一份 HTML 里的「给开发看」，或导入 zip 中的 repro.json。微信打不开时，把文件拷到电脑再用 Chrome / Edge 打开。
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
