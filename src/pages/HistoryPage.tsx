import { useNavigate } from "react-router-dom";
import { useStore } from "../store";

export function HistoryPage() {
  const sessions = useStore((s) => s.sessions);
  const setActive = useStore((s) => s.setActive);
  const remove = useStore((s) => s.remove);
  const nav = useNavigate();

  const list = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="page">
      <header>
        <h1>历史</h1>
        <p>对应 agent /history：本地会话列表（演示数据存浏览器）</p>
      </header>
      {list.length === 0 ? (
        <p className="empty">暂无会话，去「对话」发一条消息吧。</p>
      ) : (
        <ul className="hist">
          {list.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="hist-row"
                onClick={() => {
                  setActive(s.id);
                  nav("/demo/chat");
                }}
              >
                <strong>{s.title}</strong>
                <span>{s.agentName}</span>
              </button>
              <button type="button" className="del" onClick={() => remove(s.id)}>
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
