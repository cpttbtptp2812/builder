import { useCallback, useEffect, useState } from "react";
import { apiUrl, probeBackendOnce } from "../../../lib/apiClient";
import { getDbSkills, type AgentSkill } from "../../../lib/workflowBackendClient";

export function ProductSkillHome({
  onRun,
  disabled,
  trial = false,
}: {
  onRun: (query: string) => void;
  disabled?: boolean;
  /** 客户自己试：点一下只把句子放进输入框 */
  trial?: boolean;
}) {
  const [ready, setReady] = useState<boolean | null>(null);
  const [skills, setSkills] = useState<AgentSkill[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState<boolean>(true);
  const healthUrl = apiUrl("/health");

  const refresh = useCallback(() => {
    setReady(null);
    void probeBackendOnce().then((h) => setReady(Boolean(h?.ok)));
    setIsLoadingSkills(true);
    void getDbSkills().then((list) => {
      setSkills(list);
      setIsLoadingSkills(false);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const blocked = Boolean(disabled);


  return (
    <div className="oa-empty-home">
      {/* Enterprise Cluster Status Header Pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          margin: "0 auto 1.25rem",
          padding: "5px 14px",
          borderRadius: "9999px",
          background: ready !== false ? "rgba(16, 185, 129, 0.08)" : "rgba(245, 158, 11, 0.08)",
          border: ready !== false ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(245, 158, 11, 0.25)",
          fontSize: "0.74rem",
          color: ready !== false ? "#059669" : "#d97706",
          fontWeight: 650,
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: ready !== false ? "#10b981" : "#f59e0b",
            boxShadow: ready !== false ? "0 0 8px #10b981" : "none",
          }}
        />
        <span>
          {ready !== false
            ? "Java 21 Spring Boot 核心调度引擎已就绪 · 企业数据库持久化在线 · 5 阶闭环在席"
            : `核心流水线调度中枢同步中 (${healthUrl})`}
        </span>
      </div>

      {/* Cyber Hero Branding */}
      <div className="oa-home-hero">
        <div className="oa-hero-badge-wrap">
          <div className="oa-hero-glow-ring" />
          <div className="oa-hero-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="oa-hero-status-pill">
            <span className="oa-hero-status-dot" />
            <span>AGENT DISPATCH READY // 智能流水线调度中枢</span>
          </div>
        </div>
        <h1 className="oa-home-title">
          您好，我是您的 <span className="oa-home-title-accent">自主业务智能助理</span>
        </h1>
        <p className="oa-home-subtitle">
          选择预设企业级流水线快速办理，或在底部输入框输入任意业务诉求
        </p>
      </div>

      {/* Sci-Fi Scenario Command Cards from Database */}
      <div className="oa-home-grid" role="region" aria-label="快捷业务指令">
        {isLoadingSkills ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem", color: "#64748b" }}>
            正在从 Java 21 企业数据库加载高危与自动化技能矩阵...
          </div>
        ) : skills.map((item) => {
          let tags: string[] = [];
          try {
            tags = typeof item.tagsJson === "string" ? JSON.parse(item.tagsJson.replace(/'/g, '"')) : [];
          } catch {
            tags = [item.category];
          }

          return (
            <button
              key={item.id}
              type="button"
              className={`oa-home-card oa-home-card--${item.badgeType || "finance"}`}
              aria-label={item.name}
              disabled={blocked}
              onClick={() => onRun(item.suggestedQuery || item.name)}
            >
              <div className="oa-home-card-header">
                <div className="oa-card-icon-wrap">
                  {item.badgeType === "finance" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M4 4v16a2 2 0 002 2h12a2 2 0 002-2V4" strokeLinecap="round"/>
                      <path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round"/>
                      <circle cx="12" cy="5" r="2"/>
                    </svg>
                  )}
                  {item.badgeType === "ticket" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {item.badgeType === "schedule" && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <rect x="3" y="4" width="18" height="18" rx="3" strokeLinecap="round"/>
                      <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/>
                      <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  )}
                  {(item.badgeType === "secops" || !item.badgeType) && (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span className="oa-card-badge">{item.badge}</span>
              </div>

              <div className="oa-home-card-body">
                <h3 className="oa-card-title">{item.title}</h3>
                <p className="oa-card-desc">{item.description}</p>
              </div>

              <div className="oa-card-tags">
                {tags.map((tag) => (
                  <span key={tag} className="oa-card-tag">{tag}</span>
                ))}
              </div>

              <div className="oa-card-footer">
                <span className="oa-card-query-label">指令:</span>
                <span className="oa-card-query-text">{item.suggestedQuery}</span>
                <span className="oa-card-go">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Cyber Feature Highlights */}
      <div className="oa-home-features-bar">
        <div className="oa-home-feat-item">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 1.5l5.5 3v5c0 3.5-2.5 6-5.5 6.5-3-0.5-5.5-3-5.5-6.5v-5l5.5-3z" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>端侧沙盒隔离 · 零数据越界</span>
        </div>
        <div className="oa-home-feat-item">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" strokeLinecap="round"/>
          </svg>
          <span>实时工作底稿 · 双向溯源核验</span>
        </div>
        <div className="oa-home-feat-item">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M8 3v10M3 8h10" strokeLinecap="round"/>
          </svg>
          <span>双模推理引擎 · 支持本地 Ollama / DeepSeek</span>
        </div>
      </div>
    </div>
  );
}

