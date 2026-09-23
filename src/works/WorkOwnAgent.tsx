import type React from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentHubOverview } from "../components/agent/AgentHubOverview";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { KnowledgeFeed } from "../components/fx/agent/KnowledgeFeed";
import { EvalLabPanel } from "../components/fx/EvalLabPanel";
import { GuardPanel } from "../components/ownagent/GuardPanel";
import { RagPanel } from "../components/ownagent/RagPanel";
import { SkillPlatformPanel } from "../components/ownagent/SkillPlatformPanel";
import { TracePanel } from "../components/ownagent/TracePanel";

type TabId = "product" | "theory";
type ViewId = "chat" | "guide" | "feed" | "skills" | "rag" | "guard" | "trace" | "eval";

type NavItem = { id: ViewId; label: string; desc: string; icon: React.ReactNode; primary?: boolean };

const CORE_VIEWS: NavItem[] = [
  {
    id: "chat",
    label: "和 AI 对话",
    desc: "直接输入问题即可",
    primary: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M13 9.5A1.5 1.5 0 0 1 11.5 11H5L2 14V3.5A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5v6z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5 5.5h5M5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const MANAGE_VIEWS: NavItem[] = [
  {
    id: "guide",
    label: "使用指南",
    desc: "三步快速上手",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2.5" y="1.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 4.5h5M5 7h5M5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "feed",
    label: "知识广场",
    desc: "共享问答，先搜再问",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 8.2c.8 1.1 2.2 1.1 3 0M5.8 6.2h.1M9.2 6.2h.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "rag",
    label: "知识管理",
    desc: "录入你的资料",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <ellipse cx="7.5" cy="4" rx="4.5" ry="1.8" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 4v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 7.5v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V7.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "skills",
    label: "功能扩展",
    desc: "添加更多能力",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M8.5 1.5L3.5 8h4.5l-1.5 5.5 5.5-7H7.5l1-5z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "guard",
    label: "安全管控",
    desc: "限制回答范围",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5l-5 2.5v4c0 3 2.5 5 5 5.5 2.5-.5 5-2.5 5-5.5V4l-5-2.5z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5.5 7.5l1.5 1.5 2.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "trace",
    label: "运行日志",
    desc: "查看处理过程",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M4.5 5.5l2 2-2 2M8 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "eval",
    label: "质量检测",
    desc: "测试回答准不准",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11l3.5-4L8 10l3-5 2 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="11.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
];

const VIEWS: NavItem[] = [...CORE_VIEWS, ...MANAGE_VIEWS];

function resolveTab(tab: string | null, panel: string | null): TabId {
  if (tab === "theory" || panel === "arch") return "theory";
  if (tab === "product") return "product";
  if (panel && panel !== "arch") return "product";
  return "product";
}

function resolveView(panel: string | null, view: string | null): ViewId {
  const raw = view || panel;
  if (raw === "skills" || raw === "codrive") return "skills";
  if (VIEWS.some((v) => v.id === raw)) return raw as ViewId;
  return "chat";
}

/* ════════════════════════════════════════════════════════════
   QuickStartGuide — 客户快速上手引导（三步 + 常见问题）
   ════════════════════════════════════════════════════════════ */
function QuickStartGuide({ onGo }: { onGo: (view: ViewId) => void }) {
  const [doneSteps, setDoneSteps] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("oa-guide-done");
      return saved ? new Set(JSON.parse(saved) as number[]) : new Set();
    } catch { return new Set(); }
  });

  function markDone(step: number) {
    setDoneSteps(prev => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      localStorage.setItem("oa-guide-done", JSON.stringify([...next]));
      return next;
    });
  }

  const STEPS = [
    {
      num: 1,
      title: "录入你的知识",
      desc: "把公司介绍、产品文档、常见问题等资料写进知识库，AI 就能根据这些内容回答。",
      detail: "进入「知识管理」→ 切换到「编辑知识库」→ 点击「新建」→ 填入标题和内容 → 保存。支持多篇文档，每篇聚焦一个主题效果最好。",
      action: "去录入知识",
      target: "rag" as ViewId,
      color: "#6366f1",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="3" width="20" height="22" rx="3" stroke="#6366f1" strokeWidth="2"/><path d="M9 9h10M9 13h10M9 17h6" stroke="#6366f1" strokeWidth="1.6" strokeLinecap="round"/></svg>,
    },
    {
      num: 2,
      title: "先搜知识广场",
      desc: "别人问过的问题会发布在广场里。先搜广场，找到答案就不用再问 AI。",
      detail: "打开左侧「知识广场」→ 用搜索框搜关键词 → 没有再去对话。问完后可把当前问答或整段对话发布到广场，同事下次直接看。",
      action: "去知识广场",
      target: "feed" as ViewId,
      color: "#0891b2",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="10" stroke="#0891b2" strokeWidth="2"/><path d="M10 16c1.5 2 6.5 2 8 0M11.5 11.5h.2M16.5 11.5h.2" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round"/></svg>,
    },
    {
      num: 3,
      title: "和 AI 对话",
      desc: "广场没有的问题再问 AI。答完后点「发布到广场」，整段对话也能一起共享。",
      detail: "点击左侧「和 AI 对话」→ 先看顶部广场搜索 → 没有再输入问题。每条回答下方可以把「这一条」或「整段对话」发布到广场。",
      action: "去对话试试",
      target: "chat" as ViewId,
      color: "#059669",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M24 18a3 3 0 0 1-3 3H9L4 26V7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v11z" stroke="#059669" strokeWidth="2" strokeLinejoin="round"/><path d="M9 10h10M9 14h6" stroke="#059669" strokeWidth="1.6" strokeLinecap="round"/></svg>,
    },
    {
      num: 4,
      title: "检查回答质量",
      desc: "一键批量测试 AI 的回答是否准确，发现问题就回去补充知识，持续优化。",
      detail: "点击「质量检测」→ 点击「运行全部用例」→ 查看通过率和失败样本。失败的说明知识库缺少相关内容，回去补充即可。",
      action: "去检测质量",
      target: "eval" as ViewId,
      color: "#d97706",
      icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M4 20l6-7 4 5 5-8 5 5" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="22" cy="8" r="3" stroke="#d97706" strokeWidth="1.8"/></svg>,
    },
  ];

  const FAQ = [
    { q: "为什么要先去知识广场？", a: "广场里是已经问过、校对过的答案。先搜能省时间和费用；没有再问 AI，答完记得发布回去。" },
    { q: "AI 回答得不对怎么办？", a: "在「知识管理」里补充更详细的内容，或把正确版本编辑进知识广场。" },
    { q: "可以限制 AI 不回答某些问题吗？", a: "可以。进入「安全管控」设置规则，比如只允许回答产品相关问题。" },
    { q: "怎么知道 AI 为什么这样回答？", a: "在「运行日志」里可以看到 AI 的完整思考过程和引用了哪些资料。" },
    { q: "如何添加更多 AI 能力？", a: "进入「功能扩展」可以导入新的技能，比如自动查数据、生成报表等。" },
    { q: "数据安全吗？", a: "所有数据存储在你自己的服务器上，不会上传到任何第三方平台。" },
  ];

  const progress = Math.round((doneSteps.size / STEPS.length) * 100);

  return (
    <div className="guide-root">
      {/* Header */}
      <div className="guide-header">
        <div className="guide-header-text">
          <h1>👋 欢迎使用 OwnAgent</h1>
          <p>只需 3 步，让 AI 成为你的专属知识助手。按顺序完成下方步骤即可开始使用。</p>
        </div>
        <div className="guide-progress">
          <div className="guide-progress-bar">
            <div className="guide-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="guide-progress-text">完成 {doneSteps.size}/{STEPS.length}</span>
        </div>
      </div>

      {/* Steps */}
      <div className="guide-steps">
        {STEPS.map((s, i) => (
          <div key={s.num} className={`guide-step${doneSteps.has(i) ? " done" : ""}`}>
            <div className="guide-step-left">
              <button
                type="button"
                className={`guide-check${doneSteps.has(i) ? " checked" : ""}`}
                onClick={() => markDone(i)}
                title={doneSteps.has(i) ? "标记为未完成" : "标记为已完成"}
                style={{ "--gc": s.color } as React.CSSProperties}
              >
                {doneSteps.has(i) ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3.5 8.5l3 3 6-7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : (
                  <span className="guide-check-num">{s.num}</span>
                )}
              </button>
              {i < STEPS.length - 1 && <div className="guide-step-line" style={{ background: doneSteps.has(i) ? s.color : "#e2e8f0" }} />}
            </div>
            <div className="guide-step-card">
              <div className="guide-step-icon" style={{ background: `${s.color}12` }}>{s.icon}</div>
              <div className="guide-step-body">
                <h3>{s.title}</h3>
                <p className="guide-step-desc">{s.desc}</p>
                <p className="guide-step-detail">{s.detail}</p>
                <button
                  type="button"
                  className="guide-step-btn"
                  style={{ background: s.color }}
                  onClick={() => onGo(s.target)}
                >
                  {s.action} →
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="guide-faq">
        <h2>💡 常见问题</h2>
        <div className="guide-faq-list">
          {FAQ.map((f, i) => (
            <details key={i} className="guide-faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Bottom tip */}
      <div className="guide-tip">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#6366f1" strokeWidth="1.3"/><path d="M8 5v3M8 10v.5" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span>遇到问题？联系管理员或在「和 AI 对话」中直接提问。</span>
      </div>
    </div>
  );
}

/** OwnAgent 产品工作台 */
export function WorkOwnAgent() {
  const [params, setParams] = useSearchParams();
  const tab = resolveTab(params.get("tab"), params.get("panel"));
  const view = resolveView(params.get("panel"), params.get("view"));

  function go(nextTab: TabId, nextView?: ViewId) {
    const next = new URLSearchParams();
    next.set("tab", nextTab);
    if (nextTab === "product") next.set("view", nextView ?? view);
    const trySkill = params.get("try") ?? params.get("skill");
    if (trySkill) next.set("try", trySkill);
    setParams(next, { replace: true });
  }

  useEffect(() => {
    function onGo(ev: Event) {
      const detail = (ev as CustomEvent<{ view?: ViewId; tab?: TabId }>).detail ?? {};
      if (detail.tab === "theory") go("theory");
      else if (detail.view) go("product", detail.view);
    }
    window.addEventListener("ownagent:go", onGo);
    return () => window.removeEventListener("ownagent:go", onGo);
  }, [view]);

  return (
    <div className={`own-app ${tab}${view === "chat" && tab === "product" ? " chat-focus" : ""}`}>
      <header className="own-app-bar">
        <div className="own-app-brand">
          <strong>OwnAgent</strong>
        </div>
        <nav className="own-app-tabs" aria-label="OwnAgent">
          <button type="button" className={tab === "product" ? "on" : ""} onClick={() => go("product")}>
            产品
          </button>
          <button type="button" className={tab === "theory" ? "on" : ""} onClick={() => go("theory")}>
            理论
          </button>
        </nav>
        <div className="own-app-actions">
          <BackendStatusBar compact quiet />
          <button type="button" className="own-cmd" onClick={() => window.dispatchEvent(new Event("ownagent:palette"))}>
            命令
          </button>
          <Link to="/" className="own-exit">
            退出
          </Link>
        </div>
      </header>

      {tab === "theory" ? (
        <div className="own-theory">
          <AgentHubOverview />
        </div>
      ) : (
        <>
          <aside className="own-app-side">
            {/* Brand */}
            <div className="own-nav-brand">
              <span className="own-nav-brand-dot" />
              <span>OwnAgent</span>
            </div>

            {/* Core */}
            <div className="own-nav-section">
              {CORE_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`own-nav-item own-nav-item--primary${view === v.id ? " on" : ""}`}
                  onClick={() => go("product", v.id)}
                  title={v.desc}
                >
                  <span className="own-nav-icon">{v.icon}</span>
                  <span className="own-nav-body">
                    <span className="own-nav-label">{v.label}</span>
                    <span className="own-nav-sub">{v.desc}</span>
                  </span>
                  {view === v.id && <span className="own-nav-active-dot" />}
                </button>
              ))}
            </div>

            {/* Divider + label */}
            <div className="own-nav-group-label">设置与帮助</div>

            {/* Manage */}
            <div className="own-nav-section">
              {MANAGE_VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className={`own-nav-item${view === v.id ? " on" : ""}`}
                  onClick={() => go("product", v.id)}
                  title={v.desc}
                >
                  <span className="own-nav-icon">{v.icon}</span>
                  <span className="own-nav-body">
                    <span className="own-nav-label">{v.label}</span>
                    <span className="own-nav-sub">{v.desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </aside>
          <div className={`own-app-stage${view === "chat" ? " is-chat" : ""}`}>
            {view === "chat" ? <AgentProductDemo hubMode /> : null}
            {view === "guide" ? <QuickStartGuide onGo={(v) => go("product", v)} /> : null}
            {view === "feed" ? (
              <KnowledgeFeed
                onAskNew={(q) => {
                  if (q) sessionStorage.setItem("oa-pending-ask", q);
                  go("product", "chat");
                }}
              />
            ) : null}
            {view === "skills" ? <SkillPlatformPanel /> : null}
            {view === "rag" ? <RagPanel /> : null}
            {view === "guard" ? <GuardPanel /> : null}
            {view === "trace" ? <TracePanel /> : null}
            {view === "eval" ? <EvalLabPanel /> : null}
          </div>
        </>
      )}
    </div>
  );
}
