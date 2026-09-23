import type { CSSProperties } from "react";
import { useMemo } from "react";
import { listKnowledgePrompts, listKnowledgeDocs } from "../../../lib/ownKnowledge";

/* ── Capability definitions ──────────────────────────── */
const CAPS = [
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M6 9l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Hybrid RAG",
    desc: "混合向量检索，每条答复自动关联知识库原文",
    color: "#6366f1",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M3 9h2l2-5 3 10 2-7 1 2h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "Neural Trace",
    desc: "推理步骤实时可视，AI 思考过程透明可审",
    color: "#0891b2",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M9 2l-6 3v5c0 3.5 3 6.5 6 7 3-0.5 6-3.5 6-7V5L9 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <path d="M6.5 9l2 2 3.5-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    title: "知识边界感知",
    desc: "自动检测知识缺口并告警，杜绝过度自信",
    color: "#d97706",
  },
  {
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
        <path d="M8 5h2M5 8v2M13 8v2M8 13h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
    title: "Multi-Agent",
    desc: "复杂任务自动拆解，多子智能体协同执行",
    color: "#059669",
  },
] as const;

/** 欢迎屏 — 企业级高端版 */
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
  const docs    = useMemo(() => listKnowledgeDocs(),     [kbRev]);

  return (
    <div className="aw-root">

      {/* ── Hero ─────────────────────────────────────────── */}
      <div className="aw-hero">
        {/* Avatar */}
        <div className="aw-avatar">
          <div className="aw-avatar-ring" aria-hidden />
          <div className="aw-avatar-ring aw-avatar-ring--2" aria-hidden />
          <span>OA</span>
        </div>

        {/* Copy */}
        <div className="aw-hero-copy">
          <div className="aw-hero-status">
            <span className="aw-status-dot" />
            <span>AI 已就绪</span>
            <span className="aw-status-sep">·</span>
            <span>知识库已加载</span>
            {docs.length > 0 && (
              <>
                <span className="aw-status-sep">·</span>
                <span>{docs.length} 个文档</span>
              </>
            )}
          </div>
          <h2 className="aw-hero-title">
            OwnAgent
            <span className="aw-hero-badge">Enterprise</span>
          </h2>
          <p className="aw-hero-desc">
            基于企业私有知识库的 AI 问答助手<br/>
            每条回答均可溯源，推理过程完全透明
          </p>
        </div>
      </div>

      {/* ── Capabilities ─────────────────────────────────── */}
      <div className="aw-caps">
        {CAPS.map((c) => (
          <div key={c.title} className="aw-cap" style={{ "--c": c.color } as CSSProperties}>
            <span className="aw-cap-icon">{c.icon}</span>
            <div className="aw-cap-body">
              <strong>{c.title}</strong>
              <p>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Quick Start ───────────────────────────────────── */}
      {prompts.length > 0 ? (
        <div className="aw-prompts-wrap">
          <div className="aw-prompts-header">
            <span className="aw-prompts-title">从这里开始</span>
            <span className="aw-prompts-hint">点击即可提问</span>
          </div>
          <div className="aw-prompts">
            {prompts.map((p, i) => (
              <button
                key={p.docId}
                type="button"
                disabled={disabled}
                className="aw-prompt"
                style={{ animationDelay: `${i * 0.06}s` }}
                onClick={() => onPrompt(p.text)}
              >
                <span className="aw-prompt-num">{i + 1}</span>
                <span className="aw-prompt-body">
                  {p.hint && <em>{p.hint}</em>}
                  <strong>{p.text}</strong>
                </span>
                <span className="aw-prompt-arrow">→</span>
              </button>
            ))}
          </div>

          {onOpenKnowledge && (
            <button type="button" className="aw-kb-btn" disabled={disabled} onClick={onOpenKnowledge}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <ellipse cx="6.5" cy="3.5" rx="4" ry="1.6" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2.5 3.5v3c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6v-3" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M2.5 6.5v3c0 .9 1.8 1.6 4 1.6s4-.7 4-1.6v-3" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              管理知识库
            </button>
          )}
        </div>
      ) : (
        <div className="aw-empty">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="6" y="8" width="28" height="4" rx="2" fill="#e2e8f0"/>
            <rect x="6" y="17" width="20" height="3" rx="1.5" fill="#f1f5f9"/>
            <rect x="6" y="24" width="24" height="3" rx="1.5" fill="#f1f5f9"/>
            <circle cx="30" cy="28" r="8" fill="#eef2ff" stroke="#818cf8" strokeWidth="1.5"/>
            <path d="M27.5 28h5M30 25.5v5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p>知识库暂无内容</p>
          {onOpenKnowledge && (
            <button type="button" className="aw-kb-setup-btn" onClick={onOpenKnowledge}>
              立即配置知识库
            </button>
          )}
        </div>
      )}
    </div>
  );
}
