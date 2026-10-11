/** 本地 Trace 收件箱：失败聚类 + 建议 case（浏览器会话） */

import type { StoredTraceSession } from "./agentTraceStore";

export type TraceInboxItem = {
  id: string;
  query: string;
  createdAt: string;
  totalMs: number;
  failedTools: string[];
  skillHint?: string;
};

export type TraceCluster = {
  key: string;
  label: string;
  count: number;
  items: TraceInboxItem[];
};

function failedToolsFromSession(s: StoredTraceSession): string[] {
  const bad = new Set<string>();
  for (const turn of s.traces) {
    for (const t of turn.tools) {
      if (t.ok === false) bad.add(t.name);
    }
  }
  for (const span of s.spans) {
    if (span.status === "err" || span.status === "warn") bad.add(span.label);
  }
  return [...bad];
}

function skillHintFromSession(s: StoredTraceSession): string | undefined {
  for (const turn of s.traces) {
    for (const t of turn.tools) {
      if (t.name.includes("credit-flow") || t.name.includes("skill")) return t.name;
    }
  }
  const route = s.spans.find((sp) => sp.kind === "intent");
  return route?.detail?.slice(0, 40);
}

export function traceSessionsToInbox(sessions: StoredTraceSession[]): TraceInboxItem[] {
  return sessions.map((s) => ({
    id: s.id,
    query: s.query,
    createdAt: s.createdAt,
    totalMs: s.totalMs,
    failedTools: failedToolsFromSession(s),
    skillHint: skillHintFromSession(s),
  }));
}

export function clusterTraceInbox(items: TraceInboxItem[]): TraceCluster[] {
  const map = new Map<string, TraceInboxItem[]>();
  for (const item of items) {
    const key =
      item.failedTools.length > 0
        ? `fail:${item.failedTools.sort().join("+")}`
        : `ok:${item.skillHint ?? "general"}`;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return [...map.entries()]
    .map(([key, group]) => ({
      key,
      label:
        group[0]?.failedTools.length
          ? `失败 · ${group[0].failedTools.join(", ")}`
          : `成功 · ${group[0]?.skillHint ?? "一般对话"}`,
      count: group.length,
      items: group,
    }))
    .sort((a, b) => b.count - a.count);
}

export function inboxItemsNeedingAttention(items: TraceInboxItem[]): TraceInboxItem[] {
  return items.filter((i) => i.failedTools.length > 0);
}
