/**
 * Real Java Spring Boot Backend API Client for OwnSudo / OwnAgent
 * Connects to Java Spring Boot backend (http://localhost:8080 or cloud server)
 * Backed by MySQL 8.0 on Tencent Cloud
 */

import { apiUrl } from "./apiClient";

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  topologyJson: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NodeExecution {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeName: string;
  nodeType: "LLM_REASONING" | "MCP_TOOL_CALL" | "HUMAN_APPROVAL_2PC" | "POLICY_VERIFICATION" | "SQL_EXECUTOR";
  status: "PENDING" | "RUNNING" | "SUCCESS" | "BLOCKED" | "FAILED";
  inputPayload?: string;
  outputPayload?: string;
  costTokens?: number;
  latencyMs?: number;
  startedAt?: string;
  endedAt?: string;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: "RUNNING" | "SUSPENDED_APPROVAL" | "COMPLETED" | "FAILED";
  triggeredBy: string;
  currentNodeId: string;
  contextData?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface ApprovalTicket {
  id: string;
  instanceId: string;
  nodeId: string;
  policyLevel: "P0_CRITICAL" | "P1_HIGH" | "P2_STANDARD";
  riskScore: number;
  operationSummary: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  operatorId?: string;
  signatureHash?: string;
  auditReason?: string;
  createdAt?: string;
  decidedAt?: string;
}

export interface WorkflowEventMessage {
  eventType:
    | "INIT"
    | "INSTANCE_STARTED"
    | "NODE_RUNNING"
    | "NODE_COMPLETED"
    | "TICKET_REQUIRED"
    | "TICKET_APPROVED"
    | "TICKET_REJECTED"
    | "INSTANCE_COMPLETED"
    | "INSTANCE_FAILED";
  instanceId: string;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  status?: string;
  payload?: any;
  timestamp: string;
}

/**
 * Fetch all available DAG workflow templates from Java backend
 */
export async function getWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  try {
    const res = await fetch(apiUrl("/workflow/definitions"));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("[Java API] Failed to fetch workflow definitions:", e);
    return [];
  }
}

/**
 * Trigger real DAG execution on Java backend
 */
export async function triggerWorkflowRun(
  workflowId: string = "wf-settlement-migration",
  triggeredBy: string = "admin_sec",
  inputParams?: string
): Promise<{ instanceId: string; status: string; workflowId: string; startedAt: string } | null> {
  try {
    const res = await fetch(apiUrl("/workflow/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflowId, triggeredBy, inputParams }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[Java API] Failed to trigger workflow run:", e);
    return null;
  }
}

/**
 * Fetch instance details and all node execution rows from MySQL
 */
export async function getWorkflowInstance(instanceId: string): Promise<{
  instance: WorkflowInstance;
  steps: NodeExecution[];
} | null> {
  try {
    const res = await fetch(apiUrl(`/workflow/instances/${instanceId}`));
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.error(`[Java API] Failed to fetch instance ${instanceId}:`, e);
    return null;
  }
}

/**
 * Fetch pending 2PC zero-trust tickets waiting for human signature
 */
export async function getPendingApprovals(): Promise<ApprovalTicket[]> {
  try {
    const res = await fetch(apiUrl("/workflow/approvals/pending"));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.warn("[Java API] Failed to fetch pending approvals:", e);
    return [];
  }
}

/**
 * Commit human 2PC approval decision (sign or reject) to Java backend
 */
export async function commitApprovalDecision(
  ticketId: string,
  decision: "APPROVED" | "REJECTED",
  operatorId: string = "auditor_sec",
  auditReason: string = "已复核资产清算合规性，零信任双签确认",
  digitalSignature?: string
): Promise<ApprovalTicket | null> {
  try {
    const res = await fetch(apiUrl(`/workflow/approvals/${ticketId}/commit`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operatorId,
        decision,
        auditReason,
        digitalSignature: digitalSignature || `SIG_${Date.now()}_SEC_GATE`,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`[Java API] Failed to commit approval for ticket ${ticketId}:`, e);
    return null;
  }
}

/**
 * Subscribe to real-time SSE event stream for a workflow instance
 */
export function subscribeToWorkflowStream(
  instanceId: string,
  onEvent: (event: WorkflowEventMessage) => void,
  onError?: (err: any) => void
): () => void {
  const url = apiUrl(`/workflow/instances/${instanceId}/stream`);
  const eventSource = new EventSource(url);

  const eventTypes: Array<WorkflowEventMessage["eventType"]> = [
    "INIT",
    "INSTANCE_STARTED",
    "NODE_RUNNING",
    "NODE_COMPLETED",
    "TICKET_REQUIRED",
    "TICKET_APPROVED",
    "TICKET_REJECTED",
    "INSTANCE_COMPLETED",
    "INSTANCE_FAILED",
  ];

  for (const type of eventTypes) {
    eventSource.addEventListener(type, (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as WorkflowEventMessage;
        onEvent(data);
      } catch (e) {
        console.warn(`[SSE Parse Error for ${type}]`, e);
      }
    });
  }

  eventSource.onerror = (err) => {
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
