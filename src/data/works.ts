/** 作品目录 — 每个项目独立路由与交互类型 */

export type WorkKind =
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
    id: "agent",
    slug: "agent",
    title: "UniAgent",
    subtitle: "SSE 流式消费链",
    desc: "SSE 流式对话，Reasoning 思考链，Tool Call 卡片与 noVNC 远程桌面",
    period: "2025",
    kind: "agent-chat",
    stack: ["AI SDK 5", "SSE", "Tool Call", "noVNC"],
    teaser: "流式对话 + 工具调用 + 远程浏览器",
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
  {
    id: "jianchi",
    slug: "jianchi",
    title: "剑池项目管理",
    subtitle: "大型前端重构",
    desc: "react-window 虚拟滚动，8000 行表格 FPS 对比，Worker 布局预计算",
    period: "2025.01 — 03",
    kind: "perf-lab",
    stack: ["react-window", "虚拟滚动", "FPS 对比", "reselect"],
    teaser: "重构前/后 · 滚动看 FPS · DOM 节点数",
    accent: "#fb923c",
  },
  {
    id: "cmb",
    slug: "cmb",
    title: "远程银行 & 柜面",
    subtitle: "WebRTC 远程见证",
    desc: "RTCPeerConnection 连接状态机，ICE 重连，双录留痕，RTT 监控",
    period: "2022 — 2024",
    kind: "multi-channel",
    stack: ["WebRTC", "ICE", "MediaRecorder", "Redux middleware"],
    teaser: "Offer → Connected → 双录 · 技术事件流",
    accent: "#ef4444",
  },
  {
    id: "fee",
    slug: "fee",
    title: "智能费控",
    subtitle: "微前端 & 组件库",
    desc: "qiankun registerMicroApps 子应用加载，Bundle 瀑布图按需拆包",
    period: "2022 — 2023",
    kind: "micro-frontend",
    stack: ["qiankun", "dynamic import", "Bundle 分析", "样式隔离"],
    teaser: "瀑布图看 chunk · Tab 切换看 mount",
    accent: "#22d3ee",
  },
];

export function getWork(slug: string) {
  return WORKS.find((w) => w.slug === slug);
}
