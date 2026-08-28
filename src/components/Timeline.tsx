import type { ChatMsg } from "../data/demo";
import { runProcess, streamReply } from "../engine";
import { useStore } from "../store";

function WaveText({ text }: { text: string }) {
  return (
    <span className="wave-text">
      {text.split("").map((ch, i) => (
        <span key={i} style={{ animationDelay: `${i * 0.04}s` }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

export function Timeline({
  messages,
  sessionId,
}: {
  messages: ChatMsg[];
  sessionId: string;
}) {
  const patch = useStore((s) => s.patch);

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
          case "searching":
            return (
              <div key={m.id} className="card searching">
                <span className="spinner" />
                {m.text}
              </div>
            );
          case "reasoning":
            return (
              <details key={m.id} className="card reasoning" open={!m.collapsed}>
                <summary>
                  {m.streaming ? (
                    <>
                      <span className="shimmer">思考中…</span>
                    </>
                  ) : (
                    "思考过程"
                  )}
                </summary>
                <pre>{m.text}{m.streaming && <span className="caret">▍</span>}</pre>
              </details>
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
              <div key={m.id} className={`card tool ${m.status}`}>
                <div className="card-h">
                  <span className={`tool-dot ${m.status}`} />
                  {m.status === "loading" ? (
                    <WaveText text={`调用 ${m.name}…`} />
                  ) : (
                    <>🔧 {m.name}</>
                  )}
                </div>
                {m.status === "done" && <pre>{m.output}</pre>}
              </div>
            );
          case "workflows":
            return (
              <div key={m.id} className="card wf-picks">
                <div className="card-h">✦ 匹配的工作流</div>
                {m.items.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="pick"
                    onClick={() => runProcess(sessionId, w.title)}
                  >
                    <div>
                      <strong>{w.title}</strong>
                      {w.channel && <small>{w.channel}</small>}
                    </div>
                    <em>{Math.round(w.score * 100)}%</em>
                  </button>
                ))}
              </div>
            );
          case "process": {
            const pct = Math.round(((m.step + 1) / m.total) * 100);
            return (
              <div
                key={m.id}
                className={`card process ${m.status === "running" || m.status === "planning" ? "animated-border" : ""}`}
              >
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
                  <button
                    type="button"
                    className={m.voted === "up" ? "voted" : ""}
                    onClick={() => patch(sessionId, m.id, { voted: "up" })}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    className={m.voted === "down" ? "voted" : ""}
                    onClick={() => patch(sessionId, m.id, { voted: "down" })}
                  >
                    👎
                  </button>
                </div>
              </div>
            );
          case "topics":
            return (
              <div key={m.id} className="card topics">
                <div className="card-h">{m.title}</div>
                <div className="topic-row">
                  {m.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="topic-btn"
                      onClick={() => streamReply(sessionId, item, { think: true })}
                    >
                      {item}
                    </button>
                  ))}
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
