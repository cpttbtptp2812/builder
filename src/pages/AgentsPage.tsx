import { useNavigate } from "react-router-dom";
import { AGENTS } from "../data/demo";
import { useStore } from "../store";

export function AgentsPage() {
  const openChat = useStore((s) => s.openChat);
  const nav = useNavigate();

  return (
    <div className="page">
      <header>
        <h1>智能体</h1>
        <p>对应 agent 项目 /agents：选择 Agent 并进入专属对话</p>
      </header>
      <div className="cards">
        {AGENTS.map((a) => (
          <article key={a.id} className="tile">
            <h2>{a.name}</h2>
            <p>{a.desc}</p>
            <div className="tags">
              {a.tags.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>
            <button
              type="button"
              className="cta sm"
              onClick={() => {
                openChat(a.id);
                nav("/demo/chat");
              }}
            >
              开始对话
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
