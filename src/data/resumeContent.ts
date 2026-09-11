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

// ─── 项目经历（2 条：在职 iMean + 个人 Agent Trace） ───

export const resumeProjectEntries: ResumeProjectEntry[] = [
  {
    id: "imean",
    name: "iMean AI 智能自动化操作平台",
    role: "前端开发工程师",
    period: "2025.08 — 至今",
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
          "iMean 是创业团队自研的 AI 浏览器自动化平台：用户用自然语言描述任务，系统在真实浏览器中完成点击、填写、跳转等操作。产品采用微前端，含 Builder（流程编排）、Agent（AI 对话）、SDK（执行引擎）三个子系统，支持本地 / 云端 / 远程三种执行模式，形成「配置 → 对话 → 执行」闭环。",
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
              "设计基于队列的任务调度，支持暂停、恢复、跳过、失败重试，提升长流程可控性",
              "PostMessage 跨窗口协调：窗口管理器追踪所有 Tab，主窗口维护全局队列，多窗口有序、无冲突",
              "插件化任务类型：步骤、条件判断、循环、组件操作等，便于扩展新能力",
              "CompressionStream 压缩队列持久化，IndexedDB 缓存任务状态",
            ],
          },
          {
            heading: "Builder 工作流编辑器",
            bullets: [
              "React Flow 可视化编排：拖拽节点、连线，支持步骤 / 条件 / API 请求等节点",
              "集成 dagre 力导向自动布局，优化复杂流程图可读性",
              "与 GraphQL 后端同步工作流定义，支持 Copilot 辅助改图（探索中）",
            ],
          },
          {
            heading: "Agent AI 对话界面",
            bullets: [
              "Vercel AI SDK 流式对话，UIMessage 映射与 Tool Call 渲染",
              "GraphQL + Apollo 管理会话、历史记录、文件上传与定时任务",
              "流式 SSE 对接后端，支持断线恢复与多轮上下文",
            ],
          },
          {
            heading: "回放引擎与性能",
            bullets: [
              "多策略元素定位：CSS 优先级、表格索引、本地缓存，各策略独立重试后瀑布降级",
              "定位成功率由约 70% 提升至 90%+，适配 Shadow DOM、异步渲染",
              "代码分割、路由懒加载、gzip 队列压缩，SDK 首屏包体积减少约 30%",
              "Playwright E2E 覆盖核心回放与对话链路",
            ],
          },
        ],
      },
      {
        heading: "技术难点",
        bullets: [
          "跨窗口执行顺序与状态同步：全局队列 + PostMessage 协议，避免多 Tab 并行抢执行",
          "动态页面元素定位：页面跳转、懒加载、DOM 变更下的稳定性与重试策略",
          "流式对话与自动化执行的状态一致性：Agent 下发任务与 SDK 执行反馈的闭环",
        ],
      },
    ],
    achievements: [
      "核心调度系统与 Agent 对话 UI 上线，跨窗口协调在生产环境稳定运行",
      "回放定位成功率 90%+，SDK 包体积约 -30%，首屏加载明显缩短",
      "建立 TypeScript 规范与 Playwright E2E，主链路质量可回归验证",
    ],
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
          "市面上的 Agent 框架大多把 Loop、工具协议、检索和评测藏在服务端 SDK 里，前端只剩一个聊天框。OwnAgent 反过来做：把「听懂问题 → 选技能 → 调工具 → 流式作答 → 留下可追踪的运行记录」整条链路在浏览器里从 0 实现一遍，打开网页即可运行，不需要配置 API Key。",
        ],
      },
      {
        heading: "核心模块",
        bullets: [
          "Agent Loop：OpenAI 兼容流式解析，增量累积 tool_call 参数，最多 8 轮工具迭代后收敛",
          "MCP Server（进程内）：JSON-RPC 2.0 实现 tools/list、tools/call，按 JSON Schema 校验入参，异常统一包成 isError 结果",
          "Skill 注册表：能力以 SKILL.md 声明 triggers / tools / steps，运行前按 trigger 加权打分选 Top-1，路由过程对用户可见",
          "RAG 检索：项目文档分块建语料，关键词重叠 + 项目直匹配 + 段落加权混合打分，每条命中带 chunkId 可溯源",
          "Multi-Agent：Planner / Executor / Reviewer 三角色协作，复杂请求先拆解再执行",
          "可观测：TraceSpan 协议（kind / label / ms / status / payload）记录每一步，时间线展示并持久化历史会话",
          "回归评测：路由用例集跑命中率与失败样本，工具 benchmark 统计真实耗时",
        ],
      },
      {
        heading: "工程取舍",
        bullets: [
          "双运行时：优先走 SQLite 服务端，不可用时自动降级为纯浏览器内运行，保证 demo 永远打得开",
          "工具执行统一异常边界，单个工具失败不中断整轮对话，失败信息回流给模型继续决策",
          "长期记忆用 IndexedDB、会话态用 sessionStorage，避免刷新即失忆又不污染跨会话上下文",
          "能力全部收敛到一个入口页（对话 / 追踪 / 检索 / 路由 / 评测），而不是散成多个 demo",
        ],
      },
    ],
    achievements: [
      "从 0 实现 Agent Loop、MCP Server、RAG、Skill 路由、Trace、Eval 六个子系统，无第三方 Agent 框架",
      "/work/ownagent 全部真实运行，面试可现场输入问题看完整调用链",
      "运行链路可追踪 + 可回归，把「AI 应用怎么调试」讲清楚，而不只是接一个对话框",
    ],
  },
];

// ─── 工作经历（由近及远，与项目经历分工：这里写「公司职责」，项目写「代表作」） ───

export const jobExperienceEntries: JobExperienceEntry[] = [
  {
    company: "天阳宏业科技股份有限公司",
    role: "前端开发工程师",
    period: "2025.05 — 至今",
    stack: ["React", "TypeScript", "Next.js", "GraphQL", "Vercel AI SDK", "Playwright"],
    plain: {
      description:
        "负责创业公司自研项目 iMean AI 智能自动化平台的前端开发与核心模块交付。\n\n负责核心任务调度系统（SDK）的开发：\n设计并实现基于队列的任务调度，支持暂停、恢复、跳过和失败重试，提升系统稳定性与可控性；通过 PostMessage 实现跨窗口任务协调，设计窗口管理器追踪所有打开窗口，主窗口维护全局任务队列，保证多窗口环境下任务有序执行、互不冲突；支持步骤、条件判断、循环、组件操作等多种任务类型，采用插件化设计便于扩展。\n\n开发工作流编辑器（Builder）：\n基于 React Flow 实现可视化流程编排，支持拖拽配置步骤 / 条件 / API 请求等节点类型，集成力导向图自动布局，优化复杂流程的可读性与编辑效率。\n\n开发 AI 对话界面（Agent）：\n基于 Next.js 16 App Router 与 Vercel AI SDK 实现流式对话，对接 GraphQL + Apollo 完成会话管理，支持文件上传、定时任务等能力。\n\n优化回放引擎元素定位与性能：\n实现优先级 / 表格 / 缓存等多策略元素匹配与智能重试；推进代码分割、懒加载、gzip 队列压缩与智能缓存；参与 TypeScript 规范与 Playwright E2E 建设。",
      performance:
        "1. 完成核心任务调度系统与对话式 UI 开发，支持跨窗口协调与多种任务类型，系统稳定运行，解决多窗口环境下执行顺序与状态同步的技术难点。\n2. 通过多策略元素匹配机制，将复杂动态页面上的元素定位成功率从 70% 提升至 90% 以上，显著增强回放稳定性；通过代码分割、懒加载与数据压缩，SDK 初始包体积减少约 30%，首屏加载时间明显缩短。\n3. 参与代码规范化建设，使用 TypeScript 提升代码质量、减少类型相关缺陷；引入 Playwright E2E 测试，保障自动化主链路稳定性与用户体验。",
    },
    sections: [
      {
        paragraphs: [
          "创业公司核心产品 iMean AI：AI + 浏览器自动化。前端覆盖微前端 Builder / Agent / SDK 三条线。",
        ],
      },
      {
        heading: "主要工作",
        bullets: [
          "SDK：队列调度、PostMessage 跨窗口、步骤 / 条件 / 循环插件化",
          "Builder：React Flow 可视化编排与自动布局",
          "Agent：Vercel AI SDK 流式对话、GraphQL 会话、文件与定时任务",
          "回放引擎多策略定位、性能优化（分割 / 懒加载 / gzip 队列）",
          "Playwright E2E、TypeScript 工程规范",
        ],
      },
    ],
    achievements: [
      "调度 + 对话 UI 稳定上线",
      "定位 90%+，包体积 -30%",
      "E2E 保障核心自动化链路",
    ],
  },
  {
    company: "软通动力信息技术（集团）股份有限公司",
    role: "前端开发工程师",
    period: "2024.09 — 2025.05",
    stack: ["React", "Redux", "react-window", "React DnD", "TypeScript"],
    plain: {
      description:
        "驻场阿里巴巴剑池系统，参与前端重构与持续迭代，保障核心研发工具链稳定可用。\n\n现有功能维护与优化：\n修复右侧定位菜单在部分浏览器下的渲染异常、多标签页状态不同步等生产缺陷；梳理高频报错路径，与后端协作定位接口与状态边界问题，缩短问题闭环周期。\n\n性能优化：\n针对超长列表与大数据量表格，引入 react-window FixedSizeList 虚拟滚动方案，减少 DOM 节点数量与无效渲染；结合 React.memo、useCallback 与 Redux store 结构优化，降低组件重复渲染，显著提升列表加载与滚动流畅度。\n\n功能迭代 — TR 审批流程：\n基于 React DnD 实现审批节点可视化拖拽配置，支持动态表单定义审批人规则与条件分支；将原本偏静态的配置流程改为可交互编排，降低业务同学理解与配置成本。\n\n技术债务治理：\n推动历史类组件向函数组件 + Hooks 迁移，统一状态管理与副作用写法；补充关键路径注释与类型约束，为后续 TypeScript 化打基础。",
      performance:
        "1. TR 审批流程可视化配置上线后，审批配置平均耗时降低约 40%，自检错误率降低约 35%，评审环节耗时降低约 25%，业务配置效率明显提升。\n2. 列表场景引入虚拟滚动与渲染优化后，首屏加载时间由约 3.2s 降至 1.4s，大数据量列表滚动与切换流畅度显著改善，用户反馈加载等待问题明显减少。\n3. 组件复用率提升至约 60%，重复代码减少约 40%，构建时间缩短约 35%，为团队后续迭代与维护降低成本。",
    },
    sections: [
      {
        paragraphs: [
          "阿里巴巴剑池系统 — 前端重构、性能优化与 TR 审批流程迭代（软通动力驻场）。",
        ],
      },
      {
        heading: "主要工作",
        bullets: [
          "生产缺陷：菜单渲染异常、多 Tab 状态同步等",
          "react-window 虚拟滚动，首屏 3.2s → 1.4s",
          "React DnD 审批节点可视化 + 动态表单规则",
          "类组件 → Hooks，Redux + memo 减渲染",
          "组件复用与构建体积治理",
        ],
      },
    ],
    achievements: [
      "审批配置 -40%，首屏 3.2s → 1.4s",
      "复用率 60%，构建 -35%",
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
