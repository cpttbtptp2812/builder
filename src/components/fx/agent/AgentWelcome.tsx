import { useMemo } from "react";
import { listKnowledgePrompts } from "../../../lib/ownKnowledge";

const CAPS = [
  {
    icon: "⚡",
    title: "Hybrid RAG",
    desc: "知识库向量检索，每条答复含引用溯源",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.07)",
  },
  {
    icon: "🧠",
    title: "Neural Trace",
    desc: "实时推理轨迹可视化，思考过程透明可审",
    color: "#0891b2",
    bg: "rgba(8,145,178,0.07)",
  },
  {
    icon: "🔗",
    title: "Citation Bridge",
    desc: "答复片段与原始文档双向跳转追踪",
    color: "#059669",
    bg: "rgba(5,150,105,0.07)",
  },
  {
    icon: "🤖",
    title: "Multi-Agent",
    desc: "复杂任务自动拆解，多子智能体协同完成",
    color: "#dc2626",
    bg: "rgba(220,38,38,0.07)",
  },
] as const;

/** 欢迎屏 — 高端产品版 */
export function AgentWelcome({
  onPrompt,
  disabled,
  onOpenKnowledge,
  kbRev = 0,
}: {
  onPrompt: (text: string) => void;
  disabled?: boolean;
  onOpenKnowledge?: () => void;
  kbRev?: number;
}) {
  const prompts = useMemo(() => listKnowledgePrompts(4), [kbRev]);

  return (
    <div className="ua-welcome-pro">
      {/* ── Hero ── */}
      <div className="ua-welcome-pro-hero">
        <div className="ua-welcome-pro-avatar">
          <div className="ua-welcome-pro-glow" aria-hidden />
          <span>OA</span>
        </div>
        <div className="ua-welcome-pro-copy">
          <h2 className="ua-welcome-pro-title">
            OwnAgent
            <span className="ua-welcome-pro-badge">Enterprise</span>
          </h2>
          <p className="ua-welcome-pro-desc">
            企业级 AI 问答助手 · 知识库检索 · 推理过程透明可审
          </p>
          <div className="ua-welcome-pro-tech">
            <span>Hybrid RAG</span>
            <span>Neural Trace</span>
            <span>Multi-Agent</span>
            <span>Citation Bridge</span>
          </div>
        </div>
      </div>

      {/* ── Capability Cards ── */}
      <div className="ua-welcome-pro-caps">
        {CAPS.map((c) => (
          <div
            key={c.title}
            className="ua-welcome-pro-cap"
            style={{ "--cap-color": c.color, "--cap-bg": c.bg } as React.CSSProperties}
          >
            <span className="ua-welcome-pro-cap-icon">{c.icon}</span>
            <strong>{c.title}</strong>
            <p>{c.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Prompts ── */}
      {prompts.length > 0 && (
        <div className="ua-welcome-pro-prompts-wrap">
          <div className="ua-welcome-pro-divider">
            <span>从这里开始</span>
          </div>
          <div className="ua-welcome-pro-prompts">
            {prompts.map((p, i) => (
              <button
                key={p.docId}
                type="button"
                disabled={disabled}
                className="ua-welcome-pro-prompt"
                style={{ animationDelay: `${i * 0.07}s` }}
                onClick={() => onPrompt(p.text)}
              >
                <span className="ua-welcome-pro-prompt-num">{i + 1}</span>
                <span className="ua-welcome-pro-prompt-body">
                  <em>{p.hint}</em>
                  <strong>{p.text}</strong>
                </span>
                <span className="ua-welcome-pro-prompt-go">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {prompts.length === 0 && (
        <div className="ua-welcome-pro-empty">
          <span>📂</span>
          <p>知识库还没有可问答的条目</p>
          {onOpenKnowledge && (
            <button type="button" onClick={onOpenKnowledge}>
              立即配置知识库
            </button>
          )}
        </div>
      )}

      {prompts.length > 0 && onOpenKnowledge && (
        <button type="button" className="ua-welcome-pro-kb" disabled={disabled} onClick={onOpenKnowledge}>
          管理知识库
        </button>
      )}
    </div>
  );
}
