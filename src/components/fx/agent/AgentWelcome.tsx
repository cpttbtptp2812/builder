import { AGENT_QUICK_PROMPTS } from "../../../lib/agentRuntime";

/** 空状态欢迎 — 对齐 tianyangAgent AgentWelcome */
export function AgentWelcome({ onPrompt, disabled }: { onPrompt: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="agent-welcome">
      <div className="agent-welcome-avatar" aria-hidden>
        UA
      </div>
      <h3 className="agent-welcome-title">UniAgent</h3>
      <p className="agent-welcome-desc">
        内置 Guest Agent · MCP 真实执行。无需 API Key，路由 Skill 后调用 http_probe / knowledge_search / browser_snapshot。
      </p>
      <div className="agent-welcome-divider">
        <span>开始对话</span>
      </div>
      <div className="agent-welcome-prompts">
        {AGENT_QUICK_PROMPTS.map((p) => (
          <button key={p.label} type="button" disabled={disabled} onClick={() => onPrompt(p.text)}>
            <span>{p.label}</span>
            <em>{p.text.slice(0, 28)}…</em>
            <i aria-hidden>→</i>
          </button>
        ))}
      </div>
    </div>
  );
}
