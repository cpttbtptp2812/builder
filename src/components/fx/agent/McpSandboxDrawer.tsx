import React, { useState } from "react";
import { MCP_TOOLS, executeSandboxToolCall, type McpTool } from "../../../lib/mcpBridgeLab";

export type McpSandboxDrawerProps = {
  open: boolean;
  onClose: () => void;
  initialToolName?: string;
};

/**
 * 资深 AI Agent 全栈核心组件 — MCP 工具沙箱与协议控制台
 * 支持动态切换 MCP 工具、查看 Schema、编辑 JSON 参数并实时沙箱调试执行
 */
export function McpSandboxDrawer({ open, onClose, initialToolName }: McpSandboxDrawerProps) {
  const [selectedTool, setSelectedTool] = useState<McpTool>(() => {
    return (
      MCP_TOOLS.find((t) => t.name === initialToolName) ||
      MCP_TOOLS.find((t) => t.name === "ledger_reconcile") ||
      MCP_TOOLS[0]
    );
  });

  const getInitialArgs = (tool: McpTool): string => {
    if (tool.name === "ledger_reconcile") {
      return JSON.stringify(
        {
          aggregationKey: "department",
          sumField: "amount",
          policyThreshold: 10000,
        },
        null,
        2,
      );
    }
    if (tool.name === "dataset_validate") {
      return JSON.stringify(
        {
          datasetId: "ds_reimbursement_2026_oct",
          requiredColumns: "id,dept,amount,tax_inclusive",
          strictNullCheck: true,
        },
        null,
        2,
      );
    }
    if (tool.name === "financial_settle_commit") {
      return JSON.stringify(
        {
          ticketId: "tkt-722cqq",
          operatorSign: "ed25519_sign_89a0b12e_approved",
          idempotencyKey: "idem_commit_9921_fin",
        },
        null,
        2,
      );
    }
    if (tool.name === "http_probe") {
      return JSON.stringify(
        {
          url: "https://api.internal.corp/health",
          method: "GET",
        },
        null,
        2,
      );
    }
    // 默认空对象
    const def: Record<string, unknown> = {};
    for (const key of tool.inputSchema.required || []) {
      def[key] = "sample_value";
    }
    return JSON.stringify(def, null, 2);
  };

  const [jsonInput, setJsonInput] = useState<string>(() => getInitialArgs(selectedTool));
  const [running, setRunning] = useState(false);
  const [execResult, setExecResult] = useState<{
    rpcResponse: unknown;
    durationMs: number;
    status: "success" | "error";
  } | null>(null);

  if (!open) return null;

  const handleSelectTool = (t: McpTool) => {
    setSelectedTool(t);
    setJsonInput(getInitialArgs(t));
    setExecResult(null);
  };

  const handleRun = async () => {
    let parsed: Record<string, unknown> = {};
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setExecResult({
        rpcResponse: {
          jsonrpc: "2.0",
          error: { code: -32700, message: "Parse error: 入参必须是合法的 JSON 格式" },
        },
        durationMs: 0,
        status: "error",
      });
      return;
    }

    setRunning(true);
    try {
      const res = await executeSandboxToolCall(selectedTool.name, parsed);
      setExecResult(res);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="oa-modal-overlay" onClick={onClose}>
      <div className="oa-mcp-sandbox-drawer" onClick={(e) => e.stopPropagation()}>
        {/* 抽屉头部 */}
        <div className="oa-sandbox-head">
          <div className="oa-sandbox-head-title">
            <span className="oa-sandbox-logo">🛠️</span>
            <div>
              <h3>MCP 协议工具沙箱调试控制台</h3>
              <p>Model Context Protocol · 进程内 JSON-RPC 2.0 沙箱与参数校验</p>
            </div>
          </div>
          <button type="button" className="oa-sandbox-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* 抽屉双栏主体 */}
        <div className="oa-sandbox-body">
          {/* 左栏：MCP 注册工具列表 */}
          <div className="oa-sandbox-tool-list">
            <div className="oa-sandbox-panel-title">
              <span>注册工具 (Registry: {MCP_TOOLS.length})</span>
            </div>
            <div className="oa-sandbox-tool-scroll">
              {MCP_TOOLS.map((t) => (
                <div
                  key={t.name}
                  className={`oa-sandbox-tool-item ${selectedTool.name === t.name ? "active" : ""}`}
                  onClick={() => handleSelectTool(t)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="oa-sandbox-tool-item-head">
                    <span className="oa-sandbox-tool-tag">MCP</span>
                    <strong className="oa-sandbox-tool-name">{t.labelZh}</strong>
                  </div>
                  <span className="oa-sandbox-tool-raw">{t.name}</span>
                  <p className="oa-sandbox-tool-desc">{t.descriptionZh}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 右栏：参数配置与调试执行 */}
          <div className="oa-sandbox-exec-panel">
            <div className="oa-sandbox-panel-title">
              <span className="oa-sandbox-cur-tool">
                当前工具: <code>mcp::{selectedTool.name}</code> ({selectedTool.labelZh})
              </span>
              <span className="oa-sandbox-rpc-spec">JSON-RPC 2.0 / tools/call</span>
            </div>

            {/* Input Schema 提示 */}
            <div className="oa-sandbox-schema-box">
              <div className="oa-sandbox-schema-label">入参约束 (Schema Properties):</div>
              <div className="oa-sandbox-schema-chips">
                {Object.entries(selectedTool.inputSchema.properties || {}).map(([key, prop]) => {
                  const isReq = (selectedTool.inputSchema.required || []).includes(key);
                  return (
                    <span key={key} className={`oa-sandbox-schema-chip ${isReq ? "req" : ""}`}>
                      <code>{key}</code>: <em>{prop.type}</em>
                      {isReq && <b title="必填">*</b>}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* JSON 请求参数输入区 */}
            <div className="oa-sandbox-code-section">
              <div className="oa-sandbox-code-label">调用参数 (arguments JSON):</div>
              <textarea
                className="oa-sandbox-textarea"
                rows={6}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder="请输入符合 JSON Schema 的参数对象..."
              />
            </div>

            {/* 触发操作按钮栏 */}
            <div className="oa-sandbox-action-bar">
              <button
                type="button"
                className="oa-sandbox-btn-reset"
                onClick={() => setJsonInput(getInitialArgs(selectedTool))}
              >
                重置示例参数
              </button>
              <button
                type="button"
                className={`oa-sandbox-btn-run ${running ? "running" : ""}`}
                disabled={running}
                onClick={handleRun}
              >
                {running ? "正在沙箱调用..." : "▶ 发起 MCP 沙箱调用"}
              </button>
            </div>

            {/* 响应报文区 */}
            {execResult && (
              <div className={`oa-sandbox-response ${execResult.status}`}>
                <div className="oa-sandbox-response-head">
                  <span className="oa-sandbox-status-tag">
                    {execResult.status === "success" ? "✓ 200 OK" : "✕ RPC Error"}
                  </span>
                  <span className="oa-sandbox-latency">耗时: {execResult.durationMs}ms</span>
                </div>
                <pre className="oa-sandbox-response-code">
                  <code>{JSON.stringify(execResult.rpcResponse, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
