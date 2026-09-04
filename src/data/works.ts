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
  | "extension-demo";

/** flagship = 简历主推；lab = 技术深潜模块 */
export type WorkTier = "flagship" | "lab";

export type Work = {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  /** 卡片主文案 — 讲解决了什么问题 */
  desc: string;
  /** 一行钩子 — 比 desc 更短、更抓眼 */
  hook: string;
  /** 成果数字 — 卡片右上角 */
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
    id: "agent",
    slug: "agent",
    title: "UniAgent",
    subtitle: "企业 AI Agent · SSE + MCP",
    hook: "开箱即用 Agent — Guest 模式免配置；可选接入 LLM 完整 Loop",
    desc: "默认 Guest Agent：Router 选 Skill → MCP 真实执行，网站点开就能用。高级可勾选启用自有 LLM API。",
    impact: "AI SDK 5 全链路",

    kind: "agent-chat",
    stack: ["AI SDK 5", "MCP", "SSE", "Tool Call"],
    teaser: "发布前检查 → HTTP 探针 → 远程浏览器",
    accent: "#818cf8",
    tier: "flagship",
    featured: true,
  },
 
  {
    id: "skills",
    slug: "skills",
    title: "SkillForge",
    subtitle: "Agent Skills 运行时",
    hook: "Skill Runtime Lab — 路由矩阵 + MCP 流水线 + Performance/DOM 审计面板",
    desc: "Router Lab 可见 trigger 打分；三个 Skill 跑 http_probe · browser_snapshot · workflow_run，Trace 逐步展开 JSON。",
    impact: "Skills + MCP Runtime",

    kind: "agent-skills",
    stack: ["SKILL.md", "MCP", "Trigger Router", "Pipeline Trace"],
    teaser: "explainDiscovery → runSkill → DevTools Dashboard",
    accent: "#f59e0b",
    tier: "flagship",
    featured: true,
  },
  {
    id: "platform",
    slug: "platform",
    title: "Agent Platform Lab",
    subtitle: "RAG · Multi-Agent · Eval · Memory",
    hook: "30 秒演示：知识检索 → 三 Agent 协作 → 质量评估",
    desc: "点「一键演示」自动跑通。RAG 看召回和相关度；Multi-Agent 看规划/执行/汇总；Eval 看路由准确率。",
    impact: "RAG + Multi-Agent",
    kind: "agent-platform",
    stack: ["RAG", "Multi-Agent", "Eval Ops", "IndexedDB Memory"],
    teaser: "retrieve → 三 Agent Trace → Router Eval → IDB 记忆",
    accent: "#6366f1",
    tier: "flagship",
    featured: true,
  },
  {
    id: "imean",
    slug: "imean",
    title: "iMean AI",
    subtitle: "主项目 · AI 浏览器自动化",
    hook: "说一句话，系统自动在真实浏览器里跑完业务流程",
    desc: "对话匹配工作流 → 本地 / 云端 / 远程执行 → DOM 回放。微前端三件套：Builder + Agent + SDK。",
    impact: "定位 70%→92%",

    kind: "automation-chat",
    stack: ["React Flow", "ReplaySDK", "Web Worker", "GraphQL"],
    teaser: "输入「批量改价」→ 匹配流程 → 浏览器自动执行",
    accent: "#5eead4",
    tier: "flagship",
    featured: true,
  },
 
  {
    id: "clip-hub",
    slug: "clip-hub",
    title: "ClipHub",
    subtitle: "已上架 · Chrome 插件",
    hook: "选中文字保存页面位置，一键跳回原处 — 我自己每天在用的工具",
    desc: "Chrome MV3 扩展：右键保存片段 + 滚动位置，列表点击精准高亮跳回。",
    impact: "真实产品",

    kind: "product-tool",
    stack: ["Chrome MV3", "文字匹配", "本地存储"],
    teaser: "选中 → 保存 → 跳回高亮",
    accent: "#0d9488",
    tier: "flagship",
    featured: true,
  },
  {
    id: "builder",
    slug: "builder",
    title: "Workflow Builder",
    subtitle: "可视化流程编排",
    hook: "拖拽编排 + AI Copilot 改图，非技术也能看懂流程",
    desc: "React Flow 画布、dagre 自动布局、BFS 模拟运行，Copilot 自动插节点。",
    impact: "128 节点流畅",
    kind: "flow-builder",
    stack: ["React Flow", "dagre", "Valtio", "Copilot"],
    teaser: "拖节点 · AI 改图 · 模拟跑路径",
    accent: "#a78bfa",
    tier: "flagship",
    featured: true,
  },
  {
    id: "sse",
    slug: "sse",
    title: "GraphQL SSE",
    subtitle: "AI SDK Provider 实验室",
    hook: "左原始 SSE 帧、右 UIMessage — 线上长流截断问题的调试台",
    desc: "TTFB 打点、pause/resume 断线续传、node:http vs undici 对照。",
    impact: "长流截断 → 0",
    kind: "sse-lab",
    stack: ["SSE 帧解析", "UIMessage", "useAutoResume"],
    teaser: "三栏对照 · 技术事件流",
    accent: "#34d399",
    tier: "lab",
  },
  {
    id: "locator",
    slug: "locator",
    title: "Locator Engine",
    subtitle: "DOM 定位引擎",
    hook: "CSS → XPath → 文本 → IDB 缓存，一种不行自动换策略",
    desc: "ReplaySDK 核心：Shadow DOM 穿透、策略瀑布、优化前后命中率对比。",
    impact: "92% 命中率",
    kind: "locator-lab",
    stack: ["策略瀑布", "Shadow DOM", "IndexedDB"],
    teaser: "点元素 · 看 try/fail 链",
    accent: "#f0b429",
    tier: "lab",
  },
  {
    id: "sdk",
    slug: "sdk",
    title: "iMean SDK",
    subtitle: "浏览器执行引擎",
    hook: "纯 TS 任务队列，任意页面注入即可回放",
    desc: "TaskQueue 状态机、PostMessage 跨窗口 mutex、gzip 队列持久化。",
    impact: "包体积 -30%",
    kind: "replay-sdk",
    stack: ["TaskQueue", "PostMessage", "CompressionStream"],
    teaser: "pause/skip · 多窗口调度",
    accent: "#f472b6",
    tier: "lab",
  },
  {
    id: "extension",
    slug: "extension",
    title: "Playback Extension",
    subtitle: "Chrome 录制扩展",
    hook: "录一遍操作，直接导出 steps.json 进 Builder",
    desc: "MV3 Content Script 捕获、isolated world 高亮、实时 JSON 输出。",
    kind: "extension-demo",
    stack: ["MV3", "Content Script", "steps.json"],
    teaser: "录制 → JSON → 导入编排",
    accent: "#fb7185",
    tier: "lab",
  },
];

export function getWork(slug: string) {
  return WORKS.find((w) => w.slug === slug);
}

export const FLAGSHIP_WORKS = WORKS.filter((w) => w.tier === "flagship");
export const LAB_WORKS = WORKS.filter((w) => w.tier === "lab");
