import type { AnswerInsight } from "../../../lib/answerInsight";

/** 答复洞察条 —  groundedness / RAG / 耗时，客户向高端指标 */
export function AnswerInsightBar({ insight }: { insight: AnswerInsight }) {
  const pct = insight.groundedness;
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
        <span className="ua-answer-insight-badge">Grounded Answer</span>
        <p>
          {insight.hitCount > 0
            ? `基于 ${insight.hitCount} 段知识库检索 · 平均相关度 ${Math.round(insight.avgRelevance * 100)}%`
            : "本轮以路由与工具结果组织答复"}
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
