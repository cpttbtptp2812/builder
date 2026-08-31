import { useCallback, useRef, useState } from "react";
import { MCP_TOOLS, getMcpTool, validateParams, type McpTool } from "../../lib/mcpBridgeLab";
import {
  MCP_SCENARIOS,
  mcpServer,
  nextRpcId,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type McpTraceSpan,
} from "../../lib/mcpServer";
import { mkTech, resetTechSeq, type TechEvent } from "../../lib/techLog";
import { TechEventLog } from "../tech/TechEventLog";

/** MCP Bridge — 进程内 Server · 真实 fetch / 知识库 / DOM snapshot */
export function McpBridgeDemo() {
  const previewRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [scenarioId, setScenarioId] = useState(MCP_SCENARIOS[0]!.id);
  const [discovered, setDiscovered] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [paramsJson, setParamsJson] = useState(() =>
    JSON.stringify(MCP_SCENARIOS[0]!.params, null, 2),
  );
  const [validation, setValidation] = useState<{ ok: boolean; errors?: string[] } | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [trace, setTrace] = useState<McpTraceSpan[]>([]);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<TechEvent[]>([]);
  const [lastRequest, setLastRequest] = useState<JsonRpcRequest | null>(null);
  const [lastResponse, setLastResponse] = useState<JsonRpcResponse | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const scenario = MCP_SCENARIOS.find((s) => s.id === scenarioId) ?? MCP_SCENARIOS[0]!;
  const tool = selectedTool ? getMcpTool(selectedTool) : null;

  const pushEvent = useCallback((api: string, detail: string, kind: TechEvent["kind"] = "io") => {
    setEvents((prev) => [...prev, mkTech(api, detail, kind)]);
  }, []);

  function resetState(nextParams?: Record<string, unknown>) {
    setDiscovered(false);
    setSelectedTool(null);
    setParamsJson(JSON.stringify(nextParams ?? scenario.params, null, 2));
    setValidation(null);
    setResult(null);
    setTrace([]);
    setLastRequest(null);
    setLastResponse(null);
    resetTechSeq();
    setEvents([]);
  }

  function pickScenario(id: string) {
    const s = MCP_SCENARIOS.find((x) => x.id === id);
    if (!s) return;
    setScenarioId(id);
    resetState({ ...s.params });
  }

  async function rpc(method: string, params?: Record<string, unknown>) {
    const req: JsonRpcRequest = { jsonrpc: "2.0", id: nextRpcId(), method, params };
    setLastRequest(req);
    const t0 = performance.now();
    const res = await mcpServer.handleRequest(req, { snapshotRoot: previewRef.current });
    const ms = Math.round(performance.now() - t0);
    setLastResponse(res);
    return { req, res, ms };
  }

  async function discoverAndRun() {
    setRunning(true);
    resetTechSeq();
    setEvents([]);
    setTrace([]);
    setResult(null);
    setValidation(null);

    pushEvent("McpInProcessServer", "进程内 MCP Server · 非 setTimeout mock", "stage");

    const listT0 = performance.now();
    const { res: listRes, ms: listMs } = await rpc("tools/list");
    const listOk = !listRes.error;
    setTrace([{ method: "tools/list", label: `发现 ${MCP_TOOLS.length} 个工具`, ms: listMs, status: listOk ? "ok" : "fail" }]);
    pushEvent("tools/list", listOk ? `${MCP_TOOLS.length} tools · ${listMs}ms` : String(listRes.error?.message), listOk ? "ok" : "fail");

    if (!listOk) {
      setRunning(false);
      return;
    }
    setDiscovered(true);

    setSelectedTool(scenario.tool);
    setParamsJson(JSON.stringify(scenario.params, null, 2));
    const t = getMcpTool(scenario.tool)!;
    const parsed = scenario.params as Record<string, unknown>;
    const v = validateParams(t, parsed);
    setValidation(v.ok ? { ok: true } : { ok: false, errors: v.errors });

    const schemaMs = Math.round(performance.now() - listT0 - listMs);
    setTrace((prev) => [
      ...prev,
      {
        method: "schema/validate",
        label: v.ok ? `${scenario.tool} 校验通过` : "Schema 校验失败",
        ms: schemaMs,
        status: v.ok ? "ok" : "fail",
      },
    ]);

    if (!v.ok) {
      setRunning(false);
      return;
    }

    await executeCall(scenario.tool, parsed, true);
    setRunning(false);
  }

  async function executeCall(name: string, args: Record<string, unknown>, fromPipeline = false) {
    if (!fromPipeline) setRunning(true);

    const { res, ms } = await rpc("tools/call", { name, arguments: args });
    const structured = (res.result as { structuredContent?: unknown; isError?: boolean } | undefined);
    const payload = structured?.structuredContent ?? res.error ?? res.result;
    const failed = Boolean(res.error || structured?.isError);

    setResult(payload);
    setTrace((prev) => [
      ...prev.filter((s) => s.method !== "tools/call"),
      {
        method: "tools/call",
        label: `${name}${failed ? " · error" : ""}`,
        ms,
        status: failed ? "fail" : "ok",
      },
    ]);
    pushEvent("tools/call", `${name} · ${ms}ms`, failed ? "fail" : "ok");

    if (name === "browser_navigate" && typeof args.url === "string") {
      setIframeUrl(args.url);
      pushEvent("iframe.src", args.url, "stage");
    }

    if (!fromPipeline) setRunning(false);
  }

  function selectTool(name: string, params?: Record<string, unknown>) {
    const t = getMcpTool(name);
    if (!t) return;
    setSelectedTool(name);
    const nextParams = params ?? (name === scenario.tool ? { ...scenario.params } : {});
    setParamsJson(JSON.stringify(nextParams, null, 2));
    setValidation(null);
    setResult(null);
    pushEvent("tools/select", name, "stage");
  }

  async function runManualCall() {
    if (!selectedTool) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(paramsJson) as Record<string, unknown>;
    } catch {
      setValidation({ ok: false, errors: ["JSON 格式错误"] });
      return;
    }
    const t = getMcpTool(selectedTool)!;
    const v = validateParams(t, parsed);
    setValidation(v.ok ? { ok: true } : { ok: false, errors: v.errors });
    if (!v.ok) return;
    await executeCall(selectedTool, parsed);
  }

  function onToolClick(t: McpTool) {
    if (!discovered) return;
    selectTool(
      t.name,
      t.name === scenario.tool ? { ...scenario.params } : t.name === "browser_navigate" ? { url: iframeUrl ?? `${window.location.origin}/` } : {},
    );
  }

  return (
    <div className="mcp-bridge-demo">
      <div className="mcp-bridge-toolbar">
        <div className="mcp-bridge-scenarios">
          {MCP_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={scenarioId === s.id ? "on" : ""}
              onClick={() => pickScenario(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mcp-bridge-query">
          <span>Agent 意图</span>
          「{scenario.query}」→ <code>{scenario.tool}</code>
        </p>
        <button type="button" className="mcp-bridge-run" onClick={discoverAndRun} disabled={running}>
          {running ? "执行中…" : "▶ tools/list → call"}
        </button>
      </div>

      <p className="mcp-bridge-real-note">
        进程内 MCP Server：<strong>http_probe</strong> 真实 fetch · <strong>knowledge_search</strong> 检索作品集知识库 ·{" "}
        <strong>browser_snapshot</strong> 遍历预览区 DOM · <strong>workflow_run</strong> 读取 scenarios 数据
      </p>

      <div className="mcp-bridge-grid">
        <section className="mcp-bridge-panel mcp-bridge-tools">
          <header>
            <strong>MCP Server</strong>
            <span>{discovered ? `${MCP_TOOLS.length} tools` : "未发现"}</span>
          </header>
          <ul>
            {MCP_TOOLS.map((t) => (
              <li key={t.name}>
                <button
                  type="button"
                  className={`mcp-tool-row${selectedTool === t.name ? " active" : ""}${!discovered ? " dim" : ""}`}
                  onClick={() => onToolClick(t)}
                  disabled={!discovered}
                >
                  <code>{t.name}</code>
                  <span>{t.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="mcp-bridge-panel mcp-bridge-call">
          <header>
            <strong>tools/call</strong>
            {tool && <code>{tool.name}</code>}
          </header>

          <div ref={previewRef} className="mcp-preview-surface">
            <div className="mcp-preview-chrome">
              <span className="secret-code-dot red" />
              <span className="secret-code-dot yellow" />
              <span className="secret-code-dot green" />
              <em>browser preview</em>
            </div>
            {iframeUrl ? (
              <iframe ref={iframeRef} title="MCP preview" src={iframeUrl} className="mcp-preview-iframe" />
            ) : (
              <div className="mcp-preview-placeholder">
                <p>browser_navigate 会在这里加载真实 iframe</p>
                <p>browser_snapshot 会遍历此区域 DOM</p>
              </div>
            )}
          </div>

          {!selectedTool ? (
            <p className="mcp-bridge-idle">先执行 tools/list，或点左侧工具</p>
          ) : (
            <>
              <label className="mcp-bridge-params-label">
                arguments
                <textarea
                  value={paramsJson}
                  onChange={(e) => {
                    setParamsJson(e.target.value);
                    setValidation(null);
                    setResult(null);
                  }}
                  rows={4}
                  spellCheck={false}
                />
              </label>
              {validation && (
                <p className={`mcp-bridge-valid${validation.ok ? " ok" : " fail"}`}>
                  {validation.ok ? "✓ Schema 校验通过" : `✗ ${validation.errors?.join(" · ")}`}
                </p>
              )}
              {result != null && (
                <div className="mcp-bridge-result">
                  <span>structuredContent</span>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}
              <button type="button" className="mcp-bridge-call-btn" onClick={runManualCall} disabled={running}>
                单独调用
              </button>
            </>
          )}
        </section>

        <section className="mcp-bridge-panel mcp-bridge-trace">
          <header>
            <strong>Trace</strong>
            <span>真实耗时 ms</span>
          </header>
          {trace.length === 0 ? (
            <p className="mcp-bridge-idle">每次 RPC 记录真实 latency</p>
          ) : (
            <ol className="mcp-trace-list">
              {trace.map((step) => (
                <li key={step.method + step.label} className={`mcp-trace-step ${step.status}`}>
                  <div className="mcp-trace-head">
                    <code>{step.method}</code>
                    <em>{step.ms}ms</em>
                  </div>
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
          )}
          <TechEventLog events={events} />
        </section>
      </div>

      <div className="mcp-wire-split">
        <div className="mcp-wire-col">
          <header>JSON-RPC Request</header>
          <pre>{lastRequest ? JSON.stringify(lastRequest, null, 2) : "// 等待 tools/list 或 tools/call…"}</pre>
        </div>
        <div className="mcp-wire-col">
          <header>JSON-RPC Response</header>
          <pre>{lastResponse ? JSON.stringify(lastResponse, null, 2) : "// …"}</pre>
        </div>
      </div>
    </div>
  );
}
