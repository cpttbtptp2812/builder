import { useCallback, useEffect, useRef, useState } from "react";
import type { TraceSpan } from "../../data/agentTraceDemo";
import { AgentTraceRecorder } from "../../lib/agentTraceRecorder";
import {
  clearTraceSessions,
  getTraceSession,
  listTraceSessions,
  type StoredTraceSession,
} from "../../lib/agentTraceStore";
import { runGuestAgentTurn } from "../../lib/guestAgentRuntime";

const QUICK = [
  "帮我对本站做发布前检查，探活并确认关键页面可访问",
  "介绍一下 iMean 项目",
  "分析当前页面的 DOM 结构",
];

/** 预览区只要文字，去掉 markdown 记号 */
function plainText(md: string) {
  return md
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "· ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const KIND_ICON: Record<TraceSpan["kind"], string> = {
  user: "💬",
  intent: "🎯",
  plan: "📋",
  tool: "🔧",
  stream: "〰️",
  reply: "✅",
  error: "⛔",
};

function SpanRow({
  span,
  open,
  onToggle,
  cumulativeMs,
}: {
  span: TraceSpan;
  open: boolean;
  onToggle: () => void;
  cumulativeMs: number;
}) {
  return (
    <div className={`agent-trace-span agent-trace-span--${span.status}`}>
      <button type="button" className="agent-trace-span-head" onClick={onToggle}>
        <span className="agent-trace-span-icon">{KIND_ICON[span.kind]}</span>
        <span className="agent-trace-span-body">
          <strong>{span.label}</strong>
          <em>{span.detail}</em>
        </span>
        <span className="agent-trace-span-meta">
          +{span.ms}ms
          <small>{cumulativeMs + span.ms}ms</small>
        </span>
      </button>
      {open && span.payload ? (
        <pre className="agent-trace-payload">{JSON.stringify(span.payload, null, 2)}</pre>
      ) : null}
    </div>
  );
}

function TraceRail({ spans }: { spans: TraceSpan[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  let cumulative = 0;

  if (!spans.length) {
    return <p className="agent-trace-empty">发送一条消息，真实运行的每一步会出现在这里</p>;
  }

  return (
    <div className="agent-trace-rail">
      {spans.map((span) => {
        const row = (
          <SpanRow
            key={span.id}
            span={span}
            cumulativeMs={cumulative}
            open={openId === span.id}
            onToggle={() => setOpenId(openId === span.id ? null : span.id)}
          />
        );
        cumulative += span.ms;
        return row;
      })}
    </div>
  );
}

/** OwnAgent · 运行追踪 — 真实 Agent 运行 + 时间线 + 历史 */
export function TracePanel() {
  const [sessions, setSessions] = useState<StoredTraceSession[]>(() => listTraceSessions());
  const [selectedId, setSelectedId] = useState<string | null>(() => listTraceSessions()[0]?.id ?? null);
  const [liveSpans, setLiveSpans] = useState<TraceSpan[] | null>(null);
  const [running, setRunning] = useState(false);
  const [input, setInput] = useState("");
  const [lastReply, setLastReply] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = selectedId ? getTraceSession(selectedId) : null;
  const displaySpans = liveSpans ?? selected?.spans ?? [];

  const refreshSessions = useCallback(() => {
    setSessions(listTraceSessions());
  }, []);

  useEffect(() => {
    refreshSessions();
  }, [refreshSessions]);

  async function send(query: string) {
    const q = query.trim();
    if (!q || running) return;

    setRunning(true);
    setLiveSpans([]);
    setLastReply("");
    setSelectedId(null);

    const recorder = new AgentTraceRecorder(q);
    setLiveSpans(recorder.getSpans());

    try {
      const result = await runGuestAgentTurn(q, { snapshotRoot: rootRef.current }, (ev) => {
        recorder.onEvent(ev);
        setLiveSpans(recorder.getSpans());
      });
      setLastReply(result.assistantText);
      const list = listTraceSessions();
      setSessions(list);
      if (list[0]) setSelectedId(list[0].id);
    } catch (err) {
      recorder.onEvent({
        type: "error",
        message: err instanceof Error ? err.message : "运行失败",
      });
      setLiveSpans(recorder.getSpans());
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="own-panel" ref={rootRef}>
      <p className="own-panel-lead">
        输入一句话，走<strong>真实 Agent 运行</strong>（Skill 路由 + MCP 工具）。每一步 intent / tool /
        回复写入时间线，历史保存在本机。
      </p>

      <div className="agent-trace-input-row">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例如：帮我对本站做发布前检查"
          disabled={running}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send(input);
          }}
        />
        <button type="button" className="agent-trace-send" disabled={running} onClick={() => void send(input)}>
          {running ? "运行中…" : "运行"}
        </button>
      </div>
      <div className="agent-trace-quick">
        {QUICK.map((q) => (
          <button key={q} type="button" disabled={running} onClick={() => void send(q)}>
            {q.length > 18 ? `${q.slice(0, 18)}…` : q}
          </button>
        ))}
      </div>

      {lastReply ? (
        <div className="agent-trace-reply-preview">
          <strong>Agent 回复</strong>
          <p>{plainText(lastReply).slice(0, 400)}{lastReply.length > 400 ? "…" : ""}</p>
        </div>
      ) : null}

      <div className="agent-trace-layout">
        <aside className="agent-trace-history">
          <div className="agent-trace-history-head">
            <strong>历史</strong>
            {sessions.length > 0 ? (
              <button
                type="button"
                className="agent-trace-clear"
                onClick={() => {
                  clearTraceSessions();
                  setSessions([]);
                  setSelectedId(null);
                  setLiveSpans(null);
                  setLastReply("");
                }}
              >
                清空
              </button>
            ) : null}
          </div>
          {sessions.length === 0 ? (
            <p className="agent-trace-empty">尚无记录</p>
          ) : (
            <ul>
              {sessions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={selectedId === s.id && !liveSpans ? "active" : ""}
                    onClick={() => {
                      setSelectedId(s.id);
                      setLiveSpans(null);
                      setLastReply(s.assistantText);
                    }}
                  >
                    <span>{s.query.slice(0, 30)}{s.query.length > 30 ? "…" : ""}</span>
                    <small>{s.spans.length} 步 · {s.totalMs}ms · {s.runtime ?? "local"}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="agent-trace-main">
          {selected && !liveSpans ? (
            <div className="agent-trace-query card">
              <span className="agent-trace-query-label">用户</span>
              <p>{selected.query}</p>
              <span className="agent-trace-total">
                {new Date(selected.createdAt).toLocaleString("zh-CN")} · {selected.totalMs}ms ·{" "}
                {selected.spans.length} 步
              </span>
            </div>
          ) : null}
          <TraceRail spans={displaySpans} />
        </section>
      </div>
    </div>
  );
}
