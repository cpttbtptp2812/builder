/**
 * ownagent 企业级全栈 API 通信服务
 * 支持 Java 21 / Spring Boot 3 后端生产级 SSE 流式推流与客户端打断
 * 实体状态全持久化，严防页面刷新丢失
 * 严禁任何硬编码假数据与模拟定时器
 */

import {
  AgentItem,
  AuditLogItem,
  ToolItem,
  PipelineItem,
  WorkflowInstanceData,
  NodeExecutionData,
  ApprovalTicketData,
  GitRepositoryConfig,
} from "../types/platform";

export interface ChatStreamPayload {
  sessionId?: string;
  message: string;
  agentId?: string;
  model?: string;
  systemPrompt?: string;
  temperature?: number;
  enableThinking?: boolean;
  enableWebSearch?: boolean;
  enableRAG?: boolean;
}

export interface TraceStepData {
  step: number;
  name: string;
  title: string;
  status: "RUNNING" | "DONE" | "SKIPPED" | "BLOCKED" | "STREAMING" | "HIT" | "MISS" | string;
  timestamp: number;
  [key: string]: any;
}

export interface StreamEventHandlers {
  onReasoning?: (reasoning: string) => void;
  onToolCall?: (tool: { tool: string; displayName?: string; status?: string; duration?: string; result?: any }) => void;
  onApprovalRequired?: (ticket: { ticketId: string; sql?: string; warning?: string; status: string }) => void;
  onCitations?: (citations: any[], ragStats?: any) => void;
  onTraceStep?: (step: TraceStepData) => void;
  onAgentStep?: (step: any) => void;
  onDelta?: (chunk: string) => void;
  onFinish?: (meta: any) => void;
  onError?: (err: string) => void;
}

// ==========================================
// 1. 智能体 Agent API
// ==========================================
export async function fetchAgentsApi(): Promise<AgentItem[]> {
  try {
    const res = await fetch("/api/agents");
    if (!res.ok) throw new Error("Failed to fetch agents");
    const data = await res.json();
    return data.map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      avatarColor: item.avatar || "bg-blue-600",
      model: item.model || "deepseek-chat",
      temperature: item.temperature ?? 0.7,
      systemPrompt: item.systemPrompt || "",
      toolsCount: typeof item.toolsCount === "number" ? item.toolsCount : 0,
      kbCount: typeof item.kbCount === "number" ? item.kbCount : 0,
      enableMemory: item.enableMemory !== false,
      status: item.status || "PUBLISHED",
      updatedAt: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "刚刚",
    }));
  } catch (err) {
    console.warn("[ownagent] 后端智能体获取失败", err);
    return [];
  }
}

export async function saveAgentApi(agent: Partial<AgentItem>): Promise<AgentItem> {
  const res = await fetch("/api/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: agent.id,
      name: agent.name,
      description: agent.description,
      avatar: agent.avatarColor,
      model: agent.model,
      temperature: agent.temperature,
      systemPrompt: agent.systemPrompt,
      toolsCount: typeof agent.toolsCount === "number" ? agent.toolsCount : 0,
      kbCount: typeof agent.kbCount === "number" ? agent.kbCount : 0,
      enableMemory: agent.enableMemory !== false,
      status: agent.status || "PUBLISHED",
    }),
  });
  if (!res.ok) throw new Error("Failed to save agent");
  const saved = await res.json();
  return {
    id: saved.id,
    name: saved.name,
    description: saved.description,
    avatarColor: saved.avatar || "bg-blue-600",
    model: saved.model || "deepseek-chat",
    temperature: saved.temperature ?? 0.7,
    systemPrompt: saved.systemPrompt || "",
    toolsCount: typeof saved.toolsCount === "number" ? saved.toolsCount : 0,
    kbCount: typeof saved.kbCount === "number" ? saved.kbCount : 0,
    enableMemory: saved.enableMemory !== false,
    status: saved.status || "PUBLISHED",
    updatedAt: "刚刚",
  };
}

export async function deleteAgentApi(id: string): Promise<void> {
  const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete agent");
}

// ==========================================
// 2. 会话 Session 与历史消息 API
// ==========================================
export interface SessionItem {
  id: string;
  title: string;
  time?: string;
  createdAt?: string;
}

export async function fetchSessionsApi(): Promise<SessionItem[]> {
  try {
    const res = await fetch("/api/chat/sessions");
    if (!res.ok) throw new Error("Failed to fetch sessions");
    const data = await res.json();
    return data.map((s: any) => ({
      id: s.id,
      title: s.title,
      time: s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString() : "刚刚",
    }));
  } catch {
    return [];
  }
}

export async function createSessionApi(title: string): Promise<SessionItem> {
  const res = await fetch("/api/chat/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error("Failed to create session");
  const data = await res.json();
  return { id: data.id, title: data.title, time: "刚刚" };
}

export async function deleteSessionApi(id: string): Promise<void> {
  const res = await fetch(`/api/chat/sessions/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function fetchMessagesApi(sessionId: string): Promise<any[]> {
  try {
    const res = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
    if (!res.ok) throw new Error("Failed to fetch messages");
    const data = await res.json();
    return data.map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      reasoning: m.reasoning,
      citations: m.citationsJson ? JSON.parse(m.citationsJson) : undefined,
      traceSteps: m.traceStepsJson ? JSON.parse(m.traceStepsJson) : {},
      toolCalls: m.toolCallsJson ? JSON.parse(m.toolCallsJson) : undefined,
      approvalTicket: m.approvalTicketJson ? JSON.parse(m.approvalTicketJson) : undefined,
      trace: m.traceJson ? JSON.parse(m.traceJson) : undefined,
      tokens: m.tokens,
      duration: m.duration,
      isCached: !!m.isCached,
    }));
  } catch {
    return [];
  }
}

// ==========================================
// 3. 生产级 SSE 流式推流客户端 (100% 连接后端真实大模型与工具)
// ==========================================
export async function streamChatFromBackend(
  payload: ChatStreamPayload,
  handlers: StreamEventHandlers,
  signal?: AbortSignal
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (err: any) {
    if (signal?.aborted) return;
    const errorText = `后端服务连接失败 (${err.name || "NetworkError"}): ${err.message}。请核实后端服务 (8080) 是否正常运行。`;
    console.error("[api] " + errorText, err);
    if (handlers.onError) {
      handlers.onError(errorText);
    }
    return;
  }

  if (!response.ok) {
    let errorDetail = "";
    try {
      errorDetail = await response.text();
    } catch {}
    const errorText = `SSE 通信失败: HTTP ${response.status}${errorDetail ? ` - ${errorDetail.slice(0, 200)}` : ""}`;
    console.error("[api] " + errorText);
    if (handlers.onError) {
      handlers.onError(errorText);
    }
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("无法读取响应数据流");

  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const block of lines) {
        if (!block.trim()) continue;
        const eventMatch = block.match(/event:(.*)/);
        const dataMatch = block.match(/data:(.*)/);

        const event = eventMatch ? eventMatch[1].trim() : "message";
        const data = dataMatch ? dataMatch[1].trim() : "";

        if (event === "agent_step" && handlers.onAgentStep) {
          try {
            handlers.onAgentStep(JSON.parse(data));
          } catch {}
        } else if (event === "trace_step" && handlers.onTraceStep) {
          try {
            handlers.onTraceStep(JSON.parse(data));
          } catch {}
        } else if (event === "reasoning" && handlers.onReasoning) {
          handlers.onReasoning(data);
        } else if (event === "approval_required" && handlers.onApprovalRequired) {
          try {
            handlers.onApprovalRequired(JSON.parse(data));
          } catch {
            handlers.onApprovalRequired({ ticketId: data, status: "PENDING" });
          }
        } else if (event === "citations" && handlers.onCitations) {
          try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
              handlers.onCitations(parsed);
            } else if (parsed && Array.isArray(parsed.items)) {
              handlers.onCitations(parsed.items, parsed);
            } else {
              handlers.onCitations([]);
            }
          } catch {
            handlers.onCitations([]);
          }
        } else if (event === "tool" && handlers.onToolCall) {
          try {
            handlers.onToolCall(JSON.parse(data));
          } catch {
            handlers.onToolCall({ tool: data });
          }
        } else if (event === "delta" && handlers.onDelta) {
          handlers.onDelta(data);
        } else if (event === "finish" && handlers.onFinish) {
          try {
            handlers.onFinish(JSON.parse(data));
          } catch {
            handlers.onFinish({ tokens: 0, duration: "0s" });
          }
        } else if (event === "error" && handlers.onError) {
          handlers.onError(data);
        }
      }
    }
  } catch (err: any) {
    if (signal?.aborted || err?.name === "AbortError") {
      return;
    }
    throw err;
  }
}

// ==========================================
// 4. 插件与技能市场工具 API (真实执行与切换)
// ==========================================
export async function fetchToolsApi(): Promise<ToolItem[]> {
  try {
    const res = await fetch("/api/tools");
    if (!res.ok) throw new Error("Failed to fetch tools");
    const data = await res.json();
    return data.map((t: any) => ({
      id: t.id,
      name: t.functionName || t.id,
      displayName: t.displayName || t.functionName,
      desc: t.description || "",
      category: (t.category || "BUSINESS") as any,
      isEnabled: t.enabled !== false,
      paramsSchema: t.parametersSchema || '{\n  "query": "param"\n}',
    }));
  } catch {
    return [];
  }
}

export async function toggleToolApi(id: string): Promise<boolean> {
  const res = await fetch(`/api/tools/toggle/${id}`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to toggle tool");
  const data = await res.json();
  return Boolean(data.enabled);
}

export async function testToolApi(toolName: string, payload: any): Promise<any> {
  const res = await fetch("/api/tools/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ toolName, payload }),
  });
  if (!res.ok) throw new Error("Failed to execute tool");
  return await res.json();
}

export async function saveToolApi(tool: {
  id: string;
  name?: string;
  displayName?: string;
  desc?: string;
  category?: string;
  isEnabled?: boolean;
  paramsSchema?: string;
}): Promise<any> {
  const payload = {
    id: tool.id,
    serverName: "custom-plugin",
    functionName: tool.name || tool.id,
    displayName: tool.displayName || tool.name,
    description: tool.desc || "",
    category: tool.category || "BUSINESS",
    enabled: tool.isEnabled !== false,
    parametersSchema: tool.paramsSchema || "{}",
  };
  const res = await fetch("/api/tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("保存工具失败");
  return await res.json();
}

export async function deleteToolApi(id: string): Promise<boolean> {
  const res = await fetch(`/api/tools/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("删除工具失败");
  return true;
}

// ==========================================
// 5. 知识库 API (真实切片读写与混合检索)
// ==========================================
export interface KnowledgeChunkItem {
  id: string;
  docTitle: string;
  chunkIndex: number;
  content: string;
  keywords?: string;
  category?: string;
  embeddingJson?: string;
  createdAt?: string;
}

export interface IngestResponse {
  success: boolean;
  docTitle: string;
  totalChunks: number;
  successChunks: number;
  failedChunks: number;
  message: string;
}

export interface RagRecallItem {
  chunkId: string;
  projectName: string;
  section: string;
  text: string;
  denseScore: number;
  sparseScore: number;
  rrfScore: number;
  vectorMode?: string;
  vectorModel?: string;
}

export async function fetchKnowledgeChunksApi(): Promise<KnowledgeChunkItem[]> {
  try {
    const res = await fetch("/api/knowledge/all");
    if (!res.ok) throw new Error("Failed to fetch knowledge");
    return await res.json();
  } catch {
    return [];
  }
}

export async function uploadKnowledgeChunkApi(
  title: string,
  content: string,
  keywords?: string,
  category?: string
): Promise<IngestResponse> {
  const res = await fetch("/api/knowledge/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, keywords, category }),
  });
  if (!res.ok) throw new Error("Failed to upload knowledge chunk");
  return await res.json();
}

export async function deleteKnowledgeChunkApi(id: string): Promise<void> {
  const res = await fetch(`/api/knowledge/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete knowledge chunk");
}

export async function updateKnowledgeChunkApi(
  id: string,
  data: Partial<KnowledgeChunkItem>
): Promise<KnowledgeChunkItem> {
  const res = await fetch(`/api/knowledge/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update knowledge chunk");
  return await res.json();
}

export async function searchKnowledgeApi(query: string): Promise<RagRecallItem[]> {
  const res = await fetch("/api/knowledge/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error("Failed to search knowledge");
  return await res.json();
}

// ==========================================
// 6. 全链路审计日志 API
// ==========================================
export async function fetchAuditLogsApi(): Promise<AuditLogItem[]> {
  try {
    const res = await fetch("/api/audit/logs");
    if (!res.ok) throw new Error("Failed to fetch logs");
    const data = await res.json();
    return data.map((l: any) => ({
      id: l.id,
      time: l.time,
      agentName: l.agentName,
      eventType: l.eventType,
      toolName: l.toolName,
      parameters: l.parameters,
      model: l.model,
      duration: l.duration,
      tokensIn: l.tokensIn || 0,
      tokensOut: l.tokensOut || 0,
      isRealUsage: l.isRealUsage === true,
      status: l.status,
    }));
  } catch {
    return [];
  }
}

// ==========================================
// 7. 健康探活 API
// ==========================================
export async function checkBackendHealth(): Promise<{ ok: boolean; info?: any }> {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, info: data };
  } catch {
    return { ok: false };
  }
}

// ==========================================
// 8. 生产级 Human-in-the-Loop 人机协同审批 API
// ==========================================
export async function decideApprovalApi(
  ticketId: string,
  action: "APPROVE" | "REJECT",
  approver?: string
): Promise<any> {
  const res = await fetch("/api/approval/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ticketId,
      action,
      approver: approver || "系统管理员",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "审批处理失败");
  }
  return await res.json();
}

export async function fetchApprovalTicketsApi(): Promise<any[]> {
  try {
    const res = await fetch("/api/approval/tickets");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ==========================================
// 9. 真实 FinOps 降本指标与 Exact Hash Cache API
// ==========================================
export interface FinOpsCacheMetrics {
  totalCachedPrompts: number;
  totalHits: number;
  totalSavedTokens: number;
  estimatedSavedCny: number;
  totalSavedLatencySeconds: number;
  topEntries: Array<{
    hashKey: string;
    shortHash: string;
    rawPrompt: string;
    normalizedPrompt: string;
    originalTokens: number;
    originalDurationMs: number;
    hitCount: number;
    totalSavedTokens: number;
    lastHitAt: string;
  }>;
  timestamp: string;
}

export async function fetchFinOpsCacheMetricsApi(): Promise<FinOpsCacheMetrics | null> {
  try {
    const res = await fetch("/api/finops/cache-metrics");
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function clearFinOpsCacheApi(): Promise<boolean> {
  try {
    const res = await fetch("/api/finops/cache-clear", { method: "POST" });
    return res.ok;
  } catch {
    return false;
  }
}

// ==========================================
// 8. 企业业务流水线与工作流编排 API (100% 数据库持久化)
// ==========================================
export async function fetchWorkflowsApi(): Promise<PipelineItem[]> {
  try {
    const res = await fetch("/api/workflow/definitions");
    if (!res.ok) throw new Error("Failed to fetch workflows");
    const data = await res.json();
    return data.map((d: any) => {
      let parsedSteps: any[] = [];
      if (d.topologyJson) {
        try {
          parsedSteps = JSON.parse(d.topologyJson);
        } catch {
          parsedSteps = [];
        }
      }
      let dslData: any = {};
      if (d.dslJson) {
        try {
          dslData = JSON.parse(d.dslJson);
        } catch {
          dslData = {};
        }
      }
      return {
        id: d.id,
        name: d.name,
        description: d.description || "",
        category: d.category || "业务自动化",
        badge: d.badge || "生产流水线",
        icon: d.icon || "ShieldCheck",
        promptTemplate: d.promptTemplate || "",
        tags: d.tags
          ? typeof d.tags === "string"
            ? d.tags.split(",").map((s: string) => s.trim()).filter(Boolean)
            : d.tags
          : [],
        version: d.version || "v1.0.0",
        enabled: d.enabled !== false,
        sortOrder: d.sortOrder || 0,
        updatedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "刚刚",
        topologyJson: d.topologyJson || "",
        steps: parsedSteps,
        gitRepositories: dslData.gitRepositories || [],
        mcpServers: dslData.mcpServers || [],
        skills: dslData.skills || [],
        promptConfig: dslData.promptConfig,
        modelConfig: dslData.modelConfig,
        showcaseMeta: dslData.showcaseMeta,
      };
    });
  } catch (err) {
    console.warn("[ownagent] 获取业务流水线失败", err);
    return [];
  }
}

export async function fetchWorkflowDefinitionApi(id: string): Promise<PipelineItem | null> {
  try {
    const res = await fetch(`/api/workflow/definitions/${id}`);
    if (!res.ok) return null;
    const d = await res.json();
    let parsedSteps: any[] = [];
    if (d.topologyJson) {
      try {
        parsedSteps = JSON.parse(d.topologyJson);
      } catch {
        parsedSteps = [];
      }
    }
    let dslData: any = {};
    const dslRaw = d.dslJson ?? d.dslDefinitionJson;
    if (dslRaw) {
      try {
        dslData = JSON.parse(dslRaw);
      } catch {
        dslData = {};
      }
    }
    return {
      id: d.id,
      name: d.name,
      description: d.description || "",
      category: d.category || "业务自动化",
      badge: d.badge || "生产流水线",
      icon: d.icon || "ShieldCheck",
      promptTemplate: d.promptTemplate || "",
      tags: d.tags
        ? typeof d.tags === "string"
          ? d.tags.split(",").map((s: string) => s.trim()).filter(Boolean)
          : d.tags
        : [],
      version: d.version || "v1.0.0",
      enabled: d.enabled !== false,
      sortOrder: d.sortOrder || 0,
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "刚刚",
      topologyJson: d.topologyJson || "",
      steps: parsedSteps,
      gitRepositories: dslData.gitRepositories || [],
      mcpServers: dslData.mcpServers || [],
      skills: dslData.skills || [],
      promptConfig: dslData.promptConfig,
      modelConfig: dslData.modelConfig,
      showcaseMeta: dslData.showcaseMeta,
    };
  } catch (err) {
    console.warn("[ownagent] 获取流水线详情失败", err);
    return null;
  }
}

export async function saveWorkflowApi(wf: Partial<PipelineItem>): Promise<PipelineItem> {
  const dslPayload = {
    gitRepositories: wf.gitRepositories || [],
    mcpServers: wf.mcpServers || [],
    skills: wf.skills || [],
    promptConfig: wf.promptConfig,
    modelConfig: wf.modelConfig,
  };
  const payload = {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    category: wf.category || "业务自动化",
    badge: wf.badge || "生产流水线",
    icon: wf.icon || "ShieldCheck",
    promptTemplate: wf.promptTemplate || "",
    tags: Array.isArray(wf.tags) ? wf.tags.join(",") : (wf.tags || ""),
    version: wf.version || "v1.0.0",
    enabled: wf.enabled !== false,
    sortOrder: wf.sortOrder || 0,
    topologyJson: wf.topologyJson || (wf.steps ? JSON.stringify(wf.steps) : ""),
    dslJson: JSON.stringify(dslPayload),
  };
  const res = await fetch("/api/workflow/definitions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to save workflow");
  const d = await res.json();
  let parsedSteps: any[] = [];
  if (d.topologyJson) {
    try {
      parsedSteps = JSON.parse(d.topologyJson);
    } catch {
      parsedSteps = [];
    }
  }
  let dslData: any = {};
  if (d.dslJson) {
    try {
      dslData = JSON.parse(d.dslJson);
    } catch {
      dslData = {};
    }
  }
  return {
    id: d.id,
    name: d.name,
    description: d.description || "",
    category: d.category || "业务自动化",
    badge: d.badge || "生产流水线",
    icon: d.icon || "ShieldCheck",
    promptTemplate: d.promptTemplate || "",
    tags: d.tags
      ? typeof d.tags === "string"
        ? d.tags.split(",").map((s: string) => s.trim()).filter(Boolean)
        : d.tags
      : [],
    version: d.version || "v1.0.0",
    enabled: d.enabled !== false,
    sortOrder: d.sortOrder || 0,
    updatedAt: d.updatedAt ? new Date(d.updatedAt).toLocaleDateString() : "刚刚",
    topologyJson: d.topologyJson || "",
    steps: parsedSteps,
    gitRepositories: dslData.gitRepositories || [],
    mcpServers: dslData.mcpServers || [],
    skills: dslData.skills || [],
    promptConfig: dslData.promptConfig,
    modelConfig: dslData.modelConfig,
  };
}

export async function deleteWorkflowApi(id: string): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`/api/workflow/definitions/${id}`, {
      method: "DELETE",
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(errText || "删除业务流失败");
    }
  } finally {
    clearTimeout(timer);
  }
}

export async function runWorkflowApi(params: {
  workflowId: string;
  inputParams?: string;
  triggeredBy?: string;
}): Promise<{ instanceId: string; status: string; workflowId: string; startedAt: string }> {
  const res = await fetch("/api/workflow/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error("Failed to run workflow");
  return res.json();
}

export async function fetchWorkflowInstancesListApi(): Promise<WorkflowInstanceData[]> {
  try {
    const res = await fetch("/api/workflow/instances");
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchWorkflowInstanceApi(instanceId: string): Promise<{
  instance: WorkflowInstanceData;
  steps: NodeExecutionData[];
}> {
  const res = await fetch(`/api/workflow/instances/${instanceId}`);
  if (!res.ok) throw new Error("Failed to fetch workflow instance");
  return res.json();
}

export async function commitWorkflowApprovalApi(params: {
  ticketId: string;
  decision: "APPROVED" | "REJECTED";
  operatorId?: string;
  auditReason?: string;
}): Promise<ApprovalTicketData> {
  const res = await fetch(`/api/workflow/approvals/${params.ticketId}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      decision: params.decision,
      operatorId: params.operatorId || "admin_sec",
      auditReason: params.auditReason || (params.decision === "APPROVED" ? "安全核验通过，准予放行" : "人工判定存在风控隐患，执行阻断回滚"),
    }),
  });
  if (!res.ok) throw new Error("Failed to commit approval");
  return res.json();
}

// ══════════════ 多模型故障转移 (Failover) 断路器与演练 API ══════════════

export interface FailoverStatusResponse {
  circuitState: "CLOSED" | "OPEN" | "HALF_OPEN";
  consecutiveFailures: number;
  simulateTimeout: boolean;
  simulateRateLimit: boolean;
  primaryChannel: string;
  fallbackChannel: string;
  timeoutThresholdMs: number;
  recoveryCooldownSec: number;
}

export async function fetchFailoverStatusApi(): Promise<FailoverStatusResponse> {
  const res = await fetch("/api/failover/status");
  if (!res.ok) throw new Error("获取 Failover 状态失败");
  return res.json();
}

export async function toggleFailoverTimeoutApi(enabled?: boolean): Promise<FailoverStatusResponse> {
  const res = await fetch("/api/failover/toggle-timeout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(enabled !== undefined ? { enabled } : {}),
  });
  if (!res.ok) throw new Error("切换 Failover 演练模式失败");
  return res.json();
}

export async function resetFailoverApi(): Promise<FailoverStatusResponse> {
  const res = await fetch("/api/failover/reset", { method: "POST" });
  if (!res.ok) throw new Error("重置断路器失败");
  return res.json();
}

export interface GitCommitItem {
  sha: string;
  author: string;
  message: string;
  time: string;
}

export interface GitFileDiffItem {
  path: string;
  status: string; // 'M' | 'A' | 'D'
  additions: number;
  deletions: number;
}

export interface GitDiffResult {
  ok: boolean;
  commitSha?: string;
  author?: string;
  message?: string;
  time?: string;
  files: GitFileDiffItem[];
  diffText?: string;
  error?: string;
}

export interface GitCreateBranchResult {
  ok: boolean;
  branch?: string;
  baseBranch?: string;
  message?: string;
  error?: string;
}

export async function fetchGitCommitsApi(repoId: string, limit = 15): Promise<GitCommitItem[]> {
  try {
    const res = await fetch(`/api/git/repositories/${encodeURIComponent(repoId)}/commits?limit=${limit}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("[Git] Failed to fetch commit history", err);
    return [];
  }
}

export async function fetchGitDiffApi(
  repoId: string,
  sha?: string,
  file?: string
): Promise<GitDiffResult> {
  try {
    const params = new URLSearchParams();
    if (sha) params.set("sha", sha);
    if (file) params.set("file", file);
    const res = await fetch(`/api/git/repositories/${encodeURIComponent(repoId)}/diff?${params.toString()}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, files: [], error: err.error || "获取 Diff 失败" };
    }
    return await res.json();
  } catch (err: any) {
    return { ok: false, files: [], error: err.message || "请求失败" };
  }
}

export async function createGitFixBranchApi(
  repoId: string,
  baseBranch = "main",
  branchName?: string
): Promise<GitCreateBranchResult> {
  try {
    const res = await fetch(`/api/git/repositories/${encodeURIComponent(repoId)}/create-fix-branch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseBranch, branchName }),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message || "分支创建失败" };
  }
}

// ─── 真实 Git 仓库持久化与远程探活 API ───

function mapGitRepositoryFromApi(d: any): GitRepositoryConfig {
  return {
    id: d.id,
    workflowId: d.workflowId,
    name: d.name,
    repoUrl: d.repoUrl,
    branch: d.branch || "main",
    authType: (d.authType || "none").toLowerCase() as "token" | "ssh" | "none",
    accessToken: d.accessToken,
    sshKey: d.sshKey,
    localPath: d.localPath,
    pollingIntervalMinutes: d.pollingIntervalMinutes ?? 5,
    autoAnalyzeCommit: d.autoAnalyzeCommit !== false,
    enabled: d.enabled !== false,
    status: (d.status || "connected").toLowerCase() as "connected" | "disconnected" | "connecting" | "error",
    lastCommitSha: d.lastCommitSha,
    lastCommitMessage: d.lastCommitMessage,
    lastCommitAuthor: d.lastCommitAuthor,
    lastCommitTime: d.lastCommitTime,
    filesCount: d.filesCount ?? 0,
    healthStatus: (d.healthStatus || "healthy").toLowerCase() as "healthy" | "warning" | "error",
    healthMessage: d.healthMessage,
    errorMsg: d.errorMsg,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export async function fetchGitRepositoriesApi(workflowId?: string): Promise<GitRepositoryConfig[]> {
  try {
    const url = workflowId
      ? `/api/git/repositories?workflowId=${encodeURIComponent(workflowId)}`
      : "/api/git/repositories";
    const res = await fetch(url);
    if (!res.ok) throw new Error("获取 Git 仓库列表失败");
    const data = await res.json();
    return data.map(mapGitRepositoryFromApi);
  } catch (err) {
    console.warn("[ownagent] 获取 Git 仓库失败", err);
    return [];
  }
}

export async function saveGitRepositoryApi(
  repo: Partial<GitRepositoryConfig>,
  workflowId?: string
): Promise<GitRepositoryConfig> {
  const resolvedWorkflowId = workflowId || (repo as any)?.workflowId || undefined;
  const payload = {
    id: repo.id,
    workflowId: resolvedWorkflowId,
    name: repo.name,
    repoUrl: repo.repoUrl,
    branch: repo.branch || "main",
    authType: (repo.authType || "none").toUpperCase(),
    accessToken: repo.accessToken,
    sshKey: repo.sshKey,
    localPath: repo.localPath,
    pollingIntervalMinutes: repo.pollingIntervalMinutes ?? 5,
    autoAnalyzeCommit: repo.autoAnalyzeCommit !== false,
    enabled: repo.enabled !== false,
  };

  const res = await fetch("/api/git/repositories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`保存代码库失败: ${errorBody || res.statusText}`);
  }

  const d = await res.json();
  return mapGitRepositoryFromApi(d);
}

export async function deleteGitRepositoryApi(id: string): Promise<void> {
  const res = await fetch(`/api/git/repositories/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("解绑代码库失败");
}

export async function testGitConnectionApi(payload: {
  repoUrl: string;
  branch?: string;
  authType?: string;
  accessToken?: string;
  sshKey?: string;
}): Promise<{
  ok: boolean;
  status: string;
  branch?: string;
  commitSha?: string;
  commitAuthor?: string;
  commitMessage?: string;
  commitTime?: string;
  filesCount?: number;
  healthStatus?: "healthy" | "warning" | "error";
  healthMessage?: string;
  error?: string;
}> {
  const res = await fetch("/api/git/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      repoUrl: payload.repoUrl,
      branch: payload.branch || "main",
      authType: (payload.authType || "none").toUpperCase(),
      accessToken: payload.accessToken,
      sshKey: payload.sshKey,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    return {
      ok: false,
      status: "ERROR",
      error: `请求探测失败: ${errText || res.statusText}`,
      healthStatus: "error",
      healthMessage: "网络或服务异常",
    };
  }
  const d = await res.json();
  return {
    ok: d.ok,
    status: d.status,
    branch: d.branch,
    commitSha: d.commitSha,
    commitAuthor: d.commitAuthor,
    commitMessage: d.commitMessage,
    commitTime: d.commitTime,
    filesCount: d.filesCount,
    healthStatus: d.healthStatus ? (d.healthStatus.toLowerCase() as any) : "healthy",
    healthMessage: d.healthMessage,
    error: d.error,
  };
}

export async function fetchRemoteBranchesApi(payload: {
  repoUrl: string;
  authType?: string;
  accessToken?: string;
  sshKey?: string;
}): Promise<{
  ok: boolean;
  defaultBranch?: string;
  branches: string[];
  error?: string;
}> {
  try {
    const res = await fetch("/api/git/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repoUrl: payload.repoUrl,
        authType: (payload.authType || "none").toUpperCase(),
        accessToken: payload.accessToken,
        sshKey: payload.sshKey,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, branches: [], error: err || "拉取分支失败" };
    }
    const d = await res.json();
    return {
      ok: d.ok,
      defaultBranch: d.defaultBranch,
      branches: Array.isArray(d.branches) ? d.branches : [],
      error: d.error,
    };
  } catch (err: any) {
    return { ok: false, branches: [], error: err.message || "拉取分支网络异常" };
  }
}

export async function syncGitRepositoryApi(id: string): Promise<GitRepositoryConfig> {
  const res = await fetch(`/api/git/repositories/${id}/sync`, { method: "POST" });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "同步仓库失败");
  }
  const d = await res.json();
  return mapGitRepositoryFromApi(d);
}

export interface RemoteUserRepoItem {
  name: string;
  fullName: string;
  description: string;
  cloneUrl: string;
  sshUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  updatedAt: string;
}

export async function fetchUserRepositoriesApi(payload: {
  accessToken: string;
  gitHost?: string;
}): Promise<RemoteUserRepoItem[]> {
  try {
    const res = await fetch("/api/git/user-repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn("拉取用户仓库列表失败", err);
    return [];
  }
}

export interface GitUserProfile {
  ok: boolean;
  login?: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  publicRepos?: number;
  totalPrivateRepos?: number;
  error?: string;
}

export async function verifyGitTokenApi(payload: {
  accessToken: string;
  gitHost?: string;
}): Promise<GitUserProfile> {
  try {
    const res = await fetch("/api/git/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: txt || "验证失败" };
    }
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message || "网络请求异常" };
  }
}

export async function githubOAuthCallbackApi(payload: {
  code: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<{ ok: boolean; accessToken?: string; login?: string; name?: string; avatarUrl?: string; error?: string }> {
  try {
    const res = await fetch("/api/git/oauth/github/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err: any) {
    return { ok: false, error: err.message || "OAuth 换取 Token 失败" };
  }
}

export interface TestWebhookResult {
  ok: boolean;
  statusCode?: number;
  responseBody?: string;
  error?: string;
  channelType?: string;
  testedAt?: string;
}

export async function testIntegrationWebhookApi(params: {
  webhookUrl: string;
  channelType?: string;
  secret?: string;
}): Promise<TestWebhookResult> {
  try {
    const res = await fetch("/api/integration/test-webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: errData.error || `HTTP ${res.status}: 请求失败`,
        statusCode: res.status,
      };
    }
    return await res.json();
  } catch (err: any) {
    return {
      ok: false,
      error: err.message || "网络请求失败，请检查服务地址",
    };
  }
}


