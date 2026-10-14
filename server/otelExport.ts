/** 一次办理的事件导出成 OTLP JSON。没配置地址就什么都不发。 */

import type { RunEvent } from "../src/lib/platformProtocol.ts";
import { listEvents } from "./runEventStore.ts";
import { safeLog } from "./observability.ts";

export async function exportRunTrace(runId: string): Promise<void> {
  const endpoint = process.env.OWNAGENT_OTLP_ENDPOINT?.trim();
  if (!endpoint) return;
  try {
    const events = listEvents(runId);
    const body = otlpTraces(runId, events);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3_000),
    });
    if (!res.ok) safeLog("otel.export_failed", { runId, status: res.status });
  } catch (err) {
    safeLog("otel.export_failed", { runId, error: err instanceof Error ? err.message : String(err) });
  }
}

export function otlpTraces(runId: string, events: RunEvent[]) {
  const started = events.find((event) => event.type === "run.started") ?? events[0];
  const startNs = started ? Date.parse(started.at) * 1_000_000 : Date.now() * 1_000_000;
  const spans = events
    .filter((event) => event.type === "node.completed" || event.type === "node.failed")
    .map((event) => {
      const payload = event.payload as { tool?: string; stepId?: string; ms?: number; ok?: boolean };
      const duration = Math.max(1, payload.ms ?? 1) * 1_000_000;
      const end = Date.parse(event.at) * 1_000_000;
      return {
        traceId: traceId(runId),
        spanId: spanId(event.seq),
        name: payload.tool || payload.stepId || event.type,
        startTimeUnixNano: String(Math.max(0, end - duration)),
        endTimeUnixNano: String(end || startNs),
        attributes: [
          { key: "run.id", value: { stringValue: runId } },
          { key: "step.id", value: { stringValue: payload.stepId ?? "" } },
          { key: "tool", value: { stringValue: payload.tool ?? "" } },
        ],
        status: { code: event.type === "node.failed" || payload.ok === false ? 2 : 1 },
      };
    });
  return { resourceSpans: [{ resource: { attributes: [{ key: "service.name", value: { stringValue: "ownagent" } }] }, scopeSpans: [{ spans }] }] };
}

function traceId(runId: string): string {
  return Buffer.from(runId).toString("hex").padEnd(32, "0").slice(0, 32);
}

function spanId(seq: number): string {
  return seq.toString(16).padStart(16, "0").slice(-16);
}
