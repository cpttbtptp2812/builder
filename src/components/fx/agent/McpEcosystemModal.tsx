import { useState } from "react";
import { createPortal } from "react-dom";
import { MCP_TOOLS, type McpTool } from "../../../lib/mcpBridgeLab";
import { mcpServer, type JsonRpcRequest, type JsonRpcResponse } from "../../../lib/mcpServer";

export function McpEcosystemModal({ onClose }: { onClose: () => void }) {
  const [selectedToolName, setSelectedToolName] = useState<string>(MCP_TOOLS[0]?.name || "http_probe");
  const [paramInputs, setParamInputs] = useState<Record<string, any>>({
    url: "https://httpbin.org/status/200",
    method: "GET",
  });
  const [running, setRunning] = useState(false);
  const [rpcReq, setRpcReq] = useState<JsonRpcRequest | null>(null);
  const [rpcRes, setRpcRes] = useState<JsonRpcResponse | null>(null);

  const selectedTool: McpTool = MCP_TOOLS.find((t) => t.name === selectedToolName) || MCP_TOOLS[0]!;

  const handleSelectTool = (t: McpTool) => {
    setSelectedToolName(t.name);
    // 预填默认参数
    const initial: Record<string, any> = {};
    if (t.inputSchema?.properties) {
      Object.entries(t.inputSchema.properties).forEach(([k, prop]) => {
        if (prop.type === "string") {
          initial[k] = prop.enum ? prop.enum[0] : k === "url" ? "https://httpbin.org/status/200" : "测试查询内容";
        } else if (prop.type === "number") {
          initial[k] = 3;
        } else if (prop.type === "boolean") {
          initial[k] = false;
        }
      });
    }
    setParamInputs(initial);
    setRpcReq(null);
    setRpcRes(null);
  };

  const handleExecute = async () => {
    setRunning(true);
    const req: JsonRpcRequest = {
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: {
        name: selectedTool.name,
        arguments: paramInputs,
      },
    };
    setRpcReq(req);
    try {
      const res = await mcpServer.handleJsonRpc(req);
      setRpcRes(res);
    } catch (err: any) {
      setRpcRes({
        jsonrpc: "2.0",
        id: req.id,
        error: { code: -32000, message: err?.message || String(err) },
      });
    } finally {
      setRunning(false);
    }
  };

  return createPortal(
    <div className="oa-xray-backdrop" onClick={onClose}>
      <aside
        className="oa-xray-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="MCP 协议生态工作台"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="oa-xray-header">
          <div className="oa-xray-title-box">
            <span className="oa-xray-beacon" style={{ background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
            <div>
              <div className="oa-xray-title-row">
                <h3 className="oa-xray-title">MODEL CONTEXT PROTOCOL (MCP) WORKSPACE</h3>
                <span className="oa-xray-badge-live" style={{ color: "#059669", background: "rgba(16,185,129,0.1)", borderColor: "rgba(16,185,129,0.3)" }}>
                  JSON-RPC 2.0
                </span>
              </div>
              <p className="oa-xray-subtitle">Anthropic 开放协议标准 · 标准工具模式 · 动态参数验证与沙箱执行</p>
            </div>
          </div>
          <button type="button" className="oa-xray-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </header>

        {/* Top Active Server Info */}
        <div className="oa-xray-kpis" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">MCP PROTOCOL</span>
            <span className="oa-xray-kpi-val highlight">v2024-11-05</span>
            <span className="oa-xray-kpi-sub">Transport: In-Process IPC / SSE</span>
          </div>
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">REGISTERED TOOLS</span>
            <span className="oa-xray-kpi-val success">{MCP_TOOLS.length} 个活跃工具</span>
            <span className="oa-xray-kpi-sub">Schema 严格校验 (JCS/Draft-07)</span>
          </div>
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">SECURITY CONSTRAINTS</span>
            <span className="oa-xray-kpi-val">Sandboxed</span>
            <span className="oa-xray-kpi-sub">隔离运行 · 权限受控</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="oa-xray-body" style={{ gridTemplateColumns: "240px 1fr" }}>
          {/* Tool List Column */}
          <div className="oa-xray-timeline-section" style={{ borderRight: "1px solid #e2e8f0" }}>
            <div className="oa-xray-section-head">
              <span className="oa-xray-section-title">TOOL REGISTRY</span>
              <span className="oa-xray-section-meta">{MCP_TOOLS.length} Tools</span>
            </div>
            <div style={{ padding: "0.5rem" }}>
              {MCP_TOOLS.map((t) => {
                const isSelected = t.name === selectedTool.name;
                return (
                  <div
                    key={t.name}
                    className={`oa-xray-span-row${isSelected ? " is-selected" : ""}`}
                    style={{ gridTemplateColumns: "1fr", padding: "0.6rem 0.8rem", marginBottom: "0.35rem" }}
                    onClick={() => handleSelectTool(t)}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                      <strong style={{ fontSize: "12px", color: "#0f172a" }}>{t.labelZh}</strong>
                      <code style={{ fontSize: "10px", color: "#6366f1" }}>{t.name}</code>
                    </div>
                    <span style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.descriptionZh}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Playground & Schema */}
          <div className="oa-xray-detail-section" style={{ padding: "1.25rem", overflowY: "auto" }}>
            <div className="oa-xray-inspector-card" style={{ marginBottom: "1rem" }}>
              <div className="oa-xray-card-head">
                <div className="oa-xray-card-info">
                  <strong style={{ fontSize: "15px" }}>{selectedTool.labelZh} ({selectedTool.name})</strong>
                  <span>{selectedTool.descriptionZh} · {selectedTool.description}</span>
                </div>
                <button
                  type="button"
                  className="oa-xray-export-btn"
                  style={{ background: "#4f46e5" }}
                  disabled={running}
                  onClick={handleExecute}
                >
                  {running ? "⚡ 正在调用..." : "🚀 触发 MCP 调用"}
                </button>
              </div>

              {/* Dynamic Parameter Form */}
              <div style={{ margin: "0.85rem 0" }}>
                <span className="oa-xray-field-name">输入参数 (Arguments Schema):</span>
                {Object.keys(selectedTool.inputSchema?.properties || {}).length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#94a3b8", margin: "0.5rem 0" }}>此工具无需入参</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginTop: "0.5rem" }}>
                    {Object.entries(selectedTool.inputSchema.properties).map(([propKey, propVal]) => (
                      <div key={propKey} style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                          <span style={{ fontWeight: 600, color: "#334155" }}>
                            {propKey}
                            {selectedTool.inputSchema.required?.includes(propKey) && (
                              <span style={{ color: "#ef4444", marginLeft: "2px" }}>*</span>
                            )}
                          </span>
                          <span style={{ color: "#94a3b8" }}>{propVal.description || propVal.type}</span>
                        </div>
                        {propVal.enum ? (
                          <select
                            style={{
                              padding: "0.45rem 0.6rem",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12px",
                            }}
                            value={paramInputs[propKey] ?? propVal.enum[0]}
                            onChange={(e) => setParamInputs({ ...paramInputs, [propKey]: e.target.value })}
                          >
                            {propVal.enum.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={propVal.type === "number" ? "number" : "text"}
                            style={{
                              padding: "0.45rem 0.6rem",
                              borderRadius: "6px",
                              border: "1px solid #cbd5e1",
                              fontSize: "12px",
                            }}
                            value={paramInputs[propKey] ?? ""}
                            onChange={(e) =>
                              setParamInputs({
                                ...paramInputs,
                                [propKey]: propVal.type === "number" ? Number(e.target.value) : e.target.value,
                              })
                            }
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* JSON-RPC Request & Response */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div>
                <span className="oa-xray-field-name">JSON-RPC 2.0 请求包:</span>
                <pre className="oa-xray-json-code" style={{ minHeight: "160px" }}>
                  {rpcReq ? JSON.stringify(rpcReq, null, 2) : "// 点击上方「触发 MCP 调用」查看实际 JSON-RPC 封包"}
                </pre>
              </div>
              <div>
                <span className="oa-xray-field-name">JSON-RPC 2.0 响应包:</span>
                <pre
                  className="oa-xray-json-code"
                  style={{
                    minHeight: "160px",
                    color: rpcRes?.error ? "#f87171" : "#34d399",
                  }}
                >
                  {rpcRes ? JSON.stringify(rpcRes, null, 2) : "// 待响应返回"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}
