import { useCallback, useEffect, useState } from "react";
import { apiUrl, probeBackendOnce } from "../../../lib/apiClient";

type ScenarioSuggestion = {
  id: string;
  /** 客户入口的按钮名。流水按这个精确名字找，不要改成卡片里的长标题。 */
  name: string;
  badge: string;
  badgeType: "finance" | "ticket" | "schedule";
  title: string;
  desc: string;
  query: string;
  tags: string[];
};

const SCENARIOS: ScenarioSuggestion[] = [
  {
    id: "finance",
    name: "费用与对账",
    badge: "财务对账 · 自动核算",
    badgeType: "finance",
    title: "部门报销比对与发票核验",
    desc: "自动提取员工报销明细，交叉核对数电发票，精准高亮金额不符与缺漏项",
    query: "按部门汇总报销表，标出和发票对不上的",
    tags: ["发票三单比对", "自动红冲", "交互式工作底稿"],
  },
  {
    id: "ticket",
    name: "客服工单",
    badge: "工单调度 · SLA预警",
    badgeType: "ticket",
    title: "工单智能分派与超时管控",
    desc: "多维服务台技能矩阵与优先级求解，自动分派待办任务并高亮临期工单",
    query: "把这批工单分派一下，看看哪些快超时了",
    tags: ["多技能匹配", "临期工单预警", "工作量均衡"],
  },
  {
    id: "schedule",
    name: "门店排班",
    badge: "合规排班 · 规则求解",
    badgeType: "schedule",
    title: "智能员工排班与班次平衡",
    desc: "根据员工可用时段与部门班次配额，求解满足硬性约束的最优排班表",
    query: "按员工表和班次需求排一下下周的班",
    tags: ["硬性约束求解", "员工意愿协同", "工时合规校验"],
  },
];

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
  const healthUrl = apiUrl("/health");

  const refresh = useCallback(() => {
    setReady(null);
    void probeBackendOnce().then((h) => setReady(Boolean(h?.ok)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const blocked = Boolean(disabled);

  return (
    <div className="oa-empty-home">
      {ready === false && (
        <div className="oa-empty-warn" role="alert">
          <div className="oa-warn-indicator" />
          <div className="oa-warn-text">
            <strong>办事服务未就绪</strong>
            <span>检测地址 <code>{healthUrl}</code></span>
          </div>
          <button type="button" className="oa-empty-retry" onClick={refresh}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor">
              <path d="M2.5 8a5.5 5.5 0 101.6-3.9L2 6M2 2v4h4" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>重新检测</span>
          </button>
        </div>
      )}

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

      {/* Sci-Fi Scenario Command Cards */}
      <div className="oa-home-grid" role="region" aria-label="快捷业务指令">
        {SCENARIOS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`oa-home-card oa-home-card--${item.badgeType}`}
            aria-label={item.name}
            disabled={blocked}
            onClick={() => onRun(item.query)}
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
              </div>
              <span className="oa-card-badge">{item.badge}</span>
            </div>

            <div className="oa-home-card-body">
              <h3 className="oa-card-title">{item.title}</h3>
              <p className="oa-card-desc">{item.desc}</p>
            </div>

            <div className="oa-card-tags">
              {item.tags.map((tag) => (
                <span key={tag} className="oa-card-tag">{tag}</span>
              ))}
            </div>

            <div className="oa-card-footer">
              <span className="oa-card-query-label">指令:</span>
              <span className="oa-card-query-text">{item.query}</span>
              <span className="oa-card-go">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
            </div>
          </button>
        ))}
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

