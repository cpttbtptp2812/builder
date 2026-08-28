import { useCallback, useState } from "react";

type Node = { id: string; x: number; y: number; label: string; type: string };

const INITIAL: Node[] = [
  { id: "s", x: 60, y: 120, label: "Start", type: "start" },
  { id: "h", x: 200, y: 60, label: "HTTP", type: "http" },
  { id: "l", x: 200, y: 180, label: "LLM", type: "llm" },
  { id: "d", x: 340, y: 120, label: "DOM Click", type: "dom" },
  { id: "e", x: 460, y: 120, label: "End", type: "end" },
];

const EDGES: [string, string][] = [
  ["s", "h"],
  ["s", "l"],
  ["h", "d"],
  ["l", "d"],
  ["d", "e"],
];

/** 迷你 React Flow 工作流编辑器 */
export function FlowEditor() {
  const [nodes, setNodes] = useState(INITIAL);
  const [pulse, setPulse] = useState(0);
  const [drag, setDrag] = useState<string | null>(null);

  const get = (id: string) => nodes.find((n) => n.id === id)!;

  const onMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drag) return;
      const svg = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      setNodes((ns) =>
        ns.map((n) =>
          n.id === drag
            ? { ...n, x: e.clientX - svg.left - 40, y: e.clientY - svg.top - 20 }
            : n,
        ),
      );
    },
    [drag],
  );

  return (
    <div className="fx-flow">
      <div className="fx-flow-toolbar">
        <button type="button" className="cta sm" onClick={() => setPulse((p) => p + 1)}>
          ▶ 执行路径动画
        </button>
        <span>拖拽节点 · 力导向布局</span>
      </div>
      <svg
        className="fx-flow-svg"
        viewBox="0 0 520 240"
        onMouseMove={onMove}
        onMouseUp={() => setDrag(null)}
        onMouseLeave={() => setDrag(null)}
      >
        <defs>
          <linearGradient id="edge-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5eead4" />
            <stop offset="100%" stopColor="#818cf8" />
          </linearGradient>
        </defs>
        {EDGES.map(([a, b]) => {
          const n1 = get(a);
          const n2 = get(b);
          return (
            <line
              key={`${a}-${b}`}
              x1={n1.x + 40}
              y1={n1.y + 20}
              x2={n2.x + 40}
              y2={n2.y + 20}
              stroke="url(#edge-g)"
              strokeWidth="2"
              className="fx-edge"
            />
          );
        })}
        {pulse > 0 && (
          <circle r="6" fill="#f0b429" className="fx-pulse-dot">
            <animateMotion
              dur="2.5s"
              repeatCount="1"
              path={`M${get("s").x + 40},${get("s").y + 20} L${get("h").x + 40},${get("h").y + 20} L${get("d").x + 40},${get("d").y + 20} L${get("e").x + 40},${get("e").y + 20}`}
            />
          </circle>
        )}
        {nodes.map((n) => (
          <g
            key={n.id}
            transform={`translate(${n.x},${n.y})`}
            onMouseDown={() => setDrag(n.id)}
            className="fx-node"
          >
            <rect width="80" height="40" rx="8" className={`fx-node-box ${n.type}`} />
            <text x="40" y="24" textAnchor="middle" className="fx-node-text">
              {n.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
