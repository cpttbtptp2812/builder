/**
 * GapDetectionCard — 知识边界感知卡
 *
 * 核心卖点：AI 主动感知并提示自己的知识边界，
 * 区别于普通 chatbot 在知识不足时仍自信作答。
 */
import type { AnswerInsight } from "../../../lib/answerInsight";
import type { FlowJournalNode } from "../../../lib/turnFlowJournal";

type Props = {
  insight: AnswerInsight;
  flowJournal?: FlowJournalNode[];
  onFillGap?: () => void;   // 跳转到知识库编辑
};

function extractMissed(flowJournal: FlowJournalNode[]): string[] {
  const missed: string[] = [];
  for (const node of flowJournal) {
    // steps with zero hits despite having a query → true gaps
    const hasQuery = node.step && node.step.length > 2;
    const hits = (node.evidence ?? []).filter((e) => e.kind === "hit").length;
    if (hasQuery && hits === 0) missed.push(node.step!);
  }
  return missed.slice(0, 3);
}

function levelOf(g: number): "critical" | "warn" | "ok" {
  if (g < 45) return "critical";
  if (g < 65) return "warn";
  return "ok";
}

export function GapDetectionCard({ insight, flowJournal = [], onFillGap }: Props) {
  const level = levelOf(insight.groundedness);
  if (level === "ok") return null;

  const missed = extractMissed(flowJournal);
  const isCritical = level === "critical";

  return (
    <div className={`ua-gap-card ua-gap-card--${level}`} role="alert">
      {/* Header */}
      <div className="ua-gap-head">
        <span className="ua-gap-icon" aria-hidden>
          {isCritical ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1.5L13 12.5H1L7 1.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M7 5.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="10.5" r="0.8" fill="currentColor"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M7 4.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="7" cy="9.5" r="0.8" fill="currentColor"/>
            </svg>
          )}
        </span>
        <strong className="ua-gap-title">
          {isCritical ? "知识缺口 — 该问题超出知识库范围" : "知识边界提示 — 覆盖率较低"}
        </strong>
        <span className="ua-gap-pct">{insight.groundedness}% 覆盖</span>
      </div>

      {/* Body */}
      <div className="ua-gap-body">
        <p className="ua-gap-desc">
          {isCritical
            ? "AI 在知识库中未找到充足依据，本回答主要基于通用推理，建议补充相关文档后重新提问。"
            : "AI 找到了部分相关内容，但覆盖率不足。以下方面可能存在信息缺口："}
        </p>

        {missed.length > 0 && (
          <ul className="ua-gap-missed">
            {missed.map((s, i) => (
              <li key={i}>
                <span className="ua-gap-missed-dot" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Metrics row */}
        <div className="ua-gap-metrics">
          <div className="ua-gap-metric">
            <span className="ua-gap-metric-val">{insight.hitCount}</span>
            <span className="ua-gap-metric-label">知识片段</span>
          </div>
          <div className="ua-gap-metric">
            <span className="ua-gap-metric-val">{Math.round(insight.avgRelevance * 100)}%</span>
            <span className="ua-gap-metric-label">平均相关度</span>
          </div>
          <div className="ua-gap-metric">
            <span className="ua-gap-metric-val">{insight.groundedness}%</span>
            <span className="ua-gap-metric-label">知识依据率</span>
          </div>
        </div>
      </div>

      {/* Action */}
      {onFillGap && (
        <button type="button" className="ua-gap-action" onClick={onFillGap}>
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M5.5 1v9M1 5.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          补充知识库，提升覆盖率
        </button>
      )}
    </div>
  );
}
