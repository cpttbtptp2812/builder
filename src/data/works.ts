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
  | "locator-lab"
  | "extension-demo"
  | "eval-lab"
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
    id: "extension-hub",
    slug: "extension-hub",
    title: "插件集",
    subtitle: "4 款 Chrome 扩展",
    hook: "片段保存、API 调试、环境切换、SSE 流式排查",
    desc: "ClipHub / Mirror / Env / Wire — 我自己联调时在用的扩展，下载解压即可加载。",
    impact: "本地运行",
    kind: "product-tool",
    stack: ["Chrome MV3", "Fetch 劫持", "EventSource"],
    teaser: "ClipHub · Mirror · Env · Wire",
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
    id: "dev-debug",
    slug: "dev-debug",
    title: "开发调试",
    subtitle: "Agent · Skills · Platform",
    hook: "对话、Skill 路由、RAG、Multi-Agent、路由回归 — 一个入口",
    desc: "本地 SQLite 后端，Guest 模式免 Key。按 Tab 切换模块，不再拆三个独立页。",
    kind: "dev-debug",
    stack: ["MCP", "RAG", "SKILL.md"],
    teaser: "对话 · Skills · RAG · 测试",
    accent: "#6366f1",
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
    title: "Playback Extension",
    subtitle: "操作录制",
    hook: "录一遍导出 steps.json",
    desc: "MV3 Content Script 捕获操作序列。",
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

/** 首页主推：浏览器扩展 */
export const HOME_PRODUCT = WORKS.find((w) => w.slug === "extension-hub")!;

/** 首页：工作相关项目 */
export const PROJECT_WORKS = WORKS.filter((w) => ["imean", "builder"].includes(w.slug));
