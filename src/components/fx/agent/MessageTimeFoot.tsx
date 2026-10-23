import { formatMsgTime, formatMsgTimeFull } from "../../../lib/formatMsgTime";
import type { OwnChatMessage } from "../../../lib/ownagentSessions";

const MODE_LABEL: Record<NonNullable<OwnChatMessage["mode"]>, string> = {
  guest: "内置 Agent",
  llm: "LLM",
  plaza: "广场",
};

export function MessageTimeFoot({
  message,
  hubMode,
}: {
  message: OwnChatMessage;
  hubMode?: boolean;
}) {
  const ts = message.createdAt;
  const label = formatMsgTime(ts);
  if (!label) return null;

  const tags: string[] = [];
  if (message.role === "assistant") {
    if (hubMode && message.showcaseFlow) {
      const si = message.showcaseFlow.stepIndex;
      const st = message.showcaseFlow.stepTotal;
      tags.push(st && si ? `流程 ${si}/${st}` : "流程");
    } else if (!hubMode && message.route?.skillName) {
      tags.push(message.route.skillName);
    } else if (hubMode && message.mode && MODE_LABEL[message.mode]) {
      tags.push(MODE_LABEL[message.mode]);
    }
    if (typeof message.ms === "number" && message.ms > 0) tags.push(`${(message.ms / 1000).toFixed(1)}s`);
    if (hubMode) {
      if (message.runtime === "server") tags.push("SQLite");
      else if (message.runtime === "local") tags.push("浏览器");
    }
  }

  return (
    <footer className={`ua-msg-foot is-${message.role}${hubMode ? " hub" : ""}`}>
      <div className="ua-msg-telemetry-cluster">
        {message.role === "assistant" && (
          <span className="ua-msg-telemetry-beacon" aria-hidden="true" />
        )}
        <time
          className="ua-msg-telemetry-time"
          dateTime={ts ? new Date(ts).toISOString() : undefined}
          title={formatMsgTimeFull(ts)}
        >
          {label}
        </time>
        {tags.length ? (
          <div className="ua-msg-foot-tags" aria-label="消息元信息">
            {tags.map((t) => {
              const isLatency = /^\d+(\.\d+)?s$/.test(t);
              const isFlow = t.startsWith("流程");
              return (
                <span
                  key={t}
                  className={`ua-msg-foot-tag${isLatency ? " is-latency" : isFlow ? " is-flow" : " is-skill"}`}
                >
                  {isLatency ? (
                    <>
                      <span className="ua-tag-symbol">⚡</span>
                      <span>{t}</span>
                    </>
                  ) : isFlow ? (
                    <>
                      <span className="ua-tag-symbol">⎇</span>
                      <span>{t}</span>
                    </>
                  ) : (
                    <>
                      <span className="ua-tag-symbol">◈</span>
                      <span>{t}</span>
                    </>
                  )}
                </span>
              );
            })}
          </div>
        ) : null}
      </div>
    </footer>
  );
}

export function ThreadDateDivider({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div className="ua-thread-date" role="separator" aria-label={label}>
      <span className="ua-thread-date-line" />
      <span className="ua-thread-date-text">
        <span className="ua-thread-date-prefix">// TIMELINE //</span>
        <span>{label}</span>
      </span>
      <span className="ua-thread-date-line" />
    </div>
  );
}
