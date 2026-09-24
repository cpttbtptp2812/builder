import type React from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { KnowledgeFeed } from "../components/fx/agent/KnowledgeFeed";
import { EvalLabPanel } from "../components/fx/EvalLabPanel";
import { AgentHubOverview } from "../components/agent/AgentHubOverview";
import { AgentWorkbenchPanel } from "../components/ownagent/AgentWorkbenchPanel";
import { GuardPanel } from "../components/ownagent/GuardPanel";
import { ConnectPanel } from "../components/ownagent/ConnectPanel";
import { McpToolsPanel } from "../components/ownagent/McpToolsPanel";
import { PromptTemplatePanel } from "../components/ownagent/PromptTemplatePanel";
import { RagPanel } from "../components/ownagent/RagPanel";
import { SkillPlatformPanel } from "../components/ownagent/SkillPlatformPanel";
import { TracePanel } from "../components/ownagent/TracePanel";
import { OaBtn, OaCard, OaCheck, OaPage, OaStack } from "../components/ownagent/OaUi";

type TabId = "product" | "theory";
type ViewId = "chat" | "guide" | "feed" | "skills" | "rag" | "guard" | "trace" | "eval" | "prompts" | "mcp" | "connect" | "jd";
type NavTier = "daily" | "manage" | "advanced";

type NavItem = {
  id: ViewId;
  label: string;
  desc: string;
  icon: React.ReactNode;
  tier: NavTier;
  primary?: boolean;
  /** false = 仅命令面板可达（开发者功能） */
  sidebar?: boolean;
};

const DAILY_VIEWS: NavItem[] = [
  {
    id: "chat",
    label: "问 AI",
    desc: "输入问题，立即回答",
    tier: "daily",
    primary: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M13 9.5A1.5 1.5 0 0 1 11.5 11H5L2 14V3.5A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5v6z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5 5.5h5M5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "feed",
    label: "知识广场",
    desc: "搜已有问答，避免重复问",
    tier: "daily",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 8.2c.8 1.1 2.2 1.1 3 0M5.8 6.2h.1M9.2 6.2h.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "rag",
    label: "资料库",
    desc: "录入公司文档与 FAQ",
    tier: "daily",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <ellipse cx="7.5" cy="4" rx="4.5" ry="1.8" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 4v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 7.5v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V7.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "guide",
    label: "新手指南",
    desc: "三步快速上手",
    tier: "daily",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2.5" y="1.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 4.5h5M5 7h5M5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const MANAGE_VIEWS: NavItem[] = [
  {
    id: "guard",
    label: "回答规则",
    desc: "设定 AI 能答什么",
    tier: "manage",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5l-5 2.5v4c0 3 2.5 5 5 5.5 2.5-.5 5-2.5 5-5.5V4l-5-2.5z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5.5 7.5l1.5 1.5 2.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "eval",
    label: "回答质检",
    desc: "批量测试是否准确",
    tier: "manage",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11l3.5-4L8 10l3-5 2 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="11.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: "connect",
    label: "接入配置",
    desc: "大模型 · MCP · 高级能力",
    tier: "manage",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M7.5 1.5v2M7.5 11.5V13.5M1.5 7.5h2M11.5 7.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

/** 仅命令面板可达，不出现在侧栏 */
const DEV_VIEWS: NavItem[] = [
  {
    id: "skills",
    label: "技能扩展",
    desc: "自动化能力（技术向）",
    tier: "advanced",
    sidebar: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M8.5 1.5L3.5 8h4.5l-1.5 5.5 5.5-7H7.5l1-5z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "trace",
    label: "处理过程",
    desc: "查看 AI 推理步骤",
    tier: "advanced",
    sidebar: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M4.5 5.5l2 2-2 2M8 9.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "prompts",
    label: "Prompt 模板",
    desc: "场景化提示词",
    tier: "advanced",
    sidebar: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M3 2.5h9v10H3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5 5.5h5M5 8h4M5 10.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "mcp",
    label: "工具沙箱",
    desc: "MCP 工具调试",
    tier: "advanced",
    sidebar: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5v3M7.5 10.5v3M1.5 7.5h3M10.5 7.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "jd",
    label: "能力图谱",
    desc: "系统能力对照",
    tier: "advanced",
    sidebar: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 5h5M5 7.5h4M5 10h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const VIEWS: NavItem[] = [...DAILY_VIEWS, ...MANAGE_VIEWS, ...DEV_VIEWS];
const DEV_ONLY = new Set<ViewId>(["prompts", "mcp", "jd", "skills", "trace"]);

function viewMeta(id: ViewId): NavItem | undefined {
  return VIEWS.find((v) => v.id === id);
}

function resolveTab(tab: string | null, panel: string | null): TabId {
  if (tab === "workbench" || tab === "theory" || panel === "arch") return "theory";
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
      detail: "进入「资料库」→ 点击「新建」→ 填入标题和内容 → 保存。支持多篇文档，每篇聚焦一个主题效果最好。",
      action: "去录入资料",
      target: "rag" as ViewId,
    },
    {
      num: 2,
      title: "先搜知识广场",
      desc: "别人问过的问题会发布在广场里。先搜广场，找到答案就不用再问 AI。",
      detail: "打开左侧「知识广场」→ 用搜索框搜关键词 → 没有再去对话。问完后可把当前问答或整段对话发布到广场，同事下次直接看。",
      action: "去知识广场",
      target: "feed" as ViewId,
    },
    {
      num: 3,
      title: "和 AI 对话",
      desc: "广场没有的问题再问 AI。答完后点「发布到广场」，整段对话也能一起共享。",
      detail: "点击左侧「问 AI」→ 先看顶部广场搜索 → 没有再输入问题。每条回答下方可以把「这一条」或「整段对话」发布到广场。",
      action: "去对话试试",
      target: "chat" as ViewId,
    },
    {
      num: 4,
      title: "检查回答质量",
      desc: "一键批量测试 AI 的回答是否准确，发现问题就回去补充知识，持续优化。",
      detail: "点击「回答质检」→ 点击「开始检测」→ 查看通过率和失败样本。失败的说明资料库缺少相关内容，回去补充即可。",
      action: "去质检回答",
      target: "eval" as ViewId,
    },
  ];

  const FAQ = [
    { q: "为什么要先去知识广场？", a: "广场里是已经问过、校对过的答案。先搜能省时间和费用；没有再问 AI，答完记得发布回去。" },
    { q: "AI 回答得不对怎么办？", a: "在「资料库」里补充更详细的内容，或把正确版本编辑进知识广场。" },
    { q: "可以限制 AI 不回答某些问题吗？", a: "可以。进入「回答规则 → 分流规则」，开启「拒绝无关问题」并编辑关键词；也可在「制度条款」里维护可引用的内容。" },
    { q: "怎么知道 AI 为什么这样回答？", a: "在对话中展开每条回答的「来源」，可查看引用了哪些资料。" },
    { q: "如何添加更多 AI 能力？", a: "在「资料库」补充文档即可。技术人员可通过命令面板（⌘K）访问技能扩展等开发者功能。" },
    { q: "数据安全吗？", a: "所有数据存储在你自己的服务器上，不会上传到任何第三方平台。" },
  ];

  const progress = Math.round((doneSteps.size / STEPS.length) * 100);

  return (
    <OaPage
      title="新手指南"
      desc="按顺序完成下面 4 步，让 AI 基于你的资料为客户解答。"
      actions={
        <span className="oa-guide-progress">
          完成 {doneSteps.size}/{STEPS.length}
          <span className="oa-guide-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </span>
        </span>
      }
    >
      <OaStack>
        {STEPS.map((s, i) => (
          <OaCard key={s.num} muted={doneSteps.has(i)}>
            <div className="oa-guide-step">
              <span className="oa-guide-num">{s.num}</span>
              <div className="oa-guide-body">
                <OaCheck
                  compact
                  checked={doneSteps.has(i)}
                  onChange={() => markDone(i)}
                  label={s.title}
                />
                <p className="oa-guide-desc">{s.desc}</p>
                <p className="oa-guide-detail">{s.detail}</p>
                <OaBtn onClick={() => onGo(s.target)}>{s.action}</OaBtn>
              </div>
            </div>
          </OaCard>
        ))}

        <section className="oa-guide-faq">
          <h2>常见问题</h2>
          {FAQ.map((f, i) => (
            <details key={i} className="oa-details">
              <summary>{f.q}</summary>
              <div className="oa-details-body">
                <p style={{ margin: 0, fontSize: "0.8125rem", lineHeight: 1.55, color: "#52525b" }}>{f.a}</p>
              </div>
            </details>
          ))}
        </section>

        <p className="oa-guide-tip">遇到问题？联系管理员，或在「问 AI」中直接提问。</p>
      </OaStack>
    </OaPage>
  );
}

/** OwnAgent 产品工作台 */
function NavButton({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`own-nav-item${active ? " on" : ""}`}
      onClick={onClick}
      title={item.desc}
      aria-current={active ? "page" : undefined}
    >
      <span className="own-nav-icon">{item.icon}</span>
      <span className="own-nav-label">{item.label}</span>
    </button>
  );
}

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
      if (detail.tab === "workbench" || detail.tab === "theory") go("theory");
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
            <div className="own-nav-section">
              {DAILY_VIEWS.map((v) => (
                <NavButton key={v.id} item={v} active={view === v.id} onClick={() => go("product", v.id)} />
              ))}
            </div>

            <div className="own-nav-group-label">管理</div>
            <div className="own-nav-section">
              {MANAGE_VIEWS.map((v) => (
                <NavButton key={v.id} item={v} active={view === v.id} onClick={() => go("product", v.id)} />
              ))}
            </div>

          </aside>
          <div className={`own-app-stage${view === "chat" ? " is-chat" : " is-page"}`}>
            {DEV_ONLY.has(view) ? (
              <div className="oa-dev-banner">
                <strong>{viewMeta(view)?.label ?? "开发者功能"}</strong>
                <span>面向技术人员，客户一般无需使用。按 Esc 或点侧栏返回常用功能。</span>
              </div>
            ) : null}
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
            {view === "connect" ? <ConnectPanel /> : null}
            {view === "prompts" ? <PromptTemplatePanel /> : null}
            {view === "mcp" ? <McpToolsPanel /> : null}
            {view === "jd" ? (
              <AgentWorkbenchPanel
                onGo={(v) => go("product", v)}
                onGoProduct={() => go("product")}
              />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
