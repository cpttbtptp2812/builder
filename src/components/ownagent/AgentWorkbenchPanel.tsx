import { useMemo, useState } from "react";
import { AgentHubOverview } from "../agent/AgentHubOverview";
import { listTraceSessions } from "../../lib/agentTraceStore";
import { loadSessionStore } from "../../lib/ownagentSessions";
import { listPromptTemplates } from "../../lib/promptTemplates";
import { MCP_TOOLS } from "../../lib/mcpBridgeLab";
import { loadEnabledMcpTools } from "../fx/agent/AgentMcpRegistry";
import { getRouterEvalCases } from "../../lib/evalHarness";
import { isLlmConfigured, loadLlmConfig } from "../../lib/llmConfig";
import { jdCoverageStats } from "../../lib/agentJdRequirements";
import { AgentJdAtlasPanel } from "./AgentJdAtlasPanel";
import { AgentArchitectureTheory } from "./AgentArchitectureTheory";
import type { JdViewId } from "../../lib/agentJdRequirements";

type ViewId = JdViewId;
type WorkbenchTab = "demo" | "jd" | "arch" | "flow";

const CAPABILITIES: {
  id: string;
  title: string;
  desc: string;
  view: ViewId;
  metric: () => string;
}[] = [
  {
    id: "stream",
    title: "流式对话 + Markdown",
    desc: "SSE 流式 · 多轮会话 · 导出/搜索/重试",
    view: "chat",
    metric: () => `${loadSessionStore().sessions.length} 个会话`,
  },
  {
    id: "rag",
    title: "RAG 检索增强",
    desc: "混合检索 · 分栏溯源 · 依据充分度",
    view: "rag",
    metric: () => "Hybrid RAG",
  },
  {
    id: "tool",
    title: "Tool Calling / MCP",
    desc: "8 工具 · 沙箱 · 对话内调用时间线",
    view: "mcp",
    metric: () => `${loadEnabledMcpTools().length}/${MCP_TOOLS.length} 已启用`,
  },
  {
    id: "trace",
    title: "Agent Trace",
    desc: "read→route→fetch→write 全链路",
    view: "trace",
    metric: () => `${listTraceSessions().length} 条记录`,
  },
  {
    id: "eval",
    title: "评测回归",
    desc: "Router/Policy/Skill · /eval",
    view: "eval",
    metric: () => `${getRouterEvalCases().length} 条用例`,
  },
  {
    id: "prompt",
    title: "Prompt 工程",
    desc: "场景模板 · 一键带入对话",
    view: "prompts",
    metric: () => `${listPromptTemplates().length} 个模板`,
  },
  {
    id: "hitl",
    title: "Policy + HITL",
    desc: "能力锁 · 工单审批",
    view: "guard",
    metric: () => "Policy Desk",
  },
  {
    id: "multi",
    title: "多 Agent 编排",
    desc: "单/多 Agent · Guest 兜底",
    view: "chat",
    metric: () => (isLlmConfigured(loadLlmConfig()) ? "LLM 已配置" : "Guest"),
  },
];

/** Agent 工作台 — 能力演示 + 岗位图谱 + 架构理论 + Flow 编排 */
export function AgentWorkbenchPanel({
  onGo,
  onGoProduct,
}: {
  onGo: (view: ViewId) => void;
  onGoProduct?: () => void;
}) {
  const [tab, setTab] = useState<WorkbenchTab>("jd");
  const stats = useMemo(() => jdCoverageStats(), []);
  const traces = useMemo(() => listTraceSessions().slice(0, 5), []);
  const sessions = useMemo(() => loadSessionStore().sessions.slice(0, 5), []);

  function enterProduct(view: ViewId) {
    if (onGoProduct) onGoProduct();
    onGo(view);
  }

  return (
    <div className="oa-panel oa-workbench">
      <header className="oa-panel-head">
        <div>
          <h1>Agent 工作台</h1>
          <p>
            AI Agent 系统能力全景 · 已融合 {stats.done}/{stats.total} 项能力（
            {stats.pct}%）
          </p>
        </div>
        <button type="button" className="oa-panel-primary" onClick={() => enterProduct("chat")}>
          开始对话
        </button>
      </header>

      <nav className="oa-workbench-tabs" aria-label="工作台分区">
        <button type="button" className={tab === "jd" ? "on" : ""} onClick={() => setTab("jd")}>
          能力图谱
        </button>
        <button type="button" className={tab === "arch" ? "on" : ""} onClick={() => setTab("arch")}>
          架构理论
        </button>
        <button type="button" className={tab === "demo" ? "on" : ""} onClick={() => setTab("demo")}>
          能力演示
        </button>
        <button type="button" className={tab === "flow" ? "on" : ""} onClick={() => setTab("flow")}>
          Flow 编排
        </button>
      </nav>

      {tab === "jd" && <AgentJdAtlasPanel onGo={enterProduct} />}

      {tab === "arch" && <AgentArchitectureTheory onGo={enterProduct} />}

      {tab === "flow" && (
        <div className="oa-workbench-flow">
          <p className="oa-workbench-flow-lead">
            可视化编排：AntV X6 / ReactFlow 节点式 Agent 工作流（对应 AgentHubOverview 理论画布）
          </p>
          <AgentHubOverview />
        </div>
      )}

      {tab === "demo" && (
        <>
          <div className="oa-workbench-grid">
            {CAPABILITIES.map((c) => (
              <button key={c.id} type="button" className="oa-workbench-card" onClick={() => enterProduct(c.view)}>
                <strong>{c.title}</strong>
                <span className="oa-workbench-metric">{c.metric()}</span>
                <p>{c.desc}</p>
                <em>进入 →</em>
              </button>
            ))}
          </div>

          <div className="oa-workbench-split">
            <section>
              <h2>最近 Trace</h2>
              {traces.length === 0 ? (
                <p className="oa-workbench-empty">暂无记录</p>
              ) : (
                <ul className="oa-workbench-list">
                  {traces.map((t) => (
                    <li key={t.id}>
                      <strong>{t.query.slice(0, 48)}</strong>
                      <span>
                        {t.totalMs}ms · {t.traces.reduce((n, tr) => n + tr.tools.length, 0)} tools
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="oa-panel-ghost sm" onClick={() => enterProduct("trace")}>
                全部日志
              </button>
            </section>
            <section>
              <h2>最近会话</h2>
              {sessions.length === 0 ? (
                <p className="oa-workbench-empty">暂无会话</p>
              ) : (
                <ul className="oa-workbench-list">
                  {sessions.map((s) => (
                    <li key={s.id}>
                      <strong>{s.title}</strong>
                      <span>{s.messages.filter((m) => m.role === "assistant").length} 轮</span>
                    </li>
                  ))}
                </ul>
              )}
              <button type="button" className="oa-panel-ghost sm" onClick={() => enterProduct("chat")}>
                打开对话
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
