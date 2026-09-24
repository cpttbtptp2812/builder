import { useMemo } from "react";
import type { OwnChatMessage } from "../../../lib/ownagentSessions";

type Stats = {
  turns: number;
  avgMs: number | null;
  topics: string[];
  groundedness: number | null;
};

function computeStats(messages: OwnChatMessage[]): Stats {
  const assistant = messages.filter((m) => m.role === "assistant");
  const turns = assistant.length;

  const msTimes = assistant.map((m) => m.ms).filter((v): v is number => typeof v === "number" && v > 0);
  const avgMs = msTimes.length ? Math.round(msTimes.reduce((a, b) => a + b, 0) / msTimes.length) : null;

  const topics = new Set<string>();
  for (const m of assistant) {
    if (m.answerInsight?.tags) {
      m.answerInsight.tags.forEach((t) => topics.add(t));
    }
  }

  const groundnessValues = assistant
    .map((m) => m.answerInsight?.groundedness)
    .filter((v): v is number => typeof v === "number");
  const groundedness = groundnessValues.length
    ? Math.round(groundnessValues.reduce((a, b) => a + b, 0) / groundnessValues.length)
    : null;

  return { turns, avgMs, topics: [...topics].slice(0, 3), groundedness };
}

/** 顶栏会话统计胶囊 */
export function SessionStats({
  messages,
  hideGroundedness = false,
}: {
  messages: OwnChatMessage[];
  hideGroundedness?: boolean;
}) {
  const stats = useMemo(() => computeStats(messages), [messages]);

  if (stats.turns === 0) return null;

  return (
    <div className="ua-session-stats">
      <span className="ua-session-stat">
        <span className="ua-session-stat-val">{stats.turns}</span>
        <span className="ua-session-stat-label">轮对话</span>
      </span>
      {stats.avgMs != null && (
        <span className="ua-session-stat">
          <span className="ua-session-stat-val">{(stats.avgMs / 1000).toFixed(1)}s</span>
          <span className="ua-session-stat-label">平均响应</span>
        </span>
      )}
      {!hideGroundedness && stats.groundedness != null && (
        <span className="ua-session-stat highlight">
          <span className="ua-session-stat-val">{stats.groundedness}%</span>
          <span className="ua-session-stat-label">知识依据</span>
        </span>
      )}
    </div>
  );
}
