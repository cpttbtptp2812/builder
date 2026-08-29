import { useState } from "react";
import type { ChatLine } from "../../data/secretRomance";
import { secretRomance } from "../../data/secretRomance";

/** 对话气泡 — 可复用 */
export function ChatBubble({
  line,
  pop,
}: {
  line: ChatLine;
  pop?: boolean;
}) {
  return (
    <div className={`secret-chat-bubble ${line.from}${pop ? " pop" : ""}`}>
      {line.from === "her" && (
        <span className="secret-chat-tag">{secretRomance.herName}</span>
      )}
      {line.text}
    </div>
  );
}

/** 与林婷的对话 — 逐条点击 */
export function ChatStreamScene({
  title,
  lead,
  lines,
  onComplete,
  onBurst,
}: {
  title: string;
  lead?: string;
  lines: ChatLine[];
  onComplete: () => void;
  onBurst?: (x: number, y: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [typing, setTyping] = useState(false);
  const done = index >= lines.length;

  function next(e: React.MouseEvent) {
    if (done || typing) return;
    const nextLine = lines[index];
    if (nextLine?.from === "her") {
      setTyping(true);
      onBurst?.(e.clientX, e.clientY);
      window.setTimeout(() => {
        setTyping(false);
        const nextIdx = index + 1;
        setIndex(nextIdx);
        if (nextIdx >= lines.length) window.setTimeout(onComplete, 600);
      }, 650);
      return;
    }
    const nextIdx = index + 1;
    setIndex(nextIdx);
    onBurst?.(e.clientX, e.clientY);
    if (nextIdx >= lines.length) window.setTimeout(onComplete, 600);
  }

  return (
    <section
      className="secret-chat"
      onClick={next}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          next({ clientX: 0, clientY: 0 } as React.MouseEvent);
        }
      }}
    >
      <h2>{title}</h2>
      <p className="secret-chat-lead">
        {done ? "每一句话，都还在内存里。" : lead ?? "点击，让对话继续——"}
      </p>

      <div className="secret-chat-window">
        {lines.slice(0, index).map((line, i) => (
          <ChatBubble key={i} line={line} pop={i === index - 1} />
        ))}

        {typing && (
          <div className="secret-chat-bubble her typing">
            <span className="secret-chat-tag">{secretRomance.herName}</span>
            <span className="secret-typing-dots">
              <i /><i /><i />
            </span>
          </div>
        )}

        {!done && !typing && index === 0 && <p className="secret-chat-tap">👆 点击开始</p>}
        {!done && !typing && index > 0 && <p className="secret-chat-tap">点击下一句…</p>}
      </div>
    </section>
  );
}
