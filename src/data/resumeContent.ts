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
        "iMean 是创业团队自研的 AI 浏览器自动化平台：用户用自然语言描述任务，系统在真实浏览器里完成点击、填写、跳转。前端不是单一后台，而是微前端三件套——Builder 画流程、Agent 做流式对话和下发、SDK 注入业务页执行回放。三条线用 GraphQL 同步工作流定义，用 PostMessage 和全局任务队列把多窗口执行收成一条闭环。我主要负责 SDK 调度、Builder 编排、Agent 流式消费，以及回放定位和包体积。\n\n和常规中后台不同，难点在浏览器运行时：没有进程锁、DOM 会变、注入包有体积预算、对话里的进度必须和队列步数对齐。\n\n一、SDK 任务调度。TaskQueue 支持 pause / resume / skip / retry。长流程几十步，失败或用户暂停后从队列头继续，避免整段重跑。窗口管理器追踪打开的 Tab：主窗口持有全局队列，子窗口只上报就绪 / 完成 / 失败，消息带类型和序号，状态以主窗口为准。浏览器没有进程级互斥，用 PostMessage 做窗口间锁——同一时刻只允许一个窗口 execute，其他排队，解决多 Tab 抢跑和状态分叉。操作类型插件化：步骤、条件、循环、HTTP、DOM 各自 register({ type, execute })，调度循环不写死 switch，新能力只加插件。步骤 JSON 常 30～50KB，用 CompressionStream gzip 写入 IndexedDB，读取时 DecompressionStream 解压并 round-trip 校验，刷新后可续跑。\n\n二、Builder 工作流编辑器。React Flow 拖拽节点、连边，节点类型包括步骤、条件、循环、API 请求。复杂图用 dagre 自动布局，避免拖着拖着交叉不可读，布局结果写回节点 position。画布与 GraphQL 工作流定义双向同步，保存后 Agent / SDK 读到的是同一份图。\n\n三、Agent 对话。Next.js App Router + Vercel AI SDK 消费 SSE，把流式 part 映射成 UIMessage，Tool Call 渲染成卡片。Apollo + GraphQL 管会话、历史、文件上传、定时任务。流可能中断：AbortController 取消当前读取，已收帧缓存后重连拼回去，避免对话显示的步数和 SDK 队列脱节。下发任务后订阅执行进度，回放当前步与流程图高亮共用同一份 step id。\n\n四、回放定位与包体积。定位走瀑布：CSS → XPath → 文本模糊 → 表格行列坐标 → IndexedDB 上次成功路径。每一层内部重试，失败再降级，成功立刻停。Shadow DOM 不能只 querySelector 轻 DOM，要递归进 shadowRoot；异步渲染先等节点出现再点。失败埋点看卡在哪一跳。动态页回放成功率约 70% → 90%+。SDK 要注入宿主页：Vite manualChunks 把 scheduler 和引导 UI 拆开，Replay 懒加载，队列 gzip。初始包约 180KB → 125KB gzip（约 -30%）。Playwright 覆盖「匹配流程 → 回放点击 → 对话进度」主链路。\n\n技术栈：Next.js、React Flow、Vercel AI SDK、GraphQL / Apollo、Valtio、Vite、IndexedDB、PostMessage、Playwright。",
      performance:
        "1. 全局队列 + PostMessage 解决多窗口抢跑，调度与对话 UI 在生产环境稳定运行。\n2. 定位瀑布把动态页回放成功率做到 90%+；分包与 gzip 把 SDK 初始包降约 30%。\n3. Playwright + TypeScript 把回放 / 对话主链路变成可回归的质量门禁。",
    },
  },
  {
    id: "ownagent",
    name: "OwnAgent — 浏览器内 AI Agent 平台",
    role: "独立设计与开发",
    period: "2026.03 — 至今",
    personal: true,
    workSlug: "ownagent",
    stack: ["React 19", "TypeScript", "Agent Loop", "MCP", "RAG", "SQLite"],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "常见 Agent 接入把 Loop、工具协议、检索封在服务端 SDK 里，前端只消费一段 SSE。出错时 Network 只有一条 pending 长请求，分不清是意图路由选错、工具入参还是半截 JSON、还是检索根本没召回。OwnAgent 是我独立设计实现的浏览器内 Agent 平台：把这几层在 TypeScript 里拆开，能看见每一步选了哪个技能、调了哪个工具、入参怎么拼起来、检索打到哪一块。不依赖 LangChain / LlamaIndex。",
          "产品形态是同一工作台里的六块：对话、运行追踪、知识检索、技能路由、回归评测、能力全景。无后端时走浏览器内 Guest Runtime，有 Hono + SQLite 时走服务端 Loop，协议层保持一致。",
        ],
      },
      {
        heading: "核心模块",
        subsections: [
          {
            heading: "Agent Loop · 流式工具调用",
            bullets: [
              "模型以 SSE 增量下发 tool_call。同一 index 的 name / arguments 会拆成多帧，按 index 累积，流结束或该 call 完整后再 JSON.parse，禁止半截参数进执行层",
              "单轮最多 8 次「模型 → 工具 → 再模型」，超出直接停，防止工具互相回调死循环",
              "工具结果写回 messages 再请求下一轮，循环收敛条件是：模型不再发 tool_call，或达到迭代上限",
            ],
          },
          {
            heading: "进程内 MCP",
            bullets: [
              "JSON-RPC 2.0：tools/list 列出能力，tools/call 执行，不走独立进程、不依赖外部 MCP 宿主",
              "每个工具带 JSON Schema，入参校验失败不进 execute",
              "运行时异常捕获后打成 isError 结构回流给模型，让它改参或换工具；单工具失败不中断整轮对话",
            ],
          },
          {
            heading: "SKILL.md 路由",
            bullets: [
              "技能文件声明 name、triggers、tools、steps。问句分词后对 trigger 加权：长词 2 分、短词 1 分，取 Top-1",
              "全员零分则停住，不默认落到站点体检一类兜底技能——否则所有问题走同一条链，路由等于没做",
              "explainDiscovery 返回完整打分矩阵，侧栏可对照 SKILL.md，改词能看见谁被抬高、谁被压掉",
            ],
          },
          {
            heading: "分块 RAG",
            bullets: [
              "文档按段落切块。检索叠关键词重叠、项目名称直匹配、段落位置加权，无向量库依赖，浏览器内可跑",
              "命中结果带 chunkId，UI 能回到原文，避免「搜到了但说不清哪一段」",
            ],
          },
          {
            heading: "Trace · Eval · 运行时",
            bullets: [
              "TraceSpan 记录 user → route → tool → reply（kind / ms / status / payload 摘要），会话写入 localStorage，刷新可回看",
              "Eval 用固定 query → expectedSkillId 回归路由命中率，输出失败样本；工具侧记真实耗时",
              "优先 Hono + SQLite；失败降级 Guest Runtime。IndexedDB 长期记忆，sessionStorage 会话态，刷新不丢、跨会话不串",
            ],
          },
        ],
      },
    ],
    achievements: [
      "自研 Agent Loop / MCP Server / RAG / Skill 路由 / Trace / Eval，不依赖 LangChain 一类框架",
      "SSE 增量累积 + Schema 校验 + isError 回流，把流式工具调用做成可收敛、单点失败可继续的循环",
      "路由打分和 RAG chunkId 可对账，改触发词可用用例集回归，避免默认落到同一条工具链",
    ],
    plain: {
      name: "OwnAgent — 浏览器内 AI Agent 平台",
      role: "独立设计与开发",
      period: "2026.03 — 至今",
      url: "https://cpttbtptp2812.github.io/builder/#/work/ownagent",
      description:
        "独立设计并实现浏览器内 AI Agent 平台 OwnAgent。常见做法是把 Loop、工具协议、检索封在服务端 SDK，前端只消费一段 SSE；出错时 Network 只有一条 pending 长请求，分不清是意图路由选错、工具入参还是半截 JSON、还是检索根本没召回。本项目把这几层在 TypeScript 里拆开实现，不依赖 LangChain / LlamaIndex。工作台包含对话、运行追踪、知识检索、技能路由、回归评测、能力全景。无后端走浏览器内 Guest Runtime，有服务时走 Hono + SQLite，协议层保持一致。\n\n一、Agent Loop。模型以 SSE 增量下发 tool_call。同一 index 的 name / arguments 会拆成多帧，实现上按 index 做累积缓冲区，流结束或该 call 完整后再 JSON.parse，禁止半截参数进执行层。单轮最多 8 次「模型 → 工具 → 再模型」，超出直接停，防止工具互相回调死循环。工具结果写回 messages 再请求下一轮，直到模型不再发 tool_call 或达到上限。\n\n二、进程内 MCP。JSON-RPC 2.0 实现 tools/list 与 tools/call，不走独立进程、不依赖外部 MCP 宿主。每个工具带 JSON Schema，入参校验失败不进 execute。运行时异常捕获后打成 isError 结构回流给模型，让它改参或换工具；单工具失败不中断整轮，避免一次调用错误导致整页白屏。\n\n三、Skill 路由。技能用 SKILL.md 声明 name、triggers、tools、steps。用户问句分词后对每条技能的 trigger 加权：长词 2 分、短词 1 分，取 Top-1。全员零分则停住，不默认落到「站点体检」一类兜底技能——否则所有问题都会走同一条链，路由等于没做。explainDiscovery 返回完整打分矩阵，改 trigger 时用固定用例集跑命中率并输出失败样本，避免修 A 伤 B。\n\n四、分块 RAG。文档按段落切块，检索叠关键词重叠、项目名称直匹配、段落位置加权。命中结果带 chunkId，界面能回到原文，避免「搜到了但说不清哪一段」。无向量库依赖，浏览器内可跑。\n\n五、Trace 与评测。TraceSpan 记录 user → route → tool → reply，字段含 kind、耗时 ms、status、payload 摘要；会话写入 localStorage，刷新后可回看。Eval 用固定 query → expectedSkillId 回归路由；工具侧记真实耗时。\n\n六、运行时降级。优先 Hono + SQLite；无后端时降级浏览器内运行时。IndexedDB 存长期记忆，sessionStorage 存会话态，刷新不丢、跨会话不串。\n\n技术栈：React 19、TypeScript、SSE、JSON-RPC 2.0 MCP、SKILL.md、分块 RAG、Hono、SQLite、IndexedDB。",
      performance:
        "1. 自研 Agent Loop / MCP Server / RAG / Skill 路由 / Trace / Eval，不依赖 LangChain 一类框架。\n2. SSE 增量累积 + Schema 校验 + isError 回流，流式工具调用可收敛，单点失败可继续。\n3. 路由打分和 RAG chunkId 可对账；改触发词用用例集回归，避免默认落到同一条工具链。",
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
        "剑池是阿里内部研发工具链，核心页面是超长列表、复杂表格和 TR 审批配置。业务同学日常打开的是几千到上万行的配置表：滚动、筛选、勾选、再拖审批节点。历史实现是类组件 + 全量 map 渲染——8000 行表格一次挂上几十上百个 DOM，滚动掉到十几帧，首屏大约 3.2 秒。Redux store 塞了整页大对象，connect 过宽，一次 setState 会把整表刷掉。业务不能停服，不能一次性重写。驻场期间按模块渐进重构：先把列表改成虚拟滚动，再治理无效重渲，同时把审批从静态表单改成可拖拽编排。\n\n一、虚拟滚动。用 react-window FixedSizeList，itemSize 固定 36px，只 mount「视口高度 / 行高 + overscan 2 行」。滚动时用 scrollTop 算 startIndex，绝对定位平移可见行。视口内 DOM 从约 80 个降到约 15 个，滚动 FPS 从约 18 回到 58+。行高可估计所以用定高列表；不定高要用 VariableSizeList 并缓存每行测量高度，当时表格行高一致，上可变高度是过度设计。滚动条高度用「行数 × 行高」撑起来，避免用户感觉列表被截断。overscan 取 2：少了快速滚动会闪白，多了白吃 DOM。\n\n二、渲染与状态。列表项 React.memo，行数据和回调用 useCallback 稳定引用，避免父组件一次 setState 把 8000 行全刷掉。store 按领域切片，列表只订列表 slice，审批只订审批 slice。map / filter / sort 的派生结果用 reselect createSelector 缓存，上游引用不变就不重算。组件复用率大约从 18% 提到 60%。TR 流程图节点坐标计算量大（DAG 拓扑 + 层级分配），放主线程会卡住滚动，丢进 Web Worker，postMessage 回主线程一次性绘制。\n\n三、TR 审批可视化。React DnD 拖拽审批节点，动态表单描述审批人规则和条件分支。难点是拖拽预览层和虚拟列表共存：列表只渲染视口行，drag preview 必须挂到固定层，否则一滚节点从列表卸载、预览丢失。图上的节点顺序、条件边和表单 schema 双向同步，不能拖完图、提交还是旧配置。\n\n四、工程迁移。按业务模块切路由，新旧共存，每个迭代交付一块能回归的重构。类组件迁 Hooks，统一 useEffect 订阅和清理。路由级 React.lazy + Suspense 拆包，降低首屏 JS。生产上修过部分浏览器右侧菜单渲染异常、多标签页状态不同步。\n\n技术栈：React、react-window、React DnD、Redux、reselect、Web Worker。",
      performance:
        "1. 列表首屏约 3.2s 降至 1.4s，滚动 FPS 约 18 → 58+。\n2. 审批配置平均耗时约 -40%，自检错误约 -35%，评审耗时约 -25%。\n3. 组件复用率约 18% → 60%，构建时间约 -35%。",
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
