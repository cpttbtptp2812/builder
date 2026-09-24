/** BOSS 直聘 · AI Agent 前端 / 全栈岗位能力图谱（2025–2026 归纳） */

export type JdCategory =
  | "frontend"
  | "agent"
  | "rag"
  | "tool"
  | "prompt"
  | "eval"
  | "engine";

export type JdViewId =
  | "chat"
  | "feed"
  | "rag"
  | "skills"
  | "guard"
  | "trace"
  | "eval"
  | "prompts"
  | "mcp";

export type JdCoverage = "done" | "partial" | "roadmap";

export type JdSkill = {
  id: string;
  category: JdCategory;
  title: string;
  /** BOSS JD 原文关键词 */
  jdKeywords: string[];
  /** 岗位背后的核心理论 / 考察点 */
  theory: string;
  /** 在本项目中的落点 */
  projectMap: string;
  view: JdViewId;
  /** 可操作的体验入口 */
  tryHint: string;
  coverage: JdCoverage;
  /** 面试可讲的一句话 */
  interviewLine: string;
};

export const JD_CATEGORY_LABEL: Record<JdCategory, string> = {
  frontend: "AI 前端交互",
  agent: "Agent 架构",
  rag: "RAG 检索增强",
  tool: "Tool / MCP",
  prompt: "Prompt 工程",
  eval: "评测与质量",
  engine: "工程化落地",
};

export const JD_SKILLS: JdSkill[] = [
  {
    id: "sse-stream",
    category: "frontend",
    title: "SSE 流式输出 + Markdown 渲染",
    jdKeywords: ["流式输出", "Markdown", "SSE", "Server-Sent Events", "对话界面"],
    theory:
      "大模型 token 级生成延迟高，前端需用 SSE/EventStream 增量渲染，配合 Markdown 组件做表格/代码块安全展示，避免整段替换造成闪烁与布局跳动。",
    projectMap: "agentRuntime.ts 真实 SSE · guestAgentRuntime 分块模拟 · AgentMarkdown 渲染",
    view: "chat",
    tryHint: "对话页提问任意问题，观察打字机效果与 Markdown 表格",
    coverage: "done",
    interviewLine: "我用 SSE delta 驱动 UI，流式与终态共用同一套气泡样式，元信息区预留高度防止 CLS。",
  },
  {
    id: "msg-mgmt",
    category: "frontend",
    title: "消息管理 · 多轮会话",
    jdKeywords: ["消息管理", "多轮对话", "会话", "导出", "重试"],
    theory:
      "Agent 产品不是单次问答，需要 session 持久化、history 截断策略、复制/重试/导出，以及 thread 内搜索，保证长对话可维护。",
    projectMap: "ownagentSessions.ts 多会话 · AgentProductDemo 重试/导出 JSON/对话搜索",
    view: "chat",
    tryHint: "顶栏「搜索」、消息「↻ 重试」、命令面板导出 Markdown/JSON",
    coverage: "done",
    interviewLine: "会话层分离 messages（展示）与 history（LLM 上下文），localStorage 持久化并做 legacy 迁移。",
  },
  {
    id: "react-comp",
    category: "frontend",
    title: "React 组件化 · 状态管理",
    jdKeywords: ["React", "TypeScript", "组件化", "可复用组件库", "性能优化"],
    theory:
      "AI 对话 UI 应拆成 Compose、MessageMeta、ToolRail、TracePanel 等可复用组件；流式状态与终态消息分离，避免单文件 God Component。",
    projectMap: "MessageMetaBar · ToolCallRail · TurnFlowPanel · 各 fx/agent 子组件",
    view: "chat",
    tryHint: "打开「详情」侧栏查看 Tool Chip / Reasoning 组件化拆分",
    coverage: "done",
    interviewLine: "hub 模式用 MessageMetaBar 统一工具条/依据/来源，流式结束淡入避免布局闪动。",
  },
  {
    id: "pmta",
    category: "agent",
    title: "Planning · Memory · Tools · Action",
    jdKeywords: ["任务规划", "记忆管理", "工具调用", "行动执行", "Agent 四大模块"],
    theory:
      "企业 Agent 常按 PMTA 建模：Planning 拆解任务，Memory 注入上下文，Tools 调外部能力，Action 执行并写回。LangGraph 即此结构的图编排实现。",
    projectMap: "turnFlowJournal read→route→fetch→write · guestAgentRuntime 路由 · agentMemory 工作记忆",
    view: "trace",
    tryHint: "运行日志 / 对话「来源」面板看四段流水线",
    coverage: "done",
    interviewLine: "用 FlowJournal 显式建模 PMTA，每轮 assistant 消息挂载 flowJournal 供溯源与 UI。",
  },
  {
    id: "react-loop",
    category: "agent",
    title: "ReAct · Tool Loop · 多 Agent",
    jdKeywords: ["ReAct", "CoT", "多智能体", "Workflow 编排", "Agentic Workflow"],
    theory:
      "ReAct = Reasoning + Acting 交替：模型输出 tool call → 执行 → 结果回填 → 再推理。多 Agent 则是 Planner/Executor/Reviewer 角色分工。",
    projectMap: "agentRuntime 最多 8 轮 tool loop · multiAgentRuntime · OwnSettings 编排模式切换",
    view: "chat",
    tryHint: "设置开启 LLM + 多 Agent，问「帮我对本站做发布前检查」",
    coverage: "done",
    interviewLine: "LLM 路径走 runAgentTurn tool loop；Guest 路径规则路由 + 开放工具链兜底。",
  },
  {
    id: "rag-hybrid",
    category: "rag",
    title: "RAG 混合检索 + 溯源",
    jdKeywords: ["RAG", "检索增强", "知识库", "向量数据库", "Milvus", "PGVector", "溯源"],
    theory:
      "RAG = Retrieve + Augment + Generate。工程上需 chunk/embedding/检索/rerank，前端要展示 hit 片段与 groundedness，降低幻觉感知。",
    projectMap: "ragEngine TF-IDF + Query Rewrite · retrieveRagEnhanced · /eval knowledge golden set",
    view: "rag",
    tryHint: "对话选「RAG Query Rewrite」模板 · 或输入 /search · 回答质检看资料库命中率",
    coverage: "done",
    interviewLine: "浏览器内 TF-IDF 余弦 + 多 query 融合，无需 embedding API 也能演示 RAG 全链路。",
  },
  {
    id: "mcp-fc",
    category: "tool",
    title: "Function Calling · MCP 协议",
    jdKeywords: ["Function Calling", "Tool Calling", "MCP", "tools/list", "tools/call"],
    theory:
      "MCP 标准化工具发现（tools/list）与调用（tools/call）。前端 Agent 需注册表、参数 JSON Schema、调用可视化与失败重试。",
    projectMap: "mcpBridgeLab 8 工具 · mcpServer JSON-RPC · McpToolsPanel 沙箱 · MessageMetaBar 时间线",
    view: "mcp",
    tryHint: "MCP 工具页沙箱调用 knowledge_search / http_probe",
    coverage: "done",
    interviewLine: "进程内 MCP Server 实现真实 fetch/检索，非 mock 定时器；对话内 ToolCallRail 展示每次调用耗时。",
  },
  {
    id: "prompt-tmpl",
    category: "prompt",
    title: "Prompt 工程 · 场景模板",
    jdKeywords: ["Prompt 工程", "Prompt 模板", "上下文工程", "Query Rewrite"],
    theory:
      "Prompt 工程师岗位虽减少，但能力并入 Agent 工程师：需场景化 system/user 模板、变量插值、Few-shot 与动态上下文压缩。",
    projectMap: "promptTemplates systemAddon · agentPromptRuntime 注入 runAgentTurn / Guest",
    view: "prompts",
    tryHint: "对话底部选模板 → system 立即生效 · 顶栏显示「已启用 xxx」",
    coverage: "done",
    interviewLine: "模板不只预填 user 消息，systemAddon 写入 LLM system prompt，RAG 模板联动 Query Rewrite。",
  },
  {
    id: "eval-reg",
    category: "eval",
    title: "评测集 · 回归 · 效果度量",
    jdKeywords: ["评测集", "效果度量", "回归机制", "质量保障", "Router Eval"],
    theory:
      "Agent 不是 demo 即交付，需 golden set + 自动回归（路由准确率、Policy 拦截率、工具链延迟），对话内也可触发 inline eval。",
    projectMap: "evalHarness · knowledgeEval 资料库 golden set · /eval knowledge · EvalLabPanel",
    view: "eval",
    tryHint: "回答质检页「开始检测」或对话 /eval knowledge",
    coverage: "done",
    interviewLine: "从用户资料库自动生成 QA 用例，测 RAG 能否命中对应 chunk，而不只测路由。",
  },
  {
    id: "hitl-policy",
    category: "eval",
    title: "HITL · Policy · 安全合规",
    jdKeywords: ["Human-in-the-Loop", "安全合规", "能力锁", "工单审批", "Prompt 注入"],
    theory:
      "高风险动作（开通权限、提交工单）需 Policy Desk 拦截 + 人工确认（HITL）。前端展示 trust 分数与 ticket 卡片。",
    projectMap: "policyDesk · GuardPanel · PolicyTrustCard · HitlTicketCard",
    view: "guard",
    tryHint: "安全管控配置规则 · 对话触发 ticket_draft / ticket_commit",
    coverage: "done",
    interviewLine: "制度检索 + 能力矩阵决定 auto/deny/hitl，前端可审计不可静默越权。",
  },
  {
    id: "trace-obs",
    category: "engine",
    title: "Trace · 可观测 · 运行统计",
    jdKeywords: ["执行流程追溯", "任务监控", "Langfuse", "Agent Trace", "timeline"],
    theory:
      "类似 Langfuse/OpenTelemetry：每轮记录 span（intent/tool/stream/reply）、耗时、runtime（local/server），便于排障与现场演示。",
    projectMap: "agentTraceStore · TracePanel · NeuralTraceStrip · SessionStats",
    view: "trace",
    tryHint: "运行日志页重放一次 Guest 运行",
    coverage: "done",
    interviewLine: "Trace 持久化 localStorage，buildSpansFromAgentRun 把 tool loop 转为时间线。",
  },
  {
    id: "api-resilience",
    category: "engine",
    title: "LLM API 封装 · 容错降级",
    jdKeywords: ["大模型 API", "重试", "容错", "降级", "Guest 兜底"],
    theory:
      "生产需统一 LLM SDK：Key 校验、auth 错误提示、abort/stop、无 Key 时 Guest/规则引擎降级，保证弱网/断网可用。",
    projectMap: "llmConfig · backendBridge 健康检查 · guestAgentRuntime 离线链路",
    view: "chat",
    tryHint: "设置关闭 LLM Key，仍可用 Guest 模式问答",
    coverage: "done",
    interviewLine: "peekRuntimeConfig 决定 preferServer* 特性，桥接失败自动回退浏览器运行时。",
  },
  {
    id: "skills-ext",
    category: "agent",
    title: "Skill 平台 · Agent 扩展",
    jdKeywords: ["Skill", "插件", "Agent 市场", "工作流引擎", "AntV X6"],
    theory:
      "可扩展 Agent 通过 SKILL.md 声明路由与工具，平台负责导入/运行/评测。可视化编排（X6/ReactFlow）是高级 JD 加分项。",
    projectMap: "skills/*/SKILL.md · SkillPlatformPanel · AgentHubOverview ReactFlow 编排",
    view: "skills",
    tryHint: "功能扩展导入 SKILL.md · 工作台「架构理论」看 Flow 编排",
    coverage: "partial",
    interviewLine: "内置 skill 路由 + 导入 Markdown skill；理论页保留 ReactFlow 节点编排演示。",
  },
  {
    id: "plaza-memory",
    category: "rag",
    title: "知识广场 · 工作记忆",
    jdKeywords: ["知识库", "工作记忆", "共享问答", "Memory", "增量更新"],
    theory:
      "Memory 分短期（对话 history/working set）与长期（知识库/广场）。先检索已有 QA 再调用 LLM 可降本增效。",
    projectMap: "plazaFeed 广场 · agentMemory IndexedDB · matchPlaza 优先命中",
    view: "feed",
    tryHint: "知识广场搜索 → 没有再问 AI → 发布回广场",
    coverage: "done",
    interviewLine: "发送管线：广场匹配 → 预设知识 → Guest/LLM，三级降本路径。",
  },
  {
    id: "deploy",
    category: "engine",
    title: "私有化 · Docker · 前后端分离",
    jdKeywords: ["Docker", "K8s", "私有化部署", "FastAPI", "微服务"],
    theory:
      "全栈 JD 要求 Agent 服务容器化、SQLite/向量库内网部署。前端 Vite 静态资源 + server/agent.ts API 是可演示的最小私有化形态。",
    projectMap: "server/index.ts · server/rag.ts · BackendStatusBar 在线/离线",
    view: "chat",
    tryHint: "顶栏 Backend 状态 · runtimeConfig preferServer* 开关",
    coverage: "partial",
    interviewLine: "backendBridge 探测 /health，失败则全链路 local fallback，可画部署拓扑说明。",
  },
];

export function listJdSkills(category?: JdCategory) {
  if (!category) return JD_SKILLS;
  return JD_SKILLS.filter((s) => s.category === category);
}

export function jdCoverageStats() {
  const total = JD_SKILLS.length;
  const done = JD_SKILLS.filter((s) => s.coverage === "done").length;
  const partial = JD_SKILLS.filter((s) => s.coverage === "partial").length;
  return { total, done, partial, pct: Math.round((done / total) * 100) };
}
