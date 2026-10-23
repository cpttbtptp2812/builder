import type React from "react";
import { startTransition, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { AgentWorkbenchPanel } from "../components/ownagent/AgentWorkbenchPanel";
import { MaterialsLine, RulesLine, SkillLine, lineOf } from "../components/ownagent/MainLines";
import { PageToolHost } from "../components/ownagent/PageToolHost";
import { SkillUserClient } from "../components/ownagent/SkillUserClient";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { OaBtn, OaCard, OaCheck, OaPage, OaStack } from "../components/ownagent/OaUi";
type ViewId =
  | "chat"
  | "user"
  | "guide"
  | "feed"
  | "skills"
  | "compare"
  | "versions"
  | "savever"
  | "drafts"
  | "editset"
  | "cases"
  | "fork"
  | "rag"
  | "guard"
  | "trace"
  | "eval"
  | "evalops"
  | "prompts"
  | "mcp"
  | "connect"
  | "model"
  | "lab"
  | "jd";

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
    id: "lab",
    label: "实验台",
    desc: "回放 · 求解 · 签名验真",
    sidebar: false,
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M5.5 1.5h4M6 1.5v4L2.5 12a1 1 0 0 0 .9 1.5h8.2a1 1 0 0 0 .9-1.5L9 5.5v-4" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
        <path d="M4 9.5h7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
      </svg>
    ),
  },
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

const LINE_NAV: {
  line: "talk" | "materials" | "skill" | "rules";
  home: ViewId;
  label: string;
  desc: string;
  iconFrom: ViewId;
}[] = [
  { line: "talk", home: "chat", label: "对话", desc: "客户这样问，就这样答", iconFrom: "chat" },
  { line: "skill", home: "compare", label: "技能", desc: "改完检查，再决定能不能发", iconFrom: "compare" },
  { line: "materials", home: "rag", label: "资料", desc: "资料库、提示词、知识广场", iconFrom: "rag" },
  { line: "rules", home: "guard", label: "规则", desc: "能答什么，模型怎么接", iconFrom: "guard" },
];

function resolveView(panel: string | null, view: string | null): ViewId {
  const raw = view || panel;
  if (raw === "user") return "user";
  if (raw === "model") return "model";
  if (raw === "check") return "evalops";
  if (raw === "skills" || raw === "codrive") return "skills";
  if (raw === "versions") return "versions";
  if (raw === "savever") return "savever";
  if (raw === "drafts") return "drafts";
  if (raw === "editset") return "editset";
  if (VIEWS.some((v) => v.id === raw)) return raw as ViewId;
  return "chat";
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
      title: "打开一个办事技能",
      desc: "三个正在用的技能是报销对账、客服工单、门店排班。点卡片看它按哪几步办、用什么规则。",
      detail: "进入「技能」，点一张卡片。要换成自己写的，点右上角「导入技能」，拖入文件。",
      action: "打开技能列表",
      target: "compare" as ViewId,
    },
    {
      num: 2,
      title: "改规则，先存成草稿",
      desc: "改的是容差、缺票、时限、休息时长这些规则，或者客户怎么说才会接到这个技能。线上正在用的版本不受影响。",
      detail: "打开技能 → 展开「改内容」→ 改完自动保存成下一版草稿。",
      action: "去编辑技能",
      target: "compare" as ViewId,
    },
    {
      num: 3,
      title: "先看能不能发",
      desc: "用客户会说的几句话，对比现在这一版和草稿。答不上的不让发。",
      detail: "右侧点「检查能不能发」。过不了就回去改；过了再到对话里用自己的材料办一单。",
      action: "去看能不能发",
      target: "compare" as ViewId,
    },
    {
      num: 4,
      title: "用自己的材料办一单",
      desc: "在对话里说要办的事，按提示上传表格。办完的数字来自这份材料。",
      detail: "对话里说「核对报销」或「排下周的班」，上传文件，看结论和文书。确认没问题再回去发布。",
      action: "去对话办理",
      target: "chat" as ViewId,
    },
  ];

  const FAQ = [
    { q: "可以发 / 先看一眼再发 / 先别发 是什么意思？", a: "可以发：这几句都过了。先看一眼再发：能过，但有一处建议发前再看。先别发：有问法过不了，改完再检查。" },
    { q: "「假如只改一步」那张表是什么？", a: "不是检查结果。是假设实验：单独弄坏某一步，看「能不能过」会不会变，给排查用。" },
    { q: "发版检查和对话有什么区别？", a: "发版检查用固定几句客户话批量对比两版；对话是你自己上传材料办一单，确认结果。" },
    { q: "资料库还要用吗？", a: "办事技能按您上传的表格计算，不靠资料库。资料库给问答用：把制度和说明录进去，问到时会引用。" },
    { q: "导入的文件格式不对怎么办？", a: "打开技能后点「一键修复格式」，或重新导入，导入时会自动修。" },
  ];

  const progress = Math.round((doneSteps.size / STEPS.length) * 100);

  return (
    <OaPage
      title="快速上手"
      desc="四步把一个技能改完并发出去：打开 → 改规则 → 检查 → 用自己的材料办一单。"
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
  collapsed = false,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}) {
  return (
    <button
      type="button"
      className={`own-nav-item${active ? " on" : ""}${item.primary ? " own-nav-item--primary" : ""}${collapsed ? " is-collapsed" : ""}`}
      onClick={onClick}
      title={item.label + (item.desc ? ` · ${item.desc}` : "")}
      aria-current={active ? "page" : undefined}
    >
      <span className="own-nav-icon">{item.icon}</span>
      {!collapsed && <span className="own-nav-label">{item.label}</span>}
      {!collapsed && <span className="own-nav-tip">{item.desc}</span>}
    </button>
  );
}

export function WorkOwnAgent() {
  const [params, setParams] = useSearchParams();
  const view = resolveView(params.get("panel"), params.get("view"));
  const [sideCollapsed, setSideCollapsed] = useState(() => {
    try {
      return localStorage.getItem("oa_side_collapsed") === "1";
    } catch {
      return false;
    }
  });
  const [topSearchOpen, setTopSearchOpen] = useState(false);
  const [topSearchText, setTopSearchText] = useState("");

  const toggleSidebar = () => {
    setSideCollapsed((v) => {
      const next = !v;
      try {
        localStorage.setItem("oa_side_collapsed", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  function go(nextView?: ViewId) {
    const next = new URLSearchParams();
    next.set("tab", "product");
    next.set("view", nextView ?? view);
    const trySkill = params.get("try") ?? params.get("skill");
    if (trySkill) next.set("try", trySkill);
    startTransition(() => {
      setParams(next, { replace: true });
    });
  }

  useEffect(() => {
    function onGo(ev: Event) {
      const detail = (ev as CustomEvent<{ view?: ViewId; tab?: string }>).detail ?? {};
      if (detail.tab === "workbench" || detail.tab === "theory") go("chat");
      else if (detail.view) go(detail.view);
    }
    window.addEventListener("ownagent:go", onGo);
    return () => window.removeEventListener("ownagent:go", onGo);
  }, [view]);

  useEffect(() => {
    const rawTab = params.get("tab");
    const panel = params.get("panel");
    if (rawTab === "workbench" || rawTab === "theory" || panel === "arch") {
      const next = new URLSearchParams(params);
      next.set("tab", "product");
      next.set("view", "chat");
      setParams(next, { replace: true });
      return;
    }
    const hasView = params.get("view") || params.get("panel");
    if (!hasView) {
      const next = new URLSearchParams(params);
      next.set("tab", "product");
      next.set("view", "chat");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  if (view === "lab") return <Navigate to="/lab" replace />;
  if (view === "user") return <SkillUserClient onAdmin={() => go("chat")} />;

  return (
    <div className={`own-app own-app--product product${view === "chat" ? " chat-focus" : ""}${sideCollapsed ? " side-collapsed" : ""}`}>
      <header className="own-app-bar">
        <div className="own-app-brand">
          <span className="own-app-mark" aria-hidden="true">
            OA
          </span>
          <div className="own-app-brand-text">
            <strong>OwnAgent</strong>
            <span className="own-app-tagline">企业办事运行时 · 技能治理</span>
          </div>
        </div>
        <div className="own-app-actions">
          <BackendStatusBar compact quiet />
          <button type="button" className="own-cmd" onClick={() => go("user")}>
            用户端
          </button>
          {topSearchOpen ? (
            <div className="own-top-search-wrap">
              <input
                type="text"
                className="own-top-search-input"
                placeholder="搜索技能、资料、会话…"
                value={topSearchText}
                autoFocus
                onChange={(e) => setTopSearchText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setTopSearchOpen(false);
                  } else if (e.key === "Enter") {
                    window.dispatchEvent(new Event("ownagent:palette"));
                    setTopSearchOpen(false);
                  }
                }}
              />
              <button
                type="button"
                className="own-top-search-close"
                onClick={() => setTopSearchOpen(false)}
                title="关闭搜索"
                aria-label="关闭搜索"
              >
                ×
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="own-cmd"
              onClick={() => {
                setTopSearchOpen(true);
              }}
            >
              搜索
            </button>
          )}
          <Link to="/" className="own-exit" title="返回主页" aria-label="返回主页">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v7A1.5 1.5 0 0 0 3.5 13H6M10.5 11.5L14 8l-3.5-3.5M14 8H5.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>退出</span>
          </Link>
        </div>
      </header>

      <>
          <aside className={`own-app-side${sideCollapsed ? " is-collapsed" : ""}`}>
            <div className="own-nav-collapse-row">
              <button
                type="button"
                className="own-nav-side-btn"
                onClick={toggleSidebar}
                title={sideCollapsed ? "展开侧栏" : "收起侧栏"}
                aria-label={sideCollapsed ? "展开侧栏" : "收起侧栏"}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={`own-collapse-arrow${sideCollapsed ? " is-flipped" : ""}`}
                >
                  <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {!sideCollapsed && <span>收起侧栏</span>}
              </button>
            </div>

            <div className="own-nav-section">
              {LINE_NAV.map((item) => (
                <NavButton
                  key={item.line}
                  collapsed={sideCollapsed}
                  item={{
                    id: item.home,
                    label: item.label,
                    desc: item.desc,
                    icon: VIEWS.find((v) => v.id === item.iconFrom)?.icon,
                  }}
                  active={lineOf(view) === item.line}
                  onClick={() => go(item.home)}
                />
              ))}
            </div>
            {!sideCollapsed && <div className="own-nav-group-label">了解</div>}
            <div className="own-nav-section">
              {[
                ...MORE_VIEWS.filter((v) => v.id === "guide"),
                ...ADVANCED_VIEWS.filter((v) => v.id === "jd"),
              ].map((v) => (
                <NavButton
                  key={v.id}
                  collapsed={sideCollapsed}
                  item={v}
                  active={view === v.id}
                  onClick={() => go(v.id)}
                />
              ))}
            </div>
          </aside>

          <div key={view} className={`own-app-stage${view === "chat" ? " is-chat" : " is-page"}`}>
            <ErrorBoundary fallbackTitle="工作台视图渲染异常">
              {view === "chat" ? <AgentProductDemo /> : null}
              {lineOf(view) === "skill" ? <SkillLine view={view} onPick={(id) => go(id as ViewId)} /> : null}
              {lineOf(view) === "materials" ? <MaterialsLine view={view} onPick={(id) => go(id as ViewId)} /> : null}
              {lineOf(view) === "rules" ? <RulesLine view={view} onPick={(id) => go(id as ViewId)} /> : null}
              {view === "guide" ? <QuickStartGuide onGo={(v) => go(v)} /> : null}
              {view === "jd" ? (
                <AgentWorkbenchPanel onGo={(v) => go(v)} onGoProduct={() => go("compare")} />
              ) : null}
            </ErrorBoundary>
          </div>
      </>
      <PageToolHost />
    </div>
  );
}
