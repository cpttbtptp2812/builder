import type { AgentTurnTrace } from "../../../lib/agentRuntime";
import type { OwnChatMessage } from "../../../lib/ownagentSessions";
import { getMcpTool } from "../../../lib/mcpBridgeLab";
import { AgentLiveTrace } from "../AgentLiveTrace";

const OUTCOME_ZH: Record<string, string> = {
  GROUNDED: "有出处",
  POLICY_CONFLICT: "冲突熔断",
  NEEDS_HITL: "需人工",
  COMMITTED: "已提交",
  REFUSED: "已拒绝",
};

function labelOf(name: string) {
  return getMcpTool(name)?.labelZh ?? name;
}

/** 右侧洞察栏 — 只展示客户需要的本轮结果 */
export function InsightRail({
  traces,
  running,
  iteration,
  toolCount,
  modeHint,
  messages,
  onExport,
  onClose,
}: {
  traces: AgentTurnTrace[];
  running: boolean;
  iteration: number;
  toolCount: number;
  modeHint: string;
  messages: OwnChatMessage[];
  onExport: () => void;
  onClose: () => void;
}) {
  const lastAsst = [...messages].reverse().find((m) => m.role === "assistant");
  const tools = lastAsst?.tools ?? [];
  const ws = lastAsst?.workingSet;
  const trust = lastAsst?.policyTrust;
  const multi = lastAsst?.multiAgent ?? [];
  const hasLoop = traces.length > 0 || running || tools.length > 0;

  return (
    <aside className="ua-side ua-insight" aria-label="运行洞察">
      <header>
        <div>
          <strong>洞察</strong>
          <em>{running ? "实时" : "本轮"}</em>
        </div>
        <button type="button" onClick={onExport} title="导出会话">
          导出
        </button>
        <button type="button" className="ua-insight-close" onClick={onClose} title="收起">
          ›
        </button>
      </header>

      <section className="ua-insight-pulse">
        <div>
          <em>模式</em>
          <strong>{modeHint}</strong>
        </div>
        <div>
          <em>调用</em>
          <strong>{toolCount}</strong>
        </div>
        <div>
          <em>状态</em>
          <strong className={running ? "run" : ""}>{running ? "推理中" : "待命"}</strong>
        </div>
      </section>

      {multi.length > 0 && (
        <section className="ua-insight-sec">
          <header>多代理</header>
          <ul className="ua-insight-ma">
            {multi.map((s) => (
              <li key={s.id} className={s.agentId}>
                <strong>{s.agentLabel}</strong>
                <span>{s.ms}ms</span>
                <em>{s.phase}</em>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ws && (
        <section className="ua-insight-sec">
          <header>工作集</header>
          <div className="ua-insight-ws">
            <strong>
              {ws.usedTokens} / {ws.budgetTokens}
            </strong>
            <em>{ws.skillHint ?? "context"}</em>
            <div className="ua-insight-bar">
              <i
                style={{
                  width: `${Math.min(100, Math.round((ws.usedTokens / Math.max(1, ws.budgetTokens)) * 100))}%`,
                }}
              />
            </div>
          </div>
        </section>
      )}

      {trust && (
        <section className="ua-insight-sec">
          <header>策略信任</header>
          <div className={`ua-insight-trust ${trust.outcome.toLowerCase()}`}>
            <strong>{OUTCOME_ZH[trust.outcome] ?? trust.outcome}</strong>
            <span>{trust.cap}</span>
            <em>{trust.reason}</em>
          </div>
        </section>
      )}

      {hasLoop && (
        <section className="ua-insight-sec grow">
          <header>执行过程</header>
          <div className="ua-insight-trace">
            {traces.length > 0 || running ? (
              <AgentLiveTrace traces={traces} running={running} iteration={iteration} />
            ) : (
              <ol className="ua-insight-loop-fallback">
                {tools.map((t, i) => (
                  <li key={t.id} className={t.state}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <strong>{labelOf(t.name)}</strong>
                    <em>{t.state === "ok" ? "完成" : t.state === "fail" || t.state === "error" ? "失败" : t.state}</em>
                    {t.preview ? <p>{t.preview}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      )}
    </aside>
  );
}
