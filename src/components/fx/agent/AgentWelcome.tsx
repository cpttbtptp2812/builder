import { AGENT_QUICK_PROMPTS } from "../../../lib/agentRuntime";

/** 空状态欢迎 — 对齐 tianyangAgent AgentWelcome */
export function AgentWelcome({ onPrompt, disabled }: { onPrompt: (text: string) => void; disabled?: boolean }) {
  return (
    <div className="agent-welcome">
      <div className="agent-welcome-avatar" aria-hidden>
        UA
      </div>
      <h3 className="agent-welcome-title">OwnAgent</h3>
      <p className="agent-welcome-desc">
        说一句话。先看它选了哪个技能、调了哪个工具，再看它怎么答。不开模型也能跑。
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
