import { useCallback, useEffect, useRef, useState } from "react";
import { AgentConfigBar } from "./AgentConfigBar";
import { AgentLiveTrace } from "./AgentLiveTrace";
import { AgentMarkdown } from "./agent/AgentMarkdown";
import { AgentMcpRegistry, loadEnabledMcpTools } from "./agent/AgentMcpRegistry";
import { AgentReasoningBlock } from "./agent/AgentReasoningBlock";
import { AgentThink } from "./agent/AgentThink";
import { AgentToolChip, type ToolChipState } from "./agent/AgentToolChip";
import { AgentWelcome } from "./agent/AgentWelcome";
import { VncFloat } from "./VncFloat";
import {
  runAgentTurn,
  type AgentChatMessage,
  type AgentStreamEvent,
  type AgentTurnTrace,
} from "../../lib/agentRuntime";
import { isAuthError, runGuestAgentTurn } from "../../lib/guestAgentRuntime";
import { isLlmConfigured, loadLlmConfig, type LlmConfig } from "../../lib/llmConfig";

type UiMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  mode?: "guest" | "llm";
  tools?: ToolChipState[];
};

function uid() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** UniAgent 对话 — 对齐 tianyangAgent 产品体验 + tianyangbuilder MCP 配置 */
export function AgentProductDemo({ autoStart = false }: { autoStart?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const userScrolledRef = useRef(false);

  const [llmConfig, setLlmConfig] = useState<LlmConfig>(() => loadLlmConfig());
  const [enabledTools, setEnabledTools] = useState<string[]>(() => loadEnabledMcpTools());
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [history, setHistory] = useState<AgentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [traces, setTraces] = useState<AgentTurnTrace[]>([]);
  const [iteration, setIteration] = useState(0);
  const [showVnc, setShowVnc] = useState(false);
  const [streamReasoning, setStreamReasoning] = useState("");
  const [streamText, setStreamText] = useState("");
  const [liveTools, setLiveTools] = useState<ToolChipState[]>([]);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const autoStarted = useRef(false);

  const useLlm = isLlmConfigured(llmConfig);
  const hasMessages = messages.length > 0 || running;

  const scrollToBottom = useCallback((smooth = true) => {
    const el = threadRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (!userScrolledRef.current) scrollToBottom();
  }, [messages, streamText, streamReasoning, liveTools, scrollToBottom]);

  const handleEvent = useCallback((ev: AgentStreamEvent, toolsAcc: ToolChipState[]) => {
    if (ev.type === "iteration") setIteration(ev.n);
    if (ev.type === "trace-sync") setTraces(ev.traces);
    if (ev.type === "reasoning-delta") setStreamReasoning((s) => s + ev.text);
    if (ev.type === "text-delta") setStreamText((s) => s + ev.text);
    if (ev.type === "tool-start") {
      toolsAcc.push({ id: ev.tool.id, name: ev.tool.name, state: "loading" });
      setLiveTools([...toolsAcc]);
    }
    if (ev.type === "tool-end") {
      const idx = toolsAcc.findIndex((t) => t.id === ev.tool.id);
      const row: ToolChipState = {
        id: ev.tool.id,
        name: ev.tool.name,
        state: ev.tool.ok === false ? "error" : "ok",
        ms: ev.tool.ms,
      };
      if (idx >= 0) toolsAcc[idx] = row;
      else toolsAcc.push(row);
      setLiveTools([...toolsAcc]);
      if (ev.tool.name === "workflow_run") setShowVnc(true);
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || running) return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const userMsg: UiMessage = { id: uid(), role: "user", content: q };
      const assistantId = uid();
      const mode: UiMessage["mode"] = useLlm ? "llm" : "guest";
      const toolsAcc: ToolChipState[] = [];

      userScrolledRef.current = false;
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setRunning(true);
      setTraces([]);
      setIteration(0);
      setStreamReasoning("");
      setStreamText("");
      setLiveTools([]);
      setShowVnc(false);

      let fullReasoning = "";
      let fullText = "";

      const finish = (content: string, reasoning?: string) => {
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content,
            reasoning,
            mode,
            tools: [...toolsAcc],
          },
        ]);
      };

      try {
        const onEv = (ev: AgentStreamEvent) => {
          handleEvent(ev, toolsAcc);
          if (ev.type === "reasoning-delta") fullReasoning += ev.text;
          if (ev.type === "text-delta") fullText += ev.text;
        };

        if (useLlm) {
          try {
            const result = await runAgentTurn(
              q,
              history,
              llmConfig,
              { snapshotRoot: rootRef.current, signal: ac.signal },
              onEv,
            );
            setTraces(result.traces);
            setHistory(result.messages);
            finish(result.assistantText || fullText, fullReasoning || undefined);
            return;
          } catch (err) {
            if ((err as Error).name === "AbortError") return;
            if (isAuthError(err)) {
              finish(
                "LLM Key 无效（401）。请关闭「启用我的 LLM」继续使用 Guest Agent。",
                "Authentication failed",
              );
              return;
            }
            throw err;
          }
        }

        const guest = await runGuestAgentTurn(
          q,
          { snapshotRoot: rootRef.current, signal: ac.signal },
          onEv,
        );
        setTraces(guest.traces);
        finish(guest.assistantText || fullText, fullReasoning || undefined);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        finish(`请求失败：${err instanceof Error ? err.message : "未知错误"}`);
      } finally {
        setRunning(false);
        setStreamReasoning("");
        setStreamText("");
        setLiveTools([]);
        setIteration(0);
      }
    },
    [running, useLlm, llmConfig, history, handleEvent],
  );

  useEffect(() => {
    if (!autoStart || autoStarted.current) return;
    autoStarted.current = true;
    const t = window.setTimeout(() => void send("帮我对本站做发布前检查，探活并确认关键页面可访问"), 800);
    return () => clearTimeout(t);
  }, [autoStart, send]);

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  function onThreadScroll() {
    const el = threadRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledRef.current = dist > 80;
    setShowScrollFab(dist > 120);
  }

  return (
    <div className="work-agent-rich agent-product-demo agent-product-live agent-chat-shell" ref={rootRef}>
      <div className="agent-shell-bg" aria-hidden />

      <div className="agent-shell-header">
        <div className="agent-shell-identity">
          <span className="agent-shell-avatar">UA</span>
          <div>
            <strong>UniAgent</strong>
            <span>{useLlm ? "LLM Agent Loop" : "Guest Agent · 开箱即用"}</span>
          </div>
        </div>
        <div className="agent-feature-pills compact">
          {["MCP", useLlm ? "LLM" : "Router", "Trace"].map((f) => (
            <span key={f} className="agent-feature-pill">{f}</span>
          ))}
        </div>
      </div>

      <AgentMcpRegistry enabled={enabledTools} onChange={setEnabledTools} />
      <AgentConfigBar onChange={setLlmConfig} />

      <div className="agent-demo-grid agent-shell-body">
        <div className="agent-chat-panel">
          <div
            ref={threadRef}
            className="agent-chat-thread"
            onScroll={onThreadScroll}
          >
            {!hasMessages && <AgentWelcome onPrompt={(t) => void send(t)} disabled={running} />}

            {messages.map((m) => (
              <div key={m.id} className={`agent-message ${m.role}`}>
                {m.role === "user" ? (
                  <div className="chat-msg user">
                    <p>{m.content}</p>
                  </div>
                ) : (
                  <div className="chat-msg assistant">
                    {m.reasoning && (
                      <AgentReasoningBlock text={m.reasoning} thinking={false} defaultOpen={false} />
                    )}
                    {m.tools?.map((t) => (
                      <AgentToolChip key={t.id} tool={{ ...t, state: t.state === "loading" ? "ok" : t.state }} />
                    ))}
                    <AgentMarkdown text={m.content} />
                  </div>
                )}
              </div>
            ))}

            {running && (
              <div className="agent-message assistant">
                <div className="chat-msg assistant streaming">
                  {(streamReasoning || !streamText) && (
                    <AgentReasoningBlock
                      text={streamReasoning}
                      thinking={!streamText && liveTools.length === 0}
                      defaultOpen
                    />
                  )}
                  <div className="agent-inline-tools">
                    {liveTools.map((t) => (
                      <AgentToolChip key={t.id} tool={t} />
                    ))}
                  </div>
                  {streamText ? (
                    <AgentMarkdown text={streamText} />
                  ) : liveTools.length === 0 ? (
                    <AgentThink />
                  ) : null}
                  {streamText && <span className="caret">▍</span>}
                </div>
              </div>
            )}
          </div>

          {showScrollFab && (
            <button type="button" className="agent-scroll-fab" onClick={() => { userScrolledRef.current = false; scrollToBottom(); }}>
              ↓
            </button>
          )}

          <form
            className="agent-chat-compose agent-prompt-footer"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <textarea
              value={input}
              rows={1}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="输入问题，Enter 发送 · Shift+Enter 换行"
              disabled={running}
            />
            {running ? (
              <button type="button" className="agent-stop-btn square" onClick={stop} title="停止">
                ■
              </button>
            ) : (
              <button type="submit" className="agent-send-btn" disabled={!input.trim()} title="发送">
                ↑
              </button>
            )}
          </form>
        </div>

        <div className="agent-side-panel">
          <header className="agent-chat-head">
            <strong>Agent Loop Trace</strong>
            <span>tools/call · JSON-RPC</span>
          </header>
          <AgentLiveTrace traces={traces} running={running} iteration={iteration} />
        </div>
      </div>

      {showVnc && <VncFloat />}
    </div>
  );
}
