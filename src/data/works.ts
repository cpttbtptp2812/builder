/** 作品目录 — 每个项目独立路由与交互类型 */

export type WorkKind =
  | "product-tool"
  | "automation-chat"
  | "agent-chat"
  | "agent-skills"
  | "agent-platform"
  | "replay-sdk"
  | "perf-lab"
  | "multi-channel"
  | "micro-frontend"
  | "flow-builder"
  | "sse-lab"
  | "stream-probe"
  | "locator-lab"
  | "extension-demo"
  | "eval-lab"
  | "agent-trace"
  | "own-agent"
  | "dev-debug";

export type WorkTier = "flagship" | "lab";

export type Work = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  desc: string;
  hook: string;
  impact?: string;
  kind: WorkKind;
  stack: string[];
  teaser: string;
  accent: string;
  tier: WorkTier;
  featured?: boolean;
};

export const WORKS: Work[] = [
  {
    id: "ownagent",
    slug: "ownagent",
    title: "OwnAgent",
    subtitle: "浏览器内 AI Agent 平台",
    hook: "对话 · 技能路由 · MCP 工具 · 知识检索 · 运行追踪 · 回归评测",
    desc: "个人从 0 实现的 Agent 平台：Agent Loop、进程内 MCP Server、RAG 分块检索、SKILL.md 路由、TraceSpan 可观测与 Eval，全部真实运行、免 API Key。",
    impact: "个人项目",
    kind: "own-agent",
    stack: ["Agent Loop", "MCP", "RAG", "SKILL.md", "Eval"],
    teaser: "Run · Trace · Eval",
    accent: "#8b5cf6",
    tier: "flagship",
    featured: true,
  },
  {
    id: "extension-hub",
    slug: "extension-hub",
    title: "前端联调工具包",
    subtitle: "ClipHub · Env · Wire",
    hook: "摘录、切环境、看 SSE — 一个 zip 装齐",
    desc: "三个 Chrome 扩展打包发布：保存网页摘录并跳回、按域名切 API/Token、帧级调试 EventSource。前端日常联调用。",
    impact: "本地运行",
    kind: "product-tool",
    stack: ["Chrome MV3", "EventSource", "按域配置"],
    teaser: "联调三件套",
    accent: "#0d9488",
    tier: "flagship",
    featured: true,
  },
  {
    id: "imean",
    slug: "imean",
    title: "iMean AI",
    subtitle: "AI 浏览器自动化",
    hook: "自然语言描述任务，系统在浏览器里自动执行",
    desc: "对话匹配工作流，本地 / 云端 / 远程三种执行模式，DOM 回放与流程编排。",
    impact: "主项目",
    kind: "automation-chat",
    stack: ["React Flow", "ReplaySDK", "Web Worker", "GraphQL"],
    teaser: "匹配流程 → 自动执行 → 回放",
    accent: "#5eead4",
    tier: "flagship",
    featured: true,
  },
  {
    id: "builder",
    slug: "builder",
    title: "Workflow Builder",
    subtitle: "可视化流程编排",
    hook: "拖拽节点编排自动化流程，Copilot 辅助改图",
    desc: "React Flow 画布、dagre 布局、路径模拟运行。",
    impact: "流程编辑器",
    kind: "flow-builder",
    stack: ["React Flow", "dagre", "Valtio", "Copilot"],
    teaser: "拖节点 · 连边 · 模拟运行",
    accent: "#a78bfa",
    tier: "flagship",
    featured: true,
  },
  {
    id: "streamprobe",
    slug: "streamprobe",
    title: "StreamProbe",
    subtitle: "已归档",
    hook: "流式 hook 实验 · 不再主推",
    desc: "Chrome 流式调试扩展实验，已归档。站点 SSE 实验室仍可看协议对照 demo。",
    kind: "stream-probe",
    stack: ["Chrome MV3", "SSE"],
    teaser: "archived",
    accent: "#94a3b8",
    tier: "lab",
  },
  {
    id: "sse",
    slug: "sse",
    title: "GraphQL SSE",
    subtitle: "流式协议调试",
    hook: "原始 SSE 帧与 UIMessage 对照",
    desc: "TTFB、断线续传、Provider 调试。",
    kind: "sse-lab",
    stack: ["SSE", "UIMessage", "useAutoResume"],
    teaser: "三栏对照",
    accent: "#34d399",
    tier: "lab",
  },
  {
    id: "locator",
    slug: "locator",
    title: "Locator Engine",
    subtitle: "DOM 定位",
    hook: "CSS → XPath → 文本 → 缓存，策略瀑布",
    desc: "ReplaySDK 定位核心，Shadow DOM 穿透。",
    kind: "locator-lab",
    stack: ["策略瀑布", "Shadow DOM", "IndexedDB"],
    teaser: "点多策略链",
    accent: "#f0b429",
    tier: "lab",
  },
  {
    id: "sdk",
    slug: "sdk",
    title: "iMean SDK",
    subtitle: "执行引擎",
    hook: "TaskQueue 逐步回放，任意页注入",
    desc: "pause/skip、PostMessage 互斥、gzip 队列持久化。",
    kind: "replay-sdk",
    stack: ["TaskQueue", "PostMessage", "CompressionStream"],
    teaser: "队列调度",
    accent: "#f472b6",
    tier: "lab",
  },
  {
    id: "extension",
    slug: "extension",
    title: "录制 Demo",
    subtitle: "iMean 录制链路",
    hook: "MV3 录步骤 → steps.json → Builder / SDK",
    desc: "iMean 自动化闭环的「录」环节演示，非独立产品。",
    kind: "extension-demo",
    stack: ["MV3", "Content Script"],
    teaser: "录制 → JSON",
    accent: "#fb7185",
    tier: "lab",
  },
];

export function getWork(slug: string) {
  return WORKS.find((w) => w.slug === slug);
}

export const FLAGSHIP_WORKS = WORKS.filter((w) => w.tier === "flagship");
export const LAB_WORKS = WORKS.filter((w) => w.tier === "lab");

/** 首页 — iMean 平台（在职） */
export const IMEAN_WORKS = WORKS.filter((w) => ["imean", "builder"].includes(w.slug));

/** 首页 — 个人产品（独立设计与开发） */
export const PERSONAL_WORKS = WORKS.filter((w) => w.slug === "ownagent");

/** @deprecated use IMEAN_WORKS */
export const PROJECT_WORKS = IMEAN_WORKS;
