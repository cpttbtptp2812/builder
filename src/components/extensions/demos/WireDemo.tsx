import { useEffect, useState } from "react";

const FRAMES = [
  { type: "open" as const, label: "OPEN", data: "/api/chat/stream" },
  { type: "message" as const, label: "MESSAGE", data: '{"role":"assistant","content":"你"}' },
  { type: "message" as const, label: "MESSAGE", data: '{"role":"assistant","content":"好"}' },
  { type: "message" as const, label: "MESSAGE", data: '{"role":"assistant","content":"！"}' },
  { type: "error" as const, label: "ERROR", data: "connection closed" },
];

/** Wire — SSE / EventSource 帧级调试 */
export function WireDemo() {
  const [visible, setVisible] = useState(0);
  const [streaming, setStreaming] = useState("");

  useEffect(() => {
    const run = () => {
      setVisible(0);
      setStreaming("");
      const timers: number[] = [];
      FRAMES.forEach((frame, i) => {
        timers.push(
          window.setTimeout(() => {
            setVisible(i + 1);
            if (frame.type === "message") {
              try {
                const parsed = JSON.parse(frame.data) as { content?: string };
                setStreaming((s) => s + (parsed.content ?? ""));
              } catch {
                /* ignore */
              }
            }
          }, 500 + i * 700),
        );
      });
      return () => timers.forEach(clearTimeout);
    };
    const cleanup = run();
    const loop = window.setInterval(run, 5200);
    return () => {
      cleanup();
      clearInterval(loop);
    };
  }, []);

  return (
    <div className="ext-demo ext-demo--wire">
      <div className="ext-demo-browser">
        <div className="ext-demo-chrome">
          <span />
          <span />
          <span />
          <em>app.example.com/chat</em>
        </div>
        <div className="ext-demo-page ext-demo-page--chat">
          <div className="ext-demo-chat-user">解释一下 SSE</div>
          <div className="ext-demo-chat-ai">
            {streaming || (visible > 0 ? "…" : "等待流式响应")}
            {visible > 0 && visible < FRAMES.length && <span className="ext-demo-cursor">|</span>}
          </div>
          <code className="ext-demo-es-code">new EventSource(&apos;/api/chat/stream&apos;)</code>
        </div>
      </div>
      <aside className="ext-demo-panel ext-demo-panel--wire">
        <div className="ext-demo-panel-head">
          <strong>Wire</strong>
          <span>{visible} 事件</span>
        </div>
        <ul className="ext-demo-wire-list">
          {FRAMES.slice(0, visible).map((f, i) => (
            <li key={`${f.label}-${i}`} className={`ext-demo-wire-${f.type}`}>
              <span>{f.label}</span>
              <code>{f.data}</code>
            </li>
          ))}
          {visible === 0 && <li className="empty">监听 EventSource…</li>}
        </ul>
      </aside>
    </div>
  );
}
