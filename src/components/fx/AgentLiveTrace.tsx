import { useState } from "react";
import type { AgentToolTrace, AgentTurnTrace } from "../../lib/agentRuntime";

/** Agent Loop 实时 Trace — 真实 Tool Call 逐步展示 */
export function AgentLiveTrace({
  traces,
  running,
  iteration,
}: {
  traces: AgentTurnTrace[];
  running: boolean;
  iteration: number;
}) {
  if (traces.length === 0 && !running) {
    return (
      <div className="agent-live-trace idle">
        <p>Agent Loop</p>
        <span>Plan → Tool Call → Observe → Respond</span>
        <small>发送消息后，每轮 LLM 推理与 MCP 工具执行会在这里逐步出现</small>
      </div>
    );
  }

  return (
    <div className="agent-live-trace">
      <header>
        <strong>Agent Loop</strong>
        {running && <span className="live-chip">迭代 {iteration || 1}…</span>}
        {!running && traces.length > 0 && (
          <span className="done-chip">
            {traces.length} 轮 · {traces.reduce((n, t) => n + t.tools.length, 0)} tools
          </span>
        )}
      </header>

      <ol className="agent-loop-steps">
        {traces.map((turn) => (
          <li key={turn.iteration} className="agent-loop-turn">
            <div className="agent-loop-turn-head">
              <span className="idx">{String(turn.iteration).padStart(2, "0")}</span>
              <strong>{turn.label}</strong>
            </div>

            {turn.reasoning && (
              <details className="agent-loop-reasoning" open={running && turn.iteration === traces.length}>
                <summary>Reasoning</summary>
                <p>{turn.reasoning}</p>
              </details>
            )}

            {turn.tools.map((tool) => (
              <ToolTraceRow key={tool.id} tool={tool} />
            ))}

            {turn.text && turn.tools.length === 0 && (
              <div className="agent-loop-reply">
                <span>Response</span>
                <p>{turn.text}</p>
              </div>
            )}
          </li>
        ))}

        {running && (
          <li className="agent-loop-turn running">
            <div className="agent-loop-turn-head">
              <span className="idx pulse">··</span>
              <strong>MCP tools/call · 执行中</strong>
            </div>
          </li>
        )}
      </ol>
    </div>
  );
}

function ToolTraceRow({ tool }: { tool: AgentToolTrace }) {
  const [open, setOpen] = useState(false);
  let argsPreview = tool.args;
  try {
    argsPreview = JSON.stringify(JSON.parse(tool.args), null, 0).slice(0, 80);
  } catch {
    /* keep raw */
  }

  return (
    <div className={`agent-tool-trace${tool.ok === false ? " fail" : tool.ok ? " ok" : ""}`}>
      <button type="button" className="agent-tool-trace-head" onClick={() => setOpen((o) => !o)}>
        <code>{tool.name}</code>
        <span className="args">{argsPreview}</span>
        {tool.ms != null && <em>{tool.ms}ms</em>}
        <span className="chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && tool.result != null && (
        <pre className="agent-tool-trace-json">{JSON.stringify(tool.result, null, 2)}</pre>
      )}
    </div>
  );
}
