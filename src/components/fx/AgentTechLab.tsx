import { useCallback, useEffect, useRef, useState } from "react";
import {
  PIPELINE_TECH,
  runAgentStreamLab,
  type TechLogEntry,
} from "../../lib/agentStreamLab";
import type { PipelineStage } from "../../lib/streamPipeline";
import type { UIPart } from "../../lib/streams";

type Phase = "idle" | "running" | "paused" | "done";

const TECH_BADGES = [
  "ReadableStream",
  "TextDecoderStream",
  "TransformStream",
  "AbortController",
  "UIMessage",
  "node:http",
  "useAutoResume",
];

/** UniAgent 技术实验室 — 暂停/续传时展示用了什么 API、断在哪一层 */
export function AgentTechLab({ autoStart = false }: { autoStart?: boolean }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState<PipelineStage>("source");
  const [logs, setLogs] = useState<TechLogEntry[]>([]);
  const [rawLines, setRawLines] = useState<{ line: string; index: number }[]>([]);
  const [parts, setParts] = useState<UIPart[]>([]);
  const [stoppedChunk, setStoppedChunk] = useState(0);
  const [stoppedStage, setStoppedStage] = useState<PipelineStage>("source");
  const [turnId, setTurnId] = useState<string | null>(null);
  const [resumeMode, setResumeMode] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const turnIdRef = useRef<string | null>(null);

  const appendLog = useCallback((entry: TechLogEntry) => {
    setLogs((prev) => [...prev, entry]);
  }, []);

  const run = useCallback(
    async (fromChunk: number, resume: boolean, keepState: boolean) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      if (!keepState) {
        setLogs([]);
        setRawLines([]);
        setParts([]);
        setTurnId(null);
        turnIdRef.current = null;
        setResumeMode(false);
      } else {
        setResumeMode(true);
      }

      setPhase("running");
      setStoppedStage("source");

      const result = await runAgentStreamLab({
        startChunk: fromChunk,
        signal: ac.signal,
        resume,
        knownTurnId: turnIdRef.current,
        onStage: setStage,
        onChunk: (line, index) => {
          setRawLines((prev) => {
            if (prev.some((r) => r.index === index)) return prev;
            return [...prev, { line, index }];
          });
        },
        onPart: (p) => setParts((prev) => [...prev, p]),
        onLog: appendLog,
      });

      if (ac.signal.aborted) {
        setStoppedChunk(result.stoppedChunk);
        setStoppedStage(result.stage);
        if (result.turnId) {
          turnIdRef.current = result.turnId;
          setTurnId(result.turnId);
        }
        setPhase("paused");
        return;
      }

      if (result.turnId) {
        turnIdRef.current = result.turnId;
        setTurnId(result.turnId);
      }
      setPhase(result.stage === "done" ? "done" : "idle");
    },
    [appendLog],
  );

  const startFresh = () => run(0, false, false);
  const pause = () => abortRef.current?.abort();
  const resume = () => run(stoppedChunk, true, true);

  useEffect(() => {
    if (autoStart) startFresh();
    return () => abortRef.current?.abort();
  }, [autoStart]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const stageIdx = PIPELINE_TECH.findIndex((s) => s.id === stage);
  const text = parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("");
  const pausedAt = PIPELINE_TECH.find((s) => s.id === stoppedStage);

  return (
    <div className="agent-tech-lab">
      <div className="agent-tech-badges">
        {TECH_BADGES.map((b) => (
          <span key={b} className="tech-badge">{b}</span>
        ))}
      </div>

      <div className="agent-tech-controls">
        <button type="button" className="cta sm" onClick={startFresh} disabled={phase === "running"}>
          ▶ 开始 SSE 管道
        </button>
        <button
          type="button"
          className="ghost-btn sm danger"
          onClick={pause}
          disabled={phase !== "running"}
        >
          ⏸ 暂停 · AbortController.abort()
        </button>
        <button
          type="button"
          className="ghost-btn sm accent"
          onClick={resume}
          disabled={phase !== "paused"}
        >
          ↻ 断线续传 · useAutoResume
        </button>
        <span className={`live-pulse indigo ${phase === "running" ? "" : "off"}`}>
          {phase === "running" ? "管道运行中" : phase === "paused" ? "已切断" : phase === "done" ? "完成" : "待命"}
        </span>
      </div>

      {phase === "paused" && pausedAt && (
        <div className="agent-tech-banner abort">
          <strong>断在「{pausedAt.label}」</strong>
          <span>
            {pausedAt.api} · 已收 {stoppedChunk} 个 chunk
            {turnId && <> · pendingTurnId = <code>{turnId}</code></>}
          </span>
        </div>
      )}
      {resumeMode && phase === "running" && (
        <div className="agent-tech-banner resume">
          <strong>续传模式</strong>
          <span>GET /api/chat/resume?turnId={turnId} · node:http · 从 chunk #{stoppedChunk} 继续</span>
        </div>
      )}

      <div className="pipeline-stages agent-tech-stages">
        {PIPELINE_TECH.map((s, i) => {
          const isStopped = phase === "paused" && stoppedStage === s.id;
          const isActive = phase === "running" && stage === s.id;
          return (
            <div
              key={s.id}
              className={`pipeline-stage ${isActive ? "active" : stageIdx > i ? "done" : ""} ${isStopped ? "stopped" : ""}`}
            >
              <span className="pipeline-idx">{i + 1}</span>
              <div>
                <strong>{s.label}</strong>
                <code>{s.api}</code>
                {isStopped && <em className="stage-stop-tag">← 断在这里</em>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="agent-tech-grid">
        <div className="agent-tech-log">
          <header>
            <span>技术事件流</span>
            <em>每次操作对应真实 API</em>
          </header>
          <pre className="tech-log-body">
            {logs.length === 0 && (
              <span className="pipeline-empty">点「开始」或「暂停/续传」，这里会逐条打出用了什么技术…</span>
            )}
            {logs.map((l) => (
              <div key={l.id} className={`tech-log-line kind-${l.kind}`}>
                <span className="tech-log-api">{l.api}</span>
                <span className="tech-log-detail">{l.detail}</span>
              </div>
            ))}
            <div ref={logEndRef} />
          </pre>
        </div>

        <div className="sse-pane">
          <header>SSE 原始 chunk</header>
          <pre>
            {rawLines.map(({ line, index }) => (
              <div key={index} className={line.includes("tool") ? "hl-tool" : ""}>
                <small>#{index}</small> {line}
              </div>
            ))}
            {phase === "running" && <span className="caret">▍</span>}
          </pre>
        </div>

        <div className="ui-message-panel">
          <header>
            <span>AI SDK UIMessage → React</span>
            <em>part 类型驱动渲染</em>
          </header>
          <div className="ui-message-parts">
            {parts.length === 0 && phase === "idle" && (
              <p className="pipeline-empty ui">reasoning / tool-call / text-delta 会按 type 渲染</p>
            )}
            {parts.map((p, i) => {
              if (p.type === "start") {
                return (
                  <div key={i} className="ui-part start">
                    <small>useChat · turnId</small>
                    {p.turnId}
                  </div>
                );
              }
              if (p.type === "reasoning") {
                return (
                  <div key={i} className="ui-part reason">
                    <small>ReasoningPart · 可折叠</small>
                    💭 {p.text}
                  </div>
                );
              }
              if (p.type === "tool-call") {
                return (
                  <div key={i} className="ui-part tool">
                    <small>ToolCallPart</small>
                    🔧 {p.name}
                  </div>
                );
              }
              if (p.type === "tool-result") {
                return (
                  <div key={i} className="ui-part tool done">
                    <small>ToolResultPart</small>
                    ✓ {p.hits}
                  </div>
                );
              }
              if (p.type === "done") {
                return <div key={i} className="ui-part done">stream complete</div>;
              }
              return null;
            })}
            {text && (
              <div className="ui-part text">
                <small>text-delta · TextPart</small>
                <strong>assistant</strong>
                <p>{text}{phase === "running" && <span className="caret">▍</span>}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <details className="agent-tech-extra">
        <summary>noVNC · WebSocket 远程桌面（Tool 触发时挂载）</summary>
        <div className="agent-tech-vnc-note">
          <p>
            <code>ToolCallPart</code> 名为 VNC Snapshot 时 → <code>new RFB(canvas, wsUrl)</code>
            · noVNC 走 WebSocket 帧协议 · 浮窗用 <code>position: fixed</code> + drag handler
          </p>
        </div>
      </details>
    </div>
  );
}
