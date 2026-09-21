import { useMemo } from "react";
import { listKnowledgePrompts } from "../../../lib/ownKnowledge";

/** 欢迎屏 — 对齐 tianyangAgent AgentWelcome */
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
    <div className="ua-welcome ua-welcome-tianyang">
      <div className="ua-welcome-inner">
        <div className="ua-welcome-hero">
          <div className="ua-welcome-avatar-wrap">
            <div className="ua-welcome-glow ua-welcome-glow-outer" aria-hidden />
            <div className="ua-welcome-glow ua-welcome-glow-inner" aria-hidden />
            <div className="ua-welcome-avatar" aria-hidden>
              OA
            </div>
          </div>
          <div className="ua-welcome-copy">
            <h2 className="ua-welcome-title">OwnAgent</h2>
            <p className="ua-welcome-desc">
              企业知识问答助手。下方示例均已在知识库配置正文，点击即可检索并生成带引用的答复。
            </p>
          </div>
        </div>

        {prompts.length > 0 && (
          <div className="ua-welcome-section">
            <div className="ua-welcome-divider">
              <i aria-hidden />
              <span>开始对话</span>
              <i aria-hidden />
            </div>
            <div className="ua-welcome-prompts">
              {prompts.map((p) => (
                <button
                  key={p.docId}
                  type="button"
                  disabled={disabled}
                  className="ua-welcome-prompt"
                  onClick={() => onPrompt(p.text)}
                >
                  <span className="ua-welcome-prompt-text">
                    <em>{p.hint}</em>
                    <strong>{p.text}</strong>
                  </span>
                  <span className="ua-welcome-prompt-go" aria-hidden>
                    →
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {prompts.length === 0 && (
          <p className="ua-welcome-empty">知识库还没有可问答的条目，请先配置正文与示例问句。</p>
        )}

        {onOpenKnowledge && (
          <button type="button" className="ua-welcome-kb" disabled={disabled} onClick={onOpenKnowledge}>
            管理知识库
          </button>
        )}
      </div>
    </div>
  );
}
