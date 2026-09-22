/**
 * KnowledgeSources — 知识溯源面板
 * 清晰展示每轮 AI 回答引用了哪些知识片段、相关度、原文摘录
 * 替代之前抽象的"知识星图"力导向图
 */
import { useMemo, useState } from "react";
import type { OwnChatMessage } from "../../../lib/ownagentSessions";

/* ─── types ─────────────────────────────────────────────── */
type SourceItem = {
  title: string;
  score: number;       // 0–1
  excerpt: string;
  step: string;        // which reasoning step referenced it
};

type TurnSources = {
  turnIdx: number;       // 0-based
  query: string;
  sources: SourceItem[];
  groundedness: number;  // 0–100
};

/* ─── helpers ────────────────────────────────────────────── */
function buildTurns(messages: OwnChatMessage[]): TurnSources[] {
  const result: TurnSources[] = [];
  let turnIdx = 0;
  let lastUserQ = "";

  for (const msg of messages) {
    if (msg.role === "user") {
      lastUserQ = typeof msg.content === "string" ? msg.content : "";
      continue;
    }
    if (msg.role !== "assistant") continue;

    const srcMap = new Map<string, SourceItem>();

    for (const jn of msg.flowJournal ?? []) {
      for (const ev of jn.evidence ?? []) {
        if (ev.kind !== "hit" || !ev.title?.trim()) continue;
        const key = ev.title.trim();
        const prev = srcMap.get(key);
        if (!prev || (ev.score ?? 0) > prev.score) {
          srcMap.set(key, {
            title:   ev.title.trim(),
            score:   ev.score ?? 0,
            excerpt: ev.excerpt ?? "",
            step:    jn.step ?? "",
          });
        }
      }
    }

    const sources = [...srcMap.values()].sort((a, b) => b.score - a.score);
    const groundedness = sources.length > 0
      ? Math.round((sources.reduce((s, x) => s + x.score, 0) / sources.length) * 100)
      : 0;

    result.push({ turnIdx, query: lastUserQ, sources, groundedness });
    turnIdx++;
  }

  return result;
}

function scoreColor(s: number) {
  if (s >= 0.8) return { bg: "#ecfdf5", text: "#059669", border: "#6ee7b7" };
  if (s >= 0.6) return { bg: "#fffbeb", text: "#d97706", border: "#fcd34d" };
  return                { bg: "#fef2f2", text: "#dc2626", border: "#fca5a5" };
}

function groundednessLabel(g: number) {
  if (g >= 80) return { label: "高置信",   color: "#059669" };
  if (g >= 55) return { label: "中等置信", color: "#d97706" };
  return               { label: "低置信",   color: "#dc2626" };
}

/* ─── live placeholder rows ─────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="ua-src-card ua-src-card--skeleton">
      <div className="ua-src-skel-score" />
      <div className="ua-src-skel-body">
        <div className="ua-src-skel-title" />
        <div className="ua-src-skel-line" />
        <div className="ua-src-skel-line ua-src-skel-line--short" />
      </div>
    </div>
  );
}

/* ─── main ───────────────────────────────────────────────── */
export function KnowledgeSources({
  messages,
  running,
  onClose,
}: {
  messages: OwnChatMessage[];
  running?: boolean;
  onClose?: () => void;
}) {
  const turns = useMemo(() => buildTurns(messages), [messages]);

  // Default to latest turn
  const [activeTurn, setActiveTurn] = useState<number | null>(null);

  // Resolve which turn to show
  const latestIdx = turns.length > 0 ? turns[turns.length - 1]!.turnIdx : -1;
  const shownIdx  = activeTurn !== null ? activeTurn : latestIdx;
  const turn      = turns.find((t) => t.turnIdx === shownIdx) ?? null;

  const isEmpty   = turns.length === 0 && !running;
  const gl        = turn ? groundednessLabel(turn.groundedness) : null;

  return (
    <aside className="ua-ksrc" aria-label="知识溯源">

      {/* ── Header ── */}
      <header className="ua-ksrc-head">
        <div className="ua-ksrc-title">
          <span className="ua-ksrc-kicker">Knowledge Sources</span>
          <strong className="ua-ksrc-name">知识溯源</strong>
          <em>
            {isEmpty
              ? "AI 回答后，来源知识片段将显示在此处"
              : `共 ${turns.length} 轮对话 · ${turns.reduce((s, t) => s + t.sources.length, 0)} 个引用片段`}
          </em>
        </div>
        {onClose && (
          <button type="button" className="ua-ksrc-close" onClick={onClose} aria-label="关闭">×</button>
        )}
      </header>

      {/* ── Empty state ── */}
      {isEmpty ? (
        <div className="ua-ksrc-empty">
          <div className="ua-ksrc-empty-icon" aria-hidden>
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect x="5" y="8" width="30" height="4" rx="2" fill="#cbd5e1" />
              <rect x="5" y="17" width="22" height="3" rx="1.5" fill="#e2e8f0" />
              <rect x="5" y="24" width="26" height="3" rx="1.5" fill="#e2e8f0" />
              <rect x="5" y="31" width="18" height="3" rx="1.5" fill="#e2e8f0" />
              <circle cx="32" cy="28" r="7" fill="#eef2ff" stroke="#818cf8" strokeWidth="1.5" />
              <path d="M29.5 28h5M32 25.5v5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <p>提问后，AI 引用的知识片段<br />及相关度将显示在此</p>
          <em>验证 AI 回答的信息来源</em>
        </div>
      ) : (
        <>
          {/* ── Turn tabs ── */}
          {turns.length > 1 && (
            <div className="ua-ksrc-turns">
              {turns.map((t) => (
                <button
                  key={t.turnIdx}
                  type="button"
                  className={`ua-ksrc-turn-btn${shownIdx === t.turnIdx ? " on" : ""}`}
                  onClick={() => setActiveTurn(t.turnIdx)}
                  title={t.query}
                >
                  第 {t.turnIdx + 1} 轮
                </button>
              ))}
            </div>
          )}

          {/* ── Query preview ── */}
          {turn && turn.query && (
            <div className="ua-ksrc-query">
              <span className="ua-ksrc-query-label">问题</span>
              <span className="ua-ksrc-query-text">{turn.query.slice(0, 80)}{turn.query.length > 80 ? "…" : ""}</span>
            </div>
          )}

          {/* ── Confidence bar ── */}
          {turn && turn.sources.length > 0 && gl && (
            <div className="ua-ksrc-conf">
              <div className="ua-ksrc-conf-left">
                <span className="ua-ksrc-conf-label" style={{ color: gl.color }}>
                  {gl.label}
                </span>
                <span className="ua-ksrc-conf-pct" style={{ color: gl.color }}>
                  {turn.groundedness}%
                </span>
              </div>
              <div className="ua-ksrc-conf-track">
                <div
                  className="ua-ksrc-conf-fill"
                  style={{ width: `${turn.groundedness}%`, background: gl.color }}
                />
              </div>
              <span className="ua-ksrc-conf-hint">知识匹配度</span>
            </div>
          )}

          {/* ── Source cards ── */}
          <div className="ua-ksrc-list">
            {running && turn && turn.sources.length === 0 && (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            )}

            {turn && turn.sources.length === 0 && !running && (
              <div className="ua-ksrc-no-src">
                <span>本轮回答未检索到知识片段</span>
                <em>（可能为通用问答，无需引用知识库）</em>
              </div>
            )}

            {turn && turn.sources.map((src, i) => {
              const sc = scoreColor(src.score);
              return (
                <div key={i} className="ua-src-card">
                  {/* Rank + score */}
                  <div className="ua-src-rank">
                    <span className="ua-src-rank-num">{i + 1}</span>
                    <span
                      className="ua-src-score-badge"
                      style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
                    >
                      {Math.round(src.score * 100)}%
                    </span>
                  </div>

                  {/* Content */}
                  <div className="ua-src-body">
                    {/* Title */}
                    <div className="ua-src-title" title={src.title}>{src.title}</div>

                    {/* Relevance bar */}
                    <div className="ua-src-bar-wrap">
                      <div
                        className="ua-src-bar-fill"
                        style={{ width: `${src.score * 100}%`, background: sc.text }}
                      />
                    </div>

                    {/* Excerpt */}
                    {src.excerpt && (
                      <blockquote className="ua-src-excerpt">{src.excerpt}</blockquote>
                    )}

                    {/* Step tag */}
                    {src.step && (
                      <span className="ua-src-step-tag">检索步骤：{src.step}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Footer note ── */}
      {!isEmpty && (
        <footer className="ua-ksrc-footer">
          AI 回答完全基于以上知识库内容生成，相关度越高引用越准确
        </footer>
      )}
    </aside>
  );
}
