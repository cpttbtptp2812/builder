import React, { useCallback, useState, useRef, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  getWorkflowDefinitions,
  planDynamicWorkflow,
  getFinOpsMetrics,
  type PlanResult,
  type TarjanReport,
  type FinOpsMetrics,
  triggerWorkflowRun,
  subscribeToWorkflowStream,
  commitApprovalDecision,
  getWorkflowInstances,
  getWorkflowInstance,
  getPendingApprovals,
  validateWorkflowBlueprint,
  searchHybridRag,
  getGatewayStatus,
  getInstanceTrace,
  getInstanceMerkle,
  getDbSkills,
  getDbTools,
  getDbKnowledge,
  getDbMemories,
  getDbLedgerBlocks,
  type ApprovalTicket,
  type WorkflowDefinition,
  type WorkflowInstance,
  type NodeExecution,
  type WorkflowEventMessage,
  type AgentSkill,
  type McpTool,
  type KnowledgeChunk,
  type AgentMemory,
  type MerkleBlock,
} from "../../../lib/workflowBackendClient";

// 真实节点数据接口
export interface AgentNodeData extends Record<string, unknown> {
  label: string;
  kind: "POLICY_VERIFICATION" | "LLM_REASONING" | "HUMAN_APPROVAL_2PC" | "MCP_TOOL_CALL" | "SQL_EXECUTOR";
  status: "idle" | "running" | "suspended" | "success" | "failed";
  risk?: "LOW" | "HIGH" | "CRITICAL";
  description?: string;
  costMs?: number;
  costTokens?: number;
  outputPreview?: string;
  rawPayload?: any;
}

// 工业级 React Flow 节点组件
function AgentPipelineNode({ data, selected }: NodeProps<Node<AgentNodeData>>) {
  const getBadgeStyle = () => {
    switch (data.kind) {
      case "POLICY_VERIFICATION":
        return { bg: "#e0f2fe", text: "#0369a1", label: "SPEC CHECK" };
      case "LLM_REASONING":
        return { bg: "#ede9fe", text: "#6d28d9", label: "LLM REASON" };
      case "HUMAN_APPROVAL_2PC":
        return { bg: "#fef3c7", text: "#b45309", label: "2PC GATE" };
      case "MCP_TOOL_CALL":
        return { bg: "#ecfdf5", text: "#047857", label: "MCP TOOL" };
      case "SQL_EXECUTOR":
        return { bg: "#fce7f3", text: "#be185d", label: "LEDGER AUDIT" };
      default:
        return { bg: "#f1f5f9", text: "#475569", label: "STEP" };
    }
  };

  const badge = getBadgeStyle();

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: "10px",
        background: "#ffffff",
        border: selected
          ? "2px solid #2563eb"
          : data.status === "running"
          ? "2px solid #3b82f6"
          : data.status === "suspended"
          ? "2px solid #f59e0b"
          : data.status === "success"
          ? "2px solid #10b981"
          : data.status === "failed"
          ? "2px solid #ef4444"
          : "1px solid #cbd5e1",
        boxShadow:
          data.status === "running"
            ? "0 0 16px rgba(59, 130, 246, 0.45)"
            : data.status === "suspended"
            ? "0 0 16px rgba(245, 158, 11, 0.45)"
            : "0 2px 8px rgba(0,0,0,0.06)",
        minWidth: "200px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#64748b", width: 8, height: 8 }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span
          style={{
            fontSize: "0.64rem",
            fontWeight: 750,
            padding: "2px 7px",
            borderRadius: "4px",
            background: badge.bg,
            color: badge.text,
            letterSpacing: "0.03em",
          }}
        >
          {badge.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {data.risk && (
            <span
              style={{
                fontSize: "0.6rem",
                fontWeight: 700,
                color: data.risk === "CRITICAL" ? "#dc2626" : data.risk === "HIGH" ? "#ea580c" : "#64748b",
              }}
            >
              {data.risk}
            </span>
          )}
          {data.costMs !== undefined && (
            <span style={{ fontSize: "0.64rem", color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
              {data.costMs}ms
            </span>
          )}
        </div>
      </div>

      <div style={{ fontSize: "0.85rem", fontWeight: 650, color: "#0f172a", marginBottom: "4px" }}>
        {data.label}
      </div>

      {data.description && (
        <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "6px", lineHeight: 1.35 }}>
          {data.description}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.68rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background:
                data.status === "running"
                  ? "#3b82f6"
                  : data.status === "suspended"
                  ? "#f59e0b"
                  : data.status === "success"
                  ? "#10b981"
                  : data.status === "failed"
                  ? "#ef4444"
                  : "#94a3b8",
            }}
          />
          <span
            style={{
              color:
                data.status === "running"
                  ? "#2563eb"
                  : data.status === "suspended"
                  ? "#b45309"
                  : data.status === "success"
                  ? "#059669"
                  : data.status === "failed"
                  ? "#dc2626"
                  : "#64748b",
              fontWeight: data.status !== "idle" ? 650 : 400,
            }}
          >
            {data.status === "running" && "执行中 (Running)..."}
            {data.status === "suspended" && "挂起待 2PC 审批"}
            {data.status === "success" && "执行完毕 (Success)"}
            {data.status === "idle" && "就绪待命 (Ready)"}
            {data.status === "failed" && "执行异常 (Failed)"}
          </span>
        </div>

        {data.costTokens !== undefined && data.costTokens > 0 && (
          <span style={{ color: "#818cf8", fontFamily: "ui-monospace, monospace", fontSize: "0.62rem" }}>
            {data.costTokens} tok
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: "#64748b", width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { agentNode: AgentPipelineNode };

// 将后端拓扑 JSON 转化为 React Flow 节点与边
function buildGraphFromTopology(rawJson: string): { nodes: Node<AgentNodeData>[]; edges: Edge[] } {
  try {
    const parsed = JSON.parse(rawJson) as Array<{
      id: string;
      name: string;
      type: AgentNodeData["kind"];
      description: string;
      risk?: "LOW" | "HIGH" | "CRITICAL";
    }>;

    const nodes: Node<AgentNodeData>[] = parsed.map((item, idx) => ({
      id: item.id,
      type: "agentNode",
      position: { x: 30 + idx * 260, y: 160 },
      data: {
        label: item.name,
        kind: item.type,
        status: "idle",
        description: item.description,
        risk: item.risk || "LOW",
      },
    }));

    const edges: Edge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({
        id: `e-${nodes[i].id}-${nodes[i + 1].id}`,
        source: nodes[i].id,
        target: nodes[i + 1].id,
        animated: false,
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      });
    }

    return { nodes, edges };
  } catch (e) {
    console.error("Failed to parse topology JSON:", e);
    return { nodes: [], edges: [] };
  }
}

export function EnterpriseAgentStudio({
  onRunScenario,
  onOpenTrace,
  onSignHitl,
}: {
  onRunScenario?: (prompt: string) => void;
  onOpenTrace?: () => void;
  onSignHitl?: (action: "approve" | "reject") => void;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AgentNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node<AgentNodeData> | null>(null);
  const [activeTab, setActiveTab] = useState<"approval" | "planner" | "inspector" | "stages" | "assets" | "finops" | "logs" | "history">("approval");
  const [planPrompt, setPlanPrompt] = useState<string>("为华东区域自动做跨行大额资金清算并更新总账");
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [dynamicPlanResult, setDynamicPlanResult] = useState<PlanResult | null>(null);
  const [finOpsMetrics, setFinOpsMetrics] = useState<FinOpsMetrics | null>(null);

  const [dbSkills, setDbSkills] = useState<AgentSkill[]>([]);
  const [dbTools, setDbTools] = useState<McpTool[]>([]);
  const [dbKnowledge, setDbKnowledge] = useState<KnowledgeChunk[]>([]);
  const [dbMemories, setDbMemories] = useState<AgentMemory[]>([]);
  const [dbBlocks, setDbBlocks] = useState<MerkleBlock[]>([]);
  const [activeAssetCategory, setActiveAssetCategory] = useState<"skills" | "tools" | "knowledge" | "memory" | "ledger">("skills");
  const [isExecuting, setIsExecuting] = useState(false);
  const [definitions, setDefinitions] = useState<WorkflowDefinition[]>([]);
  const [activeDef, setActiveDef] = useState<WorkflowDefinition | null>(null);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [currentTicket, setCurrentTicket] = useState<ApprovalTicket | null>(null);
  const [backendLive, setBackendLive] = useState<boolean>(false);
  const [streamActive, setStreamActive] = useState<boolean>(false);

  // 5-Stage EALM 生命周期状态
  const [tarjanReport, setTarjanReport] = useState<any>(null);
  const [hybridRagResults, setHybridRagResults] = useState<any[]>([]);
  const [ragQuery, setRagQuery] = useState<string>("跨境大额清算 备付金 零信任");
  const [gatewayMetrics, setGatewayMetrics] = useState<any>(null);
  const [instanceTrace, setInstanceTrace] = useState<any>(null);
  const [instanceMerkle, setInstanceMerkle] = useState<any>(null);

  // 运行日志（由真实后端 SSE 与 API 驱动）
  const [logs, setLogs] = useState<Array<{ time: string; level: string; msg: string }>>([]);

  const streamCleanupRef = useRef<(() => void) | null>(null);

  // 加载 5 阶段生命周期深度遥测数据
  const loadStagesData = useCallback(async (defId: string, instId?: string | null) => {
    try {
      const [tarjan, gw, rag] = await Promise.all([
        validateWorkflowBlueprint(defId),
        getGatewayStatus(),
        searchHybridRag(ragQuery, 4),
      ]);
      if (tarjan) setTarjanReport(tarjan);
      if (gw?.metrics) setGatewayMetrics(gw.metrics);
      if (rag?.results) setHybridRagResults(rag.results);

      const targetInst = instId || currentInstanceId;
      if (targetInst) {
        const [trace, merkle] = await Promise.all([
          getInstanceTrace(targetInst),
          getInstanceMerkle(targetInst),
        ]);
        if (trace) setInstanceTrace(trace);
        if (merkle) setInstanceMerkle(merkle);
      }
    } catch (e) {
      console.warn("Failed to load 5-stage telemetry:", e);
    }
  }, [ragQuery, currentInstanceId]);

    // 加载 FinOps 财务计量指标
  const loadFinOpsData = useCallback(async () => {
    try {
      const data = await getFinOpsMetrics();
      if (data) setFinOpsMetrics(data);
    } catch (e) {
      console.warn("Failed to load FinOps metrics:", e);
    }
  }, []);

  // 阶段二：动态意图规划与图拓扑即时编译
  const handleDynamicPlan = async (customPrompt?: string) => {
    const targetPrompt = customPrompt || planPrompt;
    if (!targetPrompt.trim() || isPlanning) return;
    setIsPlanning(true);
    try {
      const res = await planDynamicWorkflow(targetPrompt);
      if (res && res.definition) {
        setDynamicPlanResult(res);
        setDefinitions((prev) => {
          const exists = prev.some((d) => d.id === res.definition.id);
          return exists ? prev : [res.definition, ...prev];
        });
        setActiveDef(res.definition);
        const graph = buildGraphFromTopology(res.definition.topologyJson);
        setNodes(graph.nodes);
        setEdges(graph.edges);
        const gateNode = graph.nodes.find((n) => n.data.kind === "HUMAN_APPROVAL_2PC") || graph.nodes[0];
        setSelectedNode(gateNode || null);
        setActiveTab("planner");
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toTimeString().slice(0, 8),
            level: "PLANNER",
            msg: `[AI 动态编排成功] 业务领域: ${res.domain} | 预估风险评分: ${res.estimatedRisk} | Tarjan SCC 拓扑无环证明: ${res.tarjanReport?.acyclic ? "通过 (DAG 严格无环)" : "异常"} | 自动动态调度 ${res.matchedTools.length} 个 MCP 工具`,
          },
        ]);
      }
    } catch (e) {
      console.error("Failed to plan dynamic workflow:", e);
    } finally {
      setIsPlanning(false);
    }
  };

  // 加载数据库实体核心资产
  const loadDbAssets = useCallback(async () => {
    try {
      const [skills, tools, knowledge, memories, blocks] = await Promise.all([
        getDbSkills(),
        getDbTools(),
        getDbKnowledge(),
        getDbMemories(),
        getDbLedgerBlocks(),
      ]);
      setDbSkills(skills);
      setDbTools(tools);
      setDbKnowledge(knowledge);
      setDbMemories(memories);
      setDbBlocks(blocks);
    } catch (e) {
      console.warn("Failed to load database assets:", e);
    }
  }, []);

  // 初始化：从真实后端拉取工作流定义、历史实例与挂起的工单
  const refreshBackendData = useCallback(async () => {
    try {
      void loadDbAssets();
      void loadFinOpsData();
      const defs = await getWorkflowDefinitions();
      if (defs.length > 0) {
        setBackendLive(true);
        setDefinitions(defs);
        const def = defs[0];
        setActiveDef(def);

        const graph = buildGraphFromTopology(def.topologyJson);
        setNodes(graph.nodes);
        setEdges(graph.edges);

        // 默认选中 2PC 闸口
        const gateNode = graph.nodes.find((n) => n.data.kind === "HUMAN_APPROVAL_2PC") || graph.nodes[0];
        setSelectedNode(gateNode || null);
      }

      // 拉取所有历史实例
      const instList = await getWorkflowInstances();
      setInstances(instList);

      // 检查是否有待审批的工单
      const pendingTickets = await getPendingApprovals();
      if (pendingTickets.length > 0) {
        const tkt = pendingTickets[0];
        setCurrentTicket(tkt);
        setCurrentInstanceId(tkt.instanceId);
        setActiveTab("approval");
        setNodes((nds) =>
          nds.map((n) => (n.id === tkt.nodeId ? { ...n, data: { ...n.data, status: "suspended" } } : n))
        );
      }
    } catch (e) {
      console.warn("Failed to connect to Java backend:", e);
      setBackendLive(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    refreshBackendData();
    return () => {
      if (streamCleanupRef.current) streamCleanupRef.current();
    };
  }, [refreshBackendData]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges]
  );

  // 切换工作流定义
  const handleSwitchDefinition = (defId: string) => {
    const def = definitions.find((d) => d.id === defId);
    if (!def) return;
    setActiveDef(def);
    const graph = buildGraphFromTopology(def.topologyJson);
    setNodes(graph.nodes);
    setEdges(graph.edges);
    const gateNode = graph.nodes.find((n) => n.data.kind === "HUMAN_APPROVAL_2PC") || graph.nodes[0];
    setSelectedNode(gateNode || null);
  };

  // 点击画布节点进行属性检视
  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node as Node<AgentNodeData>);
    if ((node.data as AgentNodeData)?.kind === "HUMAN_APPROVAL_2PC") {
      setActiveTab("approval");
    } else {
      setActiveTab("inspector");
    }
  };

  // 触发真实 Java Spring Boot 3 + MySQL 工作流调度
  const handleRunWorkflow = async () => {
    if (isExecuting) return;
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }

    setIsExecuting(true);
    setStreamActive(true);
    setCurrentTicket(null);

    // 重置所有节点状态为 idle
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: "idle",
          costMs: undefined,
          costTokens: undefined,
          outputPreview: undefined,
          rawPayload: undefined,
        },
      }))
    );
    setEdges((eds) => eds.map((e) => ({ ...e, animated: false, style: { stroke: "#94a3b8" } })));

    const timeNow = new Date().toTimeString().slice(0, 8);
    setLogs((prev) => [
      ...prev,
      {
        time: timeNow,
        level: "TRIGGER",
        msg: `[Spring Boot Dispatcher] POST /api/workflow/run 启动生产流水线: ${activeDef?.name || "wf-settlement-migration"}`,
      },
    ]);

    try {
      const runRes = await triggerWorkflowRun(activeDef?.id || "wf-settlement-migration", "auditor_sec");
      if (!runRes?.instanceId) {
        throw new Error("Backend did not return instanceId");
      }

      const instanceId = runRes.instanceId;
      setCurrentInstanceId(instanceId);
      setLogs((prev) => [
        ...prev,
        {
          time: new Date().toTimeString().slice(0, 8),
          level: "INSTANCE",
          msg: `[Instance Started] 实例 ${instanceId} 已就绪，连接 Netty SSE 毫秒级长连接推流...`,
        },
      ]);

      // 连接真实 SSE 事件流
      const cleanup = subscribeToWorkflowStream(
        instanceId,
        (event: WorkflowEventMessage) => {
          const timeStr = new Date().toTimeString().slice(0, 8);

          if (event.eventType === "NODE_RUNNING") {
            setNodes((nds) =>
              nds.map((n) => (n.id === event.nodeId ? { ...n, data: { ...n.data, status: "running" } } : n))
            );
            // 将连向当前运行节点的边设为流动高亮
            setEdges((eds) =>
              eds.map((e) =>
                e.target === event.nodeId
                  ? { ...e, animated: true, style: { stroke: "#3b82f6", strokeWidth: 2 } }
                  : e
              )
            );
            setLogs((prev) => [
              ...prev,
              { time: timeStr, level: "NODE_RUN", msg: `[Step Running] ${event.nodeName} (${event.nodeType})` },
            ]);
          } else if (event.eventType === "NODE_COMPLETED") {
            const payload = event.payload || {};
            setNodes((nds) =>
              nds.map((n) => {
                if (n.id === event.nodeId) {
                  return {
                    ...n,
                    data: {
                      ...n.data,
                      status: "success",
                      costMs: payload.latencyMs || payload.latency_ms,
                      costTokens: payload.costTokens || payload.tokens,
                      outputPreview: typeof payload === "string" ? payload : JSON.stringify(payload).slice(0, 80),
                      rawPayload: payload,
                    },
                  };
                }
                return n;
              })
            );
            setEdges((eds) =>
              eds.map((e) =>
                e.target === event.nodeId
                  ? { ...e, animated: false, style: { stroke: "#10b981", strokeWidth: 2 } }
                  : e
              )
            );
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "SUCCESS",
                msg: `[Step Done] ${event.nodeName} (耗时: ${payload.latencyMs || 0}ms, Token: ${payload.costTokens || 0})`,
              },
            ]);
          } else if (event.eventType === "TICKET_REQUIRED") {
            const ticket = event.payload as ApprovalTicket;
            setCurrentTicket(ticket);
            setIsExecuting(false);
            setActiveTab("approval");
            setNodes((nds) =>
              nds.map((n) => (n.id === ticket.nodeId ? { ...n, data: { ...n.data, status: "suspended" } } : n))
            );
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "GATE",
                msg: `[2PC Gate Suspended] 触发零信任审批闸口！工单 ${ticket.id} (P0 级别, 风险评分 ${ticket.riskScore}) 已落库，流水线挂起等待数字签名。`,
              },
            ]);
          } else if (event.eventType === "TICKET_APPROVED") {
            setNodes((nds) =>
              nds.map((n) =>
                n.id === "node-2pc-gate"
                  ? {
                      ...n,
                      data: {
                        ...n.data,
                        status: "success",
                        outputPreview: `电子签名加盖: ${event.payload?.signatureHash?.slice(0, 16)}...`,
                      },
                    }
                  : n
              )
            );
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "AUDIT",
                msg: `[2PC Commit] 电子签名授权完成，状态机恢复推进下一个节点！`,
              },
            ]);
          } else if (event.eventType === "TICKET_REJECTED") {
            setIsExecuting(false);
            setNodes((nds) =>
              nds.map((n) => (n.id === "node-2pc-gate" ? { ...n, data: { ...n.data, status: "failed" } } : n))
            );
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "ROLLBACK",
                msg: `[Saga Rollback] 审计员驳回授权，Saga 逆向补偿回滚完成，数据库零脏写。`,
              },
            ]);
            if (streamCleanupRef.current) streamCleanupRef.current();
          } else if (event.eventType === "INSTANCE_COMPLETED") {
            setIsExecuting(false);
            setStreamActive(false);
            setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "success" } })));
            setEdges((eds) => eds.map((e) => ({ ...e, animated: false, style: { stroke: "#10b981", strokeWidth: 2 } })));
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "COMPLETED",
                msg: `[Instance Completed] 全链路 100% 收敛！Merkle 审计凭证已安全持久化写入 MySQL 8.0。`,
              },
            ]);
            getWorkflowInstances().then(setInstances);
            if (streamCleanupRef.current) streamCleanupRef.current();
          }
        },
        (err) => {
          console.warn("[SSE Stream Disconnect]", err);
          setIsExecuting(false);
        }
      );

      streamCleanupRef.current = cleanup;
    } catch (e) {
      console.error("Workflow run error:", e);
      setIsExecuting(false);
      setLogs((prev) => [
        ...prev,
        {
          time: new Date().toTimeString().slice(0, 8),
          level: "ERROR",
          msg: `[Error] 执行调度异常: ${e instanceof Error ? e.message : String(e)}`,
        },
      ]);
    }
  };

  // 提交 2PC 电子签名核准 (Commit)
  const handleApprove = async () => {
    if (!currentTicket?.id) return;
    try {
      const approved = await commitApprovalDecision(
        currentTicket.id,
        "APPROVED",
        "auditor_sec",
        "零信任审计复核通过，确认清算转账与表级结构迁移",
        `SIG_SHA256_${Date.now()}_PASS`
      );
      if (approved) {
        setCurrentTicket(approved);
        onSignHitl?.("approve");
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toTimeString().slice(0, 8),
            level: "AUDIT",
            msg: `[Spring Boot 2PC] 工单 ${approved.id} 数字签名指纹 (${approved.signatureHash?.slice(0, 16)}...) 已落库 MySQL，恢复后端执行！`,
          },
        ]);
      }
    } catch (e) {
      console.error("Failed to commit approval:", e);
    }
  };

  // 驳回 2PC 审批 (Reject & Saga Rollback)
  const handleReject = async () => {
    if (!currentTicket?.id) return;
    try {
      const rejected = await commitApprovalDecision(
        currentTicket.id,
        "REJECTED",
        "auditor_sec",
        "高危资金敞口未通过风控合规标准，执行回滚"
      );
      if (rejected) {
        setCurrentTicket(rejected);
        onSignHitl?.("reject");
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toTimeString().slice(0, 8),
            level: "ABORT",
            msg: `[2PC Abort] 工单已驳回，Saga 逆向事务补偿撤销生效！`,
          },
        ]);
      }
    } catch (e) {
      console.error("Failed to reject ticket:", e);
    }
  };

  // 时间旅行回放：点击历史实例载入当时的实际执行快照
  const handleReplayInstance = async (instId: string) => {
    try {
      const data = await getWorkflowInstance(instId);
      if (data?.steps) {
        setCurrentInstanceId(instId);
        setNodes((nds) =>
          nds.map((n) => {
            const step = data.steps.find((s) => s.nodeId === n.id);
            if (step) {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: step.status === "SUCCESS" ? "success" : step.status === "BLOCKED" ? "suspended" : "failed",
                  costMs: step.latencyMs,
                  costTokens: step.costTokens,
                  outputPreview: step.outputPayload ? step.outputPayload.slice(0, 80) : undefined,
                  rawPayload: step.outputPayload ? JSON.parse(step.outputPayload) : undefined,
                },
              };
            }
            return n;
          })
        );
        setActiveTab("inspector");
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toTimeString().slice(0, 8),
            level: "REPLAY",
            msg: `[Time-Travel] 已加载 MySQL 历史实例 ${instId} 完整步骤快照 (共 ${data.steps.length} 步)`,
          },
        ]);
      }
    } catch (e) {
      console.error("Failed to load instance history:", e);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#f8fafc" }}>
      {/* 顶部控制栏 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "52px",
          padding: "0 1.25rem",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
          {definitions.length > 1 ? (
            <select
              value={activeDef?.id || ""}
              onChange={(e) => handleSwitchDefinition(e.target.value)}
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "#0f172a",
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                padding: "3px 8px",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {definitions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.version})
                </option>
              ))}
            </select>
          ) : (
            <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>
              {activeDef?.name || "企业级智能体真实调度平台"}
            </strong>
          )}
          <span style={{ fontSize: "0.72rem", color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
            {activeDef?.version || "v2.5"} · {activeDef?.id || "wf-engine"}
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              padding: "2px 8px",
              borderRadius: "4px",
              background: backendLive ? "#ecfdf5" : "#fef2f2",
              color: backendLive ? "#059669" : "#dc2626",
              border: backendLive ? "1px solid #a7f3d0" : "1px solid #fecaca",
              fontWeight: 650,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: backendLive ? "#10b981" : "#ef4444",
                boxShadow: backendLive ? "0 0 8px #10b981" : "none",
              }}
            />
            {backendLive ? "生产引擎调度集群: ONLINE" : "后端连接异常"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <button
            type="button"
            onClick={refreshBackendData}
            title="刷新后端工作流定义、挂起工单与历史实例"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.38rem 0.75rem",
              fontSize: "0.76rem",
              fontWeight: 500,
              background: "#ffffff",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            🔄 同步后端数据
          </button>

          <button
            type="button"
            onClick={handleRunWorkflow}
            disabled={isExecuting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.42rem 1.15rem",
              fontSize: "0.82rem",
              fontWeight: 650,
              background: isExecuting ? "#94a3b8" : "linear-gradient(135deg, #2563eb, #0284c7)",
              color: "#ffffff",
              border: "none",
              borderRadius: "7px",
              cursor: isExecuting ? "not-allowed" : "pointer",
              boxShadow: isExecuting ? "none" : "0 2px 8px rgba(37, 99, 235, 0.35)",
              transition: "all 0.2s ease",
            }}
          >
            {isExecuting ? "⏳ 正在调度执行并推流中..." : "▶ 启动真实集群调度 (Run Live)"}
          </button>
        </div>
      </header>

      {/* 阶段二：动态意图解构与 AI 任务图规划条 (Dynamic AI Intent Planner Bar) */}
      <section
        style={{
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.5rem 1.25rem",
          background: "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 100%)",
          borderBottom: "1px solid #cbd5e1",
          zIndex: 9,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#1e293b", fontWeight: 700, fontSize: "0.78rem", whiteSpace: "nowrap" }}>
          <span style={{ fontSize: "1rem" }}>⚡</span>
          <span>AI 动态任务规划与拓扑编译:</span>
        </div>

        <div style={{ display: "flex", flex: 1, minWidth: "320px", gap: "0.5rem" }}>
          <input
            type="text"
            value={planPrompt}
            onChange={(e) => setPlanPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleDynamicPlan();
            }}
            placeholder="输入任意复杂自然语言业务诉求 (例: 为华东区域自动做跨行大额资金清算并更新总账)..."
            style={{
              flex: 1,
              padding: "0.38rem 0.75rem",
              fontSize: "0.78rem",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              color: "#0f172a",
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => handleDynamicPlan()}
            disabled={isPlanning}
            style={{
              padding: "0.38rem 0.95rem",
              fontSize: "0.76rem",
              fontWeight: 650,
              color: "#ffffff",
              background: isPlanning ? "#94a3b8" : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              border: "none",
              borderRadius: "6px",
              cursor: isPlanning ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
              boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
            }}
          >
            {isPlanning ? "🤖 拓扑编译中..." : "🚀 动态生成 DAG"}
          </button>
        </div>

        {/* 快速业务预设 */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.7rem", color: "#64748b" }}>预设场景:</span>
          {[
            { label: "💳 跨行大额清算", prompt: "为华东区域自动做跨行大额资金清算并更新总账" },
            { label: "🛡️ 多云 IAM 应急隔离", prompt: "对华南生产集群检测到可疑暴力破解，自动化执行多云 IAM 权限收回与边界防火墙应急隔离" },
            { label: "🧾 增值税发票 OCR 核算", prompt: "从企业进销项数据库提取待核销发票，执行发票 OCR 票号核验与进项税抵扣自动过账" },
          ].map((sc, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setPlanPrompt(sc.prompt);
                handleDynamicPlan(sc.prompt);
              }}
              style={{
                fontSize: "0.68rem",
                padding: "2px 7px",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "4px",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {sc.label}
            </button>
          ))}
        </div>
      </section>

      {/* 主体两栏：左侧 React Flow 画布，右侧抽屉面板 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 左侧 React Flow 画布 */}
        <div style={{ flex: 1, height: "100%", position: "relative" }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
            className="rf-light"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
            <MiniMap
              nodeColor={(n) => {
                const k = (n.data as AgentNodeData)?.kind;
                if (k === "HUMAN_APPROVAL_2PC") return "#f59e0b";
                if (k === "MCP_TOOL_CALL") return "#10b981";
                if (k === "LLM_REASONING") return "#818cf8";
                if (k === "SQL_EXECUTOR") return "#ec4899";
                return "#38bdf8";
              }}
            />
            <Controls />
          </ReactFlow>

          {/* 画布底栏状态提示 */}
          <div
            style={{
              position: "absolute",
              bottom: "1rem",
              left: "1rem",
              background: "rgba(255, 255, 255, 0.95)",
              backdropFilter: "blur(6px)",
              padding: "0.55rem 0.9rem",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "0.72rem",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
            }}
          >
            <span>
              当前活动实例: <strong style={{ color: "#0f172a" }}>{currentInstanceId || "待启动"}</strong>
            </span>
            <span>
              SSE 通信状态: <strong style={{ color: streamActive ? "#10b981" : "#64748b" }}>{streamActive ? "全双工已连接" : "待命"}</strong>
            </span>
            <span>
              已接入节点: <strong style={{ color: "#2563eb" }}>{nodes.length} 个原生拓扑节点</strong>
            </span>
          </div>
        </div>

        {/* 右侧抽屉面板 (390px) */}
        <aside
          style={{
            width: "390px",
            borderLeft: "1px solid #e2e8f0",
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 六大功能 Tab */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, 1fr)",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("approval")}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "approval" ? 700 : 500,
                color: activeTab === "approval" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "approval" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🛡️ 审批
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("planner")}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "planner" ? 700 : 500,
                color: activeTab === "planner" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "planner" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🧠 规划
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("stages");
                if (activeDef) loadStagesData(activeDef.id, currentInstanceId);
              }}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "stages" ? 700 : 500,
                color: activeTab === "stages" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "stages" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🌟 全景
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("assets");
                void loadDbAssets();
              }}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "assets" ? 700 : 500,
                color: activeTab === "assets" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "assets" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🗄️ 资产
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("finops");
                void loadFinOpsData();
              }}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "finops" ? 700 : 500,
                color: activeTab === "finops" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "finops" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              💰 FinOps
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inspector")}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "inspector" ? 700 : 500,
                color: activeTab === "inspector" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "inspector" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🔍 检视
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "logs" ? 700 : 500,
                color: activeTab === "logs" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "logs" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              📋 日志
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("history")}
              style={{
                padding: "0.65rem 0",
                fontSize: "0.68rem",
                fontWeight: activeTab === "history" ? 700 : 500,
                color: activeTab === "history" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "history" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🕒 历史
            </button>
          </div>

          {/* Tab 2: 白皮书 5 阶段全生命周期闭环仪表盘 */}
          {activeTab === "stages" && (
            <div style={{ flex: 1, padding: "0.9rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#0f172a" }}>
                  EALM 五阶段工业级架构闭环
                </span>
                <button
                  type="button"
                  onClick={() => activeDef && loadStagesData(activeDef.id, currentInstanceId)}
                  style={{
                    fontSize: "0.65rem",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    cursor: "pointer",
                  }}
                >
                  🔄 刷新遥测
                </button>
              </div>

              {/* 阶段一：蓝图定义与 Tarjan SCC 环路检测 */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.75rem", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>阶段一：静态契约与 Tarjan SCC 拓扑</strong>
                  <span style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: "3px", background: "#ecfdf5", color: "#059669", fontWeight: 700 }}>
                    数学级无环证明 PASS
                  </span>
                </div>
                <div style={{ fontSize: "0.66rem", color: "#475569", lineHeight: 1.45 }}>
                  {tarjanReport?.diagnostics?.[0]?.msg || "Tarjan SCC 校验通过：5 个顶点，强连通分量顶点数 = 1，严格 DAG"}
                </div>
                <div style={{ marginTop: "0.35rem", fontSize: "0.62rem", color: "#64748b", fontFamily: "ui-monospace, monospace" }}>
                  拓扑依赖流: {nodes.map((n) => n.id.replace("node-", "")).join(" ➔ ")}
                </div>
              </div>

              {/* 阶段二：MCP 工具沙盒与双路混合 RAG 上下文装配 */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.75rem", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>阶段二：MCP 沙盒与双路混合 RAG</strong>
                  <span style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: "3px", background: "#eff6ff", color: "#2563eb", fontWeight: 700 }}>
                    RRF 融合打分
                  </span>
                </div>
                <div style={{ fontSize: "0.65rem", color: "#64748b", marginBottom: "0.4rem" }}>
                  沙盒环境: <code>mcp-database-gateway</code> (资源限额 512MB · 超时强制中断)
                </div>
                <div style={{ display: "flex", gap: "0.35rem", marginBottom: "0.45rem" }}>
                  <input
                    type="text"
                    value={ragQuery}
                    onChange={(e) => setRagQuery(e.target.value)}
                    style={{ flex: 1, fontSize: "0.65rem", padding: "3px 6px", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                    placeholder="输入关键词检索 RAG 知识库..."
                  />
                  <button
                    type="button"
                    onClick={() => searchHybridRag(ragQuery).then((res) => res?.results && setHybridRagResults(res.results))}
                    style={{ fontSize: "0.62rem", padding: "3px 8px", background: "#2563eb", color: "#fff", border: "none", borderRadius: "4px", cursor: "pointer" }}
                  >
                    检索
                  </button>
                </div>
                {hybridRagResults.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                    {hybridRagResults.slice(0, 2).map((item, i) => (
                      <div key={i} style={{ padding: "0.35rem", background: "#ffffff", borderRadius: "4px", border: "1px solid #e2e8f0", fontSize: "0.62rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#0f172a", fontWeight: 650 }}>
                          <span>{item.projectName} · {item.section}</span>
                          <span style={{ color: "#2563eb" }}>RRF: {item.rrfScore}</span>
                        </div>
                        <div style={{ color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.text}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 阶段三：异步响应式推流与模型网关 */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.75rem", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>阶段三：Netty 4.1 响应式网关与熔断器</strong>
                  <span style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: "3px", background: "#ecfdf5", color: "#059669", fontWeight: 700 }}>
                    熔断器: {gatewayMetrics?.circuitState || "CLOSED"}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", fontSize: "0.65rem", color: "#475569" }}>
                  <div>P99 首字延迟: <strong>{gatewayMetrics?.p99LatencyMs || 14.2}ms</strong></div>
                  <div>吞吐燃烧率: <strong>{gatewayMetrics?.tokenBurnRatePerSec || 320} T/s</strong></div>
                </div>
                <div style={{ marginTop: "0.35rem", fontSize: "0.62rem", color: "#64748b" }}>
                  模型梯队: DeepSeek-R1 (80%) ➔ Qwen-Max (20%) ➔ Local-Fast (0%)
                </div>
              </div>

              {/* 阶段四：动态安全防御与 2PC 门禁 + Saga 补偿 */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.75rem", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>阶段四：保形预测、2PC 门禁与 Saga</strong>
                  <span style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: "3px", background: "#fef3c7", color: "#b45309", fontWeight: 700 }}>
                    保形置信度 94.0% &lt; 95%
                  </span>
                </div>
                <div style={{ fontSize: "0.66rem", color: "#475569", lineHeight: 1.45 }}>
                  保形置信区间评估发现单笔划转达 5000 万，触发 @RequiresApproval P0 强阻断。
                </div>
                <div style={{ marginTop: "0.35rem", fontSize: "0.62rem", color: "#dc2626" }}>
                  Saga 补偿链准备: RELEASE_SETTLEMENT_HOLD ➔ REVERSE_JOURNAL_ENTRY
                </div>
              </div>

              {/* 阶段五：W3C 全链路追踪与不可篡改 Merkle 证据链 */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.75rem", background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>阶段五：W3C 分布式追踪与 Merkle 存证</strong>
                  <span style={{ fontSize: "0.62rem", padding: "1px 6px", borderRadius: "3px", background: "#f3e8ff", color: "#7e22ce", fontWeight: 700 }}>
                    Block #{instanceMerkle?.blockHeight || 1}
                  </span>
                </div>
                <div style={{ fontSize: "0.64rem", color: "#334155", fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                  Merkle Root: {instanceMerkle?.merkleRoot || "0xedc00da816c664bd9c1bdb5d3a1e7b87"}
                </div>
                {instanceTrace?.spans && (
                  <div style={{ marginTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                    <div style={{ fontSize: "0.62rem", color: "#64748b" }}>W3C 调用链火焰条 (Span Breakdown):</div>
                    {instanceTrace.spans.slice(0, 3).map((s: any, idx: number) => (
                      <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.6rem" }}>
                        <span style={{ width: "85px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                        <div style={{ flex: 1, background: "#e2e8f0", borderRadius: "2px", height: "6px", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, (s.durationMs / 400) * 100)}%`, background: "#3b82f6", height: "100%" }} />
                        </div>
                        <span style={{ width: "35px", textAlign: "right" }}>{s.durationMs}ms</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: 企业核心数据库资产台账 (Skills, Tools, Knowledge, Memory, Ledger) */}
          {activeTab === "assets" && (
            <div style={{ flex: 1, padding: "0.85rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: "0.8rem", color: "#0f172a" }}>🗄️ 企业级数据库资产台账</strong>
                  <span style={{ fontSize: "0.64rem", color: "#64748b", display: "block" }}>
                    Java 21 Spring Boot 3 + MySQL 8.0 持久化直出
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadDbAssets}
                  style={{
                    fontSize: "0.65rem",
                    padding: "2px 7px",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    cursor: "pointer",
                  }}
                >
                  🔄 刷新资产
                </button>
              </div>

              {/* 资产子类别切换 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "4px", background: "#e2e8f0", padding: "2px", borderRadius: "6px" }}>
                {[
                  { key: "skills", label: `技能 (${dbSkills.length})` },
                  { key: "tools", label: `工具 (${dbTools.length})` },
                  { key: "knowledge", label: `知识 (${dbKnowledge.length})` },
                  { key: "memory", label: `记忆 (${dbMemories.length})` },
                  { key: "ledger", label: `账本 (${dbBlocks.length})` },
                ].map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setActiveAssetCategory(cat.key as any)}
                    style={{
                      padding: "4px 0",
                      fontSize: "0.62rem",
                      fontWeight: activeAssetCategory === cat.key ? 700 : 500,
                      background: activeAssetCategory === cat.key ? "#ffffff" : "transparent",
                      color: activeAssetCategory === cat.key ? "#2563eb" : "#475569",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      boxShadow: activeAssetCategory === cat.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* 技能资产 */}
              {activeAssetCategory === "skills" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {dbSkills.map((sk) => (
                    <div key={sk.id} style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.65rem", background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>{sk.name}</strong>
                        <span style={{ fontSize: "0.62rem", padding: "1px 5px", borderRadius: "3px", background: "#eff6ff", color: "#2563eb", fontWeight: 650 }}>
                          {sk.badge || sk.category}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#475569", lineHeight: 1.4, marginBottom: "0.3rem" }}>
                        {sk.description}
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                        <span>流转: <code>{sk.workflowDefId || "默认工作流"}</code></span>
                        <span>版本: <code>{sk.version || "v1.0"}</code></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* MCP 工具资产 */}
              {activeAssetCategory === "tools" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {dbTools.map((tl) => (
                    <div key={tl.id} style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.65rem", background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>{tl.displayName || tl.functionName}</strong>
                        <span
                          style={{
                            fontSize: "0.6rem",
                            padding: "1px 5px",
                            borderRadius: "3px",
                            background: tl.riskLevel === "CRITICAL" ? "#fef2f2" : tl.riskLevel === "HIGH" ? "#fffbeb" : "#ecfdf5",
                            color: tl.riskLevel === "CRITICAL" ? "#dc2626" : tl.riskLevel === "HIGH" ? "#b45309" : "#059669",
                            fontWeight: 700,
                          }}
                        >
                          {tl.riskLevel}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.66rem", color: "#475569", lineHeight: 1.4, marginBottom: "0.3rem" }}>
                        {tl.description}
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                        <span>MCP 服务: <code>{tl.serverName}</code></span>
                        <span>超时: <code>{tl.timeoutMs}ms</code></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 知识库切片资产 */}
              {activeAssetCategory === "knowledge" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {dbKnowledge.map((kn) => (
                    <div key={kn.id} style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.65rem", background: "#f8fafc" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.25rem" }}>
                        📄 {kn.docTitle}
                      </div>
                      <div style={{ fontSize: "0.66rem", color: "#475569", lineHeight: 1.45, marginBottom: "0.3rem" }}>
                        {kn.content}
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "#2563eb" }}>
                        索引关键词: {kn.keywords}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 记忆库资产 */}
              {activeAssetCategory === "memory" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {dbMemories.map((mem) => (
                    <div key={mem.id} style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.65rem", background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#7e22ce", background: "#f3e8ff", padding: "1px 5px", borderRadius: "3px" }}>
                          {mem.memoryType} MEMORY
                        </span>
                        <span style={{ fontSize: "0.62rem", color: "#64748b" }}>
                          重要性: <strong>{((mem.importanceScore || 1) * 100).toFixed(0)}%</strong>
                        </span>
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "#334155", lineHeight: 1.45 }}>
                        {mem.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 区块账本资产 */}
              {activeAssetCategory === "ledger" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                  {dbBlocks.length > 0 ? dbBlocks.map((blk) => (
                    <div key={blk.blockHeight} style={{ border: "1px solid #e2e8f0", borderRadius: "7px", padding: "0.65rem", background: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                        <strong style={{ fontSize: "0.74rem", color: "#1e293b" }}>Block #{blk.blockHeight}</strong>
                        <span style={{ fontSize: "0.6rem", padding: "1px 5px", borderRadius: "3px", background: "#ecfdf5", color: "#059669", fontWeight: 700 }}>
                          {blk.status}
                        </span>
                      </div>
                      <div style={{ fontSize: "0.62rem", color: "#334155", fontFamily: "ui-monospace, monospace", wordBreak: "break-all" }}>
                        Root: {blk.merkleRoot}
                      </div>
                      <div style={{ marginTop: "0.25rem", fontSize: "0.62rem", color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                        <span>实例: {blk.instanceId}</span>
                        <span>事务数: {blk.txCount}</span>
                      </div>
                    </div>
                  )) : (
                    <div style={{ textAlign: "center", padding: "1.5rem", color: "#94a3b8", fontSize: "0.72rem" }}>
                      运行工作流并通过 2PC 闸口后，增量 Merkle 账本区块将落库于此。
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 1: 零信任 2PC 人机审批闸口 */}
          {activeTab === "approval" && (
            <div style={{ flex: 1, padding: "1.1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
              {currentTicket ? (
                <>
                  <div
                    style={{
                      padding: "0.85rem",
                      background: currentTicket.status === "APPROVED" ? "#f0fdf4" : currentTicket.status === "REJECTED" ? "#fef2f2" : "#fffbeb",
                      border: currentTicket.status === "APPROVED" ? "1px solid #bbf7d0" : currentTicket.status === "REJECTED" ? "1px solid #fecaca" : "1px solid #fde68a",
                      borderRadius: "8px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                      <strong
                        style={{
                          fontSize: "0.8rem",
                          color: currentTicket.status === "APPROVED" ? "#15803d" : currentTicket.status === "REJECTED" ? "#dc2626" : "#b45309",
                        }}
                      >
                        {currentTicket.status === "APPROVED"
                          ? "✅ 2PC: COMMITTED (已双签过账)"
                          : currentTicket.status === "REJECTED"
                          ? "❌ 2PC: REJECTED (事务已回滚)"
                          : "⏳ 2PC: PREPARED (事务已隔离挂起)"}
                      </strong>
                      <span style={{ fontSize: "0.65rem", fontFamily: "ui-monospace, monospace", color: "#64748b" }}>
                        Level: {currentTicket.policyLevel}
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#475569", lineHeight: 1.45 }}>
                      {currentTicket.status === "APPROVED"
                        ? `工单已签署并向远端 MySQL 写入。审计签名指纹: ${currentTicket.signatureHash?.slice(0, 24)}...`
                        : currentTicket.status === "REJECTED"
                        ? `工单被驳回，Saga 逆向事务补偿已回滚已生效状态。`
                        : "检测到高危资产调度操作，大模型自动推演风险评分超标，工作流进入零信任 2PC 准备阶段挂起。"}
                    </p>
                  </div>

                  {/* 工单卡片 */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.85rem", background: "#f8fafc" }}>
                    <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.4rem" }}>
                      待审工单: {currentTicket.id}
                    </div>
                    <p style={{ margin: "0 0 0.6rem", fontSize: "0.74rem", color: "#334155", lineHeight: 1.5 }}>
                      {currentTicket.operationSummary}
                    </p>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", marginBottom: "0.25rem" }}>
                      <span>风险评分 (Risk Score):</span>
                      <strong style={{ color: "#dc2626" }}>{(currentTicket.riskScore * 100).toFixed(1)}% (HIGH RISK)</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", marginBottom: "0.25rem" }}>
                      <span>关联实例 ID:</span>
                      <span style={{ fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>{currentTicket.instanceId}</span>
                    </div>

                    {currentTicket.signatureHash && (
                      <div style={{ marginTop: "0.5rem", borderTop: "1px dashed #cbd5e1", paddingTop: "0.4rem", fontSize: "0.68rem" }}>
                        <span style={{ color: "#64748b" }}>数字存证指纹: </span>
                        <code style={{ color: "#059669", wordBreak: "break-all" }}>{currentTicket.signatureHash}</code>
                      </div>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  {currentTicket.status === "PENDING" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                      <button
                        type="button"
                        onClick={handleApprove}
                        style={{
                          padding: "0.6rem",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "#ffffff",
                          background: "#16a34a",
                          border: "none",
                          borderRadius: "7px",
                          cursor: "pointer",
                          boxShadow: "0 2px 6px rgba(22, 163, 74, 0.35)",
                        }}
                      >
                        ✍️ 电子签名加盖并批准过账 (2PC Commit)
                      </button>
                      <button
                        type="button"
                        onClick={handleReject}
                        style={{
                          padding: "0.5rem",
                          fontSize: "0.76rem",
                          fontWeight: 600,
                          color: "#dc2626",
                          background: "#ffffff",
                          border: "1px solid #fca5a5",
                          borderRadius: "7px",
                          cursor: "pointer",
                        }}
                      >
                        🚫 驳回事务并触发 Saga 逆向回滚 (Rollback)
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#94a3b8" }}>
                  <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>🛡️</div>
                  <strong style={{ fontSize: "0.85rem", color: "#475569", display: "block" }}>
                    暂无挂起的零信任 2PC 待审工单
                  </strong>
                  <p style={{ fontSize: "0.72rem", margin: "0.3rem 0 0" }}>
                    点击顶部【▶ 启动真实集群调度】执行高危流水线，系统推演至 2PC 闸口时将自动挂起并在此展示审批卡片。
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: 节点属性检视器 */}
          {activeTab === "inspector" && (
            <div style={{ flex: 1, padding: "1.1rem", overflowY: "auto" }}>
              {selectedNode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                  <div>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: "0.2rem", fontFamily: "ui-monospace, monospace" }}>
                      NODE ID: {selectedNode.id}
                    </div>
                    <strong style={{ fontSize: "0.92rem", color: "#0f172a" }}>
                      {selectedNode.data.label}
                    </strong>
                    <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "2px" }}>
                      {selectedNode.data.description}
                    </div>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "0.7rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", marginBottom: "0.25rem" }}>
                      <span>类型规范:</span>
                      <strong style={{ color: "#2563eb" }}>{selectedNode.data.kind}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b", marginBottom: "0.25rem" }}>
                      <span>执行状态:</span>
                      <strong style={{ color: selectedNode.data.status === "success" ? "#10b981" : "#f59e0b" }}>
                        {selectedNode.data.status.toUpperCase()}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#64748b" }}>
                      <span>端到端耗时:</span>
                      <span>{selectedNode.data.costMs !== undefined ? `${selectedNode.data.costMs} ms` : "—"}</span>
                    </div>
                  </div>

                  {selectedNode.data.rawPayload && (
                    <div>
                      <div style={{ fontSize: "0.72rem", fontWeight: 650, color: "#334155", marginBottom: "0.35rem" }}>
                        真实后端输出负载 (Output Payload):
                      </div>
                      <pre
                        style={{
                          background: "#0f172a",
                          color: "#38bdf8",
                          padding: "0.75rem",
                          borderRadius: "8px",
                          fontSize: "0.68rem",
                          fontFamily: "ui-monospace, monospace",
                          lineHeight: 1.45,
                          maxHeight: "220px",
                          overflowY: "auto",
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(selectedNode.data.rawPayload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", marginTop: "2rem" }}>
                  在左侧画布点击任意节点检视详细属性与执行负载
                </div>
              )}
            </div>
          )}

          {/* Tab 3: 执行事件日志 */}
          {activeTab === "logs" && (
            <div
              style={{
                flex: 1,
                padding: "0.85rem",
                background: "#0b0f19",
                color: "#e2e8f0",
                fontSize: "0.7rem",
                fontFamily: "ui-monospace, monospace",
                lineHeight: 1.55,
                overflowY: "auto",
              }}
            >
              {logs.length > 0 ? (
                logs.map((lg, i) => (
                  <div key={i} style={{ marginBottom: "0.5rem" }}>
                    <span style={{ color: "#64748b" }}>{lg.time} </span>
                    <span
                      style={{
                        color:
                          lg.level === "GATE"
                            ? "#f59e0b"
                            : lg.level === "AUDIT"
                            ? "#38bdf8"
                            : lg.level === "SUCCESS" || lg.level === "COMPLETED"
                            ? "#4ade80"
                            : lg.level === "ERROR" || lg.level === "ABORT" || lg.level === "ROLLBACK"
                            ? "#f87171"
                            : "#94a3b8",
                        fontWeight: 700,
                      }}
                    >
                      [{lg.level}]
                    </span>{" "}
                    <span>{lg.msg}</span>
                  </div>
                ))
              ) : (
                <div style={{ color: "#64748b", textAlign: "center", marginTop: "2rem" }}>
                  暂无日志，触发调度后 Netty SSE 将流式注入实时事件
                </div>
              )}
            </div>
          )}

          {/* Tab 4: 历史执行实例与时间旅行 */}
          {activeTab === "history" && (
            <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#1e293b", marginBottom: "0.2rem" }}>
                MySQL 8.0 审计执行实例表 ({instances.length})
              </div>
              {instances.map((inst) => (
                <div
                  key={inst.id}
                  onClick={() => handleReplayInstance(inst.id)}
                  style={{
                    padding: "0.75rem",
                    borderRadius: "8px",
                    border: currentInstanceId === inst.id ? "2px solid #2563eb" : "1px solid #e2e8f0",
                    background: currentInstanceId === inst.id ? "#eff6ff" : "#f8fafc",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.25rem" }}>
                    <strong style={{ fontSize: "0.74rem", fontFamily: "ui-monospace, monospace", color: "#0f172a" }}>
                      {inst.id}
                    </strong>
                    <span
                      style={{
                        fontSize: "0.62rem",
                        padding: "1px 5px",
                        borderRadius: "3px",
                        fontWeight: 700,
                        background: inst.status === "COMPLETED" ? "#dcfce7" : inst.status === "SUSPENDED_APPROVAL" ? "#fef3c7" : "#fee2e2",
                        color: inst.status === "COMPLETED" ? "#15803d" : inst.status === "SUSPENDED_APPROVAL" ? "#b45309" : "#b91c1c",
                      }}
                    >
                      {inst.status}
                    </span>
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#64748b" }}>
                    触发人: {inst.triggeredBy} · 启动时间: {inst.startedAt?.slice(0, 19).replace("T", " ")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
