import { useEffect, useState } from "react";
import { mcpServer } from "../../../lib/mcpServer";
import { StepShell } from "./StepShell";

export function StepMcp() {
  const tools = mcpServer.listTools();
  const [envelope, setEnvelope] = useState("");

  async function call() {
    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "knowledge_search", arguments: { query: "Agent", topK: 2 } },
    };
    const result = await mcpServer.callTool("knowledge_search", { query: "Agent", topK: 2 });
    setEnvelope(JSON.stringify({ request, response: { jsonrpc: "2.0", id: 1, result } }, null, 2));
  }

  useEffect(() => {
    void call();
  }, []);

  return (
    <StepShell id="mcp">
      <p className="agent-step-sample">tools/list = {tools.map((t) => t.name).join(", ")}</p>
      <div className="agent-step-actions">
        <button type="button" onClick={() => void call()}>
          tools/call knowledge_search
        </button>
      </div>
      <pre className="agent-step-pre">{envelope || "// calling…"}</pre>
    </StepShell>
  );
}
