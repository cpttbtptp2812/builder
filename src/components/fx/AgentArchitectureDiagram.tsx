/** Agent 平台架构分层图 — Agent / Skills / MCP / Knowledge / SDK */

import type { CSSProperties } from "react";

const LAYERS = [
  {
    id: "ui",
    label: "Product UI",
    items: ["UniAgent Chat", "SkillForge Lab", "Platform Lab"],
    color: "#818cf8",
  },
  {
    id: "agent",
    label: "Agent Loop",
    items: ["Guest Router", "LLM Tool Loop", "Multi-Agent Trace"],
    color: "#a78bfa",
  },
  {
    id: "skills",
    label: "Skills Runtime",
    items: ["SKILL.md", "Trigger Router", "Pipeline Steps"],
    color: "#f59e0b",
  },
  {
    id: "mcp",
    label: "MCP Protocol",
    items: ["tools/list", "tools/call", "JSON-RPC 2.0"],
    color: "#34d399",
  },
  {
    id: "tools",
    label: "Tools & Data",
    items: ["http_probe", "knowledge_search", "browser_snapshot", "workflow_run"],
    color: "#38bdf8",
  },
  {
    id: "infra",
    label: "Knowledge & SDK",
    items: ["RAG Chunks", "IndexedDB Memory", "ReplaySDK / Locator"],
    color: "#f472b6",
  },
];

const COMPARE_ROWS = [
  {
    dim: "工具协议",
    self: "自研 McpInProcessServer + JSON-RPC",
    langchain: "LangChain Tool / StructuredTool",
    dify: "Dify Plugin + HTTP MCP",
  },
  {
    dim: "意图路由",
    self: "SKILL.md trigger 加权 + explainDiscovery",
    langchain: "AgentExecutor + RouterChain",
    dify: "工作流节点 + 条件分支",
  },
  {
    dim: "知识检索",
    self: "ragEngine 分块 + hybrid score（可接向量库）",
    langchain: "VectorStore + Retriever",
    dify: "Knowledge Base + RAG Pipeline",
  },
  {
    dim: "编排",
    self: "Multi-Agent Planner/Executor/Reviewer",
    langchain: "Multi-Agent / CrewAI 模式",
    dify: "可视化 Workflow DAG",
  },
  {
    dim: "可观测",
    self: "Skill Trace + Eval Harness + MCP Span",
    langchain: "LangSmith Traces",
    dify: "运行日志 + 节点耗时",
  },
];

type Props = {
  showCompare?: boolean;
  compact?: boolean;
};

export function AgentArchitectureDiagram({ showCompare = false, compact = false }: Props) {
  return (
    <div className={`agent-arch ${compact ? "agent-arch--compact" : ""}`}>
      <div className="agent-arch-stack" role="img" aria-label="Agent 平台分层架构">
        {LAYERS.map((layer, i) => (
          <div key={layer.id} className="agent-arch-layer" style={{ "--layer-accent": layer.color } as CSSProperties}>
            {i > 0 && <div className="agent-arch-arrow" aria-hidden>↓</div>}
            <div className="agent-arch-layer-head">
              <span className="agent-arch-layer-idx">{String(i + 1).padStart(2, "0")}</span>
              <strong>{layer.label}</strong>
            </div>
            <ul className="agent-arch-layer-items">
              {layer.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {showCompare && (
        <div className="agent-arch-compare">
          <h4>架构对照 · 自研运行时 vs 平台方案</h4>
          <p className="agent-arch-compare-lead">
            非「用过 Dify/LangChain」背书，而是说明分层职责等价 — 面试时可对照讲迁移与选型。
          </p>
          <div className="agent-arch-compare-scroll">
            <table className="agent-arch-compare-table">
              <thead>
                <tr>
                  <th>维度</th>
                  <th>本作品集</th>
                  <th>LangChain</th>
                  <th>Dify</th>
                </tr>
              </thead>
              <tbody>
                {COMPARE_ROWS.map((row) => (
                  <tr key={row.dim}>
                    <td>{row.dim}</td>
                    <td>{row.self}</td>
                    <td>{row.langchain}</td>
                    <td>{row.dify}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
