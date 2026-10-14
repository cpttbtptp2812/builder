/**
 * 运行事件 → 某一时刻的运行视图。纯函数：服务端 /state?seq=n 和前端时间轴拖动用同一套归约。
 */
import type { NodeStatus, RunEvent, RunStatus } from "./platformProtocol";

export type RunStepDecl = { id: string; tool: string; label?: string };
export type RunMaterial = { slot: string; title: string; sha256: string; rows: number; columns: string[] };
export type CheckpointRef = { sha256: string; bytes: number } | null;

export type RunCreatedPayload = {
  kind: "console" | "product";
  skillId: string;
  skillVersion: string;
  title: string;
  query: string;
  sessionId: string;
  steps: RunStepDecl[];
  materials: RunMaterial[];
  parentRunId?: string;
  fork?: { fromSeq: number; stepId: string; index: number; args: Record<string, unknown> };
};
export type NodeStartedPayload = { stepId: string; index: number; tool: string; attempt: number; args: Record<string, unknown> };
export type NodeEndedPayload = {
  stepId: string;
  index: number;
  tool: string;
  attempt: number;
  label: string;
  ok: boolean;
  ms: number;
  result: unknown;
  checkpoint: CheckpointRef;
  /** 分叉时从父运行原样继承的步骤 */
  inherited?: boolean;
  gateway?: import("./platformProtocol.ts").GatewayMeta;
};
export type RunEndedPayload = { totalMs: number; error?: string; stoppedAt?: string };
export type RunResumedPayload = { fromIndex: number; reason: string };
export type RunBranchedPayload = { childRunId: string; stepId: string; index: number };

export type RunNodeView = {
  index: number;
  stepId: string;
  tool: string;
  /** SKILL 里声明的步骤名，不随运行结果变 */
  name: string;
  /** 跑完后是引擎给出的结果说明，未跑时同 name */
  label: string;
  status: NodeStatus;
  attempt: number;
  args: Record<string, unknown> | null;
  result: unknown;
  ms: number | null;
  startedSeq: number | null;
  endedSeq: number | null;
  startedAt: string | null;
  endedAt: string | null;
  inherited: boolean;
  checkpoint: CheckpointRef;
  gateway: import("./platformProtocol.ts").GatewayMeta | null;
};

export type RunView = {
  runId: string;
  seq: number;
  lastSeq: number;
  status: RunStatus;
  kind: RunCreatedPayload["kind"] | null;
  skillId: string;
  skillVersion: string;
  title: string;
  query: string;
  sessionId: string;
  parentRunId: string | null;
  fork: RunCreatedPayload["fork"] | null;
  materials: RunMaterial[];
  nodes: RunNodeView[];
  createdAt: string | null;
  endedAt: string | null;
  totalMs: number | null;
  error: string | null;
  resumes: { seq: number; fromIndex: number; reason: string }[];
  branches: { seq: number; childRunId: string; stepId: string }[];
};

export function reduceRun(events: RunEvent[], uptoSeq = Number.POSITIVE_INFINITY): RunView {
  const view: RunView = {
    runId: events[0]?.runId ?? "",
    seq: 0,
    lastSeq: events.length ? events[events.length - 1]!.seq : 0,
    status: "queued",
    kind: null,
    skillId: "",
    skillVersion: "",
    title: "",
    query: "",
    sessionId: "",
    parentRunId: null,
    fork: null,
    materials: [],
    nodes: [],
    createdAt: null,
    endedAt: null,
    totalMs: null,
    error: null,
    resumes: [],
    branches: [],
  };
  for (const ev of events) {
    if (ev.seq > uptoSeq) break;
    view.seq = ev.seq;
    switch (ev.type) {
      case "run.created": {
        const p = ev.payload as unknown as RunCreatedPayload;
        Object.assign(view, {
          kind: p.kind,
          skillId: p.skillId,
          skillVersion: p.skillVersion,
          title: p.title,
          query: p.query,
          sessionId: p.sessionId,
          parentRunId: p.parentRunId ?? null,
          fork: p.fork ?? null,
          materials: p.materials,
          createdAt: ev.at,
        });
        view.nodes = p.steps.map((s, index) => ({
          index,
          stepId: s.id,
          tool: s.tool,
          name: s.label ?? s.id,
          label: s.label ?? s.id,
          status: "pending",
          attempt: 0,
          args: null,
          result: null,
          ms: null,
          startedSeq: null,
          endedSeq: null,
          startedAt: null,
          endedAt: null,
          inherited: false,
          checkpoint: null,
          gateway: null,
        }));
        break;
      }
      case "run.started":
      case "run.resumed":
        view.status = "running";
        if (ev.type === "run.resumed") {
          const p = ev.payload as unknown as RunResumedPayload;
          view.resumes.push({ seq: ev.seq, fromIndex: p.fromIndex, reason: p.reason });
        }
        break;
      case "node.started": {
        const p = ev.payload as unknown as NodeStartedPayload;
        const n = view.nodes[p.index];
        if (!n) break;
        Object.assign(n, { status: "running", attempt: p.attempt, args: p.args, startedSeq: ev.seq, startedAt: ev.at, endedSeq: null, endedAt: null });
        break;
      }
      case "node.completed":
      case "node.failed": {
        const p = ev.payload as unknown as NodeEndedPayload;
        const n = view.nodes[p.index];
        if (!n) break;
        Object.assign(n, {
          status: ev.type === "node.completed" ? "completed" : "failed",
          attempt: p.attempt,
          label: p.label,
          result: p.result,
          ms: p.ms,
          endedSeq: ev.seq,
          endedAt: ev.at,
          inherited: p.inherited === true,
          checkpoint: p.checkpoint,
          gateway: p.gateway ?? null,
        });
        if (n.startedSeq === null) Object.assign(n, { startedSeq: ev.seq, startedAt: ev.at });
        break;
      }
      case "run.completed":
      case "run.failed": {
        const p = ev.payload as unknown as RunEndedPayload;
        view.status = ev.type === "run.completed" ? "completed" : "failed";
        view.endedAt = ev.at;
        view.totalMs = p.totalMs;
        view.error = p.error ?? null;
        for (const n of view.nodes) if (n.status === "pending") n.status = "skipped";
        break;
      }
      case "run.branched": {
        const p = ev.payload as unknown as RunBranchedPayload;
        view.branches.push({ seq: ev.seq, childRunId: p.childRunId, stepId: p.stepId });
        break;
      }
      default:
        break;
    }
  }
  return view;
}

/** 某步最近一次结束事件的 seq（时间轴“拖回第 n 步”用） */
export function seqAfterStep(view: RunView, index: number): number | null {
  return view.nodes[index]?.endedSeq ?? null;
}
