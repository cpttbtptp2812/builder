import { useEffect, useRef, useState } from "react";
import { Timeline } from "../components/Timeline";
import { streamReply } from "../engine";
import { useStore } from "../store";

export function ChatPage() {
  const activeId = useStore((s) => s.activeId);
  const sessions = useStore((s) => s.sessions);
  const openChat = useStore((s) => s.openChat);
  const [text, setText] = useState("");
  const [web, setWeb] = useState(false);
  const [think, setThink] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeId) openChat("master");
  }, [activeId, openChat]);

  const session = activeId ? sessions[activeId] : null;

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length]);

  function send() {
    const t = text.trim();
    if (!t || !activeId) return;
    setText("");
    streamReply(activeId, t);
  }

  if (!session) return null;

  return (
    <div className="page chat">
      <header>
        <div>
          <h1>{session.agentName}</h1>
          <p>Agent 对话区 · 流式输出 / 工具 / 工作流卡片</p>
        </div>
        <div className="flags">
          <label>
            <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} />
            联网
          </label>
          <label>
            <input type="checkbox" checked={think} onChange={(e) => setThink(e.target.checked)} />
            深度思考
          </label>
        </div>
      </header>
      <div className="scroll">
        <Timeline messages={session.messages} sessionId={session.id} />
        <div ref={end} />
      </div>
      <footer>
        <textarea
          rows={2}
          value={text}
          placeholder="试试：帮我找一个自动化工作流 / 查一下知识库文档"
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
  );
}
