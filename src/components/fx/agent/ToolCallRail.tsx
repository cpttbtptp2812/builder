import type { OwnToolChip } from "../../../lib/ownagentSessions";

/** 紧凑 Tool Call 时间线 — 岗位要求的 tool calling 可视化 */
export function ToolCallRail({
  tools,
  live = false,
}: {
  tools: OwnToolChip[];
  live?: boolean;
}) {
  if (!tools.length) return null;

  return (
    <div className={`ua-tool-rail${live ? " live" : ""}`} role="list" aria-label="工具调用">
      {tools.map((t) => (
        <div
          key={t.id}
          className={`ua-tool-rail-item ${t.state}${live && t.state === "loading" ? " pulse" : ""}`}
          role="listitem"
          title={t.preview ?? t.name}
        >
          <span className="ua-tool-rail-icon" aria-hidden>
            {t.state === "loading" ? "⚙" : t.state === "error" ? "!" : "✓"}
          </span>
          <span className="ua-tool-rail-name">{t.name.replace(/_/g, " ")}</span>
          {t.ms != null && t.state !== "loading" && (
            <span className="ua-tool-rail-ms">{t.ms}ms</span>
          )}
        </div>
      ))}
    </div>
  );
}
