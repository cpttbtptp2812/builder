import type { AnswerInsight } from "../../../lib/answerInsight";

/** 答复洞察条 — groundedness / RAG / 耗时 */
export function AnswerInsightBar({
  insight,
  compact = false,
  onOpenSources,
}: {
  insight: AnswerInsight;
  compact?: boolean;
  onOpenSources?: () => void;
}) {
  const pct = insight.groundedness;

  if (compact) {
    const inner = (
      <>
        <span className="ua-answer-insight-compact-main">
          依据 {pct}%
          {insight.hitCount > 0 && ` · 引用 ${insight.hitCount} 段`}
          {insight.ms > 0 && ` · ${insight.ms}ms`}
        </span>
        {insight.tags.length > 0 && (
          <span className="ua-answer-insight-compact-tags">
            {insight.tags.slice(0, 2).map((t) => (
              <em key={t}>{t}</em>
            ))}
          </span>
        )}
        {onOpenSources && insight.hitCount > 0 && <span className="ua-answer-insight-link">查看来源</span>}
      </>
    );
    if (onOpenSources) {
      return (
        <button
          type="button"
          className="ua-answer-insight-compact ua-answer-insight-compact-btn"
          aria-label={`依据充分度 ${pct}%，查看来源`}
          onClick={onOpenSources}
        >
          {inner}
        </button>
      );
    }
    return (
      <div className="ua-answer-insight-compact" aria-label={`依据充分度 ${pct}%`}>
        {inner}
      </div>
    );
  }

  const ring = 2 * Math.PI * 18;
  const dash = (pct / 100) * ring;

  return (
    <div className="ua-answer-insight">
      <div className="ua-answer-insight-ring" aria-label={`依据充分度 ${pct}%`}>
        <svg viewBox="0 0 44 44" aria-hidden>
          <circle cx="22" cy="22" r="18" fill="none" stroke="#e2e8f0" strokeWidth="4" />
          <circle
            cx="22"
            cy="22"
            r="18"
            fill="none"
            stroke="url(#ua-answer-insight-grad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${ring}`}
            transform="rotate(-90 22 22)"
          />
          <defs>
            <linearGradient id="ua-answer-insight-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#14b8a6" />
            </linearGradient>
          </defs>
        </svg>
        <strong>{pct}%</strong>
        <em>依据充分</em>
      </div>

      <div className="ua-answer-insight-copy">
        <span className="ua-answer-insight-badge">有依据的回答</span>
        <p>
          {insight.hitCount > 0
            ? `引用了 ${insight.hitCount} 段知识库内容 · 匹配度 ${Math.round(insight.avgRelevance * 100)}%`
            : "本轮主要基于通用推理组织答复，建议补充知识库"}
          {insight.ms > 0 && ` · ${insight.ms}ms`}
        </p>
        <ul className="ua-answer-insight-tags">
          {insight.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
