import { useEffect, useState } from "react";

const ARTICLE =
  "React 19 发布后，并发渲染与 Server Components 成为默认讨论点。团队在做首屏优化时，通常从代码分割、懒加载和缓存策略入手。";
const CLIP = "并发渲染与 Server Components 成为默认讨论点";

type Phase = "idle" | "select" | "saved" | "jump";

/** ClipHub — 选中 → 保存 → 跳回高亮 */
export function ClipHubDemo() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const run = () => {
      setPhase("idle");
      setMenu(false);
      const t1 = window.setTimeout(() => setPhase("select"), 600);
      const t2 = window.setTimeout(() => setMenu(true), 1400);
      const t3 = window.setTimeout(() => {
        setMenu(false);
        setPhase("saved");
      }, 2200);
      const t4 = window.setTimeout(() => setPhase("jump"), 3200);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    };
    const cleanup = run();
    const loop = window.setInterval(run, 5200);
    return () => {
      cleanup();
      clearInterval(loop);
    };
  }, []);

  const parts = ARTICLE.split(CLIP);

  return (
    <div className="ext-demo ext-demo--clip">
      <div className="ext-demo-browser">
        <div className="ext-demo-chrome">
          <span />
          <span />
          <span />
          <em>blog.example.com/article</em>
        </div>
        <div className={`ext-demo-page${phase === "jump" ? " scrolled" : ""}`}>
          <h4>React 19 前端笔记</h4>
          <p>
            {parts[0]}
            <mark
              className={`ext-demo-mark${phase === "select" || phase === "saved" || phase === "jump" ? " on" : ""}${phase === "jump" ? " pulse" : ""}`}
            >
              {CLIP}
            </mark>
            {parts[1]}
          </p>
          {menu && (
            <div className="ext-demo-context" role="presentation">
              保存到 ClipHub
            </div>
          )}
        </div>
      </div>
      <aside className="ext-demo-panel">
        <div className="ext-demo-panel-head">
          <strong>ClipHub</strong>
          <span>{phase === "saved" || phase === "jump" ? "1 条" : "0 条"}</span>
        </div>
        <ul className="ext-demo-list">
          {phase === "saved" || phase === "jump" ? (
            <li className={phase === "jump" ? "active" : ""}>
              <strong>{CLIP.slice(0, 18)}…</strong>
              <span>blog.example.com</span>
            </li>
          ) : (
            <li className="empty">选中文字后右键保存</li>
          )}
        </ul>
        <p className="ext-demo-caption">
          {phase === "idle" && "等待选中…"}
          {phase === "select" && "拖选文字"}
          {phase === "saved" && "已保存到列表"}
          {phase === "jump" && "点击条目 → 打开页面并高亮"}
        </p>
      </aside>
    </div>
  );
}
