import { useEffect, useState } from "react";

const PAGES = [
  { kicker: "操作手册", title: "提交按钮没反应", caption: "第 1 步 · 打开网页", side: "给同事" },
  { kicker: "操作手册", title: "提交按钮没反应", caption: "第 2 步 · 点击提交", side: "演示一遍" },
  { kicker: "给开发看", title: "提交按钮没反应", caption: "[高] 接口返回 400", side: "复现包" },
];

/** 步骤记录器 — 手册给同事，复现包给开发 */
export function SkillTapDemo() {
  const [page, setPage] = useState(0);

  useEffect(() => {
    const loop = window.setInterval(() => {
      setPage((p) => (p + 1) % PAGES.length);
    }, 2000);
    return () => clearInterval(loop);
  }, []);

  const cur = PAGES[page]!;
  const isDev = page === 2;

  return (
    <div className="ext-demo ext-demo--skilltap">
      <div className="ext-demo-browser">
        <div className="ext-demo-chrome">
          <span />
          <span />
          <span />
          <em>{isDev ? "给开发.md · repro.json" : "提交按钮没反应.html"}</em>
        </div>
        <div className={`ext-demo-page ext-demo-page--manual${isDev ? " is-dev" : ""}`}>
          <p className="ext-demo-kicker">{cur.kicker}</p>
          <h4>{cur.title}</h4>
          <p className="ext-demo-manual-step">{cur.caption}</p>
          <div className="ext-demo-manual-shot">
            {page === 0 && <span>打开 HR 请假页</span>}
            {page === 1 && <span className="on">提交</span>}
            {page === 2 && <span>POST /leave 400 · 选择器不稳定</span>}
            {page === 1 ? <i className="ext-demo-pin" /> : null}
          </div>
        </div>
      </div>
      <aside className="ext-demo-panel ext-demo-panel--tap">
        <div className="ext-demo-panel-head">
          <strong>步骤记录器</strong>
          <span>{cur.side}</span>
        </div>
        <ul className="ext-demo-tap-list">
          <li className={page === 0 ? "keep" : ""}>1. 打开网页</li>
          <li className={page === 1 ? "keep" : ""}>2. 点击提交</li>
          <li className={page === 2 ? "keep tap-pause" : ""}>3. 分析：接口 400</li>
        </ul>
        <p className="ext-demo-tap-zip">
          {isDev ? "开发导入 repro.json · 不必先起本地项目" : "同事打开 HTML 就能看、能演示"}
        </p>
      </aside>
    </div>
  );
}
