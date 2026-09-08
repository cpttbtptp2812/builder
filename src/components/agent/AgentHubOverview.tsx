import { useCallback, useRef, useState } from "react";
import { ReactFlowProvider, useEdgesState, useNodesState, type Connection } from "@xyflow/react";
import { AgentHubFlowCanvas, addStepNode, connectEdge } from "./AgentHubFlowCanvas";
import { AgentStepStage } from "./AgentStepStage";
import { HubChatDock } from "./HubChatDock";
import { isStepId, type StepId } from "./steps";
import {
  defaultEdges,
  defaultNodes,
  edgeLook,
  isLaneId,
  loadSaved,
  parseFlow,
  persistFlow,
  slimFlow,
  type HubNodeData,
} from "../../lib/hubFlow";

export type AgentStep = "overview" | "chat" | "skills" | "platform" | "eval";

export type AgentPick = {
  step: Exclude<AgentStep, "overview">;
  try?: string;
  scene?: "rag" | "multi-agent";
  focus: string;
};

function HubStudio() {
  const saved = useRef(loadSaved());
  const [nodes, setNodes, onNodesChange] = useNodesState(saved.current?.nodes ?? defaultNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(saved.current?.edges ?? defaultEdges());
  const [selected, setSelected] = useState<{ step: StepId; nodeId: string }>({ step: "nlu", nodeId: "nlu" });
  const [playTick, setPlayTick] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const markDirty = useCallback(() => {
    setDirty(true);
    setNote(null);
  }, []);

  function select(id: string, nodeId: string) {
    if (!isStepId(id)) return;
    setSelected({ step: id, nodeId });
    setPlayTick((n) => n + 1);
    window.requestAnimationFrame(() => {
      document.querySelector("[data-active-step]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function save() {
    persistFlow(nodes, edges);
    setDirty(false);
    setNote("已保存到本机");
  }

  function exportFlow() {
    const blob = new Blob([JSON.stringify(slimFlow(nodes, edges), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "uniagent-flow.json";
    a.click();
    URL.revokeObjectURL(url);
    setNote("已导出 uniagent-flow.json");
  }

  async function importFlow(file: File) {
    try {
      const parsed = parseFlow(JSON.parse(await file.text()));
      if (!parsed) {
        setNote("导入失败：不是有效流程图");
        return;
      }
      setNodes(parsed.nodes);
      setEdges(parsed.edges);
      markDirty();
      setNote(`已导入 ${parsed.nodes.filter((n) => n.type === "hubStep").length} 个节点`);
    } catch {
      setNote("导入失败：JSON 读不出来");
    }
  }

  return (
    <>
      <div className="hub-studio">
        <AgentHubFlowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            if (changes.some((c) => c.type !== "select" && c.type !== "dimensions")) markDirty();
          }}
          onEdgesChange={(changes) => {
            onEdgesChange(changes);
            if (changes.some((c) => c.type !== "select")) markDirty();
          }}
          onConnect={(c: Connection) => {
            setEdges((curr) => connectEdge(c, curr));
            markDirty();
          }}
          activeNodeId={selected.nodeId}
          onSelect={select}
          dirty={dirty}
          note={note}
          onSave={save}
          onExport={exportFlow}
          onImportClick={() => fileRef.current?.click()}
          onReset={() => {
            setNodes(defaultNodes());
            setEdges(defaultEdges());
            setSelected({ step: "nlu", nodeId: "nlu" });
            markDirty();
            setNote("已恢复默认，点保存才会留下");
          }}
          onAddStep={(id) => {
            const node = addStepNode(nodes, id, selected.nodeId);
            setNodes((curr) => [...curr, node]);
            if (selected.nodeId && !isLaneId(selected.nodeId)) {
              setEdges((curr) => [
                ...curr,
                { id: `${selected.nodeId}-${node.id}`, source: selected.nodeId, target: node.id, ...edgeLook(selected.nodeId, node.id) },
              ]);
            }
            markDirty();
          }}
          onRemoveSelected={() => {
            const drop = new Set(nodes.filter((n) => n.selected && n.type === "hubStep").map((n) => n.id));
            const dropEdges = edges.filter((e) => e.selected).map((e) => e.id);
            if (drop.size === 0 && dropEdges.length === 0) {
              setNote("先点一个节点或一条线");
              return;
            }
            setNodes((curr) => curr.filter((n) => !drop.has(n.id)));
            setEdges((curr) => curr.filter((e) => !drop.has(e.source) && !drop.has(e.target) && !dropEdges.includes(e.id)));
            markDirty();
          }}
        />
        <HubChatDock />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importFlow(file);
        }}
      />
      <AgentStepStage stepId={selected.step} expanded playTick={playTick} />
    </>
  );
}

/** 点哪个节点，就停在哪一步；动态线只走从起点到该节点的路径 */
export function AgentHubOverview() {
  return (
    <section className="agent-hub-overview" aria-label="Agent 能力">
      <ReactFlowProvider>
        <HubStudio />
      </ReactFlowProvider>
    </section>
  );
}

export const AGENT_STEP_LABELS: Record<Exclude<AgentStep, "overview">, string> = {
  chat: "理解 / 运行",
  skills: "流程 / 能力",
  platform: "规划 / 知识",
  eval: "运行管控",
};
