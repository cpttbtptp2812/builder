import { useEffect, useRef, useState } from "react";
import { ToolCallPipeline } from "../fx/ToolCallPipeline";
import { VncFloat } from "../fx/VncFloat";
import {
  AGENT_SSE_LINES,
  createSSEByteStream,
  parseUIMessageChunk,
  readSSEStream,
} from "../../lib/streams";

const SCENES = [
  {
    id: "release" as const,
    label: "发布前检查",
    user: "帮我对 staging 环境做发布前检查",
    variant: "release" as const,
  },
  {
    id: "knowledge" as const,
    label: "知识库问答",
    user: "部署规范里 API 限流阈值是多少？",
    variant: "knowledge" as const,
  },
];

type ToolRow = { name: string; result?: string };

/** UniAgent 产品演示 — 流式对话 + Reasoning + Tool Call + VNC */
export function AgentProductDemo({ autoStart = false }: { autoStart?: boolean }) {
  const [scene, setScene] = useState<(typeof SCENES)[number]["id"]>("release");
  const [trigger, setTrigger] = useState(0);
  const [running, setRunning] = useState(false);
  const [showVnc, setShowVnc] = useState(false);
  const [reasoning, setReasoning] = useState("");
  const [reply, setReply] = useState("");
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [chunks, setChunks] = useState(0);
  const started = useRef(false);

  const cur = SCENES.find((s) => s.id === scene)!;

  function runDemo() {
    setTrigger((t) => t + 1);
    setRunning(true);
    setShowVnc(false);
    setReasoning("");
    setReply("");
    setTools([]);
    setChunks(0);

    const stream = createSSEByteStream(AGENT_SSE_LINES, 480);
    void readSSEStream(stream, (ev) => {
      setChunks((c) => c + 1);
      const part = parseUIMessageChunk(ev.data);
      if (!part) return;
      if (part.type === "reasoning") setReasoning((prev) => prev + part.text);
      if (part.type === "text") setReply((prev) => prev + part.text);
      if (part.type === "tool-call") setTools((prev) => [...prev, { name: part.name }]);
      if (part.type === "tool-result") {
        setTools((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last) last.result = part.hits === 200 ? "200 OK · 42ms" : `${part.hits} 条命中`;
          return next;
        });
      }
      if (part.type === "done") setRunning(false);
    });
  }

  useEffect(() => {
    if (!autoStart || started.current) return;
    started.current = true;
    const t = window.setTimeout(runDemo, 500);
    return () => clearTimeout(t);
  }, [autoStart]);

  return (
    <div className="work-agent-rich agent-product-demo">
      <div className="agent-feature-pills">
        {["SSE 流式对话", "Reasoning 思考链", "Tool Call 卡片", "noVNC 远程桌面"].map((f) => (
          <span key={f} className="agent-feature-pill">{f}</span>
        ))}
      </div>

      <div className="agent-strip">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={scene === s.id ? "on" : ""}
            onClick={() => setScene(s.id)}
            disabled={running}
          >
            <strong>{s.label}</strong>
            <span>切换演示场景</span>
          </button>
        ))}
      </div>

      <div className="work-demo-bar">
        <button type="button" className="cta" onClick={runDemo} disabled={running}>
          {running ? "对话进行中…" : "▶ 开始对话"}
        </button>
        {running && <span className="sse-live-chip">SSE 流式 · {chunks} chunks</span>}
        {!running && showVnc && <span className="sse-live-chip vnc">noVNC 已连接</span>}
      </div>

      <div className="agent-demo-grid">
        <div className="agent-chat-panel">
          <header className="agent-chat-head">
            <strong>对话界面</strong>
            <span>AI SDK 5 · UIMessage 部件渲染</span>
          </header>
          <div className="agent-chat-thread">
            <div className="chat-msg user">
              <small>你</small>
              <p>{cur.user}</p>
            </div>

            {(reasoning || running) && (
              <details className="chat-reasoning" open>
                <summary>Reasoning 思考链</summary>
                <p>{reasoning || "分析意图、匹配工具…"}</p>
              </details>
            )}

            {tools.map((t, i) => (
              <div key={`${t.name}-${i}`} className="chat-tool-card">
                <span className="chat-tool-icon" aria-hidden>🔧</span>
                <div>
                  <strong>{t.name}</strong>
                  {t.result ? <em>{t.result}</em> : running && <em className="live">running…</em>}
                </div>
              </div>
            ))}

            {(reply || (running && tools.length > 0)) && (
              <div className="chat-msg assistant">
                <small>助手</small>
                <p>
                  {reply}
                  {running && <span className="caret">▍</span>}
                </p>
              </div>
            )}

            {!running && trigger === 0 && (
              <p className="agent-chat-empty">点「开始对话」— 看流式回复、思考链、工具卡依次出现</p>
            )}
          </div>
        </div>

        <div className="agent-side-panel">
          <header className="agent-chat-head">
            <strong>Tool Call 流水线</strong>
            <span>后端工具逐步执行</span>
          </header>
          <ToolCallPipeline
            variant={cur.variant}
            trigger={trigger}
            onVnc={() => setShowVnc(true)}
          />
        </div>
      </div>

      {showVnc && <VncFloat />}
    </div>
  );
}
