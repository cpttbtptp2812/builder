import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AgentArchitectureDiagram } from "../components/fx/AgentArchitectureDiagram";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { McpBridgeDemo } from "../components/fx/McpBridgeDemo";
import { WorkGuide } from "../components/WorkGuide";
import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";
import { getWork } from "../data/works";

/** UniAgent — 流式对话 + MCP 工具协议层 */
export function WorkAgent() {
  const [params] = useSearchParams();
  const [auto, setAuto] = useState(false);
  const sse = getWork("sse");

  useEffect(() => {
    if (params.get("demo") === "1" || params.get("demo") === "true") setAuto(true);
  }, [params]);

  return (
    <div className="work-agent work-agent-rich">
      <WorkGuide slug="agent" />

      <section className="work-agent-arch">
        <h3 className="work-subsection-title">Agent 平台分层</h3>
        <p className="work-subsection-lead">
          Agent Loop → Skills Router → MCP tools/call → RAG / SDK — 与 Platform Lab 模块一一对应。
        </p>
        <AgentArchitectureDiagram compact />
      </section>

      <section className="work-agent-product">
        <h3 className="work-subsection-title">UniAgent · 对话 + MCP 配置</h3>
        <AgentProductDemo autoStart={auto} />
      </section>

      <section className="work-agent-mcp">
        <h3 className="work-subsection-title">MCP 工具协议层 · 手动调试</h3>
        <p className="work-subsection-lead">
          上面 Agent 自动调用下列工具；这里可手动发 tools/list → tools/call，对照 JSON-RPC 报文与 Trace。
        </p>
        <McpBridgeDemo />
      </section>

      {sse && (
        <WorkTechDeepLinks
          intro="更底层可看 GraphQL SSE 实验室：原始帧、UIMessage 映射与 pause/resume 断线续传。"
          links={[sse]}
        />
      )}
      {getWork("platform") && getWork("skills") && (
        <WorkTechDeepLinks
          intro="Agent 相关模块互相衔接 — 按需点进："
          links={[getWork("platform")!, getWork("skills")!]}
        />
      )}
    </div>
  );
}
