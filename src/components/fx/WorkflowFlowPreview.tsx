import { useEffect, useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useStore } from "../../store";

type NData = { label: string; kind: string };

function FlowNode({ data }: NodeProps<Node<NData>>) {
  return (
    <div className={`rf-node mini ${data.kind}`}>
      <Handle type="target" position={Position.Left} />
      <strong>{data.label}</strong>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { mini: FlowNode };

const NODES: Node<NData>[] = [
  { id: "1", type: "mini", position: { x: 0, y: 60 }, data: { label: "Start", kind: "start" } },
  { id: "2", type: "mini", position: { x: 120, y: 0 }, data: { label: "打开后台", kind: "dom" } },
  { id: "3", type: "mini", position: { x: 120, y: 120 }, data: { label: "读取 SKU", kind: "dom" } },
  { id: "4", type: "mini", position: { x: 260, y: 60 }, data: { label: "改价提交", kind: "http" } },
  { id: "5", type: "mini", position: { x: 400, y: 60 }, data: { label: "End", kind: "end" } },
];

const EDGES: Edge[] = [
  { id: "e1", source: "1", target: "2", animated: true },
  { id: "e2", source: "1", target: "3" },
  { id: "e3", source: "2", target: "4", animated: true },
  { id: "e4", source: "3", target: "4", animated: true },
  { id: "e5", source: "4", target: "5", animated: true },
];

const STEP_NODE = ["1", "2", "3", "4", "4"];

/** React Flow 工作流预览 — 节点随回放高亮 */
export function WorkflowFlowPreview() {
  const replayStep = useStore((s) => s.replayStep);
  const replayActive = useStore((s) => s.replayActive);

  const nodes = useMemo(
    () =>
      NODES.map((n) => ({
        ...n,
        style:
          replayActive && STEP_NODE[replayStep] === n.id
            ? { boxShadow: "0 0 0 3px #5eead4", borderRadius: 8 }
            : undefined,
      })),
    [replayStep, replayActive],
  );

  const edges = useMemo(
    () =>
      EDGES.map((e) => ({
        ...e,
        animated: replayActive && (e.source === STEP_NODE[replayStep] || e.target === STEP_NODE[replayStep]),
      })),
    [replayStep, replayActive],
  );

  return (
    <div className="wf-flow-preview">
      <header>
        <strong>React Flow</strong>
        <span>@xyflow/react · 流程可视化</span>
      </header>
      <div className="wf-flow-canvas">
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView panOnDrag={false} zoomOnScroll={false} nodesDraggable={false} nodesConnectable={false} elementsSelectable={false} className="rf-light">
          <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#cbd5e1" />
        </ReactFlow>
      </div>
    </div>
  );
}
