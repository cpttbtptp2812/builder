// 平台全局通用类型定义

export type NavTab = "chat" | "agents" | "knowledge" | "tools" | "logs" | "settings" | "workflows";

export type StepActionType =
  | "INPUT_EXTRACT"   // 字段映射与数据提取
  | "RULE_CHECK"      // 规则计算与判断
  | "HTTP_TOOL"       // 外部 API / 接口调用
  | "HITL_APPROVAL"   // 人工安全审批与复核
  | "LLM_REDUCE";     // 大模型总结与结果输出

export interface PipelineStep {
  id: string;
  name: string;
  type: StepActionType;
  description?: string;
  config: {
    fields?: string;
    maskSensitive?: boolean;
    ruleExpr?: string;
    apiUrl?: string;
    apiMethod?: "GET" | "POST" | "PUT";
    apiHeaders?: string;
    apiBodyTemplate?: string;
    approverRole?: string;
    timeoutSeconds?: number;
    outputFormat?: "STREAM_TEXT" | "JSON" | "TABLE";
  };
}

export interface PipelineItem {
  id: string;
  name: string;
  description: string;
  category: string;
  badge: string;
  icon?: string;
  promptTemplate: string;
  tags: string[];
  version?: string;
  enabled: boolean;
  sortOrder?: number;
  updatedAt?: string;
  topologyJson?: string;
  steps?: PipelineStep[];
  agentId?: string;
}

export interface AgentItem {
  id: string;
  name: string;
  description: string;
  avatarColor: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  toolsCount: number;
  kbCount: number;
  enableMemory: boolean;
  status: "PUBLISHED" | "DRAFT" | "OFFLINE";
  updatedAt: string;
}

export interface KnowledgeDocument {
  id: string;
  name: string;
  size: string;
  chunks: number;
  status: "READY" | "INDEXING" | "FAILED";
  updatedAt: string;
  type: "pdf" | "md" | "txt" | "xlsx";
}

export interface ToolItem {
  id: string;
  name: string;
  displayName: string;
  desc: string;
  category: "SYSTEM" | "BUSINESS" | "EXTERNAL";
  isEnabled: boolean;
  paramsSchema: string;
}

export interface AuditLogItem {
  id: string;
  time: string;
  agentName: string;
  eventType: string;
  toolName?: string;
  parameters?: string;
  model: string;
  duration: string;
  tokensIn: number;
  tokensOut: number;
  isRealUsage?: boolean;
  status: "SUCCESS" | "FAILED" | "TIMEOUT" | "ABORTED";
}

// ══════════════ 工作流运行时与瀑布流类型 ══════════════

export interface WorkflowInstanceData {
  id: string;
  workflowId: string;
  status: "RUNNING" | "SUSPENDED_APPROVAL" | "COMPLETED" | "FAILED" | "REJECTED_ROLLED_BACK";
  triggeredBy: string;
  startedAt: string;
  finishedAt?: string;
  currentNodeId?: string;
  inputParams?: string;
}

export interface NodeExecutionData {
  id: string;
  instanceId: string;
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: "RUNNING" | "SUCCESS" | "FAILED" | "BLOCKED" | "COMPENSATED";
  outputPayload?: string;
  startedAt?: string;
  endedAt?: string;
  latencyMs?: number;
  costTokens?: number;
}

export interface ApprovalTicketData {
  id: string;
  instanceId: string;
  nodeId: string;
  policyLevel: string;
  riskScore: number;
  operationSummary: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  operatorId?: string;
  auditReason?: string;
  signatureHash?: string;
  decidedAt?: string;
}

export interface WorkflowEventMessageData {
  eventType: string;
  instanceId: string;
  nodeId?: string;
  nodeName?: string;
  nodeType?: string;
  status?: string;
  payload?: any;
  timestamp?: number;
}

export const DEFAULT_ENTERPRISE_WORKFLOWS: PipelineItem[] = [];
