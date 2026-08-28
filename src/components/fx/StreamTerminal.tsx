import { useEffect, useRef, useState } from "react";

const EVENTS = [
  'event: message\ndata: {"type":"start","turnId":"t-8f2a"}',
  'data: {"type":"reasoning-delta","text":"分析意图…"}',
  'data: {"type":"text-delta","text":"我在"}',
  'data: {"type":"text-delta","text":"场景库"}',
  'data: {"type":"tool-call","name":"Knowledge"}',
  'data: {"type":"tool-result","hits":3}',
  'data: {"type":"workflow-match","score":0.94}',
  'event: done\ndata: [DONE]',
];

/** 模拟 SSE / GraphQL 订阅终端 */
export function StreamTerminal({ trigger = 0 }: { trigger?: number }) {
  const [lines, setLines] = useState<string[]>([]);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines([]);
    const timers = EVENTS.map((ev, idx) =>
      window.setTimeout(() => setLines((prev) => [...prev, ev]), idx * 380),
    );
    return () => timers.forEach(clearTimeout);
  }, [trigger]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="fx-terminal">
      <div className="fx-terminal-bar">
        <i /><i /><i />
        <span>SSE · GraphQL Provider</span>
        <em className="live-dot">LIVE</em>
      </div>
      <pre className="fx-terminal-body">
        {lines.map((l, i) => (
          <div key={i} className={l.includes("tool") ? "hl-tool" : l.includes("workflow") ? "hl-wf" : ""}>
            {l}
          </div>
        ))}
        <div ref={end} />
      </pre>
    </div>
  );
}
