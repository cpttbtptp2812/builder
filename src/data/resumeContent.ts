/** 履历正文 — 工作经历 & 项目经历 */

export type ResumeSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: { heading: string; bullets: string[] }[];
};

/** 项目经历 — 长文导出字段（工作内容 / 项目业绩） */
export type ProjectPlainFields = {
  name: string;
  role: string;
  period: string;
  description: string;
  performance: string;
  url?: string;
};

/** 工作经历 — 长文导出字段（工作内容 / 工作业绩） */
export type JobPlainFields = {
  description: string;
  performance: string;
};

export type ResumeProjectEntry = {
  id: string;
  name: string;
  role: string;
  period: string;
  workSlug?: string;
  stack?: string[];
  sections: ResumeSection[];
  achievements: string[];
  personal?: boolean;
  plain?: ProjectPlainFields;
};

export type JobExperienceEntry = {
  company: string;
  role: string;
  period: string;
  stack?: string[];
  sections: ResumeSection[];
  achievements: string[];
  plain?: JobPlainFields;
};

// ─── 项目经历（3 条：个人 OwnAgent + 在职 iMean + 剑池重构） ───

export const resumeProjectEntries: ResumeProjectEntry[] = [
  {
    id: "imean",
    name: "iMean AI 智能自动化操作平台",
    role: "前端开发工程师",
    period: "2025.08 — 2026.05",
    workSlug: "imean",
    stack: [
      "Next.js 16",
      "React Flow",
      "Vercel AI SDK",
      "GraphQL",
      "Valtio",
      "Playwright",
    ],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "iMean 是创业团队自研的 AI 浏览器自动化平台：用户用自然语言描述任务，系统在真实浏览器里完成点击、填写、跳转。产品不是单一后台，而是微前端三件套——Builder 画流程、Agent 做流式对话和下发、SDK 注入业务页执行回放。三条线用 GraphQL 同步工作流定义，用 PostMessage 和全局任务队列把多窗口执行收成一条闭环。我主要做 SDK 调度、Builder 编排、Agent 流式消费，以及回放定位和包体积。",
          "和常规中后台不同，难点在浏览器运行时：没有进程锁、DOM 会变、注入包有体积预算、对话里的进度必须和队列步数对齐。下面按模块写用了什么技术、解决什么问题。",
        ],
      },
      {
        heading: "技术架构",
        bullets: [
          "Builder：Next.js 14 · React Flow · @dnd-kit · TipTap · Zustand · GraphQL",
          "Agent：Next.js 16 App Router · Vercel AI SDK · Apollo Client · Tailwind · shadcn/ui",
          "SDK：TypeScript 5 · Vite 4 · Valtio · WebSocket · IndexedDB · PostMessage",
        ],
      },
      {
        heading: "核心模块与职责",
        subsections: [
          {
            heading: "SDK 任务调度系统",
            bullets: [
              "TaskQueue：pause / resume / skip / retry。长流程几十步，失败或用户暂停后从队列头继续，避免整段重跑",
              "窗口管理器追踪打开的 Tab。主窗口持有全局队列，子窗口只上报就绪 / 完成 / 失败。消息带类型和序号，状态以主窗口为准",
              "浏览器没有进程级互斥。用 PostMessage 做窗口间锁：同一时刻只允许一个窗口 execute，其他排队，解决多 Tab 抢跑和状态分叉",
              "操作类型插件化。步骤、条件、循环、HTTP、DOM 各自 register({ type, execute })，调度循环不写死 switch，新能力只加插件",
              "步骤 JSON 常 30～50KB。用 CompressionStream gzip 写入 IndexedDB，读取 DecompressionStream 解压并 round-trip 校验，刷新后可续跑",
            ],
          },
          {
            heading: "Builder 工作流编辑器",
            bullets: [
              "React Flow 拖拽节点、连边；节点类型包括步骤、条件、循环、API 请求",
              "复杂图用 dagre 自动布局，避免拖着拖着交叉不可读，布局结果写回节点 position",
              "画布状态与 GraphQL 工作流定义双向同步，保存后 Agent / SDK 读到的是同一份图",
            ],
          },
          {
            heading: "Agent AI 对话界面",
            bullets: [
              "Next.js App Router + Vercel AI SDK 消费 SSE，把流式 part 映射成 UIMessage，Tool Call 渲染成卡片",
              "Apollo Client + GraphQL 管理会话、历史、文件上传、定时任务",
              "流可能中断。AbortController 取消当前读取，已收帧缓存后重连拼回去，避免对话显示的步数和 SDK 队列脱节",
              "Agent 下发任务后订阅执行进度，回放当前步与流程图高亮共用同一份 step id",
            ],
          },
          {
            heading: "回放引擎与性能",
            bullets: [
              "定位瀑布：CSS → XPath → 文本模糊 → 表格行列坐标 → IndexedDB 上次成功路径。每一层内部重试，失败再降级，成功立刻停",
              "Shadow DOM 不能只 querySelector 轻 DOM，要递归进 shadowRoot；异步渲染先等节点出现再点",
              "失败埋点看卡在哪一跳，针对性补策略。动态页回放成功率约 70% → 90%+",
              "SDK 要注入宿主页。Vite manualChunks 把 scheduler 和引导 UI 拆开，Replay 懒加载；队列 gzip。初始包约 180KB → 125KB gzip（约 -30%）",
              "Playwright 覆盖「匹配流程 → 回放点击 → 对话进度」主链路",
            ],
          },
        ],
      },
      {
        heading: "技术难点",
        bullets: [
          "多 Tab 无进程锁：用 PostMessage 序号 + 主窗口队列做互斥，避免抢执行",
          "选择器失效：瀑布策略 + 缓存路径，而不是一条 CSS 写死",
          "对话下发与 SDK 执行进度不一致：队列持久化 + 流式续传，刷新后仍能对齐步数",
          "注入包体积：调度核心与回放引擎拆包，Replay 按需加载，队列 gzip 再进 IndexedDB",
        ],
      },
    ],
    achievements: [
      "全局队列 + PostMessage 解决多窗口抢跑，调度与对话 UI 在生产环境稳定运行",
      "定位瀑布把回放成功率做到 90%+；分包与压缩把 SDK 初始包降约 30%",
      "Playwright + TypeScript 把回放/对话主链路变成可回归的质量门禁",
    ],
    plain: {
      name: "iMean AI 智能自动化操作平台",
      role: "前端开发工程师",
      period: "2025.08 — 2026.05",
      url: "https://cpttbtptp2812.github.io/builder/#/work/imean",
      description:
        "iMean 是 AI 浏览器自动化平台，用户用自然语言描述任务，系统在真实浏览器中自动执行。前端拆为 Builder / Agent / SDK 三条微前端，我负责 SDK 调度、Builder 编排、Agent 流式对话及回放定位优化。\n\n1. 负责 SDK 任务调度：设计 TaskQueue（pause/resume/skip/retry），PostMessage 实现多 Tab 窗口互斥，插件化步骤执行，CompressionStream 压缩步骤队列持久化到 IndexedDB\n2. 负责 Builder 工作流编辑器：React Flow 拖拽编排，dagre 自动布局，画布与 GraphQL 工作流定义双向同步\n3. 负责 Agent 流式对话：Next.js + Vercel AI SDK 消费 SSE，Tool Call 卡片渲染，AbortController 断流续传，对话进度与 SDK 队列步数对齐\n4. 负责回放定位优化：CSS → XPath → 文本模糊 → 表格坐标 → 缓存路径多级瀑布策略，Shadow DOM 穿透，失败埋点分析\n5. 负责 SDK 包体积优化：Vite manualChunks 拆包 + Replay 懒加载 + 队列 gzip，Playwright 覆盖主链路 E2E 回归\n\n技术栈：Next.js、React Flow、Vercel AI SDK、GraphQL、Valtio、Vite、IndexedDB、PostMessage、Playwright",
      performance:
        "1. 全局队列 + PostMessage 互斥方案解决多窗口抢跑，调度与对话 UI 生产环境稳定运行\n2. 定位瀑布策略将动态页回放成功率从 70% 提升至 90%+\n3. SDK 分包与 gzip 压缩使初始包从 180KB 降至 125KB（约 -30%）\n4. 搭建 Playwright + TypeScript 主链路回归，降低发版回归成本",
    },
  },
  {
    id: "ownagent",
    name: "OwnAgent — 浏览器内 AI Agent 平台",
    role: "独立设计与全栈开发",
    period: "2026.03 — 至今",
    personal: true,
    workSlug: "ownagent",
    stack: [
      "React 19",
      "TypeScript",
      "SSE / JSON-RPC",
      "Hono",
      "SQLite",
      "IndexedDB",
      "Agent Loop",
      "Hybrid RAG",
      "MCP",
    ],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "OwnAgent 是我从零独立实现的浏览器内 AI Agent 平台（2026.03 至今）。常见做法是把 Loop、工具协议、检索封在服务端 SDK，前端只吃一条 SSE；出问题打开 Network 只有一条 pending 请求，分不清是意图路由选错了，还是工具入参拼了半截 JSON，还是检索根本没召回。本项目把这几层在 TypeScript 里逐层拆开实现，每一步选了哪个技能、调了哪个工具、入参如何拼装、检索命中哪一块均可追踪，不依赖 LangChain。",
        ],
      },
      {
        heading: "工作台七模块",
        bullets: [
          "对话：SSE 流式 Agent Loop + Guest Runtime 双模，同一套工具接口",
          "运行追踪：TraceSpan 记录 user → route → tool → reply，耗时/状态/入参落 localStorage",
          "知识检索：Hybrid RAG，命中带 chunkId 可点回原段",
          "技能路由：SKILL.md 声明 + 加权打分，打分矩阵页面可查",
          "回归评测：8 道路由题 + 5 道能力锁题，精度/预测值/前三名可视",
          "能力锁：read / mutate / abstain 先于路由和检索执行",
          "能力全景：所有技能触发词、工具列表、步骤流水线一览",
        ],
      },
      {
        heading: "Agent Loop — SSE 流式工具调用",
        bullets: [
          "流按 `data:` 行切分，用 Map 按 `index` 增量累积 tool_call：name/arguments 字符串拼接，流结束后 JSON.parse；半截绝不进执行层",
          "tool 结果以 `tool` 角色带 `tool_call_id` 写回 messages，再发起下一轮请求",
          "8 轮硬上限防死循环，模型不再下发 tool_call 即停止",
          "兼容 OpenAI Chat Completions 接口格式，支持 reasoning_content（思考块）流式渲染",
        ],
      },
      {
        heading: "进程内 MCP Server — JSON-RPC 2.0",
        bullets: [
          "不另起进程：McpInProcessServer 在浏览器主线程处理 tools/list + tools/call，请求带 jsonrpc/id/method/params，回包同 id 对应",
          "进工具前 validateParams：JSON Schema 校验类型与必填字段，校验失败/未知工具/运行时异常均返回 isError，不抛 UI",
          "已实现工具：http_probe（真实 fetch）、knowledge_search（RAG）、browser_snapshot（A11y tree）、workflow_run（队列入队）、policy_search / ticket_draft / ticket_commit（制度值班）",
        ],
      },
      {
        heading: "技能路由 — SKILL.md 声明式注册",
        bullets: [
          "每个技能声明 triggers / tools / steps，步骤 args 支持 `{{query}}` 模板和 `$prevResult` 引用",
          "打分规则：触发词长度 ≥ 4 字记 2 分，短词 1 分，技能名命中 +3 分；全员零分停止路由，不默认兜底",
          "固定优先级：site-analyzer → dom-probe → workflow-orchestrator → policy-desk → knowledge-lookup → 打分 Top-1",
          "Guest Runtime 再加一层意图正则（HEALTH/ABOUT/KNOWLEDGE/DOM/POLICY）覆盖打分，避免短句误路由",
          "7 道路由固定题：expectedSkillId 对预测值，显示前三名和失败样本，改触发词立即可验",
        ],
      },
      {
        heading: "Hybrid RAG — 纯浏览器分块检索",
        bullets: [
          "文档分 desc / architecture / narrative / challenge / aspect 段，每段生成 chunkId（格式 `${projectId}:${section}-${idx}`）",
          "混合打分：关键词 token 重叠每个 +0.11，整句命中 +0.25，直接匹配到项目 +0.22，section 语义加权；阈值 0.12 过滤",
          "命中带 chunkId / score / excerpt，点击可跳回原段；无向量库，浏览器内可跑",
          "用户手动添加的知识条目实时合并进语料，corpus 版本变化自动重建缓存",
        ],
      },
      {
        heading: "能力信封 — 问句先锁权限再检索",
        bullets: [
          "classifyCapability() 用正则检测：abstain（手册外事实，不检索不生成）/ mutate（改系统状态，只起草工单）/ read（制度问答）",
          "制度问答（read）：searchPolicy() 按 token 重叠 + 主题加权打分，detectConflict() 检测同 slot 现行/废止值冲突，冲突则 POLICY_CONFLICT 熔断不合成",
          "改权限（mutate）：只调 ticket_draft 生成 draft 工单，ticket_commit 未收到人工 allow 直接拒绝，对话里开通次数 0",
          "5 道能力锁固定题：对预测 cap / outcome，leakedCommit 计数，改权限对话误开通视为测试失败",
        ],
      },
      {
        heading: "记忆 · Trace · Guest Runtime",
        bullets: [
          "短期记忆：sessionStorage 12 轮滚动，注入 system prompt；长期记忆：IndexedDB（idbCache）分类存储，刷新不丢",
          "Trace：每轮保存 StoredTraceSession（traces + spans + totalMs），localStorage 最多 20 条，可跨页回放",
          "Guest Runtime：无 API Key 时走浏览器内工具循环，意图分类 → MCP 工具 → 规则合成回答；配 Key 后无缝切 LLM Agent Loop，同一套 MCP 接口",
        ],
      },
    ],
    achievements: [
      "自研 SSE 流式 Agent Loop：按 index 缓冲 tool_call name/arguments，完整后 JSON.parse，8 轮收敛，单点 isError 不中断",
      "进程内 JSON-RPC 2.0 MCP Server + SKILL.md 技能路由，全员零分不兜底；7 道路由题 + 5 道能力锁题固定回归",
      "Hybrid RAG 纯浏览器可跑，chunkId 溯源；能力信封锁权限优先于路由，制度问答带出处，改权限误开通为 0",
      "客户友好 UX：场景引导 + 文件/网页/粘贴导入 + 知识溯源 + 缺口检测 + 会话质量雷达",
    ],
    plain: {
      name: "OwnAgent — 浏览器内 AI Agent 平台",
      role: "独立设计与全栈开发",
      period: "2026.03 — 至今",
      url: "https://cpttbtptp2812.github.io/builder/#/work/ownagent",
      description:
        "从零独立设计并实现浏览器内 AI Agent 平台 OwnAgent（2026.03 至今）。常见做法是把 Loop、工具协议、检索封在服务端 SDK，前端只消费一段 SSE；出问题 Network 只有一条 pending，分不清是意图路由选错、工具入参拼了半截 JSON、还是检索根本没召回。本项目在 TypeScript 里把这几层逐层拆开，每步可追踪、可对账、可回归，不依赖 LangChain。\n\n1. 负责 Agent Loop：SSE 按 `data:` 行切分，用 Map 按 index 增量累积 tool_call（name/arguments 字符串拼接），流结束后整条 JSON.parse；tool 结果带 tool_call_id 写回 messages 发起下一轮；8 轮硬上限防止工具互相调用死循环\n2. 负责进程内 MCP Server（JSON-RPC 2.0）：tools/list + tools/call，validateParams JSON Schema 校验；校验失败/未知工具/运行时异常均返回 isError，不抛 UI，单工具失败整轮可继续；已实现 http_probe / knowledge_search / browser_snapshot / policy_search / ticket_draft / ticket_commit 等工具\n3. 负责技能路由（SKILL.md 声明式）：触发词 ≥4 字 2 分/短词 1 分/技能名 +3 分，固定优先级 + Top-1 执行，全员零分不兜底；Guest Runtime 加一层意图正则覆盖打分防止短句误路由；7 道固定题回归，改触发词影响可立即量化\n4. 负责 Hybrid RAG：文档按 desc/architecture/narrative/challenge/aspect 分块生成 chunkId；关键词 token 重叠 +0.11、整句命中 +0.25、项目直匹配 +0.22、阈值 0.12；命中带 chunkId/score/摘录可点回原段；无向量库，纯浏览器可跑\n5. 负责能力信封：classifyCapability() 问句先锁 read/mutate/abstain，优先于路由和检索执行；制度问答只输出手册原句带条款编号，detectConflict() 检测同 slot 现行/废止值冲突则 POLICY_CONFLICT 熔断；改权限只起草 ticket_draft，ticket_commit 未收到人工 allow 直接拒绝\n6. 负责记忆与 Trace：sessionStorage 12 轮短期记忆 + IndexedDB 长期记忆注入 system prompt；每轮 TraceSpan 落盘（耗时/状态/入参），localStorage 最多 20 条可跨页回放\n7. 负责双模运行时：无 API Key 走浏览器内 Guest Runtime（意图分类 + MCP 工具 + 规则合成），配 Key 走 LLM Agent Loop，同一套 MCP 接口，有后端走 Hono + SQLite\n\n技术栈：React 19、TypeScript、SSE、JSON-RPC 2.0、Hono、SQLite、IndexedDB",
      performance:
        "1. 自研 Agent Loop / 进程内 MCP Server / Hybrid RAG / Skill 路由 / Trace / Eval 全栈，不依赖 LangChain 一类框架，网上可打开实际运行\n2. SSE 按 index 缓冲 tool_call + JSON Schema 校验 + isError 回流，流式工具调用 8 轮收敛，三类异常均不抛 UI，单点失败整轮可继续\n3. 路由打分矩阵 + RAG chunkId 可对账；7 道路由固定题 + 5 道能力锁固定题，精度/前三名/失败样本页面可查\n4. 能力信封先于路由执行，制度问答带出处（GROUNDED），同 slot 新旧冲突熔断（POLICY_CONFLICT），改权限对话里误开通为 0（NEEDS_HITL → 人工 allow → COMMITTED）",
    },
  },
  {
    id: "jianchi",
    name: "阿里剑池 · 前端重构与性能优化",
    role: "前端开发工程师（软通驻场）",
    period: "2024.09 — 2025.05",
    workSlug: "jianchi",
    stack: ["React", "react-window", "React DnD", "Redux", "reselect", "Web Worker"],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "剑池是阿里内部研发工具链，核心页面是超长列表、复杂表格和 TR 审批配置。业务同学日常打开的是几千到上万行的配置表：滚动、筛选、勾选、再拖审批节点。历史实现是类组件 + 全量 map 渲染——8000 行表格一次挂上几十上百个 DOM，滚动掉到十几帧，首屏大约 3.2 秒。store 里塞了整页大对象，connect 过宽，一次 setState 会把整表刷掉。",
          "业务不能停服，不能 Big Bang 重写。驻场期间按模块渐进重构：先把列表从全量渲染改成虚拟滚动，再治理 Redux 订阅导致的无效重渲，同时把审批从静态表单改成可拖拽编排。每个迭代交付一块能回归的模块，新旧路由共存。",
        ],
      },
      {
        heading: "虚拟滚动",
        bullets: [
          "react-window FixedSizeList：itemSize 固定 36px，只 mount 视口高度 / 行高 + overscan 2 行。滚动时用 scrollTop 算 startIndex，绝对定位平移可见行，视口内 DOM 从约 80 个降到约 15 个，滚动 FPS 从约 18 回到 58+",
          "行高可估计所以用定高列表。不定高要用 VariableSizeList，还要缓存每行测量高度；当时表格行高一致，上可变高度是过度设计",
          "虚拟列表只渲染视口，滚动条高度必须用「行数 × 行高」撑起来，否则用户感觉列表被截断。overscan 取 2：少了快速滚动会闪白，多了白吃 DOM",
          "对比页 /work/jianchi 可切换全量渲染与虚拟滚动，对照 FPS、DOM 数量和 startIndex",
        ],
      },
      {
        heading: "渲染与状态",
        bullets: [
          "列表项用 React.memo，行数据和回调用 useCallback 稳定引用，避免父组件一次 setState 把 8000 行全刷掉",
          "Redux store 原先塞了整页大对象，组件 connect 过宽。按领域切片，列表只订列表 slice，审批只订审批 slice",
          "map / filter / sort 的派生结果用 reselect createSelector 缓存，上游引用不变就不重算。组件复用率大约从 18% 提到 60%",
          "TR 流程图节点坐标计算量大（DAG 拓扑 + 层级分配），放主线程会卡住滚动。丢进 Web Worker，postMessage 回主线程一次性绘制，主线程只负责渲染",
        ],
      },
      {
        heading: "TR 审批可视化",
        bullets: [
          "React DnD 拖拽审批节点，动态表单描述审批人规则和条件分支，把静态配置改成可编排",
          "拖拽预览层和虚拟列表共存：列表只渲染视口行，drag preview 必须挂到固定层，否则一滚节点就从列表卸载、预览丢失",
          "图上的节点顺序、条件边和表单 schema 双向同步，不能拖完图、提交还是旧配置",
        ],
      },
      {
        heading: "工程迁移",
        bullets: [
          "按业务模块切路由，新旧共存，每个迭代交付一块能回归的重构，拒绝一次性重写",
          "类组件迁 Hooks，统一 useEffect 订阅和清理，给后续 TypeScript 化铺路",
          "路由级 React.lazy + Suspense 拆包，降低首屏 JS",
          "生产上修过部分浏览器右侧菜单渲染异常、多标签页状态不同步",
        ],
      },
    ],
    achievements: [
      "列表首屏约 3.2s 降至 1.4s，滚动 FPS 约 18 → 58+",
      "审批配置平均耗时约 -40%，自检错误约 -35%，评审耗时约 -25%",
      "组件复用率约 18% → 60%，构建时间约 -35%",
    ],
    plain: {
      name: "阿里剑池 · 前端重构与性能优化",
      role: "前端开发工程师（软通驻场）",
      period: "2024.09 — 2025.05",
      url: "https://cpttbtptp2812.github.io/builder/#/work/jianchi",
      description:
        "剑池是阿里内部研发工具链，核心页面含超长列表（8000+ 行）、复杂表格和 TR 审批配置。历史实现全量渲染导致首屏 3.2s、滚动 FPS 仅 18。驻场期间按模块渐进重构，业务不停服。\n\n1. 负责超长列表虚拟滚动：react-window FixedSizeList，视口 DOM 从 80 个降至 15 个，滚动 FPS 从 18 提升至 58+\n2. 负责渲染性能治理：React.memo + useCallback 稳定引用，Redux 按领域切片，reselect 缓存派生数据，组件复用率 18% → 60%\n3. 负责 TR 审批可视化：React DnD 拖拽编排审批节点，解决拖拽预览层与虚拟列表共存问题\n4. 负责重型计算 offload：TR 流程图 DAG 拓扑计算放入 Web Worker，避免阻塞主线程滚动\n5. 负责渐进式工程迁移：类组件迁 Hooks，路由级 React.lazy 拆包，新旧路由共存迭代交付\n\n技术栈：React、react-window、React DnD、Redux、reselect、Web Worker",
      performance:
        "1. 列表首屏加载从 3.2s 优化至 1.4s，滚动 FPS 从 18 提升至 58+\n2. 审批配置平均耗时降低 40%，自检错误率降低 35%，评审耗时降低 25%\n3. 组件复用率从 18% 提升至 60%，构建时间降低 35%\n4. 渐进式重构全程未停服，按迭代交付可回归模块",
    },
  },
];

// ─── 工作经历（由近及远，与项目经历分工：这里写「公司职责」，项目写「代表作」） ───

export const jobExperienceEntries: JobExperienceEntry[] = [
  {
    company: "天阳宏业科技股份有限公司",
    role: "前端开发工程师",
    period: "2025.08 — 2026.05",
    stack: ["React", "TypeScript", "Next.js", "GraphQL", "Playwright"],
    plain: {
      description:
        "创业团队前端，参与自研产品 iMean AI 智能自动化平台。前端拆成 Builder / Agent / SDK 三条微前端，负责相关模块的需求交付、联调与上线；与产品、后端对齐 GraphQL 契约和发布节奏，保证画布、对话、执行读同一份工作流定义。参与 TypeScript 规范与 Playwright 主链路回归。\n\n任务队列、跨窗口调度、定位瀑布、包体积等实现与指标，见项目经历「iMean AI 智能自动化操作平台」，此处不重复。",
      performance:
        "1. 覆盖三条微前端的交付与联调，版本按期上线。\n2. 推动 TypeScript 与 Playwright 作为质量门禁，减少类型缺陷与主链路回归成本。\n3. 跨端对齐同一份工作流定义，降低画布 / 对话 / 执行状态分叉。",
    },
    sections: [
      {
        paragraphs: [
          "创业团队前端，参与 iMean AI。产品拆 Builder / Agent / SDK 三条微前端，负责相关模块的交付与联调；技术方案与指标见上方项目经历。",
        ],
      },
      {
        heading: "主要工作",
        bullets: [
          "三条微前端的需求交付、跨端联调与发版",
          "与产品 / 后端对齐 GraphQL 契约，保证画布、对话、执行读同一份图",
          "TypeScript 规范与 Playwright 主链路回归",
        ],
      },
    ],
    achievements: [
      "三条线按期交付",
      "契约对齐，减少跨端分叉",
      "主链路可回归",
    ],
  },
  {
    company: "软通动力信息技术（集团）股份有限公司",
    role: "前端开发工程师",
    period: "2024.09 — 2025.05",
    stack: ["React", "Redux", "TypeScript"],
    plain: {
      description:
        "软通驻场阿里巴巴，参与剑池内部研发工具链前端。职责是日常迭代、生产保障和与阿里侧的协作：对接产品 / 后端拆需求、对接口、按模块迭代上线；历史系统不能停服，新旧路由共存交付。值班处理生产缺陷（部分浏览器菜单渲染异常、多标签页状态不同步等），梳理报错路径，缩短问题闭环。推动类组件向 Hooks 迁移、Code Review 与类型约束。\n\n超长列表虚拟滚动、TR 审批拖拽编排、Redux 渲染治理等实现与指标，见项目经历「阿里剑池 · 前端重构与性能优化」，此处不重复。",
      performance:
        "1. 驻场期间按迭代交付，新旧共存未造成停服。\n2. 生产缺陷可复现、可闭环，定位周期缩短。\n3. Hooks 迁移与工程规范落地，后续维护成本下降。",
    },
    sections: [
      {
        paragraphs: [
          "软通驻场阿里，参与剑池研发工具链前端。负责日常迭代、生产保障与阿里侧联调；虚拟滚动、审批编排、渲染治理见上方项目经历。",
        ],
      },
      {
        heading: "主要工作",
        bullets: [
          "对接阿里产品 / 后端：需求拆分、接口联调、按迭代上线",
          "生产值班：菜单渲染、多 Tab 状态不同步等缺陷闭环",
          "新旧路由共存迁移；推动类组件 → Hooks、Code Review、类型约束",
        ],
      },
    ],
    achievements: [
      "重构按迭代交付，未停服",
      "生产问题闭环周期缩短",
      "Hooks 迁移与规范落地",
    ],
  },
  {
    company: "汇合发展有限公司",
    role: "前端开发工程师 · 项目组长",
    period: "2022.08 — 2024.06",
    stack: ["React", "Redux", "qiankun", "antd", "dumi"],
    plain: {
      description:
        "驻场招商银行薪福通项目，担任前端项目组长（团队 4 人），负责智能费控模块的开发、维护与版本交付。\n\n微前端架构建设：\n基于 qiankun 将原单体主应用拆分为可独立开发、独立部署的子应用，梳理主子应用通信、路由与公共资源加载策略；解决样式隔离、全局状态共享与发布节奏不一致等问题，支持多团队并行迭代。\n\n公共组件库与工程规范：\n使用 dumi 搭建内部组件库，沉淀表格、表单、布局等高频 UI 模式；对 antd Form 进行二次封装，统一校验、联动与提交流程，提升 UI 还原度并减少重复开发。\n\n稳定性与可观测性：\n设计并实现用户关键操作监听与日志上报机制，辅助生产环境问题复现与定位；推动代码检视（Code Review）与每周技术分享，降低缺陷率与 UI 还原偏差。\n\n团队管理：\n负责需求拆分、任务分配、进度跟踪与跨端联调协调；指导组员编码规范与疑难问题排查，保障费控模块按期高质量上线。",
      performance:
        "1. 微前端架构在薪福通费控场景成功落地，子应用可独立构建与部署，发布效率与并行开发能力明显提升，减少主应用全量发布风险。\n2. 公共组件库推广后，同类页面开发效率提高，UI 一致性与还原度改善；稳定性监控帮助缩短线上问题定位时间，生产故障排查效率提升。\n3. 带领 4 人前端小组完成多轮费控需求迭代与线上稳定性治理，按期交付核心业务功能，团队代码质量与协作流程持续优化。",
    },
    sections: [
      {
        paragraphs: [
          "招商银行薪福通 · 智能费控（汇合发展驻场）。前端组长，4 人团队。",
        ],
      },
      {
        heading: "主要工作",
        bullets: [
          "qiankun 微前端拆分、独立部署与主子通信",
          "dumi 组件库 + antd Form 二次封装",
          "用户操作监控与生产问题排查",
          "Code Review、培训、排期与联调",
        ],
      },
    ],
    achievements: [
      "微前端 + 组件库落地",
      "团队交付质量与稳定性提升",
    ],
  },
  {
    company: "亚联信息技术有限责任公司",
    role: "Web 前端 · 项目组长",
    period: "2018.05 — 2022.08",
    stack: ["React", "jQuery", "JavaScript"],
    plain: {
      description:
        "驻场民生银行总部，任前端组长（5 人），负责柜面、远程银行、Pad 端等多条线前端开发。参与分布式改造与多项业务模块交付，协调排期与代码质量。",
      performance:
        "1. 带领 5 人前端按时交付柜面 / 远程银行 / Pad 多条业务线。\n2. 完成分布式改造及非税、同城结算、远程见证等模块上线。",
    },
    sections: [
      {
        paragraphs: [
          "民生银行总部 — 柜面系统、远程银行、Pad 端。前端组长，5 人团队。",
        ],
      },
      {
        heading: "主要工作",
        bullets: [
          "柜面：分布式改造、非税、同城结算、司法划扣等",
          "远程银行：见证、面签、圈存、受理单等",
          "Pad：授权转账、电子签名等",
          "团队排期、代码评审、跨模块联调",
        ],
      },
    ],
    achievements: [
      "多业务线按时按质交付",
      "3 年组长经验，金融场景复杂表单与流程",
    ],
  },
  {
    company: "北京北大软件工程股份有限公司",
    role: "Java 开发工程师",
    period: "2016.06 — 2018.05",
    stack: ["Java", "Oracle", "BIRT"],
    plain: {
      description:
        "参与项目管理类产品研发：需求沟通、流程权限、工作量估算、PBS 与报表定制。维护产品库 / 受控库 / 开发库流程，Oracle 存储过程与 BIRT 报表开发。",
      performance: "1. 完成多个客户需求对接与流程、报表定制交付。",
    },
    sections: [
      {
        paragraphs: [
          "项目管理软件后端与报表。Java + Oracle + BIRT，客户现场需求对接。",
        ],
      },
    ],
    achievements: ["需求对接与报表流程交付"],
  },
];
