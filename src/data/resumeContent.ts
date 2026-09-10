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

// ─── 项目经历（3 条：在职 flagship + 2 个个人产品） ───

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
    id: "streamprobe",
    name: "StreamProbe — 流式 API 浏览器调试器",
    role: "独立设计与开发",
    period: "2026.01 — 至今",
    personal: true,
    workSlug: "streamprobe",
    stack: [
      "Chrome MV3",
      "Side Panel",
      "ReadableStream",
      "SSE",
      "AI SDK Data Stream",
    ],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "做 AI 对话前端时，Chrome Network 只能看到一条「进行中的请求」，看不清 EventSource / fetch 流式 body 的每一帧，断流、首 token 慢、tool-call 字段错都很难查。StreamProbe 是个人独立设计与开发的 Chrome 扩展，专注帧级观测：hook 页面流式 API，Side Panel 展示时间线、TTFB、Raw 与 AI SDK 语义对照，可导出 JSON 会话。与 iMean 的「执行」层互补，IP 归个人所有。",
        ],
      },
      {
        heading: "产品能力",
        bullets: [
          "EventSource + fetch ReadableStream 双通道自动捕获",
          "Side Panel：连接列表 · 帧时间线 · Raw / Parsed 双栏详情",
          "TTFB、帧间隔、每连接帧数等指标",
          "导出 streamprobe JSON，便于联调协作与留档",
          "Popup 快捷入口 + demo.html 本地验证",
        ],
      },
      {
        heading: "技术实现",
        subsections: [
          {
            heading: "采集层（MAIN world）",
            bullets: [
              "inject-event-source.js：包装 EventSource，派发 open / message / error 帧",
              "inject-fetch-stream.js：检测 stream Content-Type，ReadableStream tee 按行切帧",
              "保留原生原型链，单例防重复 hook，降低与业务脚本冲突",
            ],
          },
          {
            heading: "通信与存储",
            bullets: [
              "ISOLATED world Bridge：CustomEvent → chrome.runtime.sendMessage",
              "Background 按 tabId 维护 connections + frames，环形缓冲上限 300 帧",
              "chrome.storage.session，不上传云端",
            ],
          },
          {
            heading: "解析内核 core/parsers.js",
            bullets: [
              "SSE event/data 行解析，NDJSON 行解析",
              "Vercel AI SDK 常见 type：text-delta、tool-call、tool-result、reasoning-delta 等",
              "computeMetrics 计算 TTFB、帧间隔",
            ],
          },
        ],
      },
      {
        heading: "技术难点",
        bullets: [
          "MAIN world 不能调用 chrome API，采集与 UI 严格分层",
          "fetch 流异步 tee 读 chunk，需限制单帧 8KB 与总帧数，避免长回复拖垮扩展",
          "同一帧可能属于 sse / json / ai-sdk 多种形态，解析器需可扩展",
        ],
      },
    ],
    achievements: [
      "v1.0.0 已发布 StreamProbe-Extension-v1.0.0.zip，Side Panel 帧级调试可用",
      "AI SDK 流式事件双栏解析，配套 PRODUCT 规格与 build 打包脚本",
      "个人开源产品，从 0 完成定义、架构、实现与文档",
    ],
  },
  {
    id: "skilltap",
    name: "步骤记录器 — Web 操作复现工具",
    role: "独立设计与开发",
    period: "2025.10 — 至今",
    personal: true,
    stack: ["Chrome MV3", "Content Script", "截图", "repro.json", "HTML 导出"],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "测试测出 bug 往往只能口头描述 + 拼截图，开发还要自己猜路径；教同事走后台流程也缺少可交付的说明。步骤记录器是个人 Chrome 扩展：在真实网页录点击、填写、跳转并截图，一键导出 HTML 操作手册（非技术同事可打开演示）或复现包（repro.json + 给开发.md + 截图 + 选择器与报错信息），开发不必先起本地项目就能对照定位。",
        ],
      },
      {
        heading: "产品能力",
        bullets: [
          "录制：click / fill / navigation，viewport 截图，probe 采集 console 与 network 异常",
          "步骤清洗：去噪、合并、选择器提取与可读标题",
          "导出 HTML 手册：可翻页演示，适合培训与交付",
          "导出 zip 复现包：手册 + 给开发.md + repro.json，可导入扩展回放",
          "Popup：录制控制、问题描述、预览与双通道导出",
        ],
      },
      {
        heading: "技术实现",
        subsections: [
          {
            heading: "录制引擎",
            bullets: [
              "Content Script 监听 DOM 事件，background 聚合步骤与截图",
              "probe.js 注入 MAIN world 采集 console.error 与 failed fetch",
              "session 存储录制态，支持暂停、清空、替换步骤",
            ],
          },
          {
            heading: "repro.json 协议",
            bullets: [
              "字段：steps、viewport、startUrl、userAgent、screenshots、findings、issue 描述",
              "pack.js 生成 zip；analyze 辅助选择器与报错摘要",
              "导入 repro.json 可在扩展内对照步骤与风险点",
            ],
          },
          {
            heading: "导出与受众",
            bullets: [
              "HTML 手册：面向实施 / 客户 / 非开发同事",
              "复现包：面向前端 / 测试协作，降低复现沟通成本",
            ],
          },
        ],
      },
      {
        heading: "技术难点",
        bullets: [
          "动态 SPA 上稳定捕获步骤并生成仍可读的选择器",
          "同一套录制数据同时服务「人读」与「机器读」两种导出格式",
          "截图与步骤时序对齐，控制扩展包体积与 session 上限",
        ],
      },
    ],
    achievements: [
      "SkillTap-Extension-v1.2.0.zip 已发布，HTML 手册与 repro 包双通道导出",
      "repro.json 协议可导入扩展，配套站点扩展详情页与安装说明",
      "与 iMean（自动执行）、StreamProbe（流观测）场景互补，个人 IP",
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
