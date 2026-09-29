import type React from "react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { AgentHubOverview } from "../components/agent/AgentHubOverview";
import { AgentWorkbenchPanel } from "../components/ownagent/AgentWorkbenchPanel";
import { MaterialsLine, RulesLine, SkillLine, lineOf } from "../components/ownagent/MainLines";
import { OaBtn, OaCard, OaCheck, OaPage, OaStack } from "../components/ownagent/OaUi";

type TabId = "product" | "theory";
type ViewId = "chat" | "guide" | "feed" | "skills" | "compare" | "cases" | "fork" | "rag" | "guard" | "trace" | "eval" | "evalops" | "prompts" | "mcp" | "connect" | "jd";

type NavItem = {
  id: ViewId;
  label: string;
  desc: string;
  icon: React.ReactNode;
  primary?: boolean;
  sidebar?: boolean;
};

const iconSkill = (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="3" width="5" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <rect x="8.5" y="3" width="5" height="9" rx="1" stroke="currentColor" strokeWidth="1.2"/>
    <path d="M6.5 7.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
  </svg>
);

const PRIMARY_VIEWS: NavItem[] = [
  {
    id: "compare",
    label: "技能",
    desc: "版本、检查、发布",
    primary: true,
    icon: iconSkill,
  },
  {
    id: "chat",
    label: "对话",
    desc: "用真实问题验证效果",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M13 9.5A1.5 1.5 0 0 1 11.5 11H5L2 14V3.5A1.5 1.5 0 0 1 3.5 2h8A1.5 1.5 0 0 1 13 3.5v6z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5 5.5h5M5 8h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "rag",
    label: "资料库",
    desc: "技能会用到的文档",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <ellipse cx="7.5" cy="4" rx="4.5" ry="1.8" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 4v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 7.5v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V7.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "feed",
    label: "知识广场",
    desc: "已确认的问答",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 8.2c.8 1.1 2.2 1.1 3 0M5.8 6.2h.1M9.2 6.2h.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const MORE_VIEWS: NavItem[] = [
  {
    id: "cases",
    label: "考试题",
    desc: "客户会问的话，发版时再跑一遍",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 5h5M5 7.5h3M5 10h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "fork",
    label: "交给谁",
    desc: "一句话会由哪个技能处理",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 2v4M7.5 9v4M7.5 6h3M7.5 6H4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        <circle cx="4" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="10.5" cy="6" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
  {
    id: "evalops",
    label: "回归评测",
    desc: "批量 case · 版本对比",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1.5" y="2" width="5" height="11" rx="1" stroke="currentColor" strokeWidth="1.2"/>
        <rect x="8.5" y="2" width="5" height="11" rx="1" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M3 9.5l1.2 1.2L5.5 8.5M10 6h2M10 9h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "guide",
    label: "使用说明",
    desc: "怎么改技能、怎么发布",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2.5" y="1.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 4.5h5M5 7h5M5 9.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const MORE_TAIL: NavItem[] = [
  {
    id: "skills",
    label: "执行记录",
    desc: "逐步看一次运行",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M8.5 1.5L3.5 8h4.5l-1.5 5.5 5.5-7H7.5l1-5z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "eval",
    label: "回答质检",
    desc: "内置题库批量自检",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11l3.5-4L8 10l3-5 2 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="11.5" cy="4.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
  },
];

const RESOURCE_VIEWS: NavItem[] = [
  {
    id: "rag",
    label: "资料库",
    desc: "Skill 调用的知识语料",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <ellipse cx="7.5" cy="4" rx="4.5" ry="1.8" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 4v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V4" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M3 7.5v3.5c0 1 2 1.8 4.5 1.8s4.5-.8 4.5-1.8V7.5" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    ),
  },
  {
    id: "feed",
    label: "知识广场",
    desc: "共享问答 · 减少重复调用",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="5.5" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 8.2c.8 1.1 2.2 1.1 3 0M5.8 6.2h.1M9.2 6.2h.1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: "guard",
    label: "回答规则",
    desc: "分流与权限策略",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5l-5 2.5v4c0 3 2.5 5 5 5.5 2.5-.5 5-2.5 5-5.5V4l-5-2.5z"
          stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M5.5 7.5l1.5 1.5 2.5-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: "connect",
    label: "接入配置",
    desc: "模型 · MCP · 环境",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M7.5 1.5v2M7.5 11.5V13.5M1.5 7.5h2M11.5 7.5h2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const ADVANCED_VIEWS: NavItem[] = [
  {
    id: "trace",
    label: "处理记录",
    desc: "看清一次提问是怎么答完的",
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
    label: "可用工具",
    desc: "对话里可以调用哪些工具",
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
    sidebar: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="2" y="2" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 5h5M5 7.5h4M5 10h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const MORE_ALL: NavItem[] = [
  ...MORE_VIEWS,
  ...MORE_TAIL,
  ...RESOURCE_VIEWS.filter((v) => v.id === "guard" || v.id === "connect"),
];
const VIEWS: NavItem[] = [...PRIMARY_VIEWS, ...MORE_ALL, ...ADVANCED_VIEWS];

const LINE_NAV: { line: "talk" | "materials" | "skill" | "rules"; home: ViewId; label: string; desc: string; iconFrom: ViewId }[] = [
  { line: "talk", home: "chat", label: "对话", desc: "客户这样问，就这样答", iconFrom: "chat" },
  { line: "skill", home: "compare", label: "技能", desc: "改完检查，再决定能不能发", iconFrom: "compare" },
  { line: "materials", home: "rag", label: "资料", desc: "资料库、提示词、知识广场", iconFrom: "rag" },
  { line: "rules", home: "guard", label: "规则", desc: "能答什么，模型怎么接", iconFrom: "guard" },
];

function resolveTab(tab: string | null, panel: string | null): TabId {
  if (tab === "workbench" || tab === "theory" || panel === "arch") return "theory";
  return "product";
}

function resolveView(panel: string | null, view: string | null): ViewId {
  const raw = view || panel;
  if (raw === "check") return "evalops";
  if (raw === "skills" || raw === "codrive") return "skills";
  if (VIEWS.some((v) => v.id === raw)) return raw as ViewId;
  return "compare";
}

function QuickStartGuide({ onGo }: { onGo: (view: ViewId) => void }) {
  const [doneSteps, setDoneSteps] = useState<Set<number>>(() => {
    try {
      const saved = localStorage.getItem("oa-guide-done-b");
      return saved ? new Set(JSON.parse(saved) as number[]) : new Set();
    } catch { return new Set(); }
  });

  function markDone(step: number) {
    setDoneSteps(prev => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      localStorage.setItem("oa-guide-done-b", JSON.stringify([...next]));
      return next;
    });
  }

  const STEPS = [
    {
      num: 1,
      title: "选择或导入 Skill",
      desc: "在技能列表中打开内置 Skill，或导入你的 SKILL.md。格式不完整会自动修复。",
      detail: "进入「技能」→ 点「导入」拖入 .md 文件，或点卡片打开内置 skill 查看结构。",
      action: "打开技能列表",
      target: "compare" as ViewId,
    },
    {
      num: 2,
      title: "编辑并生成草稿",
      desc: "改 triggers、步骤或说明。所有改动自动存为草稿，线上版本不受影响。",
      detail: "打开某个 skill →「编辑」Tab → 改触发说法或步骤 → 底部显示草稿 v0.x。",
      action: "去编辑技能",
      target: "compare" as ViewId,
    },
    {
      num: 3,
      title: "运行发版检查",
      desc: "系统自动跑 case + SCM 因果分析，给出 ΔP、根因步骤和 PASS/WARN/BLOCK 门禁。",
      detail: "「发版检查」Tab → 点「检查改动」→ 查看发版门禁三指标。若 BLOCK，根据根因步骤修改后重检。",
      action: "了解发版检查",
      target: "compare" as ViewId,
    },
    {
      num: 4,
      title: "对话试跑确认",
      desc: "用真实用户问法在对话里试一遍，确认体感 OK 后再发布。",
      detail: "「对话试跑」→ 输入 trigger 相关问法 → 看路由和回答是否符合预期。",
      action: "去对话试跑",
      target: "chat" as ViewId,
    },
  ];

  const FAQ = [
    { q: "PASS / WARN / BLOCK 是什么意思？", a: "PASS 允许发布；WARN 有 case 变化但无 flip，需人工确认；BLOCK 检测到 flip 或成功率显著下降，应修改后重检。" },
    { q: "ΔP 和 pivotal step 是什么？", a: "ΔP 是候选版相对现用版的成功率变化。pivotal step 是干预后会翻转 PASS/FAIL 的因果根因步骤。" },
    { q: "对话试跑和发版检查有什么区别？", a: "发版检查跑批量 case + 因果归因，给门禁结论；对话试跑是单句体感验证，两者互补。" },
    { q: "资料库和知识广场还要用吗？", a: "要。Skill 里的 knowledge_search 等工具依赖资料库；广场用于共享已验证的问答。" },
    { q: "导入的 Skill 格式不对怎么办？", a: "打开 skill 后点「一键修复格式」，或重新导入（导入时自动修复）。" },
  ];

  const progress = Math.round((doneSteps.size / STEPS.length) * 100);

  return (
    <OaPage
      title="快速上手"
      desc="四步完成首次 Skill 发版：导入 → 编辑 → 发版检查 → 对话确认。"
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
                <OaCheck compact checked={doneSteps.has(i)} onChange={() => markDone(i)} label={s.title} />
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
      </OaStack>
    </OaPage>
  );
}

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
      className={`own-nav-item${active ? " on" : ""}${item.primary ? " own-nav-item--primary" : ""}`}
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

  useEffect(() => {
    if (tab !== "product") return;
    const hasView = params.get("view") || params.get("panel");
    if (!hasView) {
      const next = new URLSearchParams(params);
      next.set("tab", "product");
      next.set("view", "chat");
      setParams(next, { replace: true });
    }
  }, [tab, params, setParams]);

  return (
    <div className={`own-app own-app--product ${tab}${view === "chat" && tab === "product" ? " chat-focus" : ""}`}>
      <header className="own-app-bar">
        <div className="own-app-brand">
          <strong>OwnAgent</strong>
          <span className="own-app-tagline">Skill 发版安全</span>
        </div>
        <nav className="own-app-tabs" aria-label="主视图">
          <button
            type="button"
            className={tab === "product" ? "on" : ""}
            onClick={() => go("product", "chat")}
          >
            工作台
          </button>
          <button type="button" className={tab === "theory" ? "on" : ""} onClick={() => go("theory")}>
            理论
          </button>
        </nav>
        <div className="own-app-actions">
          <BackendStatusBar compact quiet />
          <button type="button" className="own-cmd" onClick={() => window.dispatchEvent(new Event("ownagent:palette"))}>
            搜索
          </button>
          <Link to="/" className="own-exit" title="返回网站">
            退出
          </Link>
        </div>
      </header>

      {tab === "theory" ? (
        <div className="own-theory">
          <div className="own-theory-bar">
            <p className="own-theory-lead">
              <strong>Parse·2 架构</strong>
              <span>Agent 全链路可编排 · 点节点看实现 · 与发版门禁同源运行时</span>
            </p>
          </div>
          <AgentHubOverview />
        </div>
      ) : (
        <>
          <aside className="own-app-side">
            <div className="own-nav-section">
              {LINE_NAV.map((item) => (
                <NavButton
                  key={item.line}
                  item={{
                    id: item.home,
                    label: item.label,
                    desc: item.desc,
                    icon: VIEWS.find((v) => v.id === item.iconFrom)?.icon,
                  }}
                  active={lineOf(view) === item.line}
                  onClick={() => go("product", item.home)}
                />
              ))}
            </div>
            <div className="own-nav-group-label">了解</div>
            <div className="own-nav-section">
              {[
                ...MORE_VIEWS.filter((v) => v.id === "guide"),
                ...ADVANCED_VIEWS.filter((v) => v.id === "jd"),
              ].map((v) => (
                <NavButton key={v.id} item={v} active={view === v.id} onClick={() => go("product", v.id)} />
              ))}
            </div>
          </aside>

          <div className={`own-app-stage${view === "chat" ? " is-chat" : " is-page"}`}>
            {view === "chat" ? <AgentProductDemo hubMode /> : null}
            {lineOf(view) === "skill" ? <SkillLine view={view} onPick={(id) => go("product", id as ViewId)} /> : null}
            {lineOf(view) === "materials" ? <MaterialsLine view={view} onPick={(id) => go("product", id as ViewId)} /> : null}
            {lineOf(view) === "rules" ? <RulesLine view={view} onPick={(id) => go("product", id as ViewId)} /> : null}
            {view === "guide" ? <QuickStartGuide onGo={(v) => go("product", v)} /> : null}
            {view === "jd" ? (
              <AgentWorkbenchPanel onGo={(v) => go("product", v)} onGoProduct={() => go("product", "compare")} />
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
