import type { ChatMsg } from "../data/demo";
import { runProcess } from "../engine";

export function Timeline({
  messages,
  sessionId,
}: {
  messages: ChatMsg[];
  sessionId: string;
}) {
  return (
    <div className="timeline">
      {messages.map((m) => {
        switch (m.kind) {
          case "user":
            return (
              <div key={m.id} className="bubble user">
                {m.text}
              </div>
            );
          case "assistant":
            return (
              <div key={m.id} className="bubble bot">
                {m.text}
                {m.streaming && <span className="caret">▍</span>}
              </div>
            );
          case "tool":
            return (
              <div key={m.id} className="card tool">
                <div className="card-h">🔧 {m.name}</div>
                <pre>{m.output}</pre>
              </div>
            );
          case "workflows":
            return (
              <div key={m.id} className="card">
                <div className="card-h">匹配的工作流</div>
                {m.items.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="pick"
                    onClick={() => runProcess(sessionId, w.title)}
                  >
                    <span>{w.title}</span>
                    <em>{Math.round(w.score * 100)}%</em>
                  </button>
                ))}
              </div>
            );
          case "process": {
            const pct = Math.round(((m.step + 1) / m.total) * 100);
            return (
              <div key={m.id} className="card process">
                <div className="card-h">⚙ {m.title}</div>
                <div className="meta">
                  <span className={`tag ${m.status}`}>{m.status}</span>
                  {m.step + 1}/{m.total} · {m.label}
                </div>
                <div className="progress">
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          }
          case "rating":
            return (
              <div key={m.id} className="card rate">
                流程已结束，这次体验如何？
                <div className="rate-btns">
                  <button type="button">👍</button>
                  <button type="button">👎</button>
                </div>
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
