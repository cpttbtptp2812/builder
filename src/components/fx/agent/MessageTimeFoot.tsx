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
  onOpenTrace,
  onOpenContextMemory,
  onOpenMcpSandbox,
}: {
  message: OwnChatMessage;
  hubMode?: boolean;
  onOpenTrace?: () => void;
  onOpenContextMemory?: (stats: { promptTokens: number; completionTokens: number; totalTokens: number; costYuan?: number }) => void;
  onOpenMcpSandbox?: () => void;
}) {
  const ts = message.createdAt;
  const label = formatMsgTime(ts);
  if (!label) return null;

  const tags: string[] = [];
  let estTokens = 1840;
  let estCost = "¥0.003";

  if (message.role === "assistant") {
    const textLen = (message.content?.length || 0) + (message.reasoning?.length || 0);
    const toolsCount = message.tools?.length || (message.productRun ? 3 : 2);
    estTokens = message.tokenUsage?.totalTokens ?? Math.round(textLen * 1.35 + toolsCount * 220 + 480);
    estCost = message.tokenUsage?.costYuan != null 
      ? `¥${message.tokenUsage.costYuan.toFixed(3)}` 
      : `¥${((estTokens / 1000) * 0.0018).toFixed(3)}`;

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
            {message.role === "assistant" && (
              <button
                type="button"
                className="ua-msg-foot-tag is-token-cost"
                onClick={() => {
                  if (onOpenContextMemory) {
                    onOpenContextMemory({
                      promptTokens: message.tokenUsage?.promptTokens ?? Math.round(estTokens * 0.6),
                      completionTokens: message.tokenUsage?.completionTokens ?? Math.round(estTokens * 0.4),
                      totalTokens: estTokens,
                      costYuan: message.tokenUsage?.costYuan ?? ((estTokens / 1000) * 0.0018),
                    });
                  } else {
                    onOpenTrace?.();
                  }
                }}
                title={`本次交互消耗 Token: ${estTokens.toLocaleString()} | 估算费用: ${estCost} (点击查看上下文工程与内存预算透视)`}
              >
                <span className="ua-tag-symbol">🪙</span>
                <span>{estTokens.toLocaleString()} tok</span>
                <span className="ua-tag-cost">{estCost}</span>
              </button>
            )}
            {message.role === "assistant" && onOpenMcpSandbox && (
              <button
                type="button"
                className="ua-msg-foot-tag is-trace-btn"
                onClick={onOpenMcpSandbox}
                title="打开 MCP 协议工具沙箱调试控制台 (JSON-RPC 2.0)"
              >
                <span className="ua-tag-symbol">🛠️</span>
                <span>MCP 沙箱</span>
              </button>
            )}
            {message.role === "assistant" && onOpenTrace && (
              <button
                type="button"
                className="ua-msg-foot-tag is-trace-btn"
                onClick={onOpenTrace}
                title="打开 Agent 链路追踪与执行瀑布图 (X-Ray)"
              >
                <span className="ua-tag-symbol">🔬</span>
                <span>链路追踪</span>
              </button>
            )}
          </div>
        ) : message.role === "assistant" && onOpenTrace ? (
          <div className="ua-msg-foot-tags">
            <button
              type="button"
              className="ua-msg-foot-tag is-trace-btn"
              onClick={onOpenTrace}
              title="打开 Agent 链路追踪与执行瀑布图 (X-Ray)"
            >
              <span className="ua-tag-symbol">🔬</span>
              <span>链路追踪</span>
            </button>
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
