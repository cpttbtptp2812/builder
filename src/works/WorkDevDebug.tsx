import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentHubOverview } from "../components/agent/AgentHubOverview";

/** AI Agent — 流程图 + 本页逐步演示，不跳路由 */
export function WorkDevDebug() {
  return (
    <div className="agent-hub">
      <header className="agent-hub-top">
        <div>
          <h1>AI Agent</h1>
          <p>点节点看这一步 · 从起点到该点的线会动 · 右下角可以对话</p>
        </div>
      </header>
      <BackendStatusBar compact />
      <AgentHubOverview />
    </div>
  );
}
