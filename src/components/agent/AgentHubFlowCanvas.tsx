import { useCallback, useMemo, useRef, type CSSProperties } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type OnEdgesChange,
  type OnNodesChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  EDGE_COLOR,
  LANES,
  bindOf,
  edgeIdsOnPath,
  edgeLook,
  isLaneId,
  nodesOnPath,
  type HubNodeData,
} from "../../lib/hubFlow";
import { STEP_REGISTRY, type StepId } from "./steps/registry";

function HubLaneNode({ data }: NodeProps<Node<HubNodeData>>) {
  return (
    <div className="hub-rf-lane">
      <strong>{data.label}</strong>
      <span>{data.sub}</span>
    </div>
  );
}

function HubStepNode({ data, selected }: NodeProps<Node<HubNodeData>>) {
  return (
    <div
      className={`hub-rf-node${selected ? " sel" : ""}${data.custom ? " is-custom" : ""}`}
      style={{ "--c": data.color } as CSSProperties}
      role="button"
      tabIndex={0}
      onClick={(e) => {
        e.stopPropagation();
        data.onPick?.(data.bind);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          data.onPick?.(data.bind);
        }
      }}
    >
      <Handle type="target" id="in-top" position={Position.Top} />
      <Handle type="target" id="in" position={Position.Left} />
      <strong>{data.label}</strong>
      <span>{data.sub}</span>
      <Handle type="source" id="out" position={Position.Right} />
      <Handle type="source" id="out-down" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = { hubStep: HubStepNode, hubLane: HubLaneNode };

export function AgentHubFlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  activeNodeId,
  onSelect,
  dirty,
  note,
  onSave,
  onExport,
  onImportClick,
  onReset,
  onAddStep,
  onRemoveSelected,
}: {
  nodes: Node<HubNodeData>[];
  edges: Edge[];
  onNodesChange: OnNodesChange<Node<HubNodeData>>;
  onEdgesChange: OnEdgesChange;
  onConnect: (c: Connection) => void;
  activeNodeId: string;
  onSelect: (id: StepId, nodeId: string) => void;
  dirty: boolean;
  note: string | null;
  onSave: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onReset: () => void;
  onAddStep: (id: StepId) => void;
  onRemoveSelected: () => void;
}) {
  const dragging = useRef(false);

  const pickNode = useCallback(
    (nodeId: string, bind: StepId) => {
      if (isLaneId(nodeId) || dragging.current) return;
      onSelect(bind, nodeId);
    },
    [onSelect],
  );

  const flowing = useMemo(() => edgeIdsOnPath(edges, activeNodeId), [edges, activeNodeId]);
  const pathNodes = useMemo(() => nodesOnPath(edges, flowing, activeNodeId), [edges, flowing, activeNodeId]);

  const shownNodes = useMemo(
    () =>
      nodes.map((n) => {
        if (n.type === "hubLane" || isLaneId(n.id)) return n;
        const step = bindOf(n.id, n.data);
        return {
          ...n,
          className: n.id === activeNodeId ? "is-active" : pathNodes.has(n.id) ? "is-path" : "",
          data: {
            ...n.data,
            onPick: () => pickNode(n.id, step),
          },
        };
      }),
    [nodes, activeNodeId, pathNodes, pickNode],
  );

  const shownEdges = useMemo(
    () =>
      edges.map((e) => {
        const on = flowing.has(e.id);
        return { ...e, ...edgeLook(e.source, e.target, on) };
      }),
    [edges, flowing],
  );

  return (
    <div className="hub-rf">
      <header className="hub-rf-head">
        <div>
          <strong>工作流</strong>
          <span>点节点看这一步 · 从起点到这里的线会动 · 拖手柄连线</span>
        </div>
        <div className="hub-rf-modes">
          <button type="button" className={dirty ? "hub-rf-save" : "ghost"} onClick={onSave}>
            {dirty ? "保存" : "已保存"}
          </button>
          <button type="button" className="ghost" onClick={onExport}>
            导出
          </button>
          <button type="button" className="ghost" onClick={onImportClick}>
            导入
          </button>
          <button type="button" className="ghost" onClick={onReset}>
            恢复默认
          </button>
        </div>
      </header>
      {note && <p className="hub-rf-note">{note}</p>}

      <div className="hub-rf-canvas">
        <ReactFlow
          nodes={shownNodes}
          edges={shownEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStart={() => {
            dragging.current = true;
          }}
          onNodeDragStop={() => {
            window.setTimeout(() => {
              dragging.current = false;
            }, 80);
          }}
          onPaneClick={() => {
            dragging.current = false;
          }}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.08, minZoom: 0.65, maxZoom: 1 }}
          minZoom={0.55}
          maxZoom={1.4}
          nodesDraggable
          nodesConnectable
          edgesFocusable
          elementsSelectable
          selectNodesOnDrag={false}
          panOnDrag
          zoomOnScroll={false}
          deleteKeyCode={["Backspace", "Delete"]}
          defaultEdgeOptions={{
            type: "straight",
            style: { stroke: EDGE_COLOR, strokeWidth: 1.4 },
          }}
          proOptions={{ hideAttribution: true }}
          className="hub-rf-flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#e2e8f0" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>

      <div className="hub-rf-editor">
        <p>添加步骤到图上 · 选中后 Delete 删除 · 从圆点拖到另一个节点连线</p>
        <div className="hub-rf-palette">
          {LANES.map((lane) => (
            <div key={lane.id} className="hub-rf-palette-group">
              {lane.ids.map((id) => (
                <button key={id} type="button" onClick={() => onAddStep(id)}>
                  + {STEP_REGISTRY[id].label}
                </button>
              ))}
            </div>
          ))}
          <button type="button" className="danger" onClick={onRemoveSelected}>
            删除选中
          </button>
        </div>
      </div>
    </div>
  );
}

export function connectEdge(c: Connection, edges: Edge[]): Edge[] {
  if (!c.source || !c.target || c.source === c.target) return edges;
  if (edges.some((e) => e.source === c.source && e.target === c.target)) return edges;
  return addEdge({ ...c, id: `${c.source}-${c.target}-${Date.now().toString(36)}`, ...edgeLook(c.source, c.target) }, edges);
}

export function addStepNode(nodes: Node<HubNodeData>[], id: StepId, fromId?: string): Node<HubNodeData> {
  const meta = STEP_REGISTRY[id];
  const last = [...nodes].reverse().find((n) => n.type === "hubStep");
  return {
    id: `custom-${id}-${Date.now().toString(36)}`,
    type: "hubStep",
    position: { x: (last?.position.x ?? 80) + 36, y: (last?.position.y ?? 360) + 28 },
    data: { label: meta.label, sub: meta.sub, color: meta.color, bind: id, custom: true },
  };
}
