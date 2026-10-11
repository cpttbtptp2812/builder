/** 服务端 Skill Gate / 生产 Trace — 浏览器工作台调用 */

import { apiFetch, checkBackendHealth } from "./apiClient";
import type { AgentTurnTrace } from "./agentRuntime";

export type IngestTraceStep = {
  stepId: string;
  tool: string;
  ok: boolean;
  result?: unknown;
};

export type TraceClusterRow = {
  fingerprint: string;
  skillId: string;
  failedStepId?: string;
  tool?: string;
  errorClass?: string;
  occurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
};

function traceStepsFromTurns(traces: AgentTurnTrace[]): IngestTraceStep[] {
  const out: IngestTraceStep[] = [];
  for (const turn of traces) {
    for (const t of turn.tools) {
      out.push({
        stepId: t.id,
        tool: t.name,
        ok: t.ok !== false,
        result: t.result,
      });
    }
  }
  return out;
}

export function buildIngestRecord(input: {
  skillId: string;
  query: string;
  traces: AgentTurnTrace[];
  environment?: string;
}): {
  idempotencyKey: string;
  skillId: string;
  query: string;
  trace: IngestTraceStep[];
  ok: boolean;
  environment: string;
} {
  const trace = traceStepsFromTurns(input.traces);
  const ok = trace.length === 0 || trace.every((s) => s.ok);
  const key = `${input.skillId}:${input.query.slice(0, 120)}:${trace.map((s) => `${s.stepId}:${s.ok}`).join("|")}`;
  return {
    idempotencyKey: key.slice(0, 240),
    skillId: input.skillId,
    query: input.query,
    trace,
    ok,
    environment: input.environment ?? "prod",
  };
}

/** 对话/run 结束后上报（需 dev:full 或生产 API；失败 run 会进入聚类与 case 建议） */
export async function ingestProductionTrace(input: {
  skillId: string;
  query: string;
  traces: AgentTurnTrace[];
}): Promise<boolean> {
  const health = await checkBackendHealth();
  if (!health?.ok) return false;
  const record = buildIngestRecord(input);
  const body = await apiFetch<{ accepted?: number }>("/skill-gate/traces/ingest", {
    method: "POST",
    body: JSON.stringify({ records: [record] }),
  });
  return (body?.accepted ?? 0) > 0;
}

export async function fetchTraceClusters(): Promise<TraceClusterRow[]> {
  const body = await apiFetch<{ clusters: TraceClusterRow[] }>("/skill-gate/trace-clusters");
  return body?.clusters ?? [];
}

export async function fetchGateAudit(limit = 20): Promise<
  { skillId: string; action: string; gate: string | null; createdAt: string }[]
> {
  const body = await apiFetch<{
    rows: { skill_id: string; action: string; gate: string | null; created_at: string }[];
  }>(`/skill-gate/audit?limit=${limit}`);
  return (body?.rows ?? []).map((r) => ({
    skillId: r.skill_id,
    action: r.action,
    gate: r.gate,
    createdAt: r.created_at,
  }));
}
