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
  availability: "离职 · 随时到岗",
  careerStart: "2016-06-01",
  email: "17301212105@163.com",
  phone: "17376563937",
  homePitchPrefix: "React / TypeScript 深耕",
  homePitchBody:
    "近年聚焦 AI 应用与浏览器侧能力：曾参与 iMean 自动化平台（调度 · Agent 流式对话 · DOM 回放）；个人从 0 实现 OwnAgent，导入表格后由服务端按技能办理报销对账、工单和排班，发版前用客户原话对比两版。",
  tagline: "AI 应用前端 · 全栈交付 · 浏览器自动化",
  homeMetrics: [
    { label: "iMean", value: "自动化平台" },
    { label: "OwnAgent", value: "企业 AI 产品" },
    { label: "定位成功率", value: "90%+" },
  ],
  summary:
    "高级前端工程师，9 年+ 经验。曾参与 iMean AI 浏览器自动化平台（任务调度、Agent 流式对话、回放引擎）；个人从 0 设计并实现 OwnAgent——React + Hono + SQLite 全栈，客户导入表格后由服务端按技能办理报销对账、工单和排班，合计由引擎锁定；发版前用客户原话对比现用版与草稿，单步弄坏后能看出哪一句从过变成不过。底层自研 Agent Loop、MCP、Hybrid RAG 与技能路由，不依赖 LangChain。擅长 React / TypeScript、SSE 流式对话、Chrome MV3、性能优化与 E2E。曾带前端小组，有银行与阿里系项目经验。离职，随时到岗。",
  highlights: [
    "OwnAgent：导入表格办报销、工单、排班，合计由引擎算出",
    "iMean：回放定位 70% → 90%+，SDK 包体积 -30%",
    "OwnAgent：发版前对比两版，单步弄坏后能看出哪一句从过变成不过",
    "剑池重构：首屏 3.2s → 1.4s · 招行 qiankun 微前端组长",
  ],
};

export const advantages = [
  "9年+开发经验，深耕 React/Vue/Java/TypeScript 与复杂 Web 工程化，熟悉 qiankun 微前端、虚拟滚动性能优化与 Playwright E2E。",
  "近两年聚焦 AI 应用，将 SSE 流式对话、Agent 编排（自研 Loop、MCP/JSON-RPC 工具调用）与浏览器自动化落到可上线、可回归的产品。曾参与 iMean 自动化平台（TaskQueue/PostMessage 调度、React Flow 编排、DOM 回放，定位与包体积有可量化优化）。",
  "独立实现 OwnAgent（React、Hono、SQLite、Docker）：主线是企业 SKILL 发版治理——草稿与线上分离，改技能前用真实问法做双版本回放、变异测试与 check:skills/GitHub Action 同源门禁，通过后再替换；办事链路由服务端引擎处理 Excel/PDF/CSV 并锁数，发版评审侧接入 Z3 规则证明与 HiGHS 排班求解。",
  "有阿里、银行项目与前端组长经历，Java 出身，可独立前后端联调与全栈部署。",
];

export const expectedJobs = [
  "高级前端工程师",
  "AI 应用工程师",
  "前端工程师（React / TypeScript）",
];

export const skills = [
  {
    group: "核心",
    items: ["React", "TypeScript", "Next.js", "GraphQL", "WebSocket"],
  },
  {
    group: "AI & 全栈",
    items: [
      "Agent Loop / MCP",
      "Hybrid RAG",
      "SSE / ReadableStream",
      "Hono + SQLite",
      "Docker Compose",
    ],
  },
  {
    group: "浏览器 & 工程化",
    items: [
      "Chrome MV3",
      "DOM 回放",
      "React Flow",
      "Vite",
      "Playwright E2E",
      "qiankun 微前端",
      "虚拟滚动",
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
