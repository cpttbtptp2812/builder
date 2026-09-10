/** @streamprobe/core — 流式帧解析（扩展 Side Panel 与导出共用） */

const AI_SDK_TYPES = new Set([
  "start",
  "start-step",
  "finish-step",
  "finish",
  "text-delta",
  "reasoning-delta",
  "tool-call",
  "tool-result",
  "tool-input-start",
  "tool-input-delta",
  "source",
  "error",
]);

/**
 * @param {string} raw
 * @returns {{ protocol: string; summary: string; detail: unknown; error?: string }}
 */
export function parseFrame(raw) {
  const text = String(raw || "").trim();
  if (!text) {
    return { protocol: "empty", summary: "（空帧）", detail: null };
  }

  if (text.startsWith("event:") || text.startsWith("data:")) {
    return parseSseLine(text);
  }

  if (text === "[DONE]") {
    return { protocol: "sse", summary: "流结束 [DONE]", detail: { done: true } };
  }

  try {
    const json = JSON.parse(text);
    if (json && typeof json === "object" && "type" in json && AI_SDK_TYPES.has(String(json.type))) {
      return parseAiSdk(json);
    }
    return {
      protocol: "json",
      summary: summarizeJson(json),
      detail: json,
    };
  } catch {
    return { protocol: "text", summary: text.slice(0, 120), detail: { text } };
  }
}

function parseSseLine(line) {
  if (line.startsWith("event:")) {
    const event = line.slice(6).trim();
    return { protocol: "sse", summary: `event: ${event}`, detail: { event } };
  }
  const data = line.startsWith("data:") ? line.slice(5).trim() : line;
  if (data === "[DONE]") {
    return { protocol: "sse", summary: "data: [DONE]", detail: { done: true } };
  }
  try {
    const json = JSON.parse(data);
    if (json?.type && AI_SDK_TYPES.has(String(json.type))) {
      const ai = parseAiSdk(json);
      return { ...ai, protocol: "sse+ai-sdk" };
    }
    return {
      protocol: "sse",
      summary: `data: ${summarizeJson(json)}`,
      detail: json,
    };
  } catch {
    return { protocol: "sse", summary: `data: ${data.slice(0, 100)}`, detail: { data } };
  }
}

function parseAiSdk(obj) {
  const type = String(obj.type);
  let summary = type;
  if (type === "text-delta" || type === "reasoning-delta") {
    summary = `${type}: ${String(obj.text || obj.delta || "").slice(0, 80)}`;
  } else if (type === "tool-call") {
    summary = `tool-call: ${obj.toolName || obj.name || "?"}`;
  } else if (type === "tool-result") {
    summary = `tool-result: ${obj.toolCallId || "?"}`;
  } else if (type === "error") {
    summary = `error: ${String(obj.errorText || obj.message || "").slice(0, 80)}`;
  }
  return { protocol: "ai-sdk", summary, detail: obj };
}

function summarizeJson(json) {
  if (json == null) return String(json);
  if (typeof json !== "object") return String(json).slice(0, 80);
  if ("type" in json) return String(json.type);
  if ("message" in json) return String(json.message).slice(0, 80);
  return JSON.stringify(json).slice(0, 100);
}

/**
 * @param {{ connections: object[]; frames: object[] }} session
 */
export function computeMetrics(session) {
  /** @type {Record<string, { ttfbMs?: number; frameCount: number; lastGapMs?: number }>} */
  const out = {};
  const byConn = groupBy(session.frames, (f) => f.connectionId);

  for (const conn of session.connections) {
    const frames = byConn[conn.id] || [];
    const messages = frames.filter((f) => f.phase === "message");
    const open = frames.find((f) => f.phase === "open") || conn;
    const openT = open.t || conn.openedAt;
    let ttfbMs;
    if (messages.length && openT) {
      ttfbMs = messages[0].t - openT;
    }
    let lastGapMs;
    if (messages.length >= 2) {
      lastGapMs = messages[messages.length - 1].t - messages[messages.length - 2].t;
    }
    out[conn.id] = { ttfbMs, frameCount: messages.length, lastGapMs };
  }
  return out;
}

function groupBy(arr, keyFn) {
  /** @type {Record<string, object[]>} */
  const map = {};
  for (const item of arr) {
    const k = keyFn(item);
    (map[k] ||= []).push(item);
  }
  return map;
}
