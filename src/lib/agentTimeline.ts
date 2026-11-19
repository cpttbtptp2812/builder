/**
 * Timeline built from events actually emitted by the Agent backend.
 * Missing status, timing, or token data stays unknown; the UI must not invent it.
 */

export type StepPhase =
  | "intent" | "workflow" | "context" | "llm" | "skill"
  | "delivery" | "closure" | "degraded" | "external";

export type StepStatus = "pending" | "running" | "done" | "failed" | "passed" | "unknown";

export interface AgentStep {
  stepId: string;
  seq: number;
  phase: StepPhase;
  status: StepStatus;
  leftTitle: string;
  leftSummary: string;
  rightTitle: string;
  rightSubtitle: string;
  rightDetail?: Record<string, any>;
  durationMs?: number;
  timestamp: number;
}

export const sortTimeline = (steps: AgentStep[]) => {
  const hasCompleteTimestamps = steps.length > 0 && steps.every(
    (step) => Number.isFinite(step.timestamp) && step.timestamp > 0
  );
  return [...steps].sort((a, b) => {
    if (hasCompleteTimestamps && a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
    return a.seq - b.seq || a.timestamp - b.timestamp;
  });
};

const normalizeStatus = (value: unknown): StepStatus => {
  if (value && typeof value === "object") {
    const item = value as Record<string, any>;
    if (item.code === 2 || String(item.code).toUpperCase() === "ERROR") return "failed";
    if (item.code === 1 || String(item.code).toUpperCase() === "OK") return "done";
    value = item.status ?? item.state ?? item.name;
  }
  const status = typeof value === "string" ? value.toLowerCase() : "";
  if (["ok", "success", "succeeded", "completed", "complete", "done"].includes(status)) return "done";
  if (["passed", "pass"].includes(status)) return "passed";
  if (["error", "failed", "failure"].includes(status)) return "failed";
  if (["running", "started", "in_progress", "in-progress", "in progress"].includes(status)) return "running";
  if (["pending", "queued"].includes(status)) return "pending";
  return "unknown";
};

const eventAttribute = (data: any, key: string): any => {
  const attributes = data?.attributes ?? {};
  if (attributes[key] !== undefined) return attributes[key];
  return key.split(".").reduce((value: any, part) => value?.[part], attributes);
};

const phaseFromEvent = (data: any): StepPhase => {
  if (data.phase) return data.phase;
  const operation = String(eventAttribute(data, "gen_ai.operation.name") ?? "").toLowerCase();
  const tool = eventAttribute(data, "gen_ai.tool.name") ?? eventAttribute(data, "mcp.tool.name");
  if (tool) return "skill";
  if (operation) return "llm";
  return "external";
};

const parseEventTimestamp = (data: any): number | undefined => {
  if (typeof data.timestamp === "number" && Number.isFinite(data.timestamp)) return data.timestamp;
  const nanos = data.startTimeUnixNano ?? data.start_time_unix_nano;
  if (nanos !== undefined && nanos !== null) {
    try { return Number(BigInt(nanos) / 1000000n); } catch { return undefined; }
  }
  const millis = data.startTimeUnixMs ?? data.start_time_unix_ms ?? data.startTime;
  if (typeof millis === "number" && Number.isFinite(millis)) return millis;
  return undefined;
};

const parseNanoDuration = (value: unknown): number | undefined => {
  if (value === undefined || value === null) return undefined;
  try {
    const nanos = BigInt(value as string | number | bigint);
    return Number(nanos) / 1000000;
  } catch { return undefined; }
};

const durationBetweenNanoTimestamps = (start: unknown, end: unknown): number | undefined => {
  if (start === undefined || start === null || end === undefined || end === null) return undefined;
  try { return Number(BigInt(end as string | number | bigint) - BigInt(start as string | number | bigint)) / 1000000; }
  catch { return undefined; }
};

const parseDuration = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const ms = value.match(/^([\d.]+)\s*ms$/i);
    if (ms) return Number(ms[1]);
    const seconds = value.match(/^([\d.]+)\s*s$/i);
    if (seconds) return Number(seconds[1]) * 1000;
  }
  return undefined;
};

export function timelineReducer(
  current: AgentStep[],
  incoming: Partial<AgentStep> & { stepId: string }
): AgentStep[] {
  const existingIdx = current.findIndex((step) => step.stepId === incoming.stepId);
  if (existingIdx >= 0) {
    const updated = [...current];
    const old = updated[existingIdx];
    const definedIncoming = Object.fromEntries(
      Object.entries(incoming).filter(([, value]) => value !== undefined)
    ) as Partial<AgentStep> & { stepId: string };
    updated[existingIdx] = {
      ...old,
      ...definedIncoming,
      rightDetail: { ...(old.rightDetail || {}), ...(incoming.rightDetail || {}) },
    };
    return sortTimeline(updated);
  }

  const step: AgentStep = {
    stepId: incoming.stepId,
    seq: incoming.seq ?? current.length + 1,
    phase: incoming.phase ?? "external",
    status: incoming.status ?? "unknown",
    leftTitle: incoming.leftTitle ?? "Agent event",
    leftSummary: incoming.leftSummary ?? "已收到执行事件",
    rightTitle: incoming.rightTitle ?? incoming.leftTitle ?? "执行事件",
    rightSubtitle: incoming.rightSubtitle ?? "",
    rightDetail: incoming.rightDetail ?? {},
    durationMs: incoming.durationMs,
    timestamp: incoming.timestamp ?? 0,
  };
  return sortTimeline([...current, step]);
}

export function applySseToTimeline(current: AgentStep[], eventName: string, payload: any): AgentStep[] {
  try {
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!data || typeof data !== "object") return current;

    if (eventName === "agent_step" || eventName === "trace_step" || eventName === "span" || eventName === "otel_span" || eventName === "gen_ai") {
      const rawSeq = data.seq ?? data.step;
      const hasSeq = rawSeq !== undefined && rawSeq !== null && rawSeq !== "" && Number.isFinite(Number(rawSeq));
      const seq = hasSeq ? Number(rawSeq) : current.length + 1;
      const suppliedId = data.stepId ?? data.step_id ?? data.spanId ?? data.span_id ?? data.eventId ?? data.event_id ?? data.id;
      // Do not invent an identity that could merge unrelated events.
      const stepId = String(suppliedId ?? `unidentified-event-${seq}-${current.length}`);
      const title = data.rightTitle ?? data.title ?? data.name ?? data.leftTitle;
      return timelineReducer(current, {
        stepId,
        seq: hasSeq ? seq : undefined,
        phase: phaseFromEvent(data),
        status: data.status == null && eventAttribute(data, "otel.status_code") == null
          ? undefined
          : normalizeStatus(data.status ?? eventAttribute(data, "otel.status_code")),
        leftTitle: data.leftTitle ?? title,
        leftSummary: data.leftSummary ?? data.message,
        rightTitle: title,
        rightSubtitle: data.rightSubtitle ?? data.description,
        // Keep envelope-level payloads (notably OpenTelemetry attributes) as well
        // as the event's explicit rightDetail. The nested detail wins on key
        // collisions, but neither source is silently discarded.
        rightDetail: {
          ...data,
          ...(data.rightDetail && typeof data.rightDetail === "object" ? data.rightDetail : {}),
        },
        durationMs: parseDuration(data.durationMs ?? data.duration ?? data.totalMs) ??
          parseNanoDuration(data.durationNs ?? data.duration_ns) ??
          durationBetweenNanoTimestamps(data.startTimeUnixNano ?? data.start_time_unix_nano, data.endTimeUnixNano ?? data.end_time_unix_nano),
        timestamp: parseEventTimestamp(data),
      });
    }

    if (eventName === "tool" || eventName === "mcp_tool") {
      const toolName = String(data.tool ?? data.toolName ?? eventAttribute(data, "mcp.tool.name") ?? eventAttribute(data, "gen_ai.tool.name") ?? data.name ?? "Unknown tool");
      const stableCallId = data.toolCallId ?? data.tool_call_id ?? data.callId ?? data.call_id ?? data.spanId ?? data.span_id ?? data.id;
      // A tool name is not a call identity: concurrent invocations can use the
      // same tool. Only merge lifecycle events when the producer supplies a
      // stable call ID; otherwise preserve each event separately.
      const stepId = String(stableCallId ?? `unidentified-tool-event-${current.length + 1}`);
      const hasSeq = data.seq !== undefined && data.seq !== null && data.seq !== "" && Number.isFinite(Number(data.seq));
      const status = data.status == null ? undefined : normalizeStatus(data.status);
      return timelineReducer(current, {
        stepId,
        seq: hasSeq ? Number(data.seq) : undefined,
        phase: "skill",
        status,
        leftTitle: `Tool: ${toolName}`,
        leftSummary: data.message ?? (data.status == null ? undefined : typeof data.status === "object" ? data.status.message ?? data.status.name : String(data.status)),
        rightTitle: toolName,
        rightSubtitle: data.description,
        rightDetail: data,
        durationMs: parseDuration(data.durationMs ?? data.duration) ?? parseNanoDuration(data.durationNs ?? data.duration_ns) ?? durationBetweenNanoTimestamps(data.startTimeUnixNano ?? data.start_time_unix_nano, data.endTimeUnixNano ?? data.end_time_unix_nano),
        timestamp: parseEventTimestamp(data),
      });
    }

    if (eventName === "citations") {
      const items = Array.isArray(data.items) ? data.items : [];
      return timelineReducer(current, {
        stepId: String(data.stepId ?? data.step_id ?? data.spanId ?? data.span_id ?? data.eventId ?? data.event_id ?? data.id ?? `unidentified-citations-${current.length + 1}`),
        seq: Number.isFinite(Number(data.seq)) ? Number(data.seq) : current.length + 1,
        phase: "context",
        status: data.status == null ? "unknown" : normalizeStatus(data.status),
        leftTitle: "Knowledge retrieval",
        leftSummary: `Retrieved ${items.length} source item(s)`,
        rightTitle: "Retrieved sources",
        rightSubtitle: "",
        rightDetail: { ...data, items },
        timestamp: typeof data.timestamp === "number" ? data.timestamp : 0,
      });
    }
    return current;
  } catch {
    return current;
  }
}

/** Legacy history reconstruction is allowed only from persisted event details. */
export function rebuildTimelineFromMessage(msg: {
  traceSteps?: Record<number, any>;
  toolCalls?: Array<{ tool: string; duration?: string; status?: string; result?: any; parameters?: any; id?: string; tool_arguments?: any; tool_result?: any; toolCallId?: string; modelStep?: number }>;
  agentTimeline?: AgentStep[];
}): AgentStep[] {
  if (msg.agentTimeline?.length) return msg.agentTimeline;
  const steps: AgentStep[] = [];

  Object.entries(msg.traceSteps || {}).forEach(([key, data]) => {
    if (!data) return;
    const keySeq = Number(key);
    const seq = Number.isFinite(Number(data.seq)) ? Number(data.seq) : keySeq;
    const title = data.rightTitle ?? data.title ?? data.name ?? `Step ${seq}`;
    steps.push({
      stepId: String(data.stepId ?? data.spanId ?? `trace-step-${seq}`),
      seq,
      phase: data.phase ?? "external",
      status: normalizeStatus(data.status),
      leftTitle: data.leftTitle ?? title,
      leftSummary: data.leftSummary ?? data.message ?? "",
      rightTitle: title,
      rightSubtitle: data.rightSubtitle ?? "",
      rightDetail: data.rightDetail ?? data,
      durationMs: parseDuration(data.durationMs ?? data.totalMs ?? data.duration),
      timestamp: typeof data.timestamp === "number" ? data.timestamp : 0,
    });
  });

  (msg.toolCalls || []).forEach((tool, index) => {
    const toolId = String(tool.id ?? tool.toolCallId ?? `history-tool-${index + 1}`);
    // Newer messages persist full tool steps in traceSteps. Avoid duplicating
    // the same call when the legacy toolCalls list is also present.
    if (steps.some((step) => step.stepId === toolId)) return;
    const status = normalizeStatus(tool.status);
    steps.push({
      stepId: toolId,
      seq: steps.length + 1,
      phase: "skill",
      status,
      leftTitle: `Tool: ${tool.tool}`,
      leftSummary: "",
      rightTitle: tool.tool,
      rightSubtitle: "",
      rightDetail: {
        parameters: tool.parameters,
        result: tool.result,
        tool_arguments: tool.tool_arguments ?? tool.parameters,
        tool_result: tool.tool_result ?? tool.result,
        toolCallId: tool.toolCallId ?? tool.id,
        modelStep: tool.modelStep,
      },
      durationMs: parseDuration(tool.duration),
      timestamp: 0,
    });
  });
  return sortTimeline(steps);
}

/** A finished stream does not imply every observed step succeeded. */
export function finalizeTimeline(timeline: AgentStep[]): AgentStep[] {
  return (timeline || []).map((step) => ({
    ...step,
    status: step.status === "running" || step.status === "pending" ? "unknown" : step.status,
  }));
}
