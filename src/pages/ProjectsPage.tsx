import { useNavigate } from "react-router-dom";
import { PROJECT_DETAILS } from "../data/knowledge";
import { streamReply } from "../engine";
import { useStore } from "../store";

export function ProjectsPage() {
  const activeId = useStore((s) => s.activeId);
  const openChat = useStore((s) => s.openChat);
  const nav = useNavigate();

  function ask(prompt: string) {
    const sid = activeId ?? openChat("master");
    nav("/demo/chat");
    window.setTimeout(() => streamReply(sid, prompt, { think: true }), 300);
  }

  return (
    <div className="page projects-page">
      <header>
        <h1>项目经历</h1>
        <p>全部 {PROJECT_DETAILS.length} 个项目 · 点击「深入聊聊」可跳转到对话继续展开</p>
      </header>

      <div className="project-list">
        {PROJECT_DETAILS.map((p) => (
          <article key={p.id} className="project-detail-card">
            <header>
              <div>
                <h2>{p.name}</h2>
                <p className="project-meta">{p.role} · {p.period}</p>
                {p.repo && <p className="repo-tag">{p.repo}</p>}
              </div>
              {p.demo && <span className="badge">可在线演示</span>}
            </header>

            <p className="project-desc">{p.desc}</p>

            <section>
              <h3>架构</h3>
              <p>{p.architecture}</p>
            </section>

            <section>
              <h3>核心成果</h3>
              <ul>
                {p.achievements.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3>技术难点</h3>
              <ul>
                {p.challenges.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </section>

            <div className="stack">
              {p.stack.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>

            <div className="topic-row">
              {p.interviewTopics.map((t) => (
                <button
                  key={t}
                  type="button"
                  className="topic-btn"
                  onClick={() => ask(`${p.name}：${t}`)}
                >
                  {t}
                </button>
              ))}
            </div>

            <footer className="project-actions">
              <button type="button" className="cta sm" onClick={() => ask(`详细介绍${p.name}`)}>
                深入聊聊
              </button>
              {p.demo && (
                <button
                  type="button"
                  className="ghost-btn sm"
                  onClick={() => {
                    nav("/demo/chat");
                  }}
                >
                  看交互演示 →
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
