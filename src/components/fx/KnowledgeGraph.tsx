import { useEffect, useState } from "react";

const NODES = [
  { id: "agent", label: "UniAgent", x: 50, y: 50, r: 28 },
  { id: "kb", label: "Knowledge", x: 20, y: 75, r: 22 },
  { id: "mcp", label: "MCP Tools", x: 80, y: 75, r: 22 },
  { id: "wf", label: "Workflows", x: 50, y: 95, r: 24 },
  { id: "sdk", label: "ReplaySDK", x: 15, y: 55, r: 20 },
  { id: "builder", label: "Builder", x: 85, y: 55, r: 20 },
];

const EDGES: [string, string][] = [
  ["agent", "kb"],
  ["agent", "mcp"],
  ["agent", "wf"],
  ["wf", "sdk"],
  ["wf", "builder"],
  ["kb", "mcp"],
];

/** 知识图谱 — 对齐 Builder KnowledgeGraphModal */
export function KnowledgeGraph() {
  const [active, setActive] = useState<string | null>("agent");
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => setPulse((p) => p + 1), 2000);
    return () => clearInterval(t);
  }, []);

  const get = (id: string) => NODES.find((n) => n.id === id)!;

  return (
    <div className="fx-kgraph">
      <div className="fx-kgraph-toolbar">
        <span>知识图谱 · 实体关系</span>
        {NODES.map((n) => (
          <button
            key={n.id}
            type="button"
            className={active === n.id ? "on" : ""}
            onClick={() => setActive(n.id)}
          >
            {n.label}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 100 100" className="fx-kgraph-svg">
        <defs>
          <radialGradient id="kg-glow">
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {EDGES.map(([a, b]) => {
          const n1 = get(a);
          const n2 = get(b);
          return (
            <line
              key={`${a}-${b}-${pulse}`}
              x1={n1.x}
              y1={n1.y}
              x2={n2.x}
              y2={n2.y}
              className="kg-edge"
              strokeDasharray={active === a || active === b ? "4 2" : "none"}
            />
          );
        })}
        {NODES.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            onClick={() => setActive(n.id)}
            className={`kg-node ${active === n.id ? "on" : ""}`}
          >
            {active === n.id && <circle r={n.r + 8} fill="url(#kg-glow)" className="kg-pulse" />}
            <circle r={n.r / 3} className="kg-dot" />
            <text y={n.r / 3 + 4} textAnchor="middle" className="kg-label">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
      {active && (
        <div className="fx-kgraph-detail pop-in">
          <strong>{get(active).label}</strong>
          <p>
            {active === "agent" && "GraphQL 会话 · AI SDK Provider · 工具卡路由"}
            {active === "kb" && "向量检索 Top-K · RAG 片段注入对话"}
            {active === "mcp" && "MCP 工具注册 · wave 动画渲染"}
            {active === "wf" && "chatMatchWorkflows · 频道库 · 执行引擎"}
            {active === "sdk" && "DOM 回放 · 队列调度 · IndexedDB"}
            {active === "builder" && "React Flow 编排 · BPMN 导出 · AI Copilot"}
          </p>
        </div>
      )}
    </div>
  );
}
