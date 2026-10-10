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
    if (message.showcaseFlow) {
      const si = message.showcaseFlow.stepIndex;
      const st = message.showcaseFlow.stepTotal;
      tags.push(st && si ? `流程 ${si}/${st}` : "流程");
    }
    else if (message.mode && MODE_LABEL[message.mode]) tags.push(MODE_LABEL[message.mode]);
    if (typeof message.ms === "number" && message.ms > 0) tags.push(`${message.ms}ms`);
    if (message.runtime === "server") tags.push("SQLite");
    else if (message.runtime === "local") tags.push("浏览器");
  }

  return (
    <footer className={`ua-msg-foot is-${message.role}${hubMode ? " hub" : ""}`}>
      <time dateTime={ts ? new Date(ts).toISOString() : undefined} title={formatMsgTimeFull(ts)}>
        {label}
      </time>
      {tags.length ? (
        <span className="ua-msg-foot-tags" aria-label="消息元信息">
          {tags.map((t) => (
            <span key={t} className="ua-msg-foot-tag">
              {t}
            </span>
          ))}
        </span>
      ) : null}
    </footer>
  );
}

export function ThreadDateDivider({ label }: { label: string }) {
  if (!label) return null;
  return (
    <div className="ua-thread-date" role="separator" aria-label={label}>
      <span>{label}</span>
    </div>
  );
}
