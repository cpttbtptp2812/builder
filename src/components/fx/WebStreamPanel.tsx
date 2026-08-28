import { useEffect, useRef, useState } from "react";
import {
  AGENT_SSE_LINES,
  createSSEByteStream,
  parseUIMessageChunk,
  readSSEStream,
  type UIPart,
} from "../../lib/streams";

/** Web Streams API — ReadableStream + TextDecoder 解析 SSE */
export function WebStreamPanel({
  trigger = 0,
  onParts,
  onRawLine,
}: {
  trigger?: number;
  onParts?: (parts: UIPart[]) => void;
  onRawLine?: (line: string) => void;
}) {
  const [rawLines, setRawLines] = useState<string[]>([]);
  const [parts, setParts] = useState<UIPart[]>([]);
  const [streaming, setStreaming] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (trigger <= 0) return;
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;

    setRawLines([]);
    setParts([]);
    setStreaming(true);

    const stream = createSSEByteStream(AGENT_SSE_LINES, 420);
    const collected: UIPart[] = [];

    readSSEStream(stream, (ev) => {
      if (ac.signal.aborted) return;
      const line = ev.event ? `event: ${ev.event}\ndata: ${ev.data}` : `data: ${ev.data}`;
      setRawLines((prev) => [...prev, line]);
      onRawLine?.(line);
      const part = parseUIMessageChunk(ev.data);
      if (part) {
        collected.push(part);
        setParts([...collected]);
        onParts?.([...collected]);
      }
    }).finally(() => {
      if (!ac.signal.aborted) setStreaming(false);
    });

    return () => ac.abort();
  }, [trigger, onParts, onRawLine]);

  const assistantText = parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");

  return (
    <div className="web-stream-panel">
      <div className="fx-terminal">
        <div className="fx-terminal-bar">
          <i /><i /><i />
          <span>ReadableStream · TextDecoder</span>
          <em className="live-dot">{streaming ? "READING" : "IDLE"}</em>
        </div>
        <pre className="fx-terminal-body sm">
          {rawLines.map((l, i) => (
            <div key={i} className={l.includes("tool") ? "hl-tool" : ""}>{l}</div>
          ))}
          {streaming && <span className="caret">▍</span>}
        </pre>
      </div>

      <div className="ui-message-panel">
        <header>AI SDK UIMessage · parseUIMessageChunk()</header>
        <div className="ui-message-parts">
          {parts.map((p, i) => {
            if (p.type === "start") return <div key={i} className="ui-part start">turnId: {p.turnId}</div>;
            if (p.type === "reasoning") return <div key={i} className="ui-part reason">{p.text}</div>;
            if (p.type === "tool-call") return <div key={i} className="ui-part tool">tool-call · {p.name}</div>;
            if (p.type === "tool-result") return <div key={i} className="ui-part tool done">HTTP {p.hits}</div>;
            if (p.type === "done") return <div key={i} className="ui-part done">stream closed</div>;
            return null;
          })}
          {assistantText && (
            <div className="ui-part text"><strong>assistant</strong> {assistantText}</div>
          )}
        </div>
      </div>
    </div>
  );
}
