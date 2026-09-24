/**
 * OwnAgent 客户向对话页 — 正文优先、预制问句在输入框上方、技术细节默认隐藏
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentMarkdown } from "../fx/agent/AgentMarkdown";
import { UserMessageBubble } from "../fx/agent/UserMessageBubble";
import { OwnSettingsSheet } from "../fx/agent/OwnSettingsSheet";
import { loadEnabledMcpTools } from "../fx/agent/AgentMcpRegistry";
import { runGuestAgentTurn } from "../../lib/guestAgentRuntime";
import { matchPlaza, publishPlaza } from "../../lib/plazaFeed";
import { getRuntimeConfig } from "../../lib/runtimeConfig";
import { listFollowUpPrompts, matchPresetQuery } from "../../lib/ownKnowledge";
import { followUpsFor } from "../../lib/chatFrontier";
import { normalizeFollowUps } from "../../lib/followUpPrompts";
import { buildAnswerInsight } from "../../lib/answerInsight";
import {
  createFlowJournal,
  activateFlowNode,
  addFlowChip,
  setFlowEvidence,
  finishFlowJournal,
  evidenceFromKnowledgeResult,
  type FlowJournalNode,
} from "../../lib/turnFlowJournal";
import {
  emptySession,
  loadSessionStore,
  persistSessionStore,
  upsertActive,
  type OwnChatMessage,
} from "../../lib/ownagentSessions";
import type { AgentChatMessage } from "../../lib/agentRuntime";
import { useThreadScroll } from "../../hooks/useThreadScroll";

function uid() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

const sleep = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

function PublishButton({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [done, setDone] = useState(false);
  if (done) return <span className="oa-hub-published">已发布到广场</span>;
  return (
    <button
      type="button"
      className="oa-hub-publish"
      onClick={async () => {
        await publishPlaza({ question, answer, author: "OwnAgent 用户" });
        setDone(true);
      }}
    >
      发布到广场
    </button>
  );
}

export function OwnAgentChat() {
  const boot = useRef(loadSessionStore());
  const [store, setStore] = useState(boot.current);
  const active = store.sessions.find((s) => s.id === store.activeId) ?? store.sessions[0]!;
  const [messages, setMessages] = useState<OwnChatMessage[]>(() => active.messages);
  const [history, setHistory] = useState<AgentChatMessage[]>(() => active.history);
  const historyRef = useRef(history);
  historyRef.current = history;

  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [enabledTools, setEnabledTools] = useState(() => loadEnabledMcpTools());
  const [kbRev, setKbRev] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(100);

  const { threadRef, scrollToBottom, onThreadScroll, stickRef } = useThreadScroll([
    messages.length,
    streamText,
    running,
    footerHeight,
  ]);

  const lastAsst = useMemo(
    () => [...messages].reverse().find((m) => m.role === "assistant"),
    [messages],
  );

  const chipPrompts = useMemo(() => {
    if (running) return [];
    const fromLast = normalizeFollowUps(lastAsst?.followUps);
    if (fromLast.length) return fromLast.slice(0, 4).map((p) => p.text);
    const asked = messages.map((m) => m.content.trim());
    return listFollowUpPrompts(asked, 6);
  }, [running, lastAsst, messages, kbRev]);

  useEffect(() => {
    setStore((prev) => {
      const next = upsertActive(prev, { messages, history });
      persistSessionStore(next);
      return next;
    });
  }, [messages, history]);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFooterHeight(el.offsetHeight));
    ro.observe(el);
    setFooterHeight(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const pending = sessionStorage.getItem("oa-pending-ask");
    if (!pending) return;
    sessionStorage.removeItem("oa-pending-ask");
    void send(pending);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (text: string) => {
      const q = text.trim();
      if (!q || running) return;

      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      const userMsg: OwnChatMessage = { id: uid(), role: "user", content: q, createdAt: Date.now() };
      const assistantId = uid();
      const t0 = performance.now();
      let journal: FlowJournalNode[] = createFlowJournal(q);
      const jActivate = (id: "read" | "route" | "fetch" | "write") => {
        journal = activateFlowNode(journal, id);
      };
      const jChip = (id: "read" | "route" | "fetch" | "write", chip: string) => {
        journal = addFlowChip(journal, id, chip);
      };

      stickRef.current = true;
      scrollToBottom(false);
      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setRunning(true);
      setStreamText("");

      let fullText = "";
      let mode: OwnChatMessage["mode"] = "guest";

      const finish = (content: string) => {
        journal = finishFlowJournal(journal);
        const ms = Math.round(performance.now() - t0);
        const answerInsight = buildAnswerInsight({
          flowJournal: journal,
          ms,
          mode,
        });
        const followUps = followUpsFor({
          mode,
          exclude: [...messages.map((m) => m.content), q],
          query: q,
          flowJournal: journal,
          limit: 4,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            createdAt: Date.now(),
            content,
            mode,
            ms,
            flowJournal: journal,
            followUps,
            answerInsight,
          },
        ]);
        setRunning(false);
        setStreamText("");
        window.setTimeout(() => scrollToBottom(true), 80);
      };

      try {
        jChip("read", q.length > 40 ? `${q.slice(0, 40)}…` : q);
        jActivate("route");

        const preset = matchPresetQuery(q);
        if (preset) {
          mode = "guest";
          jChip("route", `知识库 · ${preset.doc.title}`);
          jActivate("fetch");
          journal = setFlowEvidence(journal, "fetch", [
            {
              id: preset.doc.id,
              kind: "hit",
              title: preset.doc.title,
              excerpt: preset.doc.body.trim().slice(0, 200),
              score: preset.score,
            },
          ]);
          jActivate("write");
          for (let i = 0; i < preset.answer.length; i += 3) {
            const chunk = preset.answer.slice(i, i + 3);
            fullText += chunk;
            setStreamText(fullText);
            await sleep(6);
          }
          finish(preset.answer);
          return;
        }

        const cfg = await getRuntimeConfig();
        const plazaMatch = await matchPlaza(q);
        if (plazaMatch && plazaMatch.score >= cfg.plaza.matchThreshold) {
          mode = "plaza";
          jChip("route", `知识广场 · ${plazaMatch.score}%`);
          jActivate("write");
          const plazaText = plazaMatch.item.answer;
          for (let i = 0; i < plazaText.length; i += 3) {
            fullText += plazaText.slice(i, i + 3);
            setStreamText(fullText);
            await sleep(6);
          }
          finish(plazaText);
          return;
        }

        jActivate("fetch");
        const guest = await runGuestAgentTurn(
          q,
          {
            snapshotRoot: null,
            signal: ac.signal,
            enabledTools,
            history: historyRef.current,
          },
          (ev) => {
            if (ev.type === "text-delta") {
              fullText += ev.text;
              setStreamText(fullText);
              jActivate("write");
            }
            if (ev.type === "tool-end" && ev.tool.name === "knowledge_search") {
              journal = setFlowEvidence(journal, "fetch", evidenceFromKnowledgeResult(ev.tool.result));
            }
          },
        );

        const reply = guest.assistantText || fullText;
        if (!fullText && reply) setStreamText(reply);

        const nextHistory: AgentChatMessage[] = [
          ...historyRef.current.filter((m) => m.role === "user" || m.role === "assistant"),
          { role: "user", content: q },
          { role: "assistant", content: reply },
        ].slice(-24);
        historyRef.current = nextHistory;
        setHistory(nextHistory);
        finish(reply);
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          finish("已停止。");
          return;
        }
        finish(`请求失败：${err instanceof Error ? err.message : "未知错误"}`);
      }
    },
    [running, messages, scrollToBottom, stickRef, enabledTools],
  );

  function newChat() {
    abortRef.current?.abort();
    setRunning(false);
    setStreamText("");
    const created = emptySession();
    const sessions = [created, ...store.sessions].slice(0, 24);
    setStore({ activeId: created.id, sessions });
    persistSessionStore({ activeId: created.id, sessions });
    setMessages([]);
    setHistory([]);
    historyRef.current = [];
  }

  function stop() {
    abortRef.current?.abort();
    setRunning(false);
  }

  const empty = messages.length === 0 && !running;

  return (
    <div className="oa-hub">
      <header className="oa-hub-head">
        <div className="oa-hub-brand">
          <span className="oa-hub-logo">OA</span>
          <strong>OwnAgent</strong>
        </div>
        <div className="oa-hub-actions">
          <button type="button" onClick={newChat} disabled={running}>
            新对话
          </button>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            设置
          </button>
        </div>
      </header>

      <main
        ref={threadRef}
        className="oa-hub-thread"
        style={{ paddingBottom: footerHeight + 24 }}
        onScroll={onThreadScroll}
      >
        {empty && (
          <div className="oa-hub-welcome">
            <h2>你好，有什么可以帮你？</h2>
            <p>直接输入问题，或点击下方推荐问句</p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={m.id} data-msg-id={m.id} className={`oa-hub-row ${m.role}`}>
            {m.role === "user" ? (
              <UserMessageBubble text={m.content} />
            ) : (
              <div className="oa-hub-answer">
                <AgentMarkdown text={m.content} />
                {m.answerInsight && (
                  <div className="oa-hub-meta">
                    依据 {m.answerInsight.groundedness}%
                    {m.answerInsight.hitCount > 0 && ` · 引用 ${m.answerInsight.hitCount} 段`}
                    {m.ms != null && m.ms > 0 && ` · ${m.ms}ms`}
                  </div>
                )}
                {!running && idx === messages.length - 1 && (() => {
                  const userMsg = messages.slice(0, idx).reverse().find((x) => x.role === "user");
                  if (!userMsg) return null;
                  return <PublishButton question={userMsg.content} answer={m.content} />;
                })()}
              </div>
            )}
          </div>
        ))}

        {running && (
          <div className="oa-hub-row assistant" data-msg-id="__live__">
            {streamText ? (
              <div className="oa-hub-answer streaming">
                <AgentMarkdown text={streamText} />
                <span className="oa-hub-caret" />
              </div>
            ) : (
              <div className="oa-hub-thinking">
                <span className="oa-hub-thinking-dot" />
                正在思考…
              </div>
            )}
          </div>
        )}
      </main>

      <footer ref={footerRef} className="oa-hub-footer">
        {chipPrompts.length > 0 && (
          <div className="oa-hub-chips">
            {chipPrompts.map((text) => (
              <button
                key={text}
                type="button"
                className="oa-hub-chip"
                disabled={running}
                onClick={() => void send(text)}
              >
                {text}
              </button>
            ))}
          </div>
        )}

        <form
          className="oa-hub-input-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <textarea
            value={input}
            rows={1}
            placeholder="输入你的问题…"
            disabled={running}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button
            type={running ? "button" : "submit"}
            className="oa-hub-send"
            disabled={!running && !input.trim()}
            onClick={running ? stop : undefined}
            aria-label={running ? "停止" : "发送"}
          >
            {running ? "■" : "↑"}
          </button>
        </form>
      </footer>

      <OwnSettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        initialTab="knowledge"
        enabledTools={enabledTools}
        onToolsChange={setEnabledTools}
        orchMode="single"
        onOrchModeChange={() => {}}
        onLlmChange={() => {}}
        onKnowledgeChange={() => setKbRev((n) => n + 1)}
      />
    </div>
  );
}
