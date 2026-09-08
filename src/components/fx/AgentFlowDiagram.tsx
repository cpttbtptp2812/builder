import { Link } from "react-router-dom";
import { useRef, type CSSProperties } from "react";
import { STEP_IDS, STEP_REGISTRY } from "../agent/steps/registry";

export type FlowNode = {
  id: string;
  label: string;
  sub?: string;
  color: string;
  /** 站内路由 — 点击跳转其它项目 */
  href?: string;
};

export type FlowEdge = {
  from: string;
  to: string;
  label?: string;
};

export type FlowDiagramSpec = {
  title: string;
  hint: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  layout: Record<string, { x: number; y: number }>;
};

export const PLATFORM_FLOW: FlowDiagramSpec = {
  title: "Platform Lab · 一问三验",
  hint: "点击节点进入对应演示 · 跑演示时看数据流动",
  nodes: [
    { id: "query", label: "用户问题", sub: "自然语言输入", color: "#64748b" },
    { id: "rag", label: "RAG 召回", sub: "chunk + 相关度", color: "#6366f1" },
    { id: "corpus", label: "知识库", sub: "项目 chunk", color: "#818cf8" },
    { id: "multi-agent", label: "Multi-Agent", sub: "三角色协作", color: "#a78bfa" },
    { id: "planner", label: "Planner", sub: "读记忆 · 定计划", color: "#c084fc" },
    { id: "executor", label: "Executor", sub: "MCP 调工具", color: "#d946ef" },
    { id: "reviewer", label: "Reviewer", sub: "带引用汇总", color: "#e879f9" },
    { id: "eval", label: "Eval", sub: "路由 + 延迟", color: "#f59e0b" },
    { id: "answer", label: "最终答案", sub: "可验证输出", color: "#34d399" },
    { id: "agent", label: "UniAgent", sub: "对话入口", color: "#818cf8", href: "/work/agent" },
    { id: "skills", label: "SkillForge", sub: "Skill 层", color: "#f59e0b", href: "/work/skills" },
  ],
  edges: [
    { from: "query", to: "rag", label: "retrieve" },
    { from: "corpus", to: "rag", label: "Top-K" },
    { from: "rag", to: "multi-agent" },
    { from: "multi-agent", to: "planner" },
    { from: "planner", to: "executor" },
    { from: "executor", to: "reviewer" },
    { from: "reviewer", to: "answer" },
    { from: "multi-agent", to: "eval", label: "benchmark" },
    { from: "eval", to: "answer" },
  ],
  layout: {
    query: { x: 50, y: 12 },
    rag: { x: 22, y: 38 },
    corpus: { x: 22, y: 68 },
    "multi-agent": { x: 50, y: 38 },
    planner: { x: 38, y: 62 },
    executor: { x: 50, y: 62 },
    reviewer: { x: 62, y: 62 },
    eval: { x: 78, y: 38 },
    answer: { x: 50, y: 88 },
    agent: { x: 8, y: 12 },
    skills: { x: 92, y: 12 },
  },
};

/** 一次提问沿图里的步骤走：节点文案来自 STEP_REGISTRY */
export const HUB_FLOW: FlowDiagramSpec = {
  title: "UniAgent · 提问怎么被做完",
  hint: "点节点，下方标题必须是同一个词",
  nodes: STEP_IDS.map((id) => {
    const s = STEP_REGISTRY[id];
    return { id: s.id, label: s.label, sub: s.sub, color: s.color };
  }),
  edges: [
    { from: "nlu", to: "intent" },
    { from: "intent", to: "entity" },
    { from: "entity", to: "plan" },
    { from: "plan", to: "context" },
    { from: "context", to: "dsl" },
    { from: "dsl", to: "manage" },
    { from: "manage", to: "pattern" },
    { from: "pattern", to: "engine" },
    { from: "engine", to: "mech" },
    { from: "mech", to: "ctrl" },
    { from: "ctrl", to: "browser" },
    { from: "ctrl", to: "mcp" },
    { from: "ctrl", to: "kb" },
  ],
  layout: {
    nlu: { x: 14, y: 16 },
    intent: { x: 32, y: 16 },
    entity: { x: 50, y: 16 },
    plan: { x: 68, y: 16 },
    context: { x: 86, y: 16 },
    dsl: { x: 24, y: 40 },
    manage: { x: 50, y: 40 },
    pattern: { x: 76, y: 40 },
    engine: { x: 24, y: 64 },
    mech: { x: 50, y: 64 },
    ctrl: { x: 76, y: 64 },
    browser: { x: 24, y: 86 },
    mcp: { x: 50, y: 86 },
    kb: { x: 76, y: 86 },
  },
};

const HUB_ORDER = STEP_IDS;

export const HUB_TOUR: {
  active: string;
  edge?: { from: string; to: string };
  visited: string[];
  caption: string;
}[] = [
  { active: "nlu", visited: [], caption: "理解问句：对本站做发布前检查" },
  { active: "intent", edge: { from: "nlu", to: "intent" }, visited: ["nlu"], caption: "辨认意图 → 发布前检查 / 探活" },
  { active: "entity", edge: { from: "intent", to: "entity" }, visited: ["nlu", "intent"], caption: "抽出实体：站点、页面、检查项" },
  { active: "plan", edge: { from: "entity", to: "plan" }, visited: ["nlu", "intent", "entity"], caption: "规划任务：先探活，再汇总" },
  { active: "context", edge: { from: "plan", to: "context" }, visited: ["nlu", "intent", "entity", "plan"], caption: "整理上下文：会话与当前页面" },
  { active: "dsl", edge: { from: "context", to: "dsl" }, visited: ["nlu", "intent", "entity", "plan", "context"], caption: "流程定义：入参、步骤、出参" },
  { active: "manage", edge: { from: "dsl", to: "manage" }, visited: ["nlu", "intent", "entity", "plan", "context", "dsl"], caption: "流程管理：排队执行、记下版本" },
  { active: "pattern", edge: { from: "manage", to: "pattern" }, visited: ["nlu", "intent", "entity", "plan", "context", "dsl", "manage"], caption: "执行模式：顺序探活，页面并行查" },
  { active: "engine", edge: { from: "pattern", to: "engine" }, visited: ["nlu", "intent", "entity", "plan", "context", "dsl", "manage", "pattern"], caption: "运行内核：解析流程并调度" },
  { active: "mech", edge: { from: "engine", to: "mech" }, visited: ["nlu", "intent", "entity", "plan", "context", "dsl", "manage", "pattern", "engine"], caption: "落地机制：填参、沙箱、需要时问你" },
  { active: "ctrl", edge: { from: "mech", to: "ctrl" }, visited: ["nlu", "intent", "entity", "plan", "context", "dsl", "manage", "pattern", "engine", "mech"], caption: "运行管控：跟踪、失败再试、回退" },
  { active: "browser", edge: { from: "ctrl", to: "browser" }, visited: [...HUB_ORDER.slice(0, 11)], caption: "浏览器能力：探活、看页面" },
  { active: "mcp", edge: { from: "ctrl", to: "mcp" }, visited: [...HUB_ORDER], caption: "协议工具：MCP tools/call" },
  { active: "kb", edge: { from: "ctrl", to: "kb" }, visited: [...HUB_ORDER, "mcp"], caption: "知识检索：召回站内说明" },
];

export const AGENT_FLOW: FlowDiagramSpec = HUB_FLOW;

export const SKILLS_FLOW: FlowDiagramSpec = {
  title: "能力调用 · 浏览器 / 协议 / 知识",
  hint: "点节点看对应能力",
  nodes: [
    { id: "intent", label: "辨认意图", sub: "要做什么", color: "#60a5fa" },
    { id: "router", label: "规划任务", sub: "拆成步骤", color: "#818cf8" },
    { id: "site-analyzer", label: "浏览器能力", sub: "探活 · 看页面", color: "#34d399" },
    { id: "dom-probe", label: "抽出实体", sub: "页面关键字段", color: "#38bdf8" },
    { id: "workflow-orchestrator", label: "执行模式", sub: "顺序 · 并行", color: "#fb923c" },
    { id: "mcp", label: "协议工具", sub: "tools/call", color: "#2dd4bf" },
    { id: "metrics", label: "运行管控", sub: "跟踪 · 耗时", color: "#fbbf24" },
  ],
  edges: [
    { from: "intent", to: "router" },
    { from: "router", to: "site-analyzer" },
    { from: "router", to: "dom-probe" },
    { from: "router", to: "workflow-orchestrator" },
    { from: "site-analyzer", to: "mcp" },
    { from: "dom-probe", to: "mcp" },
    { from: "workflow-orchestrator", to: "mcp" },
    { from: "mcp", to: "metrics" },
  ],
  layout: {
    intent: { x: 50, y: 12 },
    router: { x: 50, y: 34 },
    "site-analyzer": { x: 22, y: 58 },
    "dom-probe": { x: 50, y: 58 },
    "workflow-orchestrator": { x: 78, y: 58 },
    mcp: { x: 50, y: 78 },
    metrics: { x: 50, y: 94 },
  },
};

const SPECS = {
  hub: HUB_FLOW,
  platform: PLATFORM_FLOW,
  agent: AGENT_FLOW,
  skills: SKILLS_FLOW,
} as const;

export type FlowVariant = keyof typeof SPECS;

type Props = {
  variant: FlowVariant;
  activeId?: string | null;
  visitedIds?: string[];
  flowEdge?: { from: string; to: string } | null;
  onSelect?: (id: string) => void;
  compact?: boolean;
  hero?: boolean;
  caption?: string | null;
  extraNodes?: FlowNode[];
  extraEdges?: FlowEdge[];
  layoutOverride?: Record<string, { x: number; y: number }>;
  draggable?: boolean;
  onMove?: (id: string, pos: { x: number; y: number }) => void;
};

function nodeState(id: string, activeId: string | null | undefined, visitedIds: string[]) {
  if (activeId === id) return "active";
  if (visitedIds.includes(id)) return "visited";
  return "idle";
}

function edgeKey(from: string, to: string) {
  return `${from}→${to}`;
}

export function AgentFlowDiagram({
  variant,
  activeId = null,
  visitedIds = [],
  flowEdge = null,
  onSelect,
  compact = false,
  hero = false,
  caption = null,
  extraNodes = [],
  extraEdges = [],
  layoutOverride,
  draggable = false,
  onMove,
}: Props) {
  const spec = SPECS[variant];
  const nodes = [...spec.nodes, ...extraNodes];
  const edges = [...spec.edges, ...extraEdges];
  const getPos = (id: string) => layoutOverride?.[id] ?? spec.layout[id] ?? { x: 50, y: 50 };
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null);

  function posFromEvent(e: React.PointerEvent) {
    const box = canvasRef.current?.getBoundingClientRect();
    if (!box) return { x: 50, y: 50 };
    return {
      x: Math.min(92, Math.max(8, ((e.clientX - box.left) / box.width) * 100)),
      y: Math.min(92, Math.max(8, ((e.clientY - box.top) / box.height) * 100)),
    };
  }

  return (
    <div
      className={`agent-flow-diagram${compact ? " agent-flow-diagram--compact" : ""}${hero ? " agent-flow-diagram--hero" : ""}`}
      data-variant={variant}
    >
      <header className="agent-flow-head">
        <div>
          <strong>{spec.title}</strong>
          <span>{caption ?? spec.hint}</span>
        </div>
      </header>

      <div className="agent-flow-canvas" ref={canvasRef} role="img" aria-label={spec.title}>
        <svg className="agent-flow-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`flow-grad-${variant}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#a5b4fc" stopOpacity="1" />
              <stop offset="100%" stopColor="#34d399" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {edges.map((e) => {
            const a = getPos(e.from);
            const b = getPos(e.to);
            const lit =
              flowEdge?.from === e.from && flowEdge?.to === e.to
                || activeId === e.from
                || activeId === e.to
                || (visitedIds.includes(e.from) && visitedIds.includes(e.to));
            return (
              <g key={edgeKey(e.from, e.to)}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  className={`agent-flow-edge ${lit ? "lit" : ""} ${flowEdge?.from === e.from && flowEdge?.to === e.to ? "flowing" : ""}`}
                  stroke={flowEdge?.from === e.from && flowEdge?.to === e.to ? `url(#flow-grad-${variant})` : undefined}
                />
                {lit && (
                  <circle r="0.9" className="agent-flow-packet">
                    <animateMotion
                      dur="1.4s"
                      repeatCount="indefinite"
                      path={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
                    />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {nodes.map((node) => {
          const pos = getPos(node.id);
          const state = nodeState(node.id, activeId, visitedIds);
          const style = { "--node-x": `${pos.x}%`, "--node-y": `${pos.y}%`, "--node-color": node.color } as CSSProperties;

          const inner = (
            <>
              <span className="agent-flow-node-ring" aria-hidden />
              <span className="agent-flow-node-label">{node.label}</span>
              {node.sub && <span className="agent-flow-node-sub">{node.sub}</span>}
            </>
          );

          if (node.href) {
            return (
              <Link
                key={node.id}
                to={node.href}
                className={`agent-flow-node agent-flow-node--link ${state}`}
                style={style}
                title={`前往 ${node.label}`}
              >
                {inner}
              </Link>
            );
          }

          return (
            <button
              key={node.id}
              type="button"
              className={`agent-flow-node ${state}${draggable ? " is-draggable" : ""}`}
              style={style}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (!draggable) {
                  onSelect?.(node.id);
                  return;
                }
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { id: node.id, sx: e.clientX, sy: e.clientY, moved: false };
              }}
              onPointerMove={(e) => {
                const drag = dragRef.current;
                if (!drag || drag.id !== node.id || !draggable) return;
                if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 8) return;
                drag.moved = true;
                onMove?.(drag.id, posFromEvent(e));
              }}
              onPointerUp={(e) => {
                const drag = dragRef.current;
                if (!drag || drag.id !== node.id) return;
                dragRef.current = null;
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {
                  /* already released */
                }
                if (!drag.moved) onSelect?.(node.id);
              }}
              aria-pressed={activeId === node.id}
            >
              {inner}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Platform Lab 节点 → scene 映射 */
export function platformNodeToScene(nodeId: string): "tour" | "rag" | "multi-agent" | "eval" | null {
  if (nodeId === "query" || nodeId === "answer") return "tour";
  if (nodeId === "rag" || nodeId === "corpus") return "rag";
  if (nodeId === "multi-agent" || nodeId === "planner" || nodeId === "executor" || nodeId === "reviewer") return "multi-agent";
  if (nodeId === "eval") return "eval";
  return null;
}

/** 演示 tour 步骤对应的 active 节点 */
export const PLATFORM_TOUR_NODES: Record<number, { active: string; edge?: { from: string; to: string }; visited: string[] }> = {
  0: { active: "query", visited: [] },
  1: { active: "rag", edge: { from: "query", to: "rag" }, visited: ["query", "corpus"] },
  2: { active: "multi-agent", edge: { from: "rag", to: "multi-agent" }, visited: ["query", "corpus", "rag", "planner", "executor", "reviewer"] },
  3: { active: "eval", edge: { from: "multi-agent", to: "eval" }, visited: ["query", "corpus", "rag", "planner", "executor", "reviewer", "multi-agent"] },
  4: { active: "answer", edge: { from: "eval", to: "answer" }, visited: ["query", "corpus", "rag", "planner", "executor", "reviewer", "multi-agent", "eval", "answer"] },
};
