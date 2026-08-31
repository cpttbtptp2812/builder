/** 作品目录 — 每个项目独立路由与交互类型 */

export type WorkKind =
  | "product-tool"
  | "automation-chat"
  | "agent-chat"
  | "replay-sdk"
  | "perf-lab"
  | "multi-channel"
  | "micro-frontend"
  | "flow-builder"
  | "sse-lab"
  | "locator-lab"
  | "extension-demo";

export type Work = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  desc: string;
  period: string;
  kind: WorkKind;
  stack: string[];
  teaser: string;
  accent: string;
  featured?: boolean;
};

export const WORKS: Work[] = [
 
  {
    id: "imean",
    slug: "imean",
    title: "iMean AI",
    subtitle: "智能自动化平台",
    desc: "对话匹配工作流，ReplaySDK DOM 回放，本地 / 云端 / 远程三种执行模式",
    period: "2025 — 今",
    kind: "automation-chat",
    stack: ["React Flow", "ReplaySDK", "Web Worker", "GraphQL"],
    teaser: "说一句话 → 匹配流程 → 浏览器自动执行",
    accent: "#5eead4",
    featured: true,
  },
  {
    id: "clip-hub",
    slug: "clip-hub",
    title: "ClipHub",
    subtitle: "网页片段 · 跳回原位",
    desc: "Chrome / Edge 插件：右键保存选中文字与页面位置，点击列表精准跳回并高亮",
    period: "2026",
    kind: "product-tool",
    stack: ["Chrome MV3", "文字匹配", "本地存储"],
    teaser: "选中 → 右键保存 → 点击跳回原处",
    accent: "#0d9488",
    featured: true,
  },
  {
    id: "agent",
    slug: "agent",
    title: "UniAgent",
    subtitle: "SSE 流式 + MCP 工具链",
    desc: "流式对话、Reasoning、Tool Call、noVNC；进程内 MCP Server — 真实 fetch、知识库检索、JSON-RPC",
    period: "2025 — 今",
    kind: "agent-chat",
    stack: ["AI SDK 5", "MCP", "SSE", "Tool Call"],
    teaser: "流式对话 → MCP 工具 → Trace",
    accent: "#818cf8",
    featured: true,
  },
  {
    id: "builder",
    slug: "builder",
    title: "Workflow Builder",
    subtitle: "可视化编排器",
    desc: "React Flow 拖拽编排，AI Copilot 改图，dagre 布局，节点模拟运行",
    period: "2025",
    kind: "flow-builder",
    stack: ["React Flow", "dagre", "Valtio", "Copilot"],
    teaser: "拖节点 · Copilot 插节点 · 模拟跑路径",
    accent: "#a78bfa",
    featured: true,
  },
  {
    id: "sse",
    slug: "sse",
    title: "GraphQL SSE",
    subtitle: "AI SDK Provider",
    desc: "SSE 原始流 ↔ UIMessage 对照，TTFB 打点，pause/resume 断线续传",
    period: "2025",
    kind: "sse-lab",
    stack: ["SSE 帧解析", "UIMessage", "node:http", "useAutoResume"],
    teaser: "左原始 SSE · 右 parse 结果 · 中间技术日志",
    accent: "#34d399",
    featured: true,
  },
  {
    id: "locator",
    slug: "locator",
    title: "Locator Engine",
    subtitle: "元素定位引擎",
    desc: "CSS / XPath / 文本 / Shadow DOM / IndexedDB 缓存，策略瀑布定位",
    period: "2025",
    kind: "locator-lab",
    stack: ["策略瀑布", "Shadow DOM", "IndexedDB", "dispatchEvent"],
    teaser: "点元素 · 看策略 try/fail · 优化前后对比",
    accent: "#f0b429",
  },
  {
    id: "sdk",
    slug: "sdk",
    title: "iMean SDK",
    subtitle: "浏览器执行引擎",
    desc: "TaskQueue 状态机，PostMessage 跨窗口调度，CompressionStream 队列持久化",
    period: "2025",
    kind: "replay-sdk",
    stack: ["TaskQueue", "PostMessage", "CompressionStream", "Operation 插件"],
    teaser: "pause/skip · 多窗口 mutex · gzip 队列",
    accent: "#f472b6",
  },
  {
    id: "extension",
    slug: "extension",
    title: "Playback Extension",
    subtitle: "Chrome 录制扩展",
    desc: "MV3 Content Script 录制，isolated world 高亮，输出 steps.json",
    period: "2025",
    kind: "extension-demo",
    stack: ["MV3", "Content Script", "chrome.storage", "steps.json"],
    teaser: "录操作 · 实时出 JSON · 可导入 Builder",
    accent: "#fb7185",
  },
];

export function getWork(slug: string) {
  return WORKS.find((w) => w.slug === slug);
}
