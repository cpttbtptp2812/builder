import type { AgentStep } from "@/lib/agentTimeline";
import type { OpenTelemetryDocument, OpenTelemetrySpan } from "@/vendor/agent-prism/packages/types/src/types/open-telemetry";
import { toAttributes } from "@/vendor/agent-prism/packages/data/src/common/attribute-value";
import { openTelemetrySpanAdapter } from "@/vendor/agent-prism/packages/data/src/open-telemetry/adapter";

/**
 * Normalize only events that carry real OTLP trace/span identifiers and a real
 * start timestamp. No synthetic trace IDs, parent IDs, or timestamps are added.
 */
export function toAgentPrismTraceTree(steps: readonly AgentStep[]) {
  const spans: OpenTelemetrySpan[] = [];
  for (const step of steps) {
    const raw = step.rightDetail ?? {};
    const traceId = raw.traceId ?? raw.trace_id;
    const spanId = raw.spanId ?? raw.span_id;
    const rawStart = raw.startTimeUnixNano ?? raw.start_time_unix_nano;
    const startMs = typeof step.timestamp === "number" && step.timestamp > 0 ? step.timestamp : undefined;
    if (typeof traceId !== "string" || !traceId || typeof spanId !== "string" || !spanId) continue;
    if ((rawStart === undefined || rawStart === null) && startMs === undefined) continue;

    const startTimeUnixNano = rawStart != null
      ? String(rawStart)
      : (BigInt(Math.trunc(startMs!)) * 1_000_000n).toString();
    const rawEnd = raw.endTimeUnixNano ?? raw.end_time_unix_nano;
    const durationNs = typeof step.durationMs === "number" && step.durationMs >= 0
      ? BigInt(Math.round(step.durationMs * 1_000_000))
      : undefined;
    const endTimeUnixNano = rawEnd != null
      ? String(rawEnd)
      : durationNs !== undefined
        ? (BigInt(startTimeUnixNano) + durationNs).toString()
        : undefined;

    const statusCode = raw.status?.code ?? (
      step.status === "failed" ? 2 :
      step.status === "done" || step.status === "passed" ? 1 : 0
    );
    const attributes = Array.isArray(raw.attributes)
      ? raw.attributes
      : raw.attributes && typeof raw.attributes === "object"
        ? toAttributes(raw.attributes)
        : undefined;

    spans.push({
      traceId,
      spanId,
      parentSpanId: raw.parentSpanId ?? raw.parent_span_id ?? undefined,
      name: typeof raw.name === "string" && raw.name ? raw.name : step.rightTitle,
      startTimeUnixNano,
      ...(endTimeUnixNano !== undefined ? { endTimeUnixNano } : {}),
      ...(raw.kind !== undefined ? { kind: raw.kind } : {}),
      ...(attributes ? { attributes } : {}),
      status: { code: statusCode, ...(raw.status?.message ? { message: raw.status.message } : {}) },
    } as OpenTelemetrySpan);
  }

  if (spans.length === 0) return [];
  const document: OpenTelemetryDocument = {
    resourceSpans: [{ scopeSpans: [{ spans }] }],
  };
  return openTelemetrySpanAdapter.convertRawDocumentsToSpans(document);
}
