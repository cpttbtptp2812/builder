import { useEffect, useRef, useState } from "react";
import { ReplayPanel } from "../components/ReplayPanel";
import { ScenarioBar } from "../components/ScenarioBar";
import { Timeline } from "../components/Timeline";
import { streamReply } from "../engine";
import { useStore } from "../store";

export function ChatPage() {
  const activeId = useStore((s) => s.activeId);
  const sessions = useStore((s) => s.sessions);
  const initShowcase = useStore((s) => s.initShowcase);
  const consumePendingChat = useStore((s) => s.consumePendingChat);
  const [text, setText] = useState("");
  const [think, setThink] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  const pendingHandled = useRef(false);

  useEffect(() => {
    if (!activeId) initShowcase();
  }, [activeId, initShowcase]);

  const session = activeId ? sessions[activeId] : null;

  useEffect(() => {
    if (!activeId || pendingHandled.current) return;
    const { prompt } = consumePendingChat();
    if (prompt) {
      pendingHandled.current = true;
      streamReply(activeId, prompt, { think: true });
    }
  }, [activeId, consumePendingChat, think]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  function send() {
    const t = text.trim();
    if (!t || !activeId) return;
    setText("");
    streamReply(activeId, t, { think });
  }

  if (!session) return null;

  return (
    <div className="showcase-main">
      <div className="page chat">
        <header className="chat-head">
          <div>
            <h1>{session.agentName}</h1>
            <div className="tech-tags">
              <span>AI SDK 流式</span>
              <span>GraphQL SSE</span>
              <span>工作流匹配</span>
              <span>DOM 回放</span>
            </div>
          </div>
          <div className="flags">
            <label className={think ? "on" : ""}>
              <input type="checkbox" checked={think} onChange={(e) => setThink(e.target.checked)} />
              深度思考
            </label>
          </div>
        </header>

        <ScenarioBar sessionId={session.id} think={think} />

        <div className="scroll">
          <Timeline messages={session.messages} sessionId={session.id} />
          <div ref={end} />
        </div>

        <footer>
          <textarea
            rows={2}
            value={text}
            placeholder="聊项目经历、技术架构、难点成果… 或点下方按钮"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <button type="button" className="cta sm" onClick={send}>
            发送
          </button>
        </footer>
      </div>
      <ReplayPanel />
    </div>
  );
}
