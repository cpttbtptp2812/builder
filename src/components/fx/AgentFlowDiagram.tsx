import { Link } from "react-router-dom";
import type { CSSProperties } from "react";

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

export const AGENT_FLOW: FlowDiagramSpec = {
  title: "UniAgent · 对话闭环",
  hint: "点击节点定位到页面对应区域",
  nodes: [
    { id: "input", label: "用户输入", sub: "Enter 发送", color: "#64748b" },
    { id: "router", label: "Guest Router", sub: "意图 → Skill", color: "#818cf8" },
    { id: "skill", label: "Skill 执行", sub: "SKILL.md 流水线", color: "#f59e0b", href: "/work/skills" },
    { id: "mcp", label: "MCP tools/call", sub: "JSON-RPC", color: "#34d399" },
    { id: "trace", label: "Agent Trace", sub: "逐步展开", color: "#38bdf8" },
    { id: "platform", label: "Platform Lab", sub: "RAG / Eval", color: "#6366f1", href: "/work/platform" },
  ],
  edges: [
    { from: "input", to: "router" },
    { from: "router", to: "skill" },
    { from: "skill", to: "mcp" },
    { from: "mcp", to: "trace" },
  ],
  layout: {
    input: { x: 12, y: 50 },
    router: { x: 32, y: 50 },
    skill: { x: 52, y: 50 },
    mcp: { x: 72, y: 50 },
    trace: { x: 92, y: 50 },
    platform: { x: 50, y: 18 },
  },
};

export const SKILLS_FLOW: FlowDiagramSpec = {
  title: "SkillForge · Skill 运行时",
  hint: "点击节点切换 Lab 面板",
  nodes: [
    { id: "intent", label: "意图输入", sub: "trigger 词", color: "#64748b" },
    { id: "router", label: "Router Lab", sub: "explainDiscovery", color: "#f59e0b" },
    { id: "site-analyzer", label: "Site Audit", sub: "http + perf", color: "#fb923c" },
    { id: "dom-probe", label: "DOM Probe", sub: "snapshot 树", color: "#fbbf24" },
    { id: "workflow-orchestrator", label: "Workflow", sub: "入队执行", color: "#fcd34d" },
    { id: "mcp", label: "MCP 工具", sub: "tools/call", color: "#34d399" },
    { id: "metrics", label: "指标面板", sub: "latency / DOM", color: "#38bdf8" },
    { id: "agent", label: "UniAgent", sub: "上层对话", color: "#818cf8", href: "/work/agent" },
    { id: "platform", label: "Platform Lab", sub: "RAG / Eval", color: "#6366f1", href: "/work/platform" },
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
    intent: { x: 50, y: 14 },
    router: { x: 50, y: 36 },
    "site-analyzer": { x: 22, y: 58 },
    "dom-probe": { x: 50, y: 58 },
    "workflow-orchestrator": { x: 78, y: 58 },
    mcp: { x: 50, y: 76 },
    metrics: { x: 50, y: 92 },
    agent: { x: 12, y: 14 },
    platform: { x: 88, y: 14 },
  },
};

const SPECS = {
  platform: PLATFORM_FLOW,
  agent: AGENT_FLOW,
  skills: SKILLS_FLOW,
} as const;

export type FlowVariant = keyof typeof SPECS;

type Props = {
  variant: FlowVariant;
  activeId?: string | null;
  visitedIds?: string[];
  /** 当前正在流动的边 from→to */
  flowEdge?: { from: string; to: string } | null;
  onSelect?: (id: string) => void;
  compact?: boolean;
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
}: Props) {
  const spec = SPECS[variant];
  const getPos = (id: string) => spec.layout[id] ?? { x: 50, y: 50 };

  return (
    <div className={`agent-flow-diagram ${compact ? "agent-flow-diagram--compact" : ""}`} data-variant={variant}>
      <header className="agent-flow-head">
        <div>
          <strong>{spec.title}</strong>
          <span>{spec.hint}</span>
        </div>
      </header>

      <div className="agent-flow-canvas" role="img" aria-label={spec.title}>
        <svg className="agent-flow-edges" viewBox="0 0 100 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="flow-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.2" />
            </linearGradient>
          </defs>
          {spec.edges.map((e) => {
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

        {spec.nodes.map((node) => {
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
              className={`agent-flow-node ${state}`}
              style={style}
              onClick={() => onSelect?.(node.id)}
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
