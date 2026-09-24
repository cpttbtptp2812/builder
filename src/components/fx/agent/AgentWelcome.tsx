import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { listKnowledgePrompts, listKnowledgeDocs, type KnowledgeDoc } from "../../../lib/ownKnowledge";
import { listPlaza } from "../../../lib/plazaFeed";

/* ════════════════════════════════════════════════════════════
   AgentWelcome — 超越一问一答的智能首页
   
   融合 5 种创新交互:
   1. 场景卡片 — 不用想问什么，选场景即可
   2. AI 反向提问 — 选场景后 AI 引导，逐步缩小范围
   3. 知识信息流 — "大家都在问" + 即时答案预览
   4. 渐进式揭示 — 先看一句话摘要，想看再展开
   5. 可视化分类浏览 — 知识库按分类气泡展示
   ════════════════════════════════════════════════════════════ */

/* ── Scenario definitions ────────────────────────────── */
type Scenario = {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  color: string;
  guidedQuestions: { text: string; followUp: string[] }[];
};

const SCENARIOS: Scenario[] = [
  {
    id: "learn",
    emoji: "🆕",
    title: "了解产品",
    desc: "我是新客户，想快速了解",
    color: "#6366f1",
    guidedQuestions: [
      { text: "产品是做什么的？", followUp: ["有哪些核心功能", "和竞品有什么区别", "有成功案例吗"] },
      { text: "适合什么行业？", followUp: ["教育行业能用吗", "电商能用吗", "金融行业合规吗"] },
      { text: "怎么收费？", followUp: ["有免费版吗", "企业版多少钱", "可以先试用吗"] },
    ],
  },
  {
    id: "problem",
    emoji: "🔧",
    title: "解决问题",
    desc: "我遇到问题了，需要帮助",
    color: "#ef4444",
    guidedQuestions: [
      { text: "安装或配置遇到问题", followUp: ["安装失败怎么办", "配置文件在哪里", "环境要求是什么"] },
      { text: "功能不知道怎么用", followUp: ["怎么导入数据", "怎么导出报表", "怎么设置权限"] },
      { text: "系统报错了", followUp: ["常见错误码说明", "如何查看日志", "如何联系技术支持"] },
    ],
  },
  {
    id: "explore",
    emoji: "📚",
    title: "深度学习",
    desc: "我想深入了解使用方法",
    color: "#059669",
    guidedQuestions: [
      { text: "有新手教程吗？", followUp: ["从零开始教程", "最佳实践指南", "视频教程"] },
      { text: "高级功能有哪些？", followUp: ["自动化工作流", "API 集成", "自定义扩展"] },
      { text: "有技术文档吗？", followUp: ["API 文档", "架构说明", "部署文档"] },
    ],
  },
  {
    id: "freeask",
    emoji: "💬",
    title: "直接提问",
    desc: "我知道要问什么",
    color: "#0891b2",
    guidedQuestions: [],
  },
];

/* ── Knowledge categories ────────────────────────────── */
function buildCategories(docs: KnowledgeDoc[]): { name: string; count: number; color: string }[] {
  const colors = ["#6366f1", "#059669", "#d97706", "#0891b2", "#ec4899", "#8b5cf6"];
  return docs
    .filter(d => d.body.trim())
    .map((d, i) => ({ name: d.title, count: d.body.length, color: colors[i % colors.length] }));
}

/* ════════════════════════════════════════════════════════════ */
export function AgentWelcome({
  onPrompt,
  disabled,
  onOpenKnowledge,
  onOpenPlaza,
  kbRev = 0,
  hidePrompts = false,
}: {
  onPrompt: (text: string) => void;
  disabled?: boolean;
  onOpenKnowledge?: () => void;
  onOpenPlaza?: () => void;
  kbRev?: number;
  hidePrompts?: boolean;
}) {
  const prompts = useMemo(() => listKnowledgePrompts(4), [kbRev]);
  const docs = useMemo(() => listKnowledgeDocs(), [kbRev]);
  const categories = useMemo(() => buildCategories(docs), [docs]);

  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [guidedStep, setGuidedStep] = useState(0);
  const [plazaTotal, setPlazaTotal] = useState(0);

  useEffect(() => {
    void listPlaza("", 1).then((d) => setPlazaTotal(d.total));
  }, [kbRev]);

  function selectScenario(s: Scenario) {
    if (s.id === "freeask") {
      // Focus the input — dispatch custom event
      window.dispatchEvent(new CustomEvent("ownagent:focus-input"));
      return;
    }
    setActiveScenario(s);
    setGuidedStep(0);
  }

  function selectGuidedQuestion(text: string) {
    onPrompt(text);
    setActiveScenario(null);
    setGuidedStep(0);
  }

  /* ── Guided Flow Panel ───────────────────────────────── */
  if (activeScenario) {
    const s = activeScenario;
    return (
      <div className="aw-root">
        <div className="aw-guided">
          {/* Back button */}
          <button type="button" className="aw-guided-back" onClick={() => setActiveScenario(null)}>
            ← 返回首页
          </button>

          {/* Header */}
          <div className="aw-guided-header" style={{ "--sc": s.color } as CSSProperties}>
            <span className="aw-guided-emoji">{s.emoji}</span>
            <div>
              <h2>{s.title}</h2>
              <p>请选择更具体的方向，我来帮你找答案</p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="aw-guided-steps">
            <div className={`aw-guided-dot${guidedStep >= 0 ? " active" : ""}`} style={{ background: s.color }}>1</div>
            <div className="aw-guided-line" />
            <div className={`aw-guided-dot${guidedStep >= 1 ? " active" : ""}`} style={{ background: guidedStep >= 1 ? s.color : "#e2e8f0" }}>2</div>
            <div className="aw-guided-line" />
            <div className={`aw-guided-dot${guidedStep >= 2 ? " active" : ""}`} style={{ background: guidedStep >= 2 ? s.color : "#e2e8f0" }}>3</div>
          </div>

          {/* Questions */}
          {guidedStep === 0 ? (
            <div className="aw-guided-options">
              <p className="aw-guided-label">你想了解哪方面？</p>
              {s.guidedQuestions.map((gq, i) => (
                <button
                  key={i}
                  type="button"
                  className="aw-guided-option"
                  style={{ "--sc": s.color } as CSSProperties}
                  onClick={() => setGuidedStep(1)}
                  onClickCapture={() => setGuidedStep(1)}
                  onMouseDown={() => {
                    // Store which option was selected
                    (window as unknown as Record<string, number>).__guidedIdx = i;
                  }}
                >
                  <span className="aw-guided-option-icon">
                    {["💡", "🎯", "💰"][i] || "📌"}
                  </span>
                  <span>{gq.text}</span>
                  <span className="aw-guided-option-arrow">→</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="aw-guided-options">
              <p className="aw-guided-label">具体想问什么？点击直接获取答案</p>
              {(() => {
                const idx = (window as unknown as Record<string, number>).__guidedIdx ?? 0;
                const gq = s.guidedQuestions[idx];
                if (!gq) return null;
                return (
                  <>
                    {/* The main question */}
                    <button
                      type="button"
                      className="aw-guided-option aw-guided-option--primary"
                      style={{ "--sc": s.color } as CSSProperties}
                      onClick={() => selectGuidedQuestion(gq.text)}
                      disabled={disabled}
                    >
                      <span className="aw-guided-option-icon">⭐</span>
                      <span>{gq.text}</span>
                      <span className="aw-guided-option-arrow">→</span>
                    </button>

                    {/* Follow-up suggestions */}
                    {gq.followUp.map((f, fi) => (
                      <button
                        key={fi}
                        type="button"
                        className="aw-guided-option"
                        style={{ "--sc": s.color } as CSSProperties}
                        onClick={() => selectGuidedQuestion(f)}
                        disabled={disabled}
                      >
                        <span className="aw-guided-option-icon">
                          {["💬", "📋", "🔍"][fi] || "💬"}
                        </span>
                        <span>{f}</span>
                        <span className="aw-guided-option-arrow">→</span>
                      </button>
                    ))}

                    <button
                      type="button"
                      className="aw-guided-back-sm"
                      onClick={() => setGuidedStep(0)}
                    >
                      ← 换个方向
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ── Main Welcome Screen ─────────────────────────────── */
  return (
    <div className="aw-root">

      {/* ── Greeting ── */}
      <div className="aw-greeting">
        <div className="aw-greeting-avatar">
          <div className="aw-avatar-ring" aria-hidden />
          <span>OA</span>
        </div>
        <div>
          <h2 className="aw-greeting-title">你好，有什么可以帮你？</h2>
          <p className="aw-greeting-sub">
            选择一个场景开始，或直接输入你的问题
            {docs.length > 0 && <span className="aw-greeting-badge">已加载 {docs.length} 篇知识</span>}
          </p>
        </div>
      </div>

      {/* ── Scenario Cards ── */}
      <div className="aw-scenarios">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="aw-scenario"
            style={{ "--sc": s.color } as CSSProperties}
            onClick={() => selectScenario(s)}
            disabled={disabled}
          >
            <span className="aw-scenario-emoji">{s.emoji}</span>
            <strong>{s.title}</strong>
            <span className="aw-scenario-desc">{s.desc}</span>
          </button>
        ))}
      </div>

      {/* ── Quick entry row ── */}
      {(onOpenPlaza || onOpenKnowledge) && (
        <div className="aw-quick-actions">
          {onOpenPlaza ? (
            <button type="button" className="aw-quick-action aw-quick-action--plaza" onClick={onOpenPlaza}>
              <span className="aw-quick-action-icon" aria-hidden>🌐</span>
              <span className="aw-quick-action-body">
                <strong>知识广场</strong>
                <em>{plazaTotal > 0 ? `${plazaTotal} 条共享问答，先搜再问` : "共享问答，先搜再问"}</em>
              </span>
              <span className="aw-quick-action-arrow" aria-hidden>→</span>
            </button>
          ) : null}
          {onOpenKnowledge ? (
            <button type="button" className="aw-quick-action" onClick={onOpenKnowledge}>
              <span className="aw-quick-action-icon" aria-hidden>📚</span>
              <span className="aw-quick-action-body">
                <strong>知识管理</strong>
                <em>{docs.length > 0 ? `已加载 ${docs.length} 篇资料` : "录入资料让 AI 更懂你"}</em>
              </span>
              <span className="aw-quick-action-arrow" aria-hidden>→</span>
            </button>
          ) : null}
        </div>
      )}

      {/* ── Knowledge Map (Category Bubbles) ── */}
      {categories.length > 0 && (
        <div className="aw-kmap">
          <h3 className="aw-kmap-title">📂 知识库概览</h3>
          <div className="aw-kmap-bubbles">
            {categories.map((cat, i) => (
              <button
                key={i}
                type="button"
                className="aw-kmap-bubble"
                style={{ "--bc": cat.color } as CSSProperties}
                onClick={() => onPrompt(`介绍一下${cat.name}`)}
                disabled={disabled}
              >
                <strong>{cat.name}</strong>
                <span>{cat.count} 字</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Suggested prompts ── */}
      {!hidePrompts && prompts.length > 0 && (
        <div className="aw-prompts">
          <span className="aw-prompts-label">试试这样问</span>
          <div className="aw-prompts-list">
            {prompts.map((p) => (
              <button
                key={`${p.docId}-${p.text}`}
                type="button"
                className="aw-prompt-chip"
                onClick={() => onPrompt(p.text)}
                disabled={disabled}
                title={p.hint}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {docs.length === 0 && (
        <div className="aw-empty">
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
            <rect x="6" y="8" width="28" height="4" rx="2" fill="#e2e8f0"/>
            <rect x="6" y="17" width="20" height="3" rx="1.5" fill="#f1f5f9"/>
            <rect x="6" y="24" width="24" height="3" rx="1.5" fill="#f1f5f9"/>
            <circle cx="30" cy="28" r="8" fill="#eef2ff" stroke="#818cf8" strokeWidth="1.5"/>
            <path d="M27.5 28h5M30 25.5v5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <p>知识库暂无内容，先录入资料让 AI 更懂你的业务</p>
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
