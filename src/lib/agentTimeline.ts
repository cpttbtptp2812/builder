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

const sortTimeline = (steps: AgentStep[]) => [...steps].sort((a, b) => {
  const aHasTime = Number.isFinite(a.timestamp) && a.timestamp > 0;
  const bHasTime = Number.isFinite(b.timestamp) && b.timestamp > 0;
  if (aHasTime && bHasTime && a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
  return a.seq - b.seq || a.timestamp - b.timestamp;
});

const normalizeStatus = (value: unknown): StepStatus => {
  const status = typeof value === "string" ? value.toLowerCase() : "";
  if (["ok", "success", "succeeded", "completed", "complete", "done"].includes(status)) return "done";
  if (["passed", "pass"].includes(status)) return "passed";
  if (["error", "failed", "failure"].includes(status)) return "failed";
  if (["running", "started", "in_progress", "in-progress", "in progress"].includes(status)) return "running";
  if (["pending", "queued"].includes(status)) return "pending";
  return "unknown";
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
    timestamp: incoming.timestamp ?? Date.now(),
  };
  return sortTimeline([...current, step]);
}

export function applySseToTimeline(current: AgentStep[], eventName: string, payload: any): AgentStep[] {
  try {
    const data = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!data || typeof data !== "object") return current;

    if (eventName === "agent_step" || eventName === "trace_step") {
      const rawSeq = data.seq ?? data.step;
      const hasSeq = rawSeq !== undefined && rawSeq !== null && rawSeq !== "" && Number.isFinite(Number(rawSeq));
      const seq = hasSeq ? Number(rawSeq) : current.length + 1;
      const stepId = String(data.stepId ?? data.step_id ?? data.spanId ?? data.span_id ?? data.eventId ?? data.event_id ?? data.id ?? `event-${seq}`);
      const title = data.rightTitle ?? data.title ?? data.name ?? data.leftTitle;
      return timelineReducer(current, {
        stepId,
        seq: hasSeq ? seq : undefined,
        phase: data.phase,
        status: data.status == null ? undefined : normalizeStatus(data.status),
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
        durationMs: parseDuration(data.durationMs ?? data.duration ?? data.totalMs),
        timestamp: typeof data.timestamp === "number" ? data.timestamp : undefined,
      });
    }

    if (eventName === "tool") {
      const toolName = String(data.tool ?? data.name ?? "Unknown tool");
      const stableCallId = data.toolCallId ?? data.tool_call_id ?? data.callId ?? data.call_id ?? data.id;
      const sameToolSteps = current.filter((step) => step.phase === "skill" && String(step.rightDetail?.tool ?? step.rightDetail?.name ?? "") === toolName);
      const existingCount = sameToolSteps.length;
      // A tool name is not a call identity: concurrent invocations can use the
      // same tool. Only merge lifecycle events when the producer supplies a
      // stable call ID; otherwise preserve each event separately.
      const stepId = String(stableCallId ?? `tool-${toolName}-${existingCount + 1}`);
      const hasSeq = data.seq !== undefined && data.seq !== null && data.seq !== "" && Number.isFinite(Number(data.seq));
      const status = data.status == null ? undefined : normalizeStatus(data.status);
      return timelineReducer(current, {
        stepId,
        seq: hasSeq ? Number(data.seq) : undefined,
        phase: "skill",
        status,
        leftTitle: `Tool: ${toolName}`,
        leftSummary: data.message ?? (data.status == null ? undefined : String(data.status)),
        rightTitle: toolName,
        rightSubtitle: data.description,
        rightDetail: data,
        durationMs: parseDuration(data.durationMs ?? data.duration),
        timestamp: typeof data.timestamp === "number" ? data.timestamp : undefined,
      });
    }

    if (eventName === "citations") {
      const items = Array.isArray(data.items) ? data.items : [];
      return timelineReducer(current, {
        stepId: String(data.stepId ?? "event-citations"),
        seq: Number.isFinite(Number(data.seq)) ? Number(data.seq) : current.length + 1,
        phase: "context",
        status: "done",
        leftTitle: "Knowledge retrieval",
        leftSummary: `Retrieved ${items.length} source item(s)`,
        rightTitle: "Retrieved sources",
        rightSubtitle: "",
        rightDetail: { ...data, items },
        timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
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
  toolCalls?: Array<{ tool: string; duration?: string; status?: string; result?: any; parameters?: any; id?: string }>;
  agentTimeline?: AgentStep[];
}): AgentStep[] {
  if (msg.agentTimeline?.length) return msg.agentTimeline;
  const steps: AgentStep[] = [];

  Object.entries(msg.traceSteps || {}).forEach(([key, data]) => {
    if (!data) return;
    const seq = Number(key);
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
    const status = normalizeStatus(tool.status);
    steps.push({
      stepId: String(tool.id ?? `history-tool-${index + 1}`),
      seq: steps.length + 1,
      phase: "skill",
      status,
      leftTitle: `Tool: ${tool.tool}`,
      leftSummary: "",
      rightTitle: tool.tool,
      rightSubtitle: "",
      rightDetail: { parameters: tool.parameters, result: tool.result },
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
