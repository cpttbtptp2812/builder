/** 多 Agent 编排 — 对话内展示 Planner / Executor / Reviewer 真实步骤 */

import { getAgentMeta, type MultiAgentStep } from "../../../lib/multiAgentRuntime";

export function MultiAgentTraceCard({ steps }: { steps: MultiAgentStep[] }) {
  if (!steps.length) return null;

  return (
    <div className="multi-agent-trace-card">
      <header>
        <strong>多 Agent 编排</strong>
        <span>{steps.length} 步 · Planner → Executor → Reviewer</span>
      </header>
      <ol>
        {steps.map((s) => {
          const meta = getAgentMeta(s.agentId);
          return (
            <li key={s.id}>
              <span className="ma-role" style={{ color: meta.color }}>
                {s.agentLabel}
              </span>
              <span className="ma-phase">{s.phase}</span>
              {s.toolCalls?.length ? (
                <ul className="ma-tools">
                  {s.toolCalls.map((tc, i) => (
                    <li key={`${s.id}-${i}`} className={tc.ok ? "ok" : "err"}>
                      {tc.tool} · {tc.preview ?? (tc.ok ? "完成" : "失败")} · {tc.ms}ms
                    </li>
                  ))}
                </ul>
              ) : null}
              {s.content.trim() && <p>{s.content.replace(/\s+/g, " ").slice(0, 160)}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
