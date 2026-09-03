/** 简历与项目数据 — 来源 Boss 直聘履历 + 仓库 */

import {
  jobExperienceEntries,
  resumeProjectEntries,
  type JobExperienceEntry,
  type ResumeProjectEntry,
} from "./resumeContent";

export const profile = {
  name: "王旭",
  title: "前端工程师 · AI 自动化",
  degree: "本科",
  location: "",
  /** 工作年限起算日 — 北大软件入职 */
  careerStart: "2016-06-01",
  careerStartLabel: "自 2016.06 起",
  email: "17301212105@163.com",
  phone: "17376563937",
  /** 首页主 pitch — 站点第一眼介绍 */
  homePitch:
    "主导 iMean AI 智能自动化平台：Agent Skills 运行时、MCP 工具链、SSE 流式对话、浏览器 DOM 回放全链路。作品全部可在线交互试玩。",
  /** 首页一句话（兼容旧引用） */
  tagline:
    "10 年前端 · React / TypeScript · AI Agent 与浏览器自动化 · 作品可在线试玩",
  /** 首页成果条 */
  homeMetrics: [
    { label: "元素定位", value: "70% → 92%" },
    { label: "SDK 包体积", value: "-30%" },
    { label: "AI 方向", value: "Skills + MCP + SSE" },
  ],
  /** 兼容旧页面 / 对话知识库 */
  summary:
    "深耕 React / TypeScript。主导 iMean AI 智能自动化平台，负责 Agent 流式对话、SDK 回放引擎与 MCP 工具协议。",
  highlights: [
    "元素定位成功率 70% → 90%+",
    "SDK 首屏包体积减少约 30%",
    "SSE 长流截断问题修复（undici → native http）",
    "Agent + MCP + Tool Call 生产级链路",
  ],
};

export const advantages = [
  "具备深厚的 React、TypeScript 框架开发能力，熟练掌握 Hooks 和 Class 组件原理，精通 TypeScript 类型设计（Utility Types、泛型约束）。精通 JavaScript 原生代码和现代前端技术栈（GraphQL、WebSocket、IndexedDB）。",
  "负责前端的性能优化及稳定性治理，包括代码分割、懒加载、虚拟滚动、架构优化等技术手段，将系统性能提升 30% 以上，系统稳定性从 70% 提升到 90% 以上。",
  "负责智能自动化业务（iMean AI 平台）和大型项目重构（阿里巴巴剑池平台），负责需求的分发和技术方案的制定，具备从 0 到 1 的项目开发能力和系统重构经验。",
  "对大型项目重构和系统优化有着深入的理解，能准确把握业务需求和技术难点，具备较强的技术方案制定和执行能力。",
];

export const expectedJobs = [
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
    items: ["Vercel AI SDK", "MCP", "流式 SSE", "DOM 回放引擎"],
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
    id: "skills",
    name: "SkillForge · Agent Skills",
    role: "个人作品",
    period: "2026",
    workSlug: "skills",
    repo: "portfolio / skill-forge",
    stack: ["SKILL.md", "MCP", "Trigger Match", "Tool Call"],
    sections: [],
    desc: "Skill Runtime Lab：Router 矩阵 + MCP 流水线 + Performance/DOM 审计面板。",
    highlights: [
      "explainDiscovery 可见打分",
      "SKILL.md 来自 src/skills/ 真实文件",
      "http_probe / snapshot / workflow_run",
    ],
    achievements: ["3 技术 Skill · DevTools 面板"],
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
];
