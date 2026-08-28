/** 面试深聊知识库 — 6 个项目 + 通用话题，支持长对话 */

import { projects, type Project } from "./profile";

export type ProjectDetail = Project & {
  era: "current" | "history";
  architecture: string;
  challenges: string[];
  interviewTopics: string[];
  /** Overview for long-form chat */
  narrative: string;
  /** Aspect-specific deep answers */
  aspects: Record<string, string>;
};

export const PROJECT_DETAILS: ProjectDetail[] = [
  {
    ...projects.find((p) => p.id === "imean")!,
    era: "current",
    architecture:
      "微前端三件套：Builder（React Flow 工作流编辑）+ Agent（Next.js 对话）+ SDK（Vite 回放引擎）。" +
      "PostMessage 跨窗口调度全局任务队列，IndexedDB 持久化步骤，WebSocket 推送云端执行状态。",
    challenges: [
      "多窗口并发执行时的顺序与互斥 — 用全局队列 + 窗口心跳解决",
      "DOM 元素定位在动态页面失败率高 — 多策略匹配 + 缓存 + 表格行列索引",
      "Shadow DOM 嵌入宿主页面 — 样式隔离 + 事件代理",
    ],
    interviewTopics: [
      "PostMessage 调度设计",
      "元素定位 70%→90%",
      "React Flow 自动布局",
      "本地/云端/远程三种执行模式",
    ],
    narrative:
      "iMean AI 是我目前主导的智能自动化平台，核心是让 AI 理解用户意图后，在真实浏览器里自动完成操作。\n\n" +
      "架构上拆成 Builder、Agent、SDK 三个子应用。Builder 用 React Flow 做可视化编排，支持步骤、条件、循环和 HTTP/LLM 等组件；" +
      "Agent 是对话入口，负责意图识别、工作流匹配和 VNC 远程预览；SDK 是执行引擎，在页面里做 DOM 回放。\n\n" +
      "我负责的关键模块包括：跨窗口 PostMessage 调度（保证多 Tab 按序执行）、ReplaySDK 元素定位优化（成功率从 70% 提到 90%+）、" +
      "以及 React Flow 编辑器的力导向布局和性能优化。整个平台支持本地浏览器执行、云端 VNC、远程 Agent 三种模式。",
    aspects: {
      架构: "Builder + Agent + SDK 微前端，PostMessage 全局队列，GraphQL 后端，Shadow DOM 嵌入。",
      定位: "优先级链：CSS Selector → XPath → 表格坐标 → 文本模糊 → IndexedDB 缓存上次成功路径。失败自动降级并上报。",
      性能: "SDK 初始包 gzip 后减 30%；步骤队列压缩存储；懒加载 Replay 模块。",
      团队: "与后端 GraphQL、AI 团队联调 chatMatchWorkflows 和 cloudProcessDetail 订阅。",
    },
  },
  {
    ...projects.find((p) => p.id === "agent")!,
    era: "current",
    architecture:
      "Next.js 16 App Router + Vercel AI SDK v5 自定义 GraphQL Provider。" +
      "data-backend-tool 协议渲染工具卡，WorkflowProvider 管理 VNC 浮窗，Zustand + Apollo 持久化。",
    challenges: [
      "AI SDK 默认 fetch 在 Node 下截断 SSE — 改用 native http 模块",
      "工具 double-execution — 后端工具走 data part 而非 function call",
      "断线后流丢失 — useAutoResume + turnId 续传",
    ],
    interviewTopics: [
      "自定义 AI SDK Provider",
      "useAutoResume 流恢复",
      "工具卡 wave 动画",
      "虚拟滚动智能体列表",
    ],
    narrative:
      "Agent 是企业级 AI 助手前端，对标 ChatGPT 但多了工作流编排和工具生态。\n\n" +
      "技术栈 Next.js 16 + AI SDK 5 + Apollo GraphQL。我实现了自定义 GraphQL LanguageModel Provider，" +
      "把后端的 SSE 流桥接到 AI SDK 的 UIMessage 格式；因为 undici fetch 会截断长流，改用 Node native http。\n\n" +
      "另一个亮点是 useAutoResume：页面刷新或断网后，通过 pendingTurnId 调 /api/chat/resume 续传，" +
      "不丢半条 assistant 消息。工具渲染用 data-backend-tool 协议，避免 AI SDK function call 双重执行。\n\n" +
      "UI 上有 reasoning 折叠块、MCP/Knowledge/Todo 等异构工具卡、可拖拽 VNC 工作流浮窗、@tanstack/virtual 智能体列表。",
    aspects: {
      架构: "App Router 分 (home) 和 (chat) layout，WorkflowProvider 跨页面，SSE → UIMessage 管道。",
      流式: "experimental_throttle 100ms；ResizeObserver 输入框；smart auto-scroll。",
      工作流: "浮窗 iframe VNC，pause/resume/discard GraphQL mutation，切换会话自动 discard。",
      历史: "三 Tab：对话 / 收藏 / 定时任务，虚拟列表 + 批量删除。",
    },
  },
  {
    ...projects.find((p) => p.id === "sdk")!,
    era: "current",
    architecture:
      "Vite + TS 纯 SDK，ReplayController 驱动步骤执行，插件化 Operation 注册，gzip 队列持久化。",
    challenges: [
      "Hover/Click 在不同 SPA 框架下行为不一致",
      "大任务队列内存占用 — gzip + IndexedDB 分片",
      "失败步骤的用户可选手动完成",
    ],
    interviewTopics: ["队列调度 API", "ReplaySDK 插件", "包体积优化", "失败重试策略"],
    narrative:
      "SDK 是 iMean 的执行内核，不依赖 React，可在任意页面注入。\n\n" +
      "核心 ReplayController 按步骤查找 DOM、滚动到视口、dispatch 事件。支持条件分支、循环、等待、HTTP 组件。" +
      "我实现了全局队列：pause / resume / skip / retry，以及多策略 Hover 触发（mouseenter vs click）。\n\n" +
      "工程上把初始 bundle 从 ~180KB 压到 ~125KB（gzip -30%），任务队列用 gzip 存 IndexedDB。" +
      "OverRect + GuideContainer 做步骤引导 UI，和 example-chat 的 process 卡片联动。",
    aspects: {
      调度: "单例 TaskQueue，优先级队列，窗口级 mutex，PostMessage 广播状态。",
      回放: "findElement 多策略，scrollIntoView smooth，simulateClick 兼容 React 合成事件。",
      扩展: "Operation 插件注册表，新增组件类型不改核心循环。",
    },
  },
  {
    ...projects.find((p) => p.id === "jianchi")!,
    era: "history",
    architecture:
      "类组件 + alife → Hooks + antd 渐进迁移，react-window 虚拟列表，Web Worker 处理大列表计算。",
    challenges: [
      "20 万行 legacy 代码不能停服重写",
      "TR 流程图性能 — Canvas + 分层渲染",
      "Redux 过度渲染 — selector 优化 + memo",
    ],
    interviewTopics: ["首屏 3.2s→1.4s", "虚拟滚动", "类组件迁移策略", "React DnD 审批流"],
    narrative:
      "剑池是阿里内部项目管理平台，我负责前端架构重构，周期约 3 个月。\n\n" +
      "背景是 alife 老架构 + 类组件维护成本高，目标是 Hooks + antd 现代化，同时业务不能停。\n\n" +
      "策略是「按模块渐进替换」：先抽公共 Hooks 和组件库，再逐页迁移 TR 流程可视化、自检、会签模块。" +
      "性能方面：react-window 虚拟滚动让万级列表可滚动；Web Worker 做 TR 节点布局预计算；" +
      "路由级 code splitting 把首屏从 3.2s 打到 1.4s。Redux 用 reselect 减少 60% 无效渲染。\n\n" +
      "成果：组件复用率 60%，审批配置效率 +40%，构建时间 -35%。",
    aspects: {
      迁移: "共存期 alife 与新 antd 模块 iframe/路由隔离，共享 Redux store 子树。",
      性能: "webpack splitChunks 按路由；动态 import 重型图表；Worker  offload 布局。",
      流程: "React DnD 拖拽审批节点，会签增强支持并行/串行配置可视化。",
    },
  },
  {
    ...projects.find((p) => p.id === "cmb")!,
    era: "history",
    architecture:
      "招商银行分布式柜面，React + Redux，远程见证视频链路与 Pad 端授权转账，多渠道代码复用。",
    challenges: [
      "柜面/Pad/远程三端 UI 差异大但业务逻辑同",
      "视频见证低延迟与弱网重连",
      "监管合规下的操作留痕",
    ],
    interviewTopics: ["项目组长经验", "分布式柜面", "远程见证", "团队 5 人协作"],
    narrative:
      "在汇合发展期间担任招行远程银行 & 分布式柜面项目组长，带 5 人前端团队。\n\n" +
      "项目覆盖柜员桌面端、Pad 移动授权、远程视频见证等模块。我负责架构拆分、代码 Review 和核心流程交付。\n\n" +
      "技术上是 React + Redux + antd，重点在多渠道适配层：同一套业务 action，不同 channel 渲染不同 UI 组件。" +
      "远程见证涉及 WebRTC/专线视频 SDK 封装，弱网重连和双录合规是难点。\n\n" +
      "作为组长主要做任务拆分、风险同步、与产品和后端对齐接口，保证多业务线并行交付。",
    aspects: {
      管理: "5 人前端，双周迭代，Jira + 内部 Git，Code Review 门禁。",
      远程: "视频见证流程：排队 → 身份核验 → 业务办理 → 双录存档。",
      架构: "渠道抽象层 ChannelAdapter，Redux middleware 统一埋点。",
    },
  },
  {
    ...projects.find((p) => p.id === "fee")!,
    era: "history",
    architecture:
      "薪福通智能费控，qiankun 微前端主应用 + 多个 React 子应用，dumi 组件库独立发布。",
    challenges: [
      "子应用独立部署与样式隔离",
      "MutationObserver 适配动态表头",
      "HOC 封装动态 Form 字段联动",
    ],
    interviewTopics: ["qiankun 微前端", "dumi 组件库", "MutationObserver", "GitHub Actions CI"],
    narrative:
      "招行薪福通智能费控，我担任前端组长（4 人），负责微前端架构和公共能力。\n\n" +
      "用 qiankun 拆主应用和费控、审批等子应用，各自独立构建部署，registerMicroApps 按路由加载。" +
      "公共组件库用 dumi 文档化，GitHub Actions 自动发 npm。\n\n" +
      "业务亮点：MutationObserver 监听表格 DOM 变化做表头自适应；HOC 封装动态 Form，" +
      "根据后端 schema 渲染字段联动和校验。稳定性方面加了全局 ErrorBoundary 和用户操作埋点。",
    aspects: {
      微前端: "qiankun sandbox + 公共依赖 externals，子应用 vite/webpack 混部。",
      组件库: "dumi 写文档，gulp 打包 ES/CJS，Actions 发私有 npm。",
      表单: "HOC withDynamicForm，schema-driven，字段 visibility 表达式引擎。",
    },
  },
];

const KEYWORDS: Record<string, string[]> = {
  imean: ["imean", "immean", "智能自动化", "builder", "回放引擎", "元素定位", "postmessage"],
  agent: ["agent", "uniagent", "对话系统", "ai sdk", "流恢复", "autoresume", "工具卡"],
  sdk: ["sdk", "replay", "回放", "调度", "队列", "indexeddb"],
  jianchi: ["剑池", "jianchi", "阿里", "重构", "虚拟滚动", "alife", "tr流程"],
  cmb: ["招行", "招商", "柜面", "远程见证", "远程银行", "pad"],
  fee: ["薪福通", "费控", "qiankun", "微前端", "dumi", "mutationobserver"],
};

export function matchProject(text: string): ProjectDetail | null {
  const s = text.toLowerCase();
  for (const [id, keys] of Object.entries(KEYWORDS)) {
    if (keys.some((k) => s.includes(k.toLowerCase()) || text.includes(k))) {
      return PROJECT_DETAILS.find((p) => p.id === id) ?? null;
    }
  }
  if (/项目|经历|做过|介绍|简历/.test(text)) {
    return null; // general, handled separately
  }
  return null;
}

export function replyForProject(text: string): string | null {
  const project = matchProject(text);
  if (!project) {
    if (/我想了解这些项目/.test(text)) {
      const ids = PROJECT_DETAILS.filter((p) => text.includes(p.name)).map((p) => p.id);
      return replyForProjects(ids.length ? ids : PROJECT_DETAILS.slice(0, 2).map((p) => p.id));
    }
    if (/全部项目|所有项目|项目列表|做过哪些/.test(text)) {
      return (
        "我近 10 年做过 6 个代表性项目，可按名称深入聊：\n\n" +
        PROJECT_DETAILS.map(
          (p, i) =>
            `${i + 1}. **${p.name}**（${p.period}）\n   ${p.desc}\n   可问：${p.interviewTopics.slice(0, 2).join("、")}`,
        ).join("\n\n") +
        "\n\n你可以直接说「详细介绍 iMean」或「剑池重构难点」等，我会展开讲。"
      );
    }
    if (/自我介绍|介绍一下你|你是谁/.test(text)) {
      return (
        "我是王旭，10 年前端，目前在广州。从 Java 后端转前端，经历银行核心、阿里 enterprise 重构，" +
        "现在在 AI 自动化平台做 Agent 对话、SDK 回放和工作流编排。\n\n" +
        "强项是 React/TS 工程化、流式 AI 交互、性能优化和带 small team 交付。" +
        "你可以点上方项目按钮，或问我任意一个项目的架构、难点和成果。"
      );
    }
    if (/性能|优化/.test(text) && !/剑池|sdk|imean/.test(text)) {
      return (
        "性能优化我有多处实战：\n" +
        "• 剑池首屏 3.2s→1.4s（code split + virtual scroll + Worker）\n" +
        "• SDK 包体积 -30%（tree-shake + 懒加载 Replay）\n" +
        "• Agent 智能体列表 @tanstack/virtual 万级卡片\n" +
        "• 元素定位缓存减少重复 DOM 遍历\n\n" +
        "想深入哪一块可以继续问。"
      );
    }
    if (/团队|管理|组长/.test(text)) {
      return (
        "我带过 4–5 人前端团队（招行远程银行、薪福通费控）。\n" +
        "做法：任务按模块拆分、双周迭代、CR 门禁、与产品后端三角对齐。" +
        "自己仍写核心模块（架构、性能、复杂交互），代码 Review 帮团队统一规范。\n\n" +
        "招行项目是多业务线并行，风险点是接口延期 — 用 mock + 契约测试并行开发。"
      );
    }
    return null;
  }

  // Aspect-specific within project
  for (const [aspect, answer] of Object.entries(project.aspects)) {
    if (text.includes(aspect)) {
      return `【${project.name} · ${aspect}】\n\n${answer}\n\n${project.narrative.split("\n\n")[0]}`;
    }
  }
  if (/难点|挑战|问题|怎么解决/.test(text)) {
    return (
      `【${project.name} · 难点与解决】\n\n` +
      project.challenges.map((c, i) => `${i + 1}. ${c}`).join("\n") +
      `\n\n${project.narrative}`
    );
  }
  if (/架构|设计|技术方案/.test(text)) {
    return `【${project.name} · 架构】\n\n${project.architecture}\n\n${project.narrative}`;
  }
  if (/成果|亮点|数据|指标/.test(text)) {
    return (
      `【${project.name} · 成果】\n\n` +
      project.achievements.map((a) => `• ${a}`).join("\n") +
      `\n\n技术栈：${project.stack.join(" · ")}\n\n${project.narrative.split("\n\n").slice(-1)[0]}`
    );
  }

  return `【${project.name}】\n\n${project.narrative}\n\n---\n还可继续问：${project.interviewTopics.join(" · ")}`;
}

export function reasoningForProject(text: string): string {
  const project = matchProject(text);
  if (project) {
    return (
      `1. 识别项目：${project.name}\n` +
      `2. 匹配话题：${/架构/.test(text) ? "架构" : /难点/.test(text) ? "挑战" : "综合介绍"}\n` +
      `3. 从简历知识库组装 ${project.achievements.length} 条成果 + narrative`
    );
  }
  if (/全部项目|自我介绍/.test(text)) {
    return "1. 意图：概览请求\n2. 遍历 PROJECT_DETAILS\n3. 生成结构化列表";
  }
  return "1. 检索简历知识库\n2. 匹配通用话题（性能/团队/项目）\n3. 组装长文本回复";
}

export function getProjectById(id: string) {
  return PROJECT_DETAILS.find((p) => p.id === id);
}

/** Multi-project intro when visitor selects several on entry page */
export function replyForProjects(ids: string[]): string {
  const list = ids.map((id) => getProjectById(id)).filter(Boolean) as ProjectDetail[];
  if (!list.length) return "";

  if (list.length === 1) {
    const p = list[0]!;
    return `【${p.name}】\n\n${p.narrative}\n\n---\n可继续问：架构、难点、成果，或${p.demo ? "体验右侧交互演示" : "深入细节"}。`;
  }

  return (
    `你选了 ${list.length} 个项目，我按时间线简要介绍：\n\n` +
    list
      .map(
        (p, i) =>
          `${i + 1}. **${p.name}**（${p.period}）\n` +
          `   ${p.desc}\n` +
          `   核心成果：${p.achievements[0]}`,
      )
      .join("\n\n") +
    `\n\n---\n你可以指定任意一个项目，我会展开讲架构、难点和我的具体贡献。`
  );
}

export function buildMultiProjectPrompt(ids: string[]): string {
  const names = ids
    .map((id) => getProjectById(id)?.name)
    .filter(Boolean) as string[];
  if (names.length === 1) {
    return `详细介绍${names[0]}的项目背景、架构和我的贡献`;
  }
  return `我想了解这些项目：${names.join("、")}。请分别介绍项目背景、架构和我的贡献。`;
}

/** Quick prompts for ScenarioBar — grouped */
export const PROJECT_PROMPTS = PROJECT_DETAILS.map((p) => ({
  id: p.id,
  label: p.name.replace(/ · .+$/, "").slice(0, 8),
  prompt: `详细介绍${p.name}的项目背景、架构和你的贡献`,
  project: p.demo ? ("both" as const) : ("agent" as const),
}));

export const GENERAL_PROMPTS = [
  { id: "intro", label: "自我介绍", prompt: "请做一个3分钟的自我介绍", project: "agent" as const },
  { id: "all", label: "全部项目", prompt: "列出你做过所有项目并简要说明", project: "agent" as const },
  { id: "perf", label: "性能优化", prompt: "讲讲你在性能优化方面的实战经验", project: "agent" as const },
  { id: "team", label: "团队管理", prompt: "你作为组长的项目管理经验", project: "agent" as const },
];
