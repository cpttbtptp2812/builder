// 平台全局通用类型定义

export type NavTab = "chat" | "agents" | "knowledge" | "tools" | "logs" | "settings" | "workflows";

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
