/** Agent Trace — 真实运行记录（localStorage） */

import type { AgentTurnTrace } from "./agentRuntime";
import type { TraceSpan } from "../data/agentTraceDemo";

export type StoredTraceSession = {
  id: string;
  query: string;
  assistantText: string;
  runtime?: string;
  traces: AgentTurnTrace[];
  spans: TraceSpan[];
  totalMs: number;
  createdAt: string;
};

const KEY = "agent-trace-sessions-v1";
const MAX = 20;

function loadAll(): StoredTraceSession[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredTraceSession[];
  } catch {
    return [];
  }
}

function saveAll(list: StoredTraceSession[]) {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function listTraceSessions(): StoredTraceSession[] {
  return loadAll();
}

export function getTraceSession(id: string) {
  return loadAll().find((s) => s.id === id);
}

export function saveTraceSession(input: Omit<StoredTraceSession, "id" | "createdAt">) {
  const session: StoredTraceSession = {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  saveAll([session, ...loadAll()]);
  return session;
}

export function clearTraceSessions() {
  localStorage.removeItem(KEY);
}

/** 把 Agent 运行时产物转成时间线 spans */
export function buildSpansFromAgentRun(
  query: string,
  traces: AgentTurnTrace[],
  assistantText: string,
  totalMs: number,
): TraceSpan[] {
  const spans: TraceSpan[] = [
    {
      id: "user",
      kind: "user",
      label: "用户输入",
      detail: query,
      ms: 0,
      status: "ok",
    },
  ];

  let allocated = 0;
  const sliceMs = (n: number) => {
    allocated += n;
    return n;
  };

  for (const turn of traces) {
    if (turn.reasoning?.trim()) {
      const firstLine = turn.reasoning.split("\n").find(Boolean) ?? turn.label;
      spans.push({
        id: `intent-${turn.iteration}`,
        kind: "intent",
        label: turn.label || "Skill 路由",
        detail: firstLine.slice(0, 120),
        ms: sliceMs(100),
        status: "ok",
        payload: { reasoning: turn.reasoning },
      });
    }

    for (const tool of turn.tools) {
      spans.push({
        id: tool.id,
        kind: "tool",
        label: `tool · ${tool.name}`,
        detail:
          tool.ok === false
            ? `失败 · ${tool.ms ?? "?"}ms`
            : `完成 · ${tool.ms ?? "?"}ms`,
        ms: sliceMs(tool.ms ?? 120),
        status: tool.ok === false ? "err" : "ok",
        payload: { args: tool.args, result: tool.result },
      });
    }

    if (turn.text?.trim()) {
      spans.push({
        id: `stream-${turn.iteration}`,
        kind: "stream",
        label: "流式片段",
        detail: turn.text.slice(0, 100),
        ms: sliceMs(80),
        status: "ok",
      });
    }
  }

  const replyMs = Math.max(60, totalMs - allocated);
  if (assistantText.trim()) {
    spans.push({
      id: "reply",
      kind: "reply",
      label: "最终回复",
      detail: assistantText.replace(/\*\*/g, "").slice(0, 100),
      ms: replyMs,
      status: "ok",
      payload: { text: assistantText },
    });
  }

  return spans;
}
