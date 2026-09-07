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
    hook: "点开就能聊 — Guest 自动路由 Skill，MCP 真实执行",
    desc: "无需 API Key：输入问题即走 Router → http_probe / knowledge_search / browser_snapshot，右侧 Trace 展开 JSON。可选启用自有 LLM 跑完整 Agent Loop。",
    impact: "Guest + LLM 双模式",

    kind: "agent-chat",
    stack: ["AI SDK 5", "MCP", "Tool Trace", "Guest Router"],
    teaser: "发布前检查 → 探活 → 知识检索 → 可选远程浏览器",
    accent: "#818cf8",
    tier: "flagship",
    featured: true,
  },

  {
    id: "skills",
    slug: "skills",
    title: "SkillForge",
    subtitle: "Agent Skills 运行时",
    hook: "SKILL.md 流水线 — 路由可见、工具可测、指标可读",
    desc: "Router Lab 看 trigger 加权打分；三个 Skill 跑 Site Audit / DOM Probe / Workflow，每步 MCP 调用可展开 JSON，Performance API 出真实 latency 面板。",
    impact: "Skills + MCP Pipeline",
    kind: "agent-skills",
    stack: ["SKILL.md", "Trigger Router", "MCP Pipeline", "DevTools Metrics"],
    teaser: "explainDiscovery → runSkill → 指标面板 + Trace",
    accent: "#f59e0b",
    tier: "flagship",
    featured: true,
  },
  {
    id: "platform",
    slug: "platform",
    title: "Agent Platform Lab",
    subtitle: "RAG · Multi-Agent · Eval · Memory",
    hook: "30 秒跑通：知识召回 → 三 Agent 协作 → 路由与工具评估",
    desc: "一键演示自动走完三步。RAG 看 chunk 相关度；Multi-Agent 看 Planner / Executor / Reviewer 分工；Eval 看 Router 准确率与工具 P50/P99。",
    impact: "平台层总览",
    kind: "agent-platform",
    stack: ["RAG", "Multi-Agent", "Eval Harness", "SQLite Memory"],
    teaser: "retrieve → 三 Agent Trace → Router Eval → 长期记忆",
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
    id: "extension-hub",
    slug: "extension-hub",
    title: "插件集",
    subtitle: "Chrome 扩展 · 4 款已发布",
    hook: "自用浏览器插件合集 — 片段保存、API 调试、环境切换、SSE 流式排查",
    desc: "ClipHub / Mirror / Env / Wire：下载解压即用，数据仅存本地，面向前端与 AI 联调场景。",
    impact: "真实产品",
    kind: "product-tool",
    stack: ["Chrome MV3", "Fetch 劫持", "EventSource"],
    teaser: "ClipHub · Mirror · Env · Wire",
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
