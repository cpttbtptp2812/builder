import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { AgentFlowDiagram } from "../components/fx/AgentFlowDiagram";
import { McpBridgeDemo } from "../components/fx/McpBridgeDemo";
import { WorkGuide } from "../components/WorkGuide";
import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";
import { getWork } from "../data/works";

/** UniAgent — 流式对话 + MCP 工具协议层 */
export function WorkAgent() {
  const [params] = useSearchParams();
  const [auto, setAuto] = useState(false);
  const [flowActive, setFlowActive] = useState<string>("input");
  const chatRef = useRef<HTMLElement>(null);
  const mcpRef = useRef<HTMLElement>(null);
  const sse = getWork("sse");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (params.get("demo") === "1" || params.get("demo") === "true") setAuto(true);
  }, [params]);

  function selectAgentFlow(id: string) {
    setFlowActive(id);
    if (id === "input" || id === "router" || id === "trace") {
      chatRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (id === "mcp") {
      mcpRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="work-agent work-agent-rich">
      <WorkGuide slug="agent" />
      <BackendStatusBar compact />

      <AgentFlowDiagram variant="agent" activeId={flowActive} onSelect={selectAgentFlow} compact />

      <section ref={chatRef} className="work-agent-product work-agent-product--hero">
        <h3 className="work-subsection-title">UniAgent · 开箱即用对话</h3>
        <p className="work-subsection-lead">
          默认 Guest 模式免配置；点预设或输入问题即可看 Router → MCP 工具链与右侧 Trace。
        </p>
        <AgentProductDemo autoStart={auto} onFlowActive={setFlowActive} />
      </section>

      <section ref={mcpRef} className="work-agent-mcp">
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
