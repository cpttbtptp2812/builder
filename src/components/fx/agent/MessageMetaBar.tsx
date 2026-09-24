import type { AnswerInsight } from "../../../lib/answerInsight";
import type { OwnChatMessage, OwnToolChip } from "../../../lib/ownagentSessions";
import { ToolCallRail } from "./ToolCallRail";

const MODE_LABEL: Record<NonNullable<OwnChatMessage["mode"]>, string> = {
  guest: "Guest",
  llm: "LLM",
  multi: "多 Agent",
  eval: "评测",
  sheet: "Sheet",
  plaza: "广场",
};

/** 回答下方元信息 — 预留高度，流式结束后淡入，避免布局闪动 */
export function MessageMetaBar({
  insight,
  tools,
  message,
  live = false,
  reserve = false,
  onOpenSources,
  onReplay,
}: {
  insight?: AnswerInsight;
  tools?: OwnToolChip[];
  message?: OwnChatMessage;
  live?: boolean;
  reserve?: boolean;
  onOpenSources?: () => void;
  onReplay?: () => void;
}) {
  const toolList = tools ?? [];
  const hasTools = toolList.length > 0;
  const hasInsight = Boolean(insight);
  const hasMetrics = Boolean(message?.ms || message?.mode || message?.runtime);

  if (reserve && !hasTools && !hasInsight && !hasMetrics) {
    return <div className="ua-answer-meta ua-answer-meta--reserve" aria-hidden />;
  }

  if (!hasTools && !hasInsight && !hasMetrics) return null;

  const pct = insight?.groundedness ?? 0;
  const showSources =
    onOpenSources && ((insight?.hitCount ?? 0) > 0 || (message?.flowJournal?.length ?? 0) > 0);

  return (
    <div className={`ua-answer-meta${live ? " live" : " done"}${reserve ? " reserve" : ""}`}>
      {hasTools && <ToolCallRail tools={tools!} live={live} />}
      {(hasInsight || hasMetrics) && (
        <div className="ua-answer-meta-line">
          {hasInsight && (
            <>
              <span>依据 {pct}%</span>
              {(insight?.hitCount ?? 0) > 0 && <span>{insight!.hitCount} 段引用</span>}
            </>
          )}
          {message?.mode && message.mode !== "plaza" && (
            <span className="muted">{MODE_LABEL[message.mode]}</span>
          )}
          {typeof message?.ms === "number" && message.ms > 0 && (
            <span className="muted">{(message.ms / 1000).toFixed(1)}s</span>
          )}
          {showSources && (
            <button type="button" className="ua-answer-meta-link" onClick={onOpenSources}>
              查看来源
            </button>
          )}
          {onReplay && (message?.flowJournal?.length ?? 0) > 0 && (
            <button type="button" className="ua-answer-meta-link ua-answer-meta-replay" onClick={onReplay}>
              回放决策
            </button>
          )}
        </div>
      )}
    </div>
  );
}
