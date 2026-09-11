import { Link } from "react-router-dom";
import { STREAM_PROBE, streamProbeDownloadUrl } from "../../data/streamProbe";

/** StreamProbe — 30 秒能懂的项目说明 */
export function StreamProbeHero() {
  return (
    <header className="sp-hero">
      <p className="sp-hero-eyebrow">个人 Chrome 扩展 · {STREAM_PROBE.version}</p>
      <h1>{STREAM_PROBE.name} 是什么？</h1>

      <div className="sp-hero-what">
        <p>
          一个给<strong>前端开发者</strong>用的 Chrome 扩展：调试 <strong>AI 聊天 / 流式接口</strong>{" "}
          时，把 Network 里看不清的 SSE 数据<strong>一帧一帧展开</strong>。
        </p>
        <p className="sp-hero-not">
          不是聊天机器人，不是 demo 里蹦几句话 — 是<strong>联调工具</strong>，装在你真实项目页面上用。
        </p>
      </div>

      <div className="sp-hero-when">
        <strong>什么时候需要它？</strong>
        <ul>
          <li>用户说 AI 回复慢 — 你要查首字多久出来（TTFB）</li>
          <li>对话中途卡住 — 你要查流有没有断、哪一帧报错</li>
          <li>tool-call 字段不对 — 你要对照原始 SSE 和 AI SDK 解析</li>
        </ul>
      </div>

      <div className="sp-hero-actions">
        <a className="sp-hero-dl" href={streamProbeDownloadUrl()} download>
          下载扩展（真实用法）
        </a>
        <Link className="sp-hero-link" to="/tools/extensions/streamprobe">
          安装说明
        </Link>
      </div>
    </header>
  );
}
