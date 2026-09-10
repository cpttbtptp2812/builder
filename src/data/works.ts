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
    id: "streamprobe",
    slug: "streamprobe",
    title: "StreamProbe",
    subtitle: "流式 API 浏览器调试器",
    hook: "帧级看 SSE · AI 流 · 首 token 与断线",
    desc: "个人开源 Chrome 扩展：hook EventSource / fetch stream，Side Panel 时间线 + Raw/Parsed 双栏，导出会话包。",
    impact: "个人项目",
    kind: "stream-probe",
    stack: ["Chrome MV3", "ReadableStream", "SSE", "AI SDK"],
    teaser: "See every frame",
    accent: "#0891b2",
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
    id: "dev-debug",
    slug: "dev-debug",
    title: "AI Agent",
    subtitle: "提问 · 编排 · 调度 · 工具",
    hook: "理解问句 → 辨认意图 → 规划任务 → 运行 → 能力",
    desc: "按图中步骤走完一轮。每个节点进不同能力，不是同一页。",
    impact: "Agent 平台",
    kind: "dev-debug",
    stack: ["MCP", "RAG", "SKILL.md", "SSE"],
    teaser: "对话 · 编排 · 运行 · 盯进度",
    accent: "#6366f1",
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
export const HOME_AGENT = WORKS.find((w) => w.slug === "dev-debug")!;
export const LAB_WORKS = WORKS.filter((w) => w.tier === "lab");

/** 首页：工作相关项目 */
export const PROJECT_WORKS = WORKS.filter((w) => ["imean", "builder"].includes(w.slug));
