/** OwnAgent platform protocol. Shared by runtime, evidence, tools, eval and UI. */

export const PLATFORM_PROTOCOL_VERSION = "2026-10-14";

export type RunStatus =
  | "queued"
  | "running"
  | "paused"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type NodeStatus = "pending" | "running" | "completed" | "failed" | "skipped";

export type RunEventType =
  | "run.created"
  | "run.started"
  | "run.paused"
  | "run.resumed"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "run.branched"
  | "node.started"
  | "node.completed"
  | "node.failed"
  | "artifact.created"
  | "evidence.linked"
  | "approval.requested"
  | "approval.decided"
  | "agent.message";

export type RunEvent<T = Record<string, unknown>> = {
  id: string;
  runId: string;
  seq: number;
  type: RunEventType;
  at: string;
  nodeId?: string;
  parentEventId?: string;
  payload: T;
};

export type PlatformRun = {
  id: string;
  kind: string;
  title: string;
  status: RunStatus;
  parentRunId?: string;
  forkedFromSeq?: number;
  inputArtifactIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type ArtifactKind = "material" | "dataset" | "document" | "table" | "report" | "bundle";

export type ArtifactLocator = {
  page?: number;
  sheet?: string;
  cell?: string;
  row?: number;
  column?: string;
  box?: [number, number, number, number];
  charRange?: [number, number];
};

export type PlatformArtifact = {
  id: string;
  runId: string;
  kind: ArtifactKind;
  name: string;
  mediaType: string;
  sha256: string;
  bytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type EvidenceLink = {
  id: string;
  runId: string;
  claim: string;
  artifactId: string;
  locator?: ArtifactLocator;
  nodeId?: string;
  transform: string[];
  confidence: number;
  createdAt: string;
};

export type ToolCapability = "read" | "write" | "network" | "model";

export type GatewayMeta = {
  capability: ToolCapability;
  allowed: boolean;
  timeoutMs: number;
  ms: number;
  retries: number;
};

export type PlatformToolDefinition = {
  name: string;
  title: string;
  description: string;
  capabilities: ToolCapability[];
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  timeoutMs: number;
  maxRetries: number;
  idempotent: boolean;
  acceptsSensitiveData: boolean;
  costUnit?: string;
};

export type AgentRoleDefinition = {
  id: string;
  title: string;
  objective: string;
  toolNames: string[];
  maxSteps: number;
  budget: number;
  canDelegate: boolean;
};

export type SimulationVariant = {
  id: string;
  title: string;
  changes: Record<string, unknown>;
};

export type SimulationMetrics = {
  completionRate: number;
  evidenceCoverage: number;
  latencyMs: number;
  cost: number;
  humanInterventions: number;
};

