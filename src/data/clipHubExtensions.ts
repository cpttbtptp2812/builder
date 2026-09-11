/**
 * 浏览器扩展目录
 * - 前端联调工具包：ClipHub + Env + Wire（一个 zip）
 * - StreamProbe / 步骤记录器：已归档，扩展页不再主推
 */

import { STREAM_PROBE } from "./streamProbe";

export type ExtensionStatus = "shipped";

export type ExtensionItem = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  desc: string;
  story?: string[];
  status: ExtensionStatus;
  zip: string;
  version: string;
  features: string[];
  useCases: string[];
  stack: string[];
  accent: string;
  /** 属于联调工具包内的子工具，不单独主推下载 */
  toolkitMember?: boolean;
  /** 个人独立项目标记 */
  personal?: boolean;
  /** 关联作品页 /work/:slug */
  workSlug?: string;
};

export type DebugToolkit = {
  id: string;
  name: string;
  icon: string;
  tagline: string;
  desc: string;
  zip: string;
  version: string;
  accent: string;
  features: string[];
  useCases: string[];
  installSteps: string[];
};

export const FRONTEND_DEBUG_TOOLKIT: DebugToolkit = {
  id: "frontend-debug-toolkit",
  name: "前端联调工具包",
  icon: "🧰",
  tagline: "摘录 · 切环境 · 看 SSE — 日常联调三件套，一次装齐",
  desc: "一个 Chrome 扩展，三个面板：ClipHub 保存网页摘录并跳回高亮；Env 按域名切换 API 和 Token；Wire 帧级查看 EventSource 流。前端联调、读文档、查 AI 流式接口时随手用，数据在本地，不联网也能跑。",
  zip: "Frontend-Debug-Toolkit-v1.1.3.zip",
  version: "1.1.3",
  accent: "#0d9488",
  features: [
    "一次安装，ClipHub / Env / Wire 三合一",
    "按域名切 API、自动带 Token",
    "SSE 帧级调试，比 Network 直观",
    "选中文字保存位置，一键跳回",
    "本地存储，解压后加载一次即可",
  ],
  useCases: [
    "本地 / 测试 / 预发环境秒切",
    "调试 AI 对话、流式接口",
    "读长文做摘录、跨 Tab 找回原文",
  ],
  installSteps: [
    "下载 zip 后先解压（不要直接选 zip 加载，会报错）",
    "chrome://extensions → 开发者模式 → 加载已解压的扩展程序",
    "选解压后的文件夹（根目录要有 manifest.json，只加载一次）",
    "点工具栏图标，在 ClipHub / Env / Wire 标签间切换",
  ],
};

export const DEBUG_TOOLKIT_TOOLS: ExtensionItem[] = [
  {
    id: "clip-hub",
    name: "ClipHub",
    icon: "📎",
    tagline: "选中文字 · 保存位置 · 一键跳回",
    desc: "在任意网页选中文字，右键保存片段与滚动位置。下次从列表点击，自动打开页面、文字匹配定位并高亮。",
    status: "shipped",
    zip: "ClipHub-Extension-v1.2.0.zip",
    version: "1.2.0",
    features: ["右键保存摘录", "文字匹配 + 坐标消歧", "列表跳回高亮", "本地存储"],
    useCases: ["读长文做摘录", "调研标记引用", "跨 Tab 找回原文"],
    stack: ["Chrome MV3", "Content Script", "文字匹配"],
    accent: "#0d9488",
    toolkitMember: true,
  },
  {
    id: "env",
    name: "Env",
    icon: "🔀",
    tagline: "按域名切换 API · 自动注入 Token",
    desc: "按 hostname 保存环境配置：API Base、Bearer Token、自定义 Header。刷新页面即生效，本地 / 测试 / 预发环境秒切。",
    status: "shipped",
    zip: "Env-Extension-v1.0.0.zip",
    version: "1.0.0",
    features: ["按域名配置", "API Base 重写", "Token 自动注入", "自定义 Header"],
    useCases: ["多环境前端联调", "免改代码切后端", "临时带 Token 调试"],
    stack: ["Fetch 重写", "chrome.storage", "按域隔离"],
    accent: "#f59e0b",
    toolkitMember: true,
  },
  {
    id: "wire",
    name: "Wire",
    icon: "📡",
    tagline: "SSE / EventSource 帧级调试",
    desc: "劫持 EventSource，实时展示 OPEN / MESSAGE / ERROR 事件流。调试 AI 对话、流式接口、Server-Sent Events 一目了然。",
    status: "shipped",
    zip: "Wire-Extension-v1.0.0.zip",
    version: "1.0.0",
    features: ["EventSource 劫持", "帧级事件列表", "实时刷新", "错误追踪"],
    useCases: ["调试 AI 流式输出", "排查 SSE 断连", "查看原始 event data"],
    stack: ["EventSource 注入", "Bridge 通信", "实时面板"],
    accent: "#ec4899",
    toolkitMember: true,
  },
];

const STREAMPROBE_EXTENSION: ExtensionItem = {
  id: STREAM_PROBE.id,
  name: STREAM_PROBE.name,
  icon: STREAM_PROBE.icon,
  tagline: STREAM_PROBE.tagline,
  desc: STREAM_PROBE.desc,
  status: STREAM_PROBE.status,
  zip: STREAM_PROBE.zip,
  version: STREAM_PROBE.version,
  features: STREAM_PROBE.features,
  useCases: STREAM_PROBE.users,
  stack: STREAM_PROBE.stack,
  accent: STREAM_PROBE.accent,
};

const SKILLTAP_EXTENSION: ExtensionItem = {
  id: "skilltap",
  name: "步骤记录器",
  icon: "⏺",
  tagline: "在网页上点一遍，生成操作说明书；测出 bug 也能录给开发",
  desc: "在真实页面上点、填、跳，扩展记下步骤并截图。普通人打开导出的 HTML 就是操作说明书；测试把复现路径录下来发给开发，对方不用先起本地项目，也能对照截图、选择器和报错定位问题。",
  story: [
    "同事或客户不会盯着你的屏幕：把常用后台操作录一次，发一个网页文件过去。对方用 Chrome / Edge 打开就能按步骤做。",
    "测试测出问题或要改某段流程时，打开出问题的页面录一遍，写上「出了什么问题」，导出复现包给开发。",
  ],
  status: "shipped",
  zip: "SkillTap-Extension-v1.2.0.zip",
  version: "1.2.0",
  features: [
    "录点击、填写、跳转并截图",
    "导出 HTML 操作手册，可演示翻页",
    "导出复现包给开发对照定位",
  ],
  useCases: ["教同事走一遍内部后台", "测试把 bug 复现路径交给开发"],
  stack: ["Chrome MV3", "截图", "HTML 手册", "repro.json"],
  accent: "#e11d48",
};

/** 扩展页 · 独立扩展 */
export const STANDALONE_EXTENSIONS: ExtensionItem[] = [];

/** 首页 · 个人产品区不再单独推扩展卡（StreamProbe 用作品页） */
export const PERSONAL_EXTENSIONS: ExtensionItem[] = [];

/** 全部可进详情页的扩展（含工具包子项） */
export const EXTENSION_CATALOG: ExtensionItem[] = [
  ...DEBUG_TOOLKIT_TOOLS,
  ...STANDALONE_EXTENSIONS,
];

export function getExtension(id: string) {
  return EXTENSION_CATALOG.find((e) => e.id === id);
}

export function extensionDownloadUrl(ext: ExtensionItem) {
  return `${import.meta.env.BASE_URL}downloads/${ext.zip}`;
}

export function toolkitDownloadUrl() {
  return `${import.meta.env.BASE_URL}downloads/${FRONTEND_DEBUG_TOOLKIT.zip}`;
}

export function extensionStatusLabel() {
  return "已发布";
}

/** @deprecated use EXTENSION_CATALOG */
export const CLIPHUB_EXTENSIONS = EXTENSION_CATALOG;
/** @deprecated */
export type ClipHubExtension = ExtensionItem;
/** @deprecated */
export type ClipHubExtStatus = ExtensionStatus;
/** @deprecated */
export function getClipHubExtension(id: string) {
  return getExtension(id);
}
/** @deprecated */
export function clipHubStatusLabel() {
  return extensionStatusLabel();
}
/** @deprecated */
export function clipHubDownloadUrl(ext: ExtensionItem) {
  return extensionDownloadUrl(ext);
}
