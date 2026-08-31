import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
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

      <section className="work-agent-product">
        <h3 className="work-subsection-title">产品体验 · SSE 流式对话</h3>
        <AgentProductDemo autoStart={auto} />
      </section>

      <section className="work-agent-mcp">
        <h3 className="work-subsection-title">MCP 工具协议层</h3>
        <p className="work-subsection-lead">
          上面是 Agent 消费 SSE 流；下面是 tools/list → tools/call 的 JSON-RPC 实现 — 真实 fetch、知识库、DOM snapshot。
        </p>
        <McpBridgeDemo />
      </section>

      {sse && (
        <WorkTechDeepLinks
          intro="更底层可看 GraphQL SSE 实验室：原始帧、UIMessage 映射与 pause/resume 断线续传。"
          links={[sse]}
        />
      )}
    </div>
  );
}
