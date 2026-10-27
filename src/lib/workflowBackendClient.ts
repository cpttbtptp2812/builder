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
 * Fetch all available DAG workflow templates
 */
export async function getWorkflowDefinitions(): Promise<WorkflowDefinition[]> {
  try {
    const res = await fetch(apiUrl("/workflow/definitions"));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const list = data.definitions || (Array.isArray(data) ? data : []);
    return list.map((d: any) => ({
      id: d.id || d.def_id,
      name: d.name,
      description: d.description || "",
      version: d.version,
      topologyJson: d.topologyJson || (typeof d.nodes === "string" ? d.nodes : JSON.stringify(d.nodes || [])),
      createdAt: d.created_at || d.createdAt,
      updatedAt: d.updated_at || d.updatedAt,
    }));
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch workflow definitions:", e);
    return [];
  }
}

/**
 * Trigger real DAG execution on backend engine
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
      body: JSON.stringify({
        defId: workflowId,
        workflowId,
        triggeredBy,
        inputParams,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      instanceId: data.instanceId || data.id,
      status: data.status || "RUNNING",
      workflowId: data.defId || data.workflowId || workflowId,
      startedAt: data.startedAt || new Date().toISOString(),
    };
  } catch (e) {
    console.error("[Workflow API] Failed to trigger workflow run:", e);
    return null;
  }
}

/**
 * Fetch instance details and all node execution rows
 */
export async function getWorkflowInstance(instanceId: string): Promise<{
  instance: WorkflowInstance;
  steps: NodeExecution[];
} | null> {
  try {
    const res = await fetch(apiUrl(`/workflow/instances/${instanceId}`));
    if (!res.ok) return null;
    const data = await res.json();

    if (data.events) {
      const inst = data.instance || {};
      const steps: NodeExecution[] = (data.events || []).map((ev: any) => ({
        id: ev.eventId || ev.id,
        instanceId,
        nodeId: ev.nodeId,
        nodeName: ev.nodeName || ev.nodeId,
        nodeType: ev.nodeType,
        status: ev.state === "SUCCESS" ? "SUCCESS" : ev.state === "SUSPENDED" ? "BLOCKED" : "FAILED",
        inputPayload: JSON.stringify(ev.input || {}),
        outputPayload: JSON.stringify(ev.output || {}),
        costTokens: ev.tokens || 0,
        latencyMs: ev.latencyMs || 0,
        startedAt: ev.createdAt,
        endedAt: ev.createdAt,
      }));

      return {
        instance: {
          id: inst.id || instanceId,
          workflowId: inst.defId || inst.workflowId,
          status: inst.status,
          triggeredBy: inst.triggeredBy,
          currentNodeId: inst.currentNode,
          startedAt: inst.createdAt,
          finishedAt: inst.finishedAt,
        },
        steps,
      };
    }

    return data;
  } catch (e) {
    console.error(`[Workflow API] Failed to fetch instance ${instanceId}:`, e);
    return null;
  }
}

/**
 * Fetch all historical workflow instances
 */
export async function getWorkflowInstances(): Promise<WorkflowInstance[]> {
  try {
    const res = await fetch(apiUrl("/workflow/instances"));
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.instances || (Array.isArray(data) ? data : []);
    return list.map((r: any) => ({
      id: r.id || r.instance_id,
      workflowId: r.defId || r.def_id || r.workflowId,
      status: r.status,
      triggeredBy: r.triggeredBy || r.triggered_by,
      currentNodeId: r.currentNode || r.current_node,
      startedAt: r.createdAt || r.created_at,
      finishedAt: r.finishedAt || r.finished_at,
    }));
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch instances:", e);
    return [];
  }
}

/**
 * Fetch pending 2PC zero-trust tickets waiting for human signature
 */
export async function getPendingApprovals(): Promise<ApprovalTicket[]> {
  try {
    const res = await fetch(apiUrl("/workflow/approvals/pending"));
    if (!res.ok) return [];
    const data = await res.json();
    const list = data.tickets || (Array.isArray(data) ? data : []);
    return list.map((t: any) => ({
      id: t.ticketId || t.id,
      instanceId: t.instanceId,
      nodeId: t.nodeId,
      policyLevel: "P0_CRITICAL",
      riskScore: t.riskScore ?? 0.94,
      operationSummary: t.operationSummary || "",
      status: t.status || "PENDING",
      createdAt: t.createdAt,
    }));
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch pending approvals:", e);
    return [];
  }
}

/**
 * Commit human 2PC approval decision (sign or reject) to backend
 */
export async function commitApprovalDecision(
  ticketId: string,
  decision: "APPROVED" | "REJECTED",
  operatorId: string = "SecOps-Director",
  auditReason: string = "已复核资产清算合规性，零信任双签确认",
  digitalSignature?: string
): Promise<ApprovalTicket | null> {
  try {
    const res = await fetch(apiUrl(`/workflow/approvals/${ticketId}/commit`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        decision,
        operator: operatorId,
        operatorId,
        reason: auditReason,
        auditReason,
        signature: digitalSignature || `SIG_SHA256_${Date.now()}_SEC_GATE`,
        digitalSignature: digitalSignature || `SIG_SHA256_${Date.now()}_SEC_GATE`,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`[Workflow API] Failed to commit approval for ticket ${ticketId}:`, e);
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

  const eventTypes = [
    "INIT",
    "INSTANCE_STARTED",
    "NODE_RUNNING",
    "NODE_COMPLETED",
    "TICKET_REQUIRED",
    "TICKET_APPROVED",
    "TICKET_REJECTED",
    "MERKLE_SEALED",
    "INSTANCE_COMPLETED",
    "INSTANCE_FAILED",
  ];

  for (const type of eventTypes) {
    eventSource.addEventListener(type, (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        onEvent({
          eventType: type as any,
          instanceId: data.instanceId || instanceId,
          nodeId: data.nodeId,
          nodeName: data.nodeName || data.nodeId,
          nodeType: data.nodeType,
          status: data.state || data.status,
          payload: data.outputPreview || data,
          timestamp: new Date().toISOString(),
        });
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

/**
 * 阶段一：获取 Tarjan 强连通分量 (SCC) 环路校验与契约推导报告
 */
export async function validateWorkflowBlueprint(defId: string) {
  try {
    const res = await fetch(apiUrl(`/workflow/blueprint/validate/${defId}`));
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to validate blueprint:", e);
    return null;
  }
}

/**
 * 阶段二：双路混合 RAG 上下文检索 (BM25 + 向量检索 RRF 融合)
 */
export async function searchHybridRag(query: string, limit = 5) {
  try {
    const res = await fetch(apiUrl("/workflow/rag/hybrid-search"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to query hybrid RAG:", e);
    return null;
  }
}

/**
 * 阶段三：获取模型网关与滑动窗口熔断器状态
 */
export async function getGatewayStatus() {
  try {
    const res = await fetch(apiUrl("/workflow/gateway/status"));
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch gateway status:", e);
    return null;
  }
}

/**
 * 阶段五：获取 W3C 全链路追踪 Traceparent 与耗时火焰图
 */
export async function getInstanceTrace(instanceId: string) {
  try {
    const res = await fetch(apiUrl(`/workflow/instances/${instanceId}/trace`));
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch instance trace:", e);
    return null;
  }
}

/**
 * 阶段五：获取增量 Merkle 树证据链证明
 */
export async function getInstanceMerkle(instanceId: string) {
  try {
    const res = await fetch(apiUrl(`/workflow/instances/${instanceId}/merkle`));
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch instance Merkle proof:", e);
    return null;
  }
}

export interface AgentSkill {
  id: string;
  name: string;
  category: string;
  badge: string;
  badgeType: "finance" | "ticket" | "schedule" | "secops";
  title: string;
  description: string;
  suggestedQuery: string;
  tagsJson?: string;
  workflowDefId?: string;
  promptTemplate?: string;
  version?: string;
  enabled?: boolean;
}

export interface McpTool {
  id: string;
  serverName: string;
  functionName: string;
  displayName: string;
  description: string;
  category: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isSafe: boolean;
  timeoutMs: number;
  parametersSchema?: string;
  enabled?: boolean;
}

export interface KnowledgeChunk {
  id: string;
  docTitle: string;
  chunkIndex: number;
  content: string;
  keywords: string;
  category: string;
}

export interface AgentMemory {
  id: string;
  sessionId: string;
  memoryType: "WORKING" | "EPISODIC" | "SEMANTIC";
  content: string;
  importanceScore: number;
  referenceEntity: string;
  lastAccessedAt: string;
}

export interface MerkleBlock {
  blockHeight: number;
  merkleRoot: string;
  instanceId: string;
  previousHash: string;
  txCount: number;
  status: string;
  sealedAt: string;
}

export async function getDbSkills(): Promise<AgentSkill[]> {
  try {
    const res = await fetch(apiUrl("/skills"));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch database skills:", e);
    return [];
  }
}

export async function getDbTools(): Promise<McpTool[]> {
  try {
    const res = await fetch(apiUrl("/tools"));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch database tools:", e);
    return [];
  }
}

export async function getDbKnowledge(): Promise<KnowledgeChunk[]> {
  try {
    const res = await fetch(apiUrl("/knowledge"));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch database knowledge:", e);
    return [];
  }
}

export async function getDbMemories(sessionId = "global-system"): Promise<AgentMemory[]> {
  try {
    const res = await fetch(apiUrl(`/memory?sessionId=${encodeURIComponent(sessionId)}`));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch database memory:", e);
    return [];
  }
}

export async function getDbLedgerBlocks(): Promise<MerkleBlock[]> {
  try {
    const res = await fetch(apiUrl("/ledger/blocks"));
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    console.warn("[Workflow API] Failed to fetch database ledger blocks:", e);
    return [];
  }
}

export interface TarjanReport {
  hasCycle: boolean;
  acyclic: boolean;
  totalVertices: number;
  sccCount: number;
  sccComponents: string[][];
  topologicalOrder: string[];
  diagnostics: Array<{ level: string; msg: string }>;
}

export interface PlanResult {
  definition: WorkflowDefinition;
  tarjanReport: TarjanReport;
  domain: string;
  estimatedRisk: number;
  matchedTools: string[];
  matchedKnowledge: string[];
}

export interface FinOpsMetrics {
  totalInstances: number;
  completedInstances: number;
  totalTokensBurned: number;
  totalCostCny: number;
  hoursSaved: number;
  laborCostSavedCny: number;
  roiMultiplier: string;
  activeBudgetQuotaCny: number;
  budgetUsedPercent: number;
  departmentBreakdown: Array<{ dept: string; sharePercent: number; costCny: number }>;
  modelCostMatrix: Array<{ role: string; tokens: number; rate: string; model: string; cost: number }>;
  timestamp: string;
}

export async function planDynamicWorkflow(
  prompt: string,
  department = "Enterprise-Operations",
  operator = "SecOps-Director"
): Promise<PlanResult | null> {
  try {
    const res = await fetch(apiUrl("/workflow/plan"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, department, operator }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[Workflow API] planDynamicWorkflow failed:", e);
    return null;
  }
}

export async function getFinOpsMetrics(): Promise<FinOpsMetrics | null> {
  try {
    const res = await fetch(apiUrl("/finops/metrics"));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error("[Workflow API] getFinOpsMetrics failed:", e);
    return null;
  }
}

