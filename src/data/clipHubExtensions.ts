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
