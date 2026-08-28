/** 简历与项目数据 — 来源 Boss 直聘履历 + 仓库 */

import {
  jobExperienceEntries,
  resumeProjectEntries,
  type JobExperienceEntry,
  type ResumeProjectEntry,
} from "./resumeContent";

export const profile = {
  name: "王旭",
  title: "前端开发工程师",
  years: 10,
  degree: "本科",
  availability: "离职 · 随时到岗",
  email: "17301212105@163.com",
  phone: "19157288895",
  /** 首页一句话，不含完整简历 */
  tagline: "前端 · 自动化 · 交互演示作品站",
  /** 兼容旧页面 / 对话知识库 */
  summary:
    "10 年前端经验，深耕 React / TypeScript。主导 iMean AI 智能自动化平台，参与阿里剑池大型重构与招商银行微前端架构。",
  highlights: [
    "元素定位成功率 70% → 90%+",
    "首屏包体积减少约 30%",
    "剑池首屏 3.2s → 1.4s",
    "审批配置效率提升 40%",
  ],
};

export const advantages = [
  "具备深厚的 React、TypeScript 框架开发能力，熟练掌握 Hooks 和 Class 组件原理，精通 TypeScript 类型设计（Utility Types、泛型约束）。精通 JavaScript 原生代码和现代前端技术栈（GraphQL、WebSocket、IndexedDB）。",
  "负责前端的性能优化及稳定性治理，包括代码分割、懒加载、虚拟滚动、架构优化等技术手段，将系统性能提升 30% 以上，系统稳定性从 70% 提升到 90% 以上。",
  "负责智能自动化业务（iMean AI 平台）和大型项目重构（阿里巴巴剑池平台），负责需求的分发和技术方案的制定，具备从 0 到 1 的项目开发能力和系统重构经验。",
  "对大型项目重构和系统优化有着深入的理解，能准确把握业务需求和技术难点，具备较强的技术方案制定和执行能力。",
];

export const expectedJobs = [
  { title: "前端开发工程师", salary: "18-22K", city: "广州" },
  { title: "前端开发工程师", salary: "17-20K", city: "北京" },
  { title: "前端开发工程师", salary: "18-21K", city: "杭州" },
];

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
    items: ["Vercel AI SDK", "流式 SSE", "DOM 回放引擎", "PostMessage 跨窗口调度"],
  },
  {
    group: "性能 & 质量",
    items: ["代码分割 / 懒加载", "虚拟滚动", "IndexedDB 缓存", "Redux 优化", "dumi 组件库"],
  },
];

export type ResumeProject = ResumeProjectEntry;
export type JobExperience = JobExperienceEntry;

export const resumeProjects = resumeProjectEntries;
export const experience = jobExperienceEntries;

/** 对话知识库用的扁平摘要 */
function flatBullets(sections: ResumeProjectEntry["sections"], max = 4): string[] {
  const out: string[] = [];
  for (const s of sections) {
    if (s.bullets) out.push(...s.bullets);
    if (s.subsections) {
      for (const sub of s.subsections) out.push(...sub.bullets);
    }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

export const education = {
  school: "兰州理工大学",
  tag: "省部共建",
  degree: "本科",
  period: "2012 — 2016",
};

/** 对话知识库用完整项目列表 */
export type Project = ResumeProjectEntry & {
  repo?: string;
  demo?: boolean;
  desc: string;
  highlights: string[];
};

export const projects: Project[] = [
  {
    ...resumeProjects[0]!,
    name: "iMean AI 智能自动化平台",
    repo: "imean-ai / agent / Builder",
    desc:
      "基于 AI 的浏览器自动化平台，微前端含 Builder、Agent、SDK，支持本地 / 云端 / 远程三种执行模式。",
    highlights: flatBullets(resumeProjects[0]!.sections),
    demo: true,
  },
  {
    id: "agent",
    name: "Agent 对话系统",
    role: "核心开发",
    period: "2025",
    workSlug: "agent",
    repo: "tianyangAgent/agent",
    stack: ["Next.js 16", "AI SDK 5", "Apollo", "Tailwind", "shadcn/ui"],
    sections: [],
    desc: "企业级 AI 助手：流式 SSE 对话、Tool Call、工作流浮窗 pause/resume。",
    highlights: [
      "Vercel AI SDK 流式对话与 UIMessage 映射",
      "useAutoResume 断线续传",
      "GraphQL Provider send / resume 双模式",
    ],
    achievements: [
      "实现 useAutoResume 流恢复 Hook",
      "data-backend-tool 协议统一工具卡渲染",
    ],
    demo: true,
  },
  {
    id: "sdk",
    name: "iMean SDK 执行引擎",
    role: "核心开发",
    period: "2025",
    workSlug: "sdk",
    repo: "tianyang/imean-ai",
    stack: ["React 18", "TypeScript 5", "Vite", "IndexedDB", "WebSocket"],
    sections: [],
    desc: "浏览器 DOM 回放与任务调度：步骤 / 条件 / 循环，插件化扩展。",
    highlights: [
      "队列调度：暂停、恢复、跳过、失败重试",
      "ReplaySDK 多策略 Hover / Click 触发",
    ],
    achievements: ["初始包体积优化约 30%"],
    demo: true,
  },
  {
    ...resumeProjects[1]!,
    name: "阿里剑池项目管理重构",
    role: "前端架构",
    desc: "阿里巴巴剑池项目管理平台重构，Hooks + antd 迁移与 TR / 自检 / 会签模块。",
    highlights: flatBullets(resumeProjects[1]!.sections),
  },
  {
    id: "cmb",
    name: "招商银行 · 远程银行 & 柜面",
    role: "项目组长（前端 5 人）",
    period: "2022 — 2024",
    workSlug: "cmb",
    stack: ["React", "Redux", "微前端", "antd"],
    sections: [],
    desc: "分布式柜面改造、远程见证、Pad 端授权转账等核心模块维护与迭代。",
    highlights: ["带领团队按期交付多业务线", "分布式架构改造与渠道扩展"],
    achievements: ["远程银行与柜面多业务线稳定交付"],
  },
  {
    ...resumeProjects[3]!,
    id: "fee",
    name: "招行薪福通 · 智能费控",
    role: "项目组长（前端 4 人）",
    period: "2022 — 2023",
    desc: "抽离公共组件库，gulp + dumi + GitHub Actions 构建发布。",
    highlights: flatBullets(resumeProjects[3]!.sections),
  },
];
