/**
 * 插件集 — 浏览器扩展目录
 */

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
};

export const EXTENSION_CATALOG: ExtensionItem[] = [
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
  },
  {
    id: "skilltap",
    name: "步骤记录器",
    icon: "⏺",
    tagline: "在网页上点一遍，生成操作说明书；测出 bug 也能录给开发",
    desc: "在真实页面上点、填、跳，扩展记下步骤并截图。普通人打开导出的 HTML 就是操作说明书，还能点「演示一遍」跟着看；测试把复现路径录下来发给开发，对方不用先起本地项目，也能对照截图、选择器和报错定位问题。",
    story: [
      "同事或客户不会盯着你的屏幕：把常用后台操作录一次，发一个网页文件过去。对方用 Chrome / Edge 打开就能按步骤做，登录、验证码会标成「请你自己做」，密码不会写进手册。",
      "测试测出问题或要改某一段流程时，打开出问题的页面录一遍，写上「出了什么问题」，导出复现包。里面有操作手册、给开发看的说明（选择器、接口 4xx、控制台报错、不稳定定位），以及可导入的 repro.json。开发导入后可一键打开当时的入口页（测试环境/预发），对照步骤看，不必每次把项目在自己电脑里跑起来再猜你点了哪里。",
    ],
    status: "shipped",
    zip: "SkillTap-Extension-v1.2.0.zip",
    version: "1.2.0",
    features: [
      "录点击、填写、跳转并截图",
      "导出 HTML 操作手册，可演示翻页",
      "导出复现包：手册 + 给开发.md + repro.json",
      "自动标出脆弱选择器、动态 id、接口报错",
      "开发导入后打开入口页，不必先起本地项目",
      "登录 / 验证码 / 选文件写成人工步骤",
    ],
    useCases: [
      "教同事走一遍内部后台",
      "把操作说明发给不写代码的人",
      "测试把 bug 复现路径交给开发",
      "开发对照截图和选择器快速定位",
    ],
    stack: ["Chrome MV3", "截图", "HTML 手册", "repro.json"],
    accent: "#e11d48",
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
  },
 
];

export function getExtension(id: string) {
  return EXTENSION_CATALOG.find((e) => e.id === id);
}

export function extensionDownloadUrl(ext: ExtensionItem) {
  return `${import.meta.env.BASE_URL}downloads/${ext.zip}`;
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

