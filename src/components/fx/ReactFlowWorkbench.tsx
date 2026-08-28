import { useCallback, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type FlowNodeData = { label: string; kind: string };

function FlowNode({ data, selected }: NodeProps<Node<FlowNodeData>>) {
  return (
    <div className={`rf-node ${data.kind} ${selected ? "sel" : ""}`}>
      <Handle type="target" position={Position.Left} />
      <span className="rf-kind">{data.kind}</span>
      <strong>{data.label}</strong>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { flow: FlowNode };

const PALETTE = [
  { kind: "http", label: "HTTP 请求" },
  { kind: "llm", label: "LLM 节点" },
  { kind: "dom", label: "DOM 操作" },
  { kind: "if", label: "条件分支" },
];

const INITIAL_NODES: Node<FlowNodeData>[] = [
  { id: "1", type: "flow", position: { x: 40, y: 120 }, data: { label: "Start", kind: "start" } },
  { id: "2", type: "flow", position: { x: 200, y: 40 }, data: { label: "HTTP 探活", kind: "http" } },
  { id: "3", type: "flow", position: { x: 200, y: 180 }, data: { label: "LLM 抽取", kind: "llm" } },
  { id: "4", type: "flow", position: { x: 380, y: 110 }, data: { label: "If 分支", kind: "if" } },
  { id: "5", type: "flow", position: { x: 540, y: 60 }, data: { label: "DOM Click", kind: "dom" } },
  { id: "6", type: "flow", position: { x: 540, y: 160 }, data: { label: "通知", kind: "notify" } },
  { id: "7", type: "flow", position: { x: 700, y: 110 }, data: { label: "End", kind: "end" } },
];

const RUN_ORDER = ["1", "2", "3", "4", "5", "7"];

const INITIAL_EDGES: Edge[] = [
  { id: "e1-2", source: "1", target: "2", animated: true },
  { id: "e1-3", source: "1", target: "3" },
  { id: "e2-4", source: "2", target: "4", animated: true },
  { id: "e3-4", source: "3", target: "4" },
  { id: "e4-5", source: "4", target: "5", label: "yes" },
  { id: "e4-6", source: "4", target: "6", label: "no" },
  { id: "e5-7", source: "5", target: "7", animated: true },
  { id: "e6-7", source: "6", target: "7" },
];

const COPILOT_MSGS = [
  "分析并行分支：HTTP 与 LLM 可合并为串行…",
  "建议插入「合并节点」减少一次网络往返",
  "→ 已在画布插入 Merge 节点",
];

/** React Flow — 组件面板 + Copilot + 模拟运行 */
export function ReactFlowWorkbench() {
  const [nodes, setNodes, onNodesChange] = useNodesState(INITIAL_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [copilotStep, setCopilotStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [optimized, setOptimized] = useState(false);
  const [simNode, setSimNode] = useState<string | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [nodeSeq, setNodeSeq] = useState(0);

  const onConnect = useCallback(
    (c: Connection) => setEdges((eds) => addEdge({ ...c, animated: true }, eds)),
    [setEdges],
  );

  function insertMergeNode() {
    setNodes((nds) => [
      ...nds,
      {
        id: "merge-8",
        type: "flow",
        position: { x: 300, y: 110 },
        data: { label: "Merge 合并", kind: "llm" },
      },
    ]);
    setEdges((eds) => [
      ...eds,
      { id: "e-opt", source: "merge-8", target: "4", animated: true, style: { stroke: "#a78bfa" } },
    ]);
    setOptimized(true);
  }

  function runCopilot() {
    if (running) return;
    setRunning(true);
    setCopilotStep(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setCopilotStep(i);
      if (i === 2) insertMergeNode();
      if (i >= COPILOT_MSGS.length) {
        window.clearInterval(t);
        setRunning(false);
      }
    }, 1000);
  }

  function addFromPalette(kind: string, label: string) {
    const id = `new-${nodeSeq}`;
    setNodeSeq((n) => n + 1);
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "flow",
        position: { x: 120 + nodeSeq * 30, y: 260 + nodeSeq * 20 },
        data: { label, kind },
      },
    ]);
  }

  function simulateRun() {
    if (simulating) return;
    setSimulating(true);
    setSimNode(null);
    let i = 0;
    const t = window.setInterval(() => {
      setSimNode(RUN_ORDER[i] ?? null);
      i += 1;
      if (i >= RUN_ORDER.length) {
        window.clearInterval(t);
        setSimulating(false);
        setSimNode(null);
      }
    }, 700);
  }

  const styledNodes = nodes.map((n) => ({
    ...n,
    className: n.id === simNode ? "rf-sim-active" : "",
    style: n.id === simNode ? { boxShadow: "0 0 0 3px #a78bfa" } : undefined,
  }));

  return (
    <div className="rf-workbench rf-workbench-rich">
      <div className="rf-palette">
        <span>组件面板</span>
        {PALETTE.map((p) => (
          <button key={p.kind} type="button" onClick={() => addFromPalette(p.kind, p.label)}>
            + {p.label}
          </button>
        ))}
        <button type="button" className="cta sm" onClick={simulateRun} disabled={simulating}>
          {simulating ? "运行中…" : "▶ 模拟运行"}
        </button>
      </div>

      <div className="rf-canvas-wrap">
        <ReactFlow
          nodes={styledNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="rf-light"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#333" />
          <MiniMap
            nodeColor={(n) => {
              const k = (n.data as FlowNodeData)?.kind;
              if (k === "http") return "#5eead4";
              if (k === "llm") return "#818cf8";
              return "#444";
            }}
          />
          <Controls />
        </ReactFlow>
        {optimized && <div className="rf-opt-badge">Copilot 已插入优化节点</div>}
      </div>

      <aside className="rf-copilot">
        <header>
          <span>AI Copilot</span>
          <button type="button" className="cta sm" onClick={runCopilot} disabled={running || optimized}>
            {optimized ? "已优化" : running ? "分析中…" : "AI 优化"}
          </button>
        </header>
        <div className="rf-copilot-msgs">
          {COPILOT_MSGS.slice(0, copilotStep).map((m, i) => (
            <p key={i} className="pop-in">{m}</p>
          ))}
        </div>
        <p className="rf-hint">从面板拖入节点 · 模拟运行高亮路径 · AI 优化改图</p>
      </aside>
    </div>
  );
}
