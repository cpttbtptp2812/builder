import type { JdViewId } from "../../lib/agentJdRequirements";

/** Agent 架构理论 — 与项目模块一一映射 */
export function AgentArchitectureTheory({ onGo }: { onGo: (view: JdViewId) => void }) {
  return (
    <div className="oa-arch-theory">
      <header>
        <h2>Agent 架构理论 ↔ OwnAgent 实现</h2>
        <p>Agent 系统常见架构概念，以及在本产品中的对应模块与入口。</p>
      </header>

      <div className="oa-arch-diagram">
        <pre className="oa-arch-pre">{`用户输入
   │
   ▼
┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Planning    │────▶│   Memory    │────▶│    Tools     │
│  路由/编排    │     │  RAG/广场/  │     │  MCP 8 工具   │
│  read→route  │     │  WorkingSet │     │  tool loop   │
└──────────────┘     └─────────────┘     └──────┬───────┘
                                                │
   ◀────────────────────────────────────────────┘
   │
   ▼
┌──────────────┐     ┌─────────────┐
│   Action     │────▶│  Trace/Eval │
│  SSE 流式写  │     │  溯源/评测  │
│  write       │     │  Policy/HITL│
└──────────────┘     └─────────────┘`}
        </pre>
      </div>

      <div className="oa-arch-table">
        <table>
          <thead>
            <tr>
              <th>理论模块</th>
              <th>常见 JD 表述</th>
              <th>本项目</th>
              <th>入口</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.module}>
                <td><strong>{r.module}</strong></td>
                <td>{r.jd}</td>
                <td><code>{r.code}</code></td>
                <td>
                  <button type="button" className="oa-arch-link" onClick={() => onGo(r.view)}>
                    {r.action}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <aside className="oa-arch-note">
        <h3>全栈常见能力</h3>
        <ul>
          <li><strong>LangChain / LangGraph</strong> — 图编排思想对应 turnFlowJournal + multiAgentRuntime</li>
          <li><strong>向量库 Milvus/PGVector</strong> — server/rag SQLite 可替换为 pgvector 部署</li>
          <li><strong>MCP 协议</strong> — mcpServer JSON-RPC tools/list · tools/call</li>
          <li><strong>LLMOps 评测</strong> — EvalLabPanel 回归 + groundedness 指标</li>
          <li><strong>AI Coding 工具</strong> — 产品本身可用 Cursor 迭代，可展示 commit 与架构说明</li>
        </ul>
      </aside>
    </div>
  );
}

const ROWS: {
  module: string;
  jd: string;
  code: string;
  view: JdViewId;
  action: string;
}[] = [
  { module: "LUI 对话层", jd: "流式/Markdown/消息管理", code: "AgentProductDemo.tsx", view: "chat", action: "对话" },
  { module: "RAG", jd: "检索增强/知识溯源", code: "ragEngine.ts · KnowledgeSources", view: "rag", action: "知识管理" },
  { module: "Tool Loop", jd: "Function Calling/ReAct", code: "agentRuntime.ts · mcpServer.ts", view: "mcp", action: "MCP 沙箱" },
  { module: "Multi-Agent", jd: "Agentic Workflow", code: "multiAgentRuntime.ts", view: "chat", action: "设置多 Agent" },
  { module: "Prompt", jd: "Prompt 工程/模板", code: "promptTemplates.ts", view: "prompts", action: "模板" },
  { module: "Memory", jd: "工作记忆/长期记忆", code: "agentMemory.ts · plazaFeed.ts", view: "feed", action: "知识广场" },
  { module: "Trace", jd: "执行追溯/可观测", code: "agentTraceStore.ts", view: "trace", action: "运行日志" },
  { module: "Eval", jd: "评测集/回归", code: "evalHarness.ts", view: "eval", action: "质量检测" },
  { module: "Policy/HITL", jd: "安全合规/人工审批", code: "policyDesk.ts", view: "guard", action: "安全管控" },
];
