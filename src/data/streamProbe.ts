/**
 * StreamProbe — 个人开源产品元数据
 * 规格书：docs/streamprobe/PRODUCT.md
 */

export const STREAM_PROBE = {
  id: "streamprobe",
  name: "StreamProbe",
  icon: "📡",
  tagline: "AI 与流式 API 的浏览器端调试器",
  desc: "帧级捕获 EventSource 与 fetch 流式响应，Side Panel 时间线 + Raw/Parsed 双栏对照，导出会话包。个人独立设计与开发。",
  version: "1.0.0",
  status: "shipped" as const,
  zip: "StreamProbe-Extension-v1.0.0.zip",
  accent: "#0891b2",
  repo: "", // GitHub 开源后填写，同步到 resumeContent plain.url
  docsPath: "docs/streamprobe/PRODUCT.md",
  features: [
    "EventSource / fetch stream 双通道 hook",
    "Side Panel 帧时间线与 TTFB 指标",
    "SSE · AI SDK 语义解析双栏",
    "导出 .streamprobe.json 会话",
  ],
  stack: [
    "Chrome MV3",
    "MAIN world inject",
    "ReadableStream",
    "TypeScript",
    "@streamprobe/core",
  ],
  problem:
    "Chrome Network 看不清 SSE 每一帧，AI 对话联调时断流、首 token、协议字段错误难以定位。",
  users: ["AI 对话前端", "GraphQL SSE 联调", "流式 BFF 全栈"],
  boundary: "只做流式观测，不做 Agent 执行或通用抓包。",
};

export function streamProbeDownloadUrl() {
  return `${import.meta.env.BASE_URL}downloads/${STREAM_PROBE.zip}`;
}

export type StreamProbeStatus = typeof STREAM_PROBE.status;
