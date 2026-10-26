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
  triggerWorkflowRun,
  subscribeToWorkflowStream,
  commitApprovalDecision,
  type ApprovalTicket,
} from "../../../lib/workflowBackendClient";

// 节点数据接口
interface AgentNodeData {
  label: string;
  kind: "trigger" | "router" | "rag" | "mcp" | "calc" | "hitl" | "commit";
  status: "idle" | "running" | "suspended" | "success" | "failed";
  costMs?: number;
  config?: {
    model?: string;
    temperature?: number;
    promptTemplate?: string;
    toolName?: string;
    rulesCount?: number;
    requireSign?: boolean;
  };
  outputPreview?: string;
}

// 自定义工业级 React Flow 节点组件
function AgentPipelineNode({ data, selected }: NodeProps<Node<AgentNodeData>>) {
  const getBadgeStyle = () => {
    switch (data.kind) {
      case "trigger": return { bg: "#e0e7ff", text: "#4338ca", label: "TRIGGER" };
      case "router": return { bg: "#ede9fe", text: "#6d28d9", label: "ROUTER" };
      case "rag": return { bg: "#e0f2fe", text: "#0369a1", label: "RAG" };
      case "mcp": return { bg: "#ecfdf5", text: "#047857", label: "MCP TOOL" };
      case "calc": return { bg: "#fef3c7", text: "#b45309", label: "SANDBOX" };
      case "hitl": return { bg: "#fee2e2", text: "#b91c1c", label: "2PC GATE" };
      case "commit": return { bg: "#f3f4f6", text: "#374151", label: "COMMIT" };
    }
  };

  const badge = getBadgeStyle();

  return (
    <div
      style={{
        padding: "10px 14px",
        borderRadius: "8px",
        background: "#ffffff",
        border: selected
          ? "2px solid #2563eb"
          : data.status === "running"
          ? "2px solid #3b82f6"
          : data.status === "suspended"
          ? "2px solid #f59e0b"
          : data.status === "success"
          ? "2px solid #10b981"
          : "1px solid #cbd5e1",
        boxShadow: data.status === "running"
          ? "0 0 12px rgba(59, 130, 246, 0.4)"
          : data.status === "suspended"
          ? "0 0 12px rgba(245, 158, 11, 0.4)"
          : "0 2px 5px rgba(0,0,0,0.06)",
        minWidth: "180px",
        fontFamily: "sans-serif",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: "#64748b", width: 8, height: 8 }} />
      
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
        <span
          style={{
            fontSize: "0.62rem",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "4px",
            background: badge.bg,
            color: badge.text,
            letterSpacing: "0.02em",
          }}
        >
          {badge.label}
        </span>
        {data.costMs !== undefined && (
          <span style={{ fontSize: "0.65rem", color: "#94a3b8", fontFamily: "monospace" }}>
            {data.costMs}ms
          </span>
        )}
      </div>

      <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
        {data.label}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "0.68rem" }}>
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background:
              data.status === "running"
                ? "#3b82f6"
                : data.status === "suspended"
                ? "#f59e0b"
                : data.status === "success"
                ? "#10b981"
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
                : "#64748b",
            fontWeight: data.status !== "idle" ? 600 : 400,
          }}
        >
          {data.status === "running" && "执行中…"}
          {data.status === "suspended" && "挂起待审批"}
          {data.status === "success" && "执行完毕"}
          {data.status === "idle" && "就绪待命"}
          {data.status === "failed" && "执行异常"}
        </span>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: "#64748b", width: 8, height: 8 }} />
    </div>
  );
}

const nodeTypes = { agentNode: AgentPipelineNode };

// 初始节点
const INITIAL_AGENT_NODES: Node<AgentNodeData>[] = [
  {
    id: "n-trigger",
    type: "agentNode",
    position: { x: 30, y: 150 },
    data: {
      label: "1. 单据触发接入 (Ingress)",
      kind: "trigger",
      status: "success",
      costMs: 120,
      config: { model: "OCR-Extractor v2", temperature: 0.1 },
      outputPreview: "解析报销单 EXP-2026-0982 (4笔明细, 总申报 ¥8,090.00)",
    },
  },
  {
    id: "n-router",
    type: "agentNode",
    position: { x: 260, y: 150 },
    data: {
      label: "2. 意图分发与共形路由",
      kind: "router",
      status: "success",
      costMs: 160,
      config: { model: "Conformal-Classifier", temperature: 0.0 },
      outputPreview: "路由命中: expense_ledger_audit (置信度 98.4%)",
    },
  },
  {
    id: "n-rag",
    type: "agentNode",
    position: { x: 490, y: 80 },
    data: {
      label: "3. 财务制度知识库检索",
      kind: "rag",
      status: "success",
      costMs: 280,
      config: { rulesCount: 14 },
      outputPreview: "召回《费用管理制度》第4.2条 (单笔限额5000) & 第18条发票规范",
    },
  },
  {
    id: "n-mcp",
    type: "agentNode",
    position: { x: 490, y: 220 },
    data: {
      label: "4. MCP 数据校验与发票核验",
      kind: "mcp",
      status: "success",
      costMs: 425,
      config: { toolName: "mcp::dataset_validate" },
      outputPreview: "检出 2 项异常: INV-0922 餐费超额, INV-0935 发票代码缺失",
    },
  },
  {
    id: "n-calc",
    type: "agentNode",
    position: { x: 740, y: 150 },
    data: {
      label: "5. 确定性平账与调减试算",
      kind: "calc",
      status: "success",
      costMs: 95,
      config: { toolName: "mcp::ledger_reconcile" },
      outputPreview: "冲销调减: -¥820.00, 最终核准入账金额: ¥7,270.00",
    },
  },
  {
    id: "n-hitl",
    type: "agentNode",
    position: { x: 970, y: 150 },
    data: {
      label: "6. 零信任人在回路门禁 (2PC)",
      kind: "hitl",
      status: "suspended",
      costMs: 0,
      config: { requireSign: true },
      outputPreview: "挂起等待: 财务主管二次电子签名授权",
    },
  },
  {
    id: "n-commit",
    type: "agentNode",
    position: { x: 1200, y: 150 },
    data: {
      label: "7. ERP 核心总账过账 (Commit)",
      kind: "commit",
      status: "idle",
      costMs: 0,
      outputPreview: "生成凭证号并同步写入 SAP 生产数据库",
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: "e-tr", source: "n-trigger", target: "n-router", animated: true },
  { id: "e-rr", source: "n-router", target: "n-rag", animated: true },
  { id: "e-rm", source: "n-router", target: "n-mcp", animated: true },
  { id: "e-rc", source: "n-rag", target: "n-calc", animated: true },
  { id: "e-mc", source: "n-mcp", target: "n-calc", animated: true },
  { id: "e-ch", source: "n-calc", target: "n-hitl", animated: true },
  { id: "e-hc", source: "n-hitl", target: "n-commit", animated: false },
];

export function EnterpriseAgentStudio({
  onRunScenario,
  onOpenTrace,
  onSignHitl,
  hitlStatus = "pending",
  running = false,
}: {
  onRunScenario: (prompt: string) => void;
  onOpenTrace: () => void;
  onSignHitl: (action: "approve" | "reject") => void;
  hitlStatus?: "pending" | "allowed" | "rejected";
  workPaper?: any;
  running?: boolean;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_AGENT_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node<AgentNodeData> | null>(INITIAL_AGENT_NODES[5]); // 默认选在 HITL
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<"inspector" | "logs" | "approval">("approval");
  const [voucherId, setVoucherId] = useState<string>("GL-20260425-0182");
  const [isApproved, setIsApproved] = useState<boolean>(hitlStatus === "allowed");

  const [backendLive, setBackendLive] = useState<boolean>(false);
  const [currentInstanceId, setCurrentInstanceId] = useState<string | null>(null);
  const [currentTicket, setCurrentTicket] = useState<ApprovalTicket | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((d) => {
        if (d?.status === "UP" || d?.service === "ownsudo-engine") {
          setBackendLive(true);
        }
      })
      .catch(() => setBackendLive(false));
  }, []);

  // 运行日志
  const [logs, setLogs] = useState<Array<{ time: string; level: string; msg: string }>>([
    { time: "10:14:02.120", level: "INFO", msg: "[Ingress] Bill EXP-2026-0982 parsed (4 rows, ¥8,090.00)" },
    { time: "10:14:02.280", level: "INFO", msg: "[Router] Intent matched: expense_audit (conformal confidence: 0.984)" },
    { time: "10:14:02.560", level: "INFO", msg: "[RAG] Retrieved 2 policy clauses from Corporate Financial Manual 2026" },
    { time: "10:14:02.980", level: "WARN", msg: "[MCP] mcp::dataset_validate caught 2 violations: INV-0922, INV-0935" },
    { time: "10:14:03.420", level: "INFO", msg: "[Calc] mcp::ledger_reconcile: Computed adjustment deduction -¥820.00, net: ¥7,270.00" },
    { time: "10:14:03.540", level: "GATE", msg: "[2PC Gate] Write transaction PREPARED. Workflow suspended for Reviewer signature." },
  ]);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges]
  );

  // 点击节点选中
  const onNodeClick = (_: any, node: Node) => {
    setSelectedNode(node as Node<AgentNodeData>);
    if (node.id === "n-hitl") {
      setActiveTab("approval");
    } else {
      setActiveTab("inspector");
    }
  };

  // 运行工作流 (优先通过真实 Spring Boot 3 + MySQL 后端调度，离线时优雅回退)
  const handleRunWorkflow = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    setIsApproved(false);
    setCurrentTicket(null);

    // 重置画布节点状态
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          status: n.id === "n-trigger" ? "running" : "idle",
        },
      }))
    );

    try {
      const runRes = await triggerWorkflowRun("wf-settlement-migration", "auditor_sec");
      if (runRes?.instanceId) {
        setBackendLive(true);
        setCurrentInstanceId(runRes.instanceId);
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toTimeString().slice(0, 8),
            level: "ENGINE",
            msg: `[Spring Boot 3 + MySQL] 实例 ${runRes.instanceId} 已启动，订阅实时 SSE 事件流...`,
          },
        ]);

        const cleanup = subscribeToWorkflowStream(runRes.instanceId, (event) => {
          const timeStr = new Date().toTimeString().slice(0, 8);
          if (event.eventType === "NODE_RUNNING") {
            setNodes((nds) =>
              nds.map((n) => {
                if (event.nodeId?.includes("spec") && n.id === "n-trigger") return { ...n, data: { ...n.data, status: "running" } };
                if (event.nodeId?.includes("risk") && n.id === "n-router") return { ...n, data: { ...n.data, status: "running" } };
                if (event.nodeId?.includes("mcp") && n.id === "n-mcp") return { ...n, data: { ...n.data, status: "running" } };
                if (event.nodeId?.includes("audit") && n.id === "n-calc") return { ...n, data: { ...n.data, status: "running" } };
                return n;
              })
            );
            setLogs((prev) => [...prev, { time: timeStr, level: "INFO", msg: `[Step Running] ${event.nodeName}` }]);
          } else if (event.eventType === "NODE_COMPLETED") {
            setNodes((nds) =>
              nds.map((n) => {
                if (event.nodeId?.includes("spec") && n.id === "n-trigger") return { ...n, data: { ...n.data, status: "success" } };
                if (event.nodeId?.includes("risk") && n.id === "n-router") return { ...n, data: { ...n.data, status: "success" } };
                if (event.nodeId?.includes("mcp") && n.id === "n-mcp") return { ...n, data: { ...n.data, status: "success" } };
                if (event.nodeId?.includes("audit") && n.id === "n-calc") return { ...n, data: { ...n.data, status: "success" } };
                return n;
              })
            );
            setLogs((prev) => [...prev, { time: timeStr, level: "SUCCESS", msg: `[Step Done] ${event.nodeName} (${event.status})` }]);
          } else if (event.eventType === "TICKET_REQUIRED") {
            const tkt = event.payload as ApprovalTicket;
            setCurrentTicket(tkt);
            setIsExecuting(false);
            setActiveTab("approval");
            setNodes((nds) => nds.map((n) => (n.id === "n-hitl" ? { ...n, data: { ...n.data, status: "suspended" } } : n)));
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "GATE",
                msg: `[2PC Gate] 工单 ${tkt.id} 已生成并持久化写入 MySQL！流水线挂起等待审计工程师数字签名。`,
              },
            ]);
          } else if (event.eventType === "TICKET_APPROVED") {
            setNodes((nds) => nds.map((n) => (n.id === "n-hitl" ? { ...n, data: { ...n.data, status: "success" } } : n)));
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "AUDIT",
                msg: `[2PC Commit] 审计工程师电子签名成功加盖，SHA-256 指纹已入库，继续向下推进。`,
              },
            ]);
          } else if (event.eventType === "INSTANCE_COMPLETED") {
            setIsExecuting(false);
            setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, status: "success" } })));
            setLogs((prev) => [
              ...prev,
              {
                time: timeStr,
                level: "SUCCESS",
                msg: `[Instance Completed] 全链路执行完毕，凭证已上链与归档！`,
              },
            ]);
            cleanup();
          }
        });
        return;
      }
    } catch (e) {
      console.warn("Real backend offline, fallback to simulation", e);
    }

    // 本地回退模拟流转
    const steps = ["n-trigger", "n-router", "n-rag", "n-mcp", "n-calc", "n-hitl"];
    let idx = 0;

    const timer = setInterval(() => {
      idx += 1;
      if (idx < steps.length) {
        const curId = steps[idx];
        const prevId = steps[idx - 1];

        setNodes((nds) =>
          nds.map((n) => {
            if (n.id === prevId) return { ...n, data: { ...n.data, status: "success" } };
            if (n.id === curId) {
              return {
                ...n,
                data: {
                  ...n.data,
                  status: curId === "n-hitl" ? "suspended" : "running",
                },
              };
            }
            return n;
          })
        );

        if (curId === "n-hitl") {
          clearInterval(timer);
          setIsExecuting(false);
          setActiveTab("approval");
          setLogs((prev) => [
            ...prev,
            {
              time: new Date().toTimeString().slice(0, 8),
              level: "GATE",
              msg: "[2PC Gate] Reached Reviewer checkpoint. Workflow execution paused waiting for human authorization.",
            },
          ]);
        }
      } else {
        clearInterval(timer);
        setIsExecuting(false);
      }
    }, 700);
  };

  // 审批通过并签章
  const handleApprove = async () => {
    setIsApproved(true);
    const newVoucher = `GL-20260425-${Math.floor(1000 + Math.random() * 9000)}`;
    setVoucherId(newVoucher);
    onSignHitl("approve");

    if (currentTicket?.id) {
      try {
        await commitApprovalDecision(currentTicket.id, "APPROVED", "auditor_sec");
        setLogs((prev) => [
          ...prev,
          {
            time: new Date().toTimeString().slice(0, 8),
            level: "AUDIT",
            msg: `[Spring Boot 2PC] 工单 ${currentTicket.id} 已完成双签提交并恢复状态机调度！`,
          },
        ]);
      } catch (err) {
        console.error(err);
      }
    }

    // 更新节点状态
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === "n-hitl") return { ...n, data: { ...n.data, status: "success" } };
        if (n.id === "n-commit") return { ...n, data: { ...n.data, status: "success", costMs: 110 } };
        return n;
      })
    );

    setEdges((eds) =>
      eds.map((e) => (e.id === "e-hc" ? { ...e, animated: true, style: { stroke: "#10b981" } } : e))
    );

    setLogs((prev) => [
      ...prev,
      {
        time: new Date().toTimeString().slice(0, 8),
        level: "AUDIT",
        msg: `[2PC Commit] Authorized by Reviewer. Electronic signature sealed. ERP voucher ${newVoucher} posted.`,
      },
    ]);
  };

  // 驳回
  const handleReject = async () => {
    setIsApproved(false);
    onSignHitl("reject");

    if (currentTicket?.id) {
      try {
        await commitApprovalDecision(currentTicket.id, "REJECTED", "auditor_sec", "事务被审计员人工驳回");
      } catch (err) {
        console.error(err);
      }
    }

    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === "n-hitl") return { ...n, data: { ...n.data, status: "failed" } };
        return n;
      })
    );
    setLogs((prev) => [
      ...prev,
      {
        time: new Date().toTimeString().slice(0, 8),
        level: "ABORT",
        msg: "[2PC Abort] Rejected by Reviewer. Transaction rolled back. Notification dispatched to employee.",
      },
    ]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#f8fafc" }}>
      {/* 顶部操作控制工具栏 */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "48px",
          padding: "0 1rem",
          background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <strong style={{ fontSize: "0.88rem", color: "#0f172a" }}>
            AI Agent 动态工作流编排与执行引擎
          </strong>
          <span style={{ fontSize: "0.7rem", color: "#64748b", fontFamily: "monospace" }}>
            DAG-Engine v2.4 · React Flow Canvas
          </span>
          <span
            style={{
              fontSize: "0.68rem",
              padding: "2px 8px",
              borderRadius: "4px",
              background: backendLive ? "#ecfdf5" : "#f1f5f9",
              color: backendLive ? "#059669" : "#64748b",
              border: backendLive ? "1px solid #a7f3d0" : "1px solid #cbd5e1",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: backendLive ? "#10b981" : "#94a3b8",
              }}
            />
            {backendLive ? "Java 21 / Spring Boot 3 Engine: CONNECTED" : "Standalone Engine"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={handleRunWorkflow}
            disabled={isExecuting}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.35rem 0.85rem",
              fontSize: "0.76rem",
              fontWeight: 600,
              background: isExecuting ? "#94a3b8" : "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "6px",
              cursor: isExecuting ? "not-allowed" : "pointer",
            }}
          >
            {isExecuting ? "▶ 正在执行 DAG 流水线…" : "▶ 触发执行工作流 (Run DAG)"}
          </button>

          <button
            type="button"
            onClick={onOpenTrace}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.35rem 0.75rem",
              fontSize: "0.76rem",
              fontWeight: 500,
              background: "#ffffff",
              color: "#475569",
              border: "1px solid #cbd5e1",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            📊 OTel 链路追踪 (APM)
          </button>
        </div>
      </header>

      {/* 主体两栏：左侧 React Flow 画布，右侧调试与审批抽屉 */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* 左侧：真正的 React Flow 工作流画布 */}
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
                if (k === "hitl") return "#ef4444";
                if (k === "mcp") return "#10b981";
                if (k === "calc") return "#f59e0b";
                return "#3b82f6";
              }}
            />
            <Controls />
          </ReactFlow>

          {/* 画布浮层提示 */}
          <div
            style={{
              position: "absolute",
              bottom: "1rem",
              left: "1rem",
              background: "rgba(255, 255, 255, 0.9)",
              backdropFilter: "blur(4px)",
              padding: "0.5rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid #e2e8f0",
              fontSize: "0.7rem",
              color: "#64748b",
              pointerEvents: "none",
            }}
          >
            💡 提示：点击任意节点可在右侧检视输入输出及配置；点击右上角【▶ 触发执行工作流】可演示状态机流转与挂起。
          </div>
        </div>

        {/* 右侧：属性检视器 / 2PC 审批门禁 / 运行日志 (~380px) */}
        <aside
          style={{
            width: "380px",
            borderLeft: "1px solid #e2e8f0",
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* 右侧 Tab */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
              padding: "0 0.5rem",
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab("approval")}
              style={{
                flex: 1,
                padding: "0.6rem 0",
                fontSize: "0.75rem",
                fontWeight: activeTab === "approval" ? 600 : 400,
                color: activeTab === "approval" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "approval" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🛡️ 2PC 人在回路审批
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("inspector")}
              style={{
                flex: 1,
                padding: "0.6rem 0",
                fontSize: "0.75rem",
                fontWeight: activeTab === "inspector" ? 600 : 400,
                color: activeTab === "inspector" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "inspector" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              🔍 节点属性检视
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("logs")}
              style={{
                flex: 1,
                padding: "0.6rem 0",
                fontSize: "0.75rem",
                fontWeight: activeTab === "logs" ? 600 : 400,
                color: activeTab === "logs" ? "#2563eb" : "#64748b",
                border: "none",
                borderBottom: activeTab === "logs" ? "2px solid #2563eb" : "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              📋 执行日志 ({logs.length})
            </button>
          </div>

          {/* Tab 1: 2PC 人在回路审批门禁 (真正的系统级业务交互) */}
          {activeTab === "approval" && (
            <div style={{ flex: 1, padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div
                style={{
                  padding: "0.75rem",
                  background: isApproved ? "#f0fdf4" : "#fffbeb",
                  border: isApproved ? "1px solid #bbf7d0" : "1px solid #fde68a",
                  borderRadius: "8px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <strong style={{ fontSize: "0.8rem", color: isApproved ? "#15803d" : "#b45309" }}>
                    {isApproved ? "✅ 2PC: COMMITTED (已核准过账)" : "⏳ 2PC: PREPARED (事务已隔离挂起)"}
                  </strong>
                  <span style={{ fontSize: "0.65rem", fontFamily: "monospace", color: "#64748b" }}>
                    TxState: {isApproved ? "COMMITTED" : "PREPARED"}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.72rem", color: "#475569", lineHeight: 1.4 }}>
                  {isApproved
                    ? `已由二级财务主管完成电子签名授权。正式财务凭证 ${voucherId} 已入账并推送 SAP。`
                    : "底层核心总账写入操作已处于准备就绪态挂起，必须由授权人确认平账核减方案后执行过账。"}
                </p>
              </div>

              {/* 待审明细单据卡片 */}
              <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", padding: "0.75rem", background: "#f8fafc" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.5rem" }}>
                  待审单据: 差旅招待核销 (EXP-2026-0982)
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#475569", marginBottom: "0.25rem" }}>
                  <span>申报金额原值:</span>
                  <strong>¥8,090.00</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "#dc2626", marginBottom: "0.25rem" }}>
                  <span>合规核减 (INV-0935缺发票码):</span>
                  <strong>-¥820.00</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", fontWeight: 700, color: "#16a34a", borderTop: "1px dashed #cbd5e1", paddingTop: "0.35rem" }}>
                  <span>最终核准入账金额:</span>
                  <span>¥7,270.00</span>
                </div>
              </div>

              {/* 操作按钮 */}
              {!isApproved ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={handleApprove}
                    style={{
                      padding: "0.55rem",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "#ffffff",
                      background: "#16a34a",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                      boxShadow: "0 1px 3px rgba(22, 163, 74, 0.3)",
                    }}
                  >
                    ✍️ 电子签名授权正式入账 (2PC Commit)
                  </button>
                  <button
                    type="button"
                    onClick={handleReject}
                    style={{
                      padding: "0.45rem",
                      fontSize: "0.74rem",
                      fontWeight: 500,
                      color: "#dc2626",
                      background: "#ffffff",
                      border: "1px solid #fca5a5",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    🚫 驳回事务 (Rollback)
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "0.5rem", background: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" }}>
                  <span style={{ fontSize: "0.75rem", color: "#15803d", fontWeight: 600 }}>
                    ✓ 电子印章已加盖，凭证号: {voucherId}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: 节点属性检视器 (Node Inspector) */}
          {activeTab === "inspector" && (
            <div style={{ flex: 1, padding: "1rem", overflowY: "auto" }}>
              {selectedNode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
                  <div>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", marginBottom: "0.2rem" }}>
                      NODE ID: {selectedNode.id}
                    </div>
                    <strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>
                      {selectedNode.data.label}
                    </strong>
                  </div>

                  <div style={{ background: "#f8fafc", padding: "0.6rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.2rem" }}>节点运行状态:</div>
                    <strong style={{ fontSize: "0.78rem", color: "#1e293b" }}>
                      {selectedNode.data.status.toUpperCase()} (耗时: {selectedNode.data.costMs}ms)
                    </strong>
                  </div>

                  {selectedNode.data.outputPreview && (
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.25rem" }}>
                        运行时输出数据 (Output):
                      </div>
                      <div
                        style={{
                          background: "#0f172a",
                          color: "#38bdf8",
                          padding: "0.6rem",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontFamily: "monospace",
                          lineHeight: 1.4,
                        }}
                      >
                        {selectedNode.data.outputPreview}
                      </div>
                    </div>
                  )}

                  {selectedNode.data.config && (
                    <div>
                      <div style={{ fontSize: "0.7rem", color: "#64748b", marginBottom: "0.25rem" }}>
                        节点配置参数 (Config Schema):
                      </div>
                      <pre
                        style={{
                          background: "#f1f5f9",
                          padding: "0.6rem",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          margin: 0,
                        }}
                      >
                        {JSON.stringify(selectedNode.data.config, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", textAlign: "center", marginTop: "2rem" }}>
                  在左侧画布点击任意节点查看属性
                </div>
              )}
            </div>
          )}

          {/* Tab 3: 执行日志 (Structured Runtime Logs) */}
          {activeTab === "logs" && (
            <div
              style={{
                flex: 1,
                padding: "0.75rem",
                background: "#0f172a",
                color: "#e2e8f0",
                fontSize: "0.68rem",
                fontFamily: "monospace",
                lineHeight: 1.5,
                overflowY: "auto",
              }}
            >
              {logs.map((lg, i) => (
                <div key={i} style={{ marginBottom: "0.4rem" }}>
                  <span style={{ color: "#64748b" }}>{lg.time} </span>
                  <span
                    style={{
                      color:
                        lg.level === "WARN"
                          ? "#f59e0b"
                          : lg.level === "GATE"
                          ? "#38bdf8"
                          : lg.level === "AUDIT"
                          ? "#4ade80"
                          : "#94a3b8",
                      fontWeight: 600,
                    }}
                  >
                    [{lg.level}]
                  </span>{" "}
                  <span>{lg.msg}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
