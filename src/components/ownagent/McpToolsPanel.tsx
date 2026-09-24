import { useCallback, useEffect, useMemo, useState } from "react";
import { MCP_TOOLS } from "../../lib/mcpBridgeLab";
import { loadEnabledMcpTools } from "../fx/agent/AgentMcpRegistry";
import { MCP_SCENARIOS, mcpServer, nextRpcId } from "../../lib/mcpServer";

type TestState = {
  running: boolean;
  ms?: number;
  result?: string;
  error?: boolean;
};

/** MCP 工具工作台 — 注册 / 沙箱调用 / 场景回放 */
export function McpToolsPanel({ embedded = false }: { embedded?: boolean }) {
  const [enabled, setEnabled] = useState<string[]>(() => loadEnabledMcpTools());
  const [selected, setSelected] = useState(MCP_TOOLS[0]?.name ?? "");
  const [paramsJson, setParamsJson] = useState("{}");
  const [test, setTest] = useState<TestState>({ running: false });

  const tool = useMemo(() => MCP_TOOLS.find((t) => t.name === selected), [selected]);

  useEffect(() => {
    localStorage.setItem("uniagent-mcp-enabled", JSON.stringify(enabled));
    window.dispatchEvent(new CustomEvent("ownagent:config-updated"));
  }, [enabled]);

  const defaultParams = useCallback((name: string) => {
    const scenario = MCP_SCENARIOS.find((s) => s.tool === name);
    if (scenario) return JSON.stringify(scenario.params, null, 2);
    const props = MCP_TOOLS.find((t) => t.name === name)?.inputSchema.properties ?? {};
    const sample: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(props)) {
      if (v.enum?.length) sample[k] = v.enum[0];
      else if (v.type === "number") sample[k] = 3;
      else if (v.type === "boolean") sample[k] = false;
      else sample[k] = v.description?.slice(0, 12) ?? "";
    }
    return JSON.stringify(sample, null, 2);
  }, []);

  useEffect(() => {
    setParamsJson(defaultParams(selected));
  }, [selected, defaultParams]);

  function toggleTool(name: string) {
    setEnabled((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  }

  async function runTest() {
    setTest({ running: true });
    const started = performance.now();
    try {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(paramsJson) as Record<string, unknown>;
      } catch {
        throw new Error("参数 JSON 格式错误");
      }
      const res = await mcpServer.handleRequest({
        jsonrpc: "2.0",
        id: nextRpcId(),
        method: "tools/call",
        params: { name: selected, arguments: args },
      });
      const ms = Math.round(performance.now() - started);
      if (res.error) {
        setTest({ running: false, ms, result: res.error.message, error: true });
        return;
      }
      const text =
        typeof res.result === "object" && res.result && "content" in res.result
          ? JSON.stringify((res.result as { content: unknown }).content, null, 2)
          : JSON.stringify(res.result, null, 2);
      setTest({ running: false, ms, result: text, error: false });
    } catch (err) {
      setTest({
        running: false,
        ms: Math.round(performance.now() - started),
        result: err instanceof Error ? err.message : "调用失败",
        error: true,
      });
    }
  }

  return (
    <div className={`oa-ui${embedded ? "" : " oa-page"} oa-mcp-panel${embedded ? " embedded" : ""}`}>
      {!embedded && (
        <header className="oa-panel-head">
          <div>
            <h1>工具沙箱</h1>
            <p>选择工具、填写参数、沙箱调用验证返回结果。</p>
          </div>
          <span className="oa-mcp-enabled-badge">已启用 {enabled.length}/{MCP_TOOLS.length}</span>
        </header>
      )}

      <div className="oa-mcp-layout">
        <aside className="oa-mcp-list">
          {MCP_TOOLS.map((t) => (
            <button
              key={t.name}
              type="button"
              className={`oa-mcp-item${selected === t.name ? " on" : ""}${enabled.includes(t.name) ? "" : " off"}`}
              onClick={() => setSelected(t.name)}
            >
              <span className="oa-mcp-item-head">
                <strong>{t.labelZh}</strong>
                <code>{t.name}</code>
              </span>
              <span className="oa-mcp-item-desc">{t.descriptionZh}</span>
              <label className="oa-mcp-toggle" onClick={(e) => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={enabled.includes(t.name)}
                  onChange={() => toggleTool(t.name)}
                />
                对话中可用
              </label>
            </button>
          ))}
        </aside>

        <div className="oa-mcp-sandbox">
          {tool && (
            <>
              <header>
                <h2>{tool.labelZh}</h2>
                <p>{tool.descriptionZh}</p>
              </header>

              <div className="oa-mcp-scenarios">
                <span>快捷场景</span>
                {MCP_SCENARIOS.filter((s) => s.tool === tool.name).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="oa-mcp-scenario"
                    onClick={() => setParamsJson(JSON.stringify(s.params, null, 2))}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <label className="oa-mcp-json-label">
                参数 JSON
                <textarea
                  rows={10}
                  value={paramsJson}
                  onChange={(e) => setParamsJson(e.target.value)}
                  spellCheck={false}
                />
              </label>

              <div className="oa-mcp-actions">
                <button type="button" className="oa-panel-primary" disabled={test.running} onClick={() => void runTest()}>
                  {test.running ? "调用中…" : "沙箱调用"}
                </button>
                {test.ms != null && (
                  <span className={`oa-mcp-latency${test.error ? " err" : ""}`}>
                    {test.error ? "失败" : "成功"} · {test.ms}ms
                  </span>
                )}
              </div>

              {test.result && (
                <pre className={`oa-mcp-output${test.error ? " err" : ""}`}>{test.result}</pre>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
