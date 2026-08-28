/** 简历与项目数据 — 来源 loca.txt + agent / imean-ai / unicode 仓库 */

export const profile = {
  name: "王旭",
  title: "前端开发工程师",
  years: 10,
  location: "广州",
  email: "17301212105@163.com",
  phone: "19157288895",
  summary:
    "10 年前端经验，深耕 React / TypeScript 生态。主导 iMean AI 智能自动化平台（Agent 对话、SDK 调度引擎、Builder 工作流编辑器），" +
    "参与阿里剑池大型重构与招商银行微前端架构。擅长流式对话、任务调度、元素定位、性能优化与系统稳定性治理。",
  highlights: [
    "元素定位成功率 70% → 90%+",
    "首屏包体积减少约 30%",
    "剑池首屏 3.2s → 1.4s",
    "审批配置效率提升 40%",
  ],
};

export const skills = [
  {
    group: "框架 & 语言",
    items: ["React 19", "Next.js 16", "TypeScript", "GraphQL", "WebSocket"],
  },
  {
    group: "工程 & 架构",
    items: ["微前端 qiankun", "React Flow", "Zustand / Valtio", "Vite", "Playwright E2E"],
  },
  {
    group: "AI & 自动化",
    items: ["Vercel AI SDK", "流式 SSE", "DOM 回放引擎", "PostMessage 跨窗口调度", "MCP 工具卡"],
  },
  {
    group: "性能 & 质量",
    items: ["代码分割 / 懒加载", "虚拟滚动", "IndexedDB 缓存", "Redux 优化", "组件库 dumi"],
  },
];

export type Project = {
  id: string;
  name: string;
  role: string;
  period: string;
  repo?: string;
  stack: string[];
  desc: string;
  achievements: string[];
  demo?: boolean;
};

export const projects: Project[] = [
  {
    id: "imean",
    name: "iMean AI 智能自动化平台",
    role: "前端开发工程师",
    period: "2025.08 — 至今",
    repo: "imean-ai / agent / Builder",
    stack: ["Next.js 16", "React Flow", "Vercel AI SDK", "GraphQL", "Valtio", "Playwright"],
    desc:
      "基于 AI 的浏览器自动化平台，微前端架构含 Builder（工作流编辑器）、Agent（对话界面）、SDK（执行引擎），" +
      "支持本地 / 云端 / 远程三种执行模式。",
    achievements: [
      "设计 PostMessage 跨窗口任务调度，全局队列控制多窗口执行顺序",
      "React Flow 可视化工作流编辑器，力导向自动布局",
      "Vercel AI SDK 流式对话 + GraphQL 会话持久化",
      "多策略元素匹配（优先级 / 表格 / 缓存），定位成功率 90%+",
    ],
    demo: true,
  },
  {
    id: "agent",
    name: "Agent 对话系统",
    role: "核心开发",
    period: "2025",
    repo: "tianyangAgent/agent",
    stack: ["Next.js 16", "AI SDK 5", "Apollo", "Tailwind", "shadcn/ui"],
    desc:
      "企业级 AI 助手：流式 SSE 对话、多智能体切换、工作流浮窗 pause/resume、工具卡渲染、历史会话三 Tab。",
    achievements: [
      "实现 useAutoResume 流恢复 Hook，断线重连不丢上下文",
      "data-backend-tool 协议统一工具卡渲染",
      "GraphQL Provider 双模式 send / resume",
    ],
    demo: true,
  },
  {
    id: "sdk",
    name: "iMean SDK 执行引擎",
    role: "核心开发",
    period: "2025",
    repo: "tianyang/imean-ai",
    stack: ["React 18", "TypeScript 5", "Vite", "IndexedDB", "WebSocket"],
    desc:
      "浏览器 DOM 回放与任务调度核心：步骤 / 条件 / 循环 / 组件操作，插件化扩展，gzip 压缩任务队列。",
    achievements: [
      "队列调度：暂停、恢复、跳过、失败重试",
      "ReplaySDK 多策略 Hover / Click 触发",
      "初始包体积优化约 30%",
    ],
    demo: true,
  },
  {
    id: "jianchi",
    name: "阿里剑池项目管理重构",
    role: "前端架构",
    period: "2025.01 — 2025.03",
    stack: ["React Hooks", "React DnD", "Redux", "react-window", "Web Workers"],
    desc: "类组件 + alife 架构迁移至 Hooks + antd，TR 流程可视化、自检模块、会签增强。",
    achievements: [
      "首屏 3.2s → 1.4s，组件复用率 60%",
      "虚拟滚动加载速度 +60%",
      "审批配置时间 -40%，构建时间 -35%",
    ],
  },
  {
    id: "cmb",
    name: "招商银行 · 远程银行 & 柜面",
    role: "项目组长（前端 5 人）",
    period: "2022 — 2024",
    stack: ["React", "Redux", "微前端", "antd"],
    desc: "分布式柜面改造、远程见证、Pad 端授权转账等核心模块维护与迭代。",
    achievements: ["带领团队按期交付多业务线", "分布式架构改造与渠道扩展"],
  },
  {
    id: "fee",
    name: "招行薪福通 · 智能费控",
    role: "项目组长（前端 4 人）",
    period: "2022 — 2023",
    stack: ["React", "qiankun", "dumi", "gulp", "HOC"],
    desc: "微前端拆分、公共组件库、MutationObserver 表头适配、动态 Form 封装。",
    achievements: [
      "搭建 qiankun 微前端与子应用独立部署",
      "dumi 组件库 + GitHub Actions 自动发布",
      "稳定性监控与用户操作埋点",
    ],
  },
];

export const experience = [
  { company: "天阳科技（集团）", role: "前端开发工程师", period: "2025.08 — 至今" },
  { company: "软通动力", role: "前端开发工程师", period: "2024.09 — 2025.05" },
  { company: "汇合发展", role: "前端开发工程师", period: "2022.08 — 2024.06" },
  { company: "亚联信息", role: "Web 前端", period: "2018.05 — 2022.08" },
  { company: "北大软件", role: "Java 开发", period: "2016.06 — 2018.05" },
];

export const education = {
  school: "兰州理工大学",
  degree: "本科 · 信息与计算科学",
  period: "2012 — 2016",
};
