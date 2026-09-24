import type { OwnChatMessage } from "../../../lib/ownagentSessions";

const MODE_LABEL: Record<NonNullable<OwnChatMessage["mode"]>, string> = {
  guest: "Guest",
  llm: "LLM",
  multi: "多 Agent",
  eval: "评测",
  sheet: "Sheet",
  plaza: "广场",
};

/** 单轮运行指标 — 延迟 / 模式 / 工具数 / RAG 运行时 */
export function TurnMetricsBar({ message }: { message: OwnChatMessage }) {
  if (message.role !== "assistant") return null;

  const toolCount = message.tools?.length ?? 0;
  const hits =
    message.flowJournal?.flatMap((n) => n.evidence ?? []).filter((e) => e.kind === "hit").length ?? 0;
  const mode = message.mode ? MODE_LABEL[message.mode] : null;

  if (!message.ms && !toolCount && !hits && !mode && !message.runtime) return null;

  return (
    <div className="ua-turn-metrics" aria-label="本轮运行指标">
      {mode && <span className="ua-turn-metric">{mode}</span>}
      {message.runtime && (
        <span className="ua-turn-metric muted">{message.runtime === "server" ? "服务端" : "本地"}</span>
      )}
      {message.ragRuntime && (
        <span className="ua-turn-metric muted">RAG·{message.ragRuntime === "server" ? "服务端" : "本地"}</span>
      )}
      {typeof message.ms === "number" && message.ms > 0 && (
        <span className="ua-turn-metric">{message.ms}ms</span>
      )}
      {toolCount > 0 && <span className="ua-turn-metric">{toolCount} 次工具</span>}
      {hits > 0 && <span className="ua-turn-metric accent">{hits} 段检索</span>}
    </div>
  );
}
