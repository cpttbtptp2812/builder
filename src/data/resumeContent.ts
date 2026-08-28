/** Boss 直聘履历正文 — 工作经历 & 项目经历 */

export type ResumeSection = {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
  subsections?: { heading: string; bullets: string[] }[];
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
};

export type JobExperienceEntry = {
  company: string;
  role: string;
  period: string;
  stack?: string[];
  sections: ResumeSection[];
  achievements: string[];
};

export const resumeProjectEntries: ResumeProjectEntry[] = [
  {
    id: "imean",
    name: "iMean AI 智能自动化操作平台",
    role: "前端开发工程师",
    period: "2025.08 — 至今",
    workSlug: "imean",
    stack: [
      "Next.js 14/16",
      "React Flow",
      "Vercel AI SDK",
      "GraphQL",
      "Vite",
      "Valtio",
      "Playwright",
    ],
    sections: [
      {
        heading: "项目概述",
        paragraphs: [
          "iMean AI 智能自动化操作平台是一个基于 AI 的自动化工具，用户可以通过自然语言指令，让系统自动在浏览器上执行各种操作任务。项目采用微前端架构，包含三个核心子项目：Builder（工作流编辑器）、Agent（AI 对话界面）、SDK（执行引擎），支持本地执行、云端执行和远程执行三种模式，实现从工作流配置、AI 对话到自动化执行的完整闭环。",
        ],
      },
      {
        heading: "技术栈",
        bullets: [
          "Builder：Next.js 14 + React Flow + @dnd-kit + TipTap + Zustand + GraphQL",
          "Agent：Next.js 16 App Router + Vercel AI SDK + Apollo Client + Tailwind CSS + shadcn/ui",
          "SDK：React 18 + TypeScript 5 + Vite 4 + Valtio + Semi Design + GraphQL + WebSocket + IndexedDB",
        ],
      },
      {
        heading: "我的分工",
        bullets: [
          "负责核心任务调度系统（SDK）：队列调度，暂停 / 恢复 / 跳过 / 失败重试；PostMessage 跨窗口协调，窗口管理器 + 全局任务队列，多窗口有序执行；支持步骤、条件判断、循环等插件化任务类型",
          "开发工作流编辑器（Builder）：React Flow 可视化编排，拖拽节点，步骤 / 条件 / API 请求等节点类型，力导向图自动布局",
          "开发 AI 对话界面（Agent）：Next.js 16 + Vercel AI SDK 流式对话，GraphQL + Apollo 会话管理，文件上传与定时任务",
          "优化回放引擎元素定位（SDK）：优先级 / 表格 / 缓存多策略匹配 + 智能重试，定位成功率 70% → 90%+",
          "性能与质量：代码分割、懒加载、gzip 队列压缩、智能缓存；TypeScript + Playwright E2E",
        ],
      },
      {
        heading: "技术难点",
        bullets: [
          "跨窗口任务协调：窗口管理器追踪所有窗口，PostMessage 与主窗口通信，全局队列控制执行顺序，避免多 Tab 冲突",
          "元素定位稳定性：多策略匹配各带重试（最多 3 次），组合降级将成功率从 70% 提升到 90% 以上",
        ],
      },
    ],
    achievements: [
      "完成核心任务调度系统与对话式 UI，跨窗口协调稳定运行，解决多窗口执行顺序与状态同步难点",
      "多策略元素匹配 + 分割懒加载 + 数据压缩，定位成功率与首屏性能显著提升，包体积减少约 30%",
      "TypeScript 规范与 Playwright E2E，整体稳定性与用户体验改善",
    ],
  },
  {
    id: "jianchi",
    name: "剑池项目管理重构",
    role: "架构",
    period: "2025.01 — 2025.03",
    workSlug: "jianchi",
    stack: ["React Hooks", "antd", "Redux", "React DnD", "react-window", "Web Workers"],
    sections: [
      {
        heading: "项目背景",
        bullets: [
          "负责阿里巴巴剑池项目管理平台重构",
          "原系统 React Class + alife 架构，组件耦合高、难维护，首屏慢",
          "新需求平均 2 周周期，60% 时间处理兼容性问题",
          "为微前端与移动端适配，迁移至 React Hooks + antd",
        ],
      },
      {
        heading: "重构内容",
        subsections: [
          {
            heading: "TR 流程创建",
            bullets: [
              "React DnD 可视化拖拽配置审批节点",
              "动态表单配置节点审批人规则",
              "基于角色的权限与条件渲染",
            ],
          },
          {
            heading: "自检模块",
            bullets: [
              "重构自检表数据结构，动态表单生成器",
              "问题风险记录：富文本、影响面选择、责任人补全",
            ],
          },
          {
            heading: "评审报告 & 会签",
            bullets: [
              "Redux selectors 聚合数据，Excel/PDF 导出",
              "会签意见收集、状态机处理拒绝/通过路径",
              "QA 节点条件渲染、意见对比、流程历史可视化",
            ],
          },
        ],
      },
      {
        heading: "技术亮点",
        bullets: [
          "可配置工作流引擎，动态节点与条件路由",
          "万级数据高性能表格，react-window 虚拟滚动",
          "Context + useReducer 复杂表单，Web Worker 大数据导出",
          "IndexedDB 离线缓存，ResizeObserver 响应式，Error Boundary 统一错误处理",
        ],
      },
    ],
    achievements: [
      "首屏 3.2s → 1.4s，审批配置时间 -40%，组件复用率 60%",
      "自检错误率 -35%，评审耗时 -25%，构建时间 -35%",
    ],
  },
  {
    id: "settlement",
    name: "采购结算入库单汇总发起结算",
    role: "前端开发工程师",
    period: "2023.11 — 2024.02",
    stack: ["React", "React Router", "MutationObserver", "IntersectionObserver"],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "针对医院供应商众多、结算流程繁琐的问题，开发入库单汇总发起结算功能，支持按筛选条件批量汇总并发起结算。",
        ],
      },
      {
        heading: "主要工作",
        subsections: [
          {
            heading: "页面懒加载分割",
            bullets: [
              "react-router-dom 路由存储，babel-plugin-import 按需导入 + route 懒加载",
            ],
          },
          {
            heading: "用户体验",
            bullets: ["MutationObserver 适配多级表头，保证各层级表头下布局正常"],
          },
          {
            heading: "动态表单封装",
            bullets: [
              "FormContext.Provider 传递 formStore，Field 注册到 useForm",
              "getEntities 挂载实例，setFieldsValue 前预处理 / 格式化 / 同步外部数据源",
              "onStoreChange / onValuesChange 联动监听",
            ],
          },
          {
            heading: "懒加载与无限滚动",
            bullets: [
              "IntersectionObserver 观察元素进入视口后 appendChild 加载",
              "列表底部 intersectionRatio 触发分页加载",
            ],
          },
          {
            heading: "代码优化",
            bullets: [
              "状态下放缩小影响面，key 减少多余 DOM",
              "useMemo 隔离子树 render，setTimeout 分帧防卡顿",
            ],
          },
        ],
      },
    ],
    achievements: [
      "路由与组件按需加载，降低首屏压力",
      "复杂表单统一封装，业务页维护成本下降",
    ],
  },
  {
    id: "fee-lib",
    name: "费控项目抽离公共组件库",
    role: "前端开发工程师",
    period: "2023.02 — 2023.04",
    workSlug: "fee",
    stack: ["React", "antd", "dumi", "gulp", "GitHub Actions"],
    sections: [
      {
        heading: "项目背景",
        paragraphs: [
          "为统一 UI 风格、交互与行为，提高稳定性与维护效率，对 antd 与 CSS 等进行封装，抽离公共组件库。",
        ],
      },
      {
        heading: "构建",
        bullets: [
          "gulp + babel + rename 将源码转 ES5 输出到指定目录",
        ],
      },
      {
        heading: "发布",
        bullets: [
          "chokidar watch 源文件变更触发 dumi build，推送 GitHub Pages",
          "GitHub Actions 监听 push，step 配置依赖与发布流程",
        ],
      },
      {
        heading: "搭建",
        bullets: [
          "dumi config 配置 title / mode，Markdown 嵌入 React 组件文档",
          "theme 全局样式变量；@testing-library/react-hooks 测试公共 Hook",
        ],
      },
    ],
    achievements: [
      "多项目 UI 一致，开发效率与还原度提升",
      "组件文档化，便于团队复用与维护",
    ],
  },
];

export const jobExperienceEntries: JobExperienceEntry[] = [
  {
    company: "天阳宏业科技股份有限公司",
    role: "前端开发工程师",
    period: "2025.05 — 至今",
    stack: ["JavaScript", "React", "TypeScript", "Next.js", "GraphQL"],
    sections: [
      {
        paragraphs: ["负责创业公司自研项目开发"],
      },
      {
        heading: "负责核心任务调度系统的开发",
        bullets: [
          "设计并实现基于队列的任务调度，支持暂停、恢复、跳过和失败重试",
          "PostMessage 跨窗口协调，窗口管理器追踪所有窗口，主窗口维护全局队列，多窗口有序无冲突",
          "多种任务类型（步骤、条件、循环、组件操作），插件化扩展",
        ],
      },
      {
        heading: "开发工作流编辑器（Builder）",
        bullets: [
          "React Flow 可视化编辑器，拖拽配置步骤 / 条件 / API 请求等节点",
          "力导向图自动布局，优化连接线",
        ],
      },
      {
        heading: "开发 AI 对话界面（Agent）",
        bullets: [
          "Next.js 16 App Router + Vercel AI SDK 流式对话，毫秒级响应",
          "GraphQL + Apollo Client 会话记录，文件上传与定时任务",
        ],
      },
      {
        heading: "优化回放引擎元素定位",
        bullets: [
          "优先级 / 表格 / 缓存多策略 + 智能重试，定位成功率 70% → 90%+",
        ],
      },
      {
        heading: "性能优化",
        bullets: [
          "代码分割、懒加载、gzip 队列压缩、智能缓存减少 DOM 查询",
          "TypeScript 提升质量，Playwright E2E 保障稳定性",
        ],
      },
    ],
    achievements: [
      "完成调度系统与对话 UI，跨窗口协调稳定，解决多窗口顺序与状态同步难点",
      "多策略定位 + 性能优化，成功率与包体积（约 -30%）显著改善",
      "代码规范与 E2E 测试，整体稳定性与体验提升",
    ],
  },
  {
    company: "软通动力信息技术（集团）股份有限公司",
    role: "前端开发工程师",
    period: "2024.09 — 2025.05",
    stack: ["React", "Redux", "react-window", "React DnD"],
    sections: [
      {
        paragraphs: ["负责阿里剑池系统项目重构"],
      },
      {
        heading: "现有功能维护与优化",
        subsections: [
          {
            heading: "缺陷修复",
            bullets: [
              "修复右侧定位菜单部分浏览器渲染异常",
              "修复多标签页状态同步问题",
            ],
          },
          {
            heading: "性能优化",
            bullets: [
              "react-window FixedSizeList 虚拟滚动，加载速度 +60%",
              "优化 Redux store，React.memo + useCallback 减少重渲染",
            ],
          },
        ],
      },
      {
        heading: "功能迭代",
        bullets: [
          "TR 流程：React DnD 可视化配置审批节点，动态表单配置审批人规则",
        ],
      },
      {
        heading: "技术债务",
        bullets: ["类组件迁移至函数组件 + Hooks"],
      },
    ],
    achievements: [
      "审批配置时间 -40%，自检错误率 -35%，评审耗时 -25%",
      "首屏 3.2s → 1.4s，组件复用率 60%，重复代码 -40%，构建时间 -35%",
    ],
  },
  {
    company: "汇合发展有限公司",
    role: "前端开发工程师",
    period: "2022.08 — 2024.06",
    stack: ["React", "Redux", "qiankun", "antd"],
    sections: [
      {
        paragraphs: [
          "在招商银行 2 年，担任项目组长（前端 4 人），负责薪福通智能费控模块开发与维护。",
          "技术栈：React + Hooks + HOC + Router + Redux 等。",
        ],
      },
      {
        heading: "技术产出",
        bullets: [
          "带领组员优化代码结构，代码检视提升质量，降低缺陷与 UI 还原偏差",
          "稳定性监控：用户操作监听与记录，提升生产问题排查效率",
          "搭建 qiankun 微前端，主项目拆为独立子项目",
          "搭建公共组件库，提高开发效率与 UI 还原度",
        ],
      },
      {
        heading: "成长",
        bullets: [
          "代码检视与每周培训，积累 gulp、dumi、qiankun 及 antd Form 二次封装经验",
        ],
      },
    ],
    achievements: [
      "微前端与子应用独立部署落地",
      "组件库与监控体系提升团队交付质量",
    ],
  },
  {
    company: "亚联信息技术有限责任公司",
    role: "Web 前端",
    period: "2018.05 — 2022.08",
    stack: ["React", "jQuery", "JavaScript"],
    sections: [
      {
        paragraphs: [
          "在民生银行总部担任项目组长 3 年（前端 5 人），负责自助设备、Pad 端与柜面系统维护与开发。",
        ],
      },
      {
        heading: "柜面系统",
        bullets: [
          "分布式改造，广州非税、账户交易渠道、同城结算、贵金属结构性改造、司法划扣等",
        ],
      },
      {
        heading: "远程银行",
        bullets: [
          "直销银行账户管理、远程见证、短信签约、互联网银行面签、名单圈存、信用卡增值、名单解锁、电子受理单打印等",
        ],
      },
      {
        heading: "Pad 端",
        bullets: ["本行他行授权转账、云速押电子签名、短信通知等"],
      },
    ],
    achievements: ["带领团队合理安排进度，多业务线按时按质交付"],
  },
  {
    company: "北京北大软件工程股份有限公司",
    role: "Java",
    period: "2016.06 — 2018.05",
    stack: ["Java", "Oracle", "BIRT"],
    sections: [
      {
        paragraphs: [
          "担任 Java 后端开发：项目立项、流程权限、工作量估算、进度初始化、成员参与度、PBS 与报表编写；项目过程中与客户沟通需求；产品库 / 受控库 / 开发库流程维护；BIRT 插件报表与流程修改。",
        ],
        bullets: ["涉及技术：Oracle 存储过程、Java、BIRT 插件"],
      },
    ],
    achievements: ["完成客户需求对接与项目流程、报表定制交付"],
  },
];
