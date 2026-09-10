/** 简历与项目数据 — 站点展示 */

import {
  jobExperienceEntries,
  resumeProjectEntries,
  type JobExperienceEntry,
  type ResumeProjectEntry,
} from "./resumeContent";

export const profile = {
  name: "王旭",
  title: "高级前端工程师",
  subtitle: "AI 应用 · 浏览器自动化 · Chrome 扩展",
  degree: "本科",
  location: "可远程 / 面议",
  availability: "在职看机会",
  careerStart: "2016-06-01",
  email: "17301212105@163.com",
  phone: "17376563937",
  homePitchPrefix: "React / TypeScript 深耕",
  homePitchBody:
    "近年聚焦 AI 应用与浏览器侧能力：在职参与 iMean 自动化平台（调度 · Agent 流式对话 · DOM 回放）；独立发布 StreamProbe（流式调试）与步骤记录器（操作复现）。",
  tagline: "AI 应用前端 · 浏览器自动化 · 工程化",
  homeMetrics: [
    { label: "iMean", value: "自动化平台" },
    { label: "StreamProbe", value: "个人开源" },
    { label: "定位成功率", value: "90%+" },
  ],
  summary:
    "高级前端工程师，9 年+ 经验。现任职参与 iMean AI 浏览器自动化平台（任务调度、Agent 流式对话、回放引擎）；独立开发 StreamProbe 流式调试扩展与步骤记录器复现工具。擅长 React / TypeScript、Chrome MV3、SSE / AI SDK、性能优化与 E2E。曾带前端小组，有银行与阿里系项目经验。",
  highlights: [
    "iMean：回放定位 70% → 90%+，SDK 包体积 -30%",
    "StreamProbe v1.0：SSE / fetch 流帧级 Chrome 调试",
    "剑池重构：首屏 3.2s → 1.4s",
    "招行：qiankun 微前端 + 组件库 · 前端组长",
  ],
};

export const advantages = [
  "9 年+ 前端经验，React / TypeScript 熟练，有 Next.js、GraphQL、微前端 qiankun 生产实践；近年深入 AI 应用（Vercel AI SDK、SSE 流式对话）与浏览器侧能力（DOM 回放、Chrome MV3 扩展）。",
  "在职参与 iMean AI 自动化平台：任务调度、跨窗口 PostMessage、React Flow 编排、回放多策略定位；有可量化结果（定位 90%+、包体积 -30%）。",
  "独立交付 2 个 Chrome 产品：StreamProbe（AI 流式帧级调试）、步骤记录器（操作复现与 HTML 手册），具备 0→1 产品、协议设计与发布能力。",
  "有前端组长经验（招行 4 人、民生 5 人），熟悉大型系统重构、虚拟滚动性能优化、E2E 与代码规范；Java 后端出身，理解全链路协作。",
];

export const expectedJobs = [
  "高级前端工程师",
  "AI 应用前端",
  "前端工程师（React / TypeScript）",
];

export const skills = [
  {
    group: "核心",
    items: ["React", "TypeScript", "Next.js", "GraphQL", "WebSocket"],
  },
  {
    group: "AI & 浏览器",
    items: [
      "Vercel AI SDK",
      "SSE / ReadableStream",
      "Chrome MV3",
      "DOM 回放",
      "React Flow",
    ],
  },
  {
    group: "工程化",
    items: [
      "Vite",
      "Playwright E2E",
      "qiankun 微前端",
      "虚拟滚动",
      "Valtio / Zustand",
    ],
  },
  {
    group: "其他",
    items: ["Redux", "antd", "dumi 组件库", "性能优化", "Java / Oracle"],
  },
];

export type ResumeProject = ResumeProjectEntry;
export type JobExperience = JobExperienceEntry;

export const resumeProjects = resumeProjectEntries;
export const experience = jobExperienceEntries;

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

export type Project = ResumeProjectEntry & {
  repo?: string;
  demo?: boolean;
  desc: string;
  highlights: string[];
};

export const projects: Project[] = resumeProjects.map((p) => ({
  ...p,
  repo: p.personal ? `personal / ${p.id}` : "company / imean",
  desc: p.sections[0]?.paragraphs?.[0] ?? p.name,
  highlights: flatBullets(p.sections),
  demo: Boolean(p.workSlug),
}));
