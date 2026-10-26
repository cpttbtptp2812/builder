import React, { useState } from "react";
import type { MultiAgentStep } from "../../../lib/multiAgentRuntime";

export type MultiAgentWorkflowCardProps = {
  steps?: MultiAgentStep[];
  className?: string;
  onOpenMcpTool?: (toolName: string) => void;
};

/**
 * 资深 AI Agent 全栈核心组件 — 多智能体协同流水线 (Multi-Agent DAG Ribbon)
 * 具备极简流线型收折态与丝滑展开的执行 DAG 拓扑
 */
export function MultiAgentWorkflowCard({
  steps,
  className = "",
  onOpenMcpTool,
}: MultiAgentWorkflowCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"dag" | "payload">("dag");
  const [selectedAgent, setSelectedAgent] = useState<"planner" | "executor" | "reviewer">("executor");

  const defaultPipeline = [
    {
      role: "planner" as const,
      name: "规划智能体",
      englishRole: "Planner",
      tag: "DAG 拓扑编排",
      color: "#6366f1",
      icon: "🧠",
      duration: "140ms",
      summary: "将自然语言目标解构为有向无环图，建立工具依赖前置条件",
      details: [
        "意图识别: 智能报销核算与台账结转",
        "DAG 拓扑: 校验(dataset_validate) ➔ 聚合(ledger_reconcile) ➔ 审批(HITL)",
        "约束声明: 强依赖确定性计算，禁止大模型自行累加浮点数",
      ],
      payload: {
        agent: "Planner",
        dag: {
          task: "ledger_reconcile_and_settle",
          nodes: [
            { id: "step_1", tool: "mcp::dataset_validate", mode: "precheck" },
            { id: "step_2", tool: "mcp::ledger_reconcile", mode: "deterministic_sum" },
            { id: "step_3", tool: "mcp::financial_settle_commit", mode: "hitl_gated" },
          ],
        },
      },
    },
    {
      role: "executor" as const,
      name: "执行智能体",
      englishRole: "Executor",
      tag: "MCP 协议调度",
      color: "#10b981",
      icon: "⚡",
      duration: "300ms",
      summary: "通过进程内 JSON-RPC 2.0 调度 MCP 标准工具，执行毫秒级确定性计算",
      mcpTools: ["dataset_validate", "ledger_reconcile"],
      details: [
        "调度 mcp::dataset_validate · 8 条数据校验通过，空值率 0.0%",
        "调度 mcp::ledger_reconcile · 精确汇总含税总额 ¥8,090.00",
        "ReAct 状态机: 0 次重试，一次性通过 Schema 校验",
      ],
      payload: {
        agent: "Executor",
        mcpExecuted: [
          { tool: "dataset_validate", rpcStatus: 200, latency: "120ms", ok: true },
          { tool: "ledger_reconcile", rpcStatus: 200, latency: "180ms", ok: true, sum: 8090.0 },
        ],
      },
    },
    {
      role: "reviewer" as const,
      name: "风控审查智能体",
      englishRole: "Reviewer",
      tag: "零信任安全门禁",
      color: "#f59e0b",
      icon: "🛡️",
      duration: "110ms",
      summary: "交叉比对文本与计算结果，检测涉及资金写入行为，强制挂起审批",
      details: [
        "幻觉核查: 助理答复金额 ¥8,090.00 与 MCP 工具计算绝对吻合 (Diff 0.00)",
        "写操作拦截: 检测到写入动作为高风险写操作，自主落库权限已阻断",
        "挂起凭证: 生成工单 #tkt-722cqq，移交人在回路 (HITL) 签名",
      ],
      payload: {
        agent: "Reviewer",
        consistency: "100% MATCH",
        riskLevel: "CRITICAL_MUTATE",
        gateResult: "BLOCKED_PENDING_HITL",
      },
    },
  ];

  const currentAgent = defaultPipeline.find((a) => a.role === selectedAgent) || defaultPipeline[1];

  return (
    <div className={`oa-ma-streamline-wrap ${expanded ? "is-expanded" : ""} ${className}`}>
      {/* 极简流线型收折 Ribbon（高度仅 36px，流畅现代） */}
      <div
        className="oa-ma-streamline-ribbon"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        title="点击展开多智能体协同流水线执行详情"
      >
        <div className="oa-ma-ribbon-left">
          <span className="oa-ma-ribbon-badge">Multi-Agent</span>
          <div className="oa-ma-flow-nodes">
            <span className="oa-ma-flow-node is-done">
              <span className="oa-ma-node-dot" />
              <span>🧠 Planner</span>
            </span>
            <span className="oa-ma-flow-line" />
            <span className="oa-ma-flow-node is-active">
              <span className="oa-ma-node-dot" />
              <span>⚡ Executor</span>
            </span>
            <span className="oa-ma-flow-line" />
            <span className="oa-ma-flow-node is-done">
              <span className="oa-ma-node-dot" />
              <span>🛡️ Reviewer</span>
            </span>
          </div>
        </div>

        <div className="oa-ma-ribbon-right">
          <span className="oa-ma-ribbon-ms">550ms · 协同完成</span>
          <span className="oa-ma-ribbon-chevron">{expanded ? "收起 ▴" : "展开拓扑 ▾"}</span>
        </div>
      </div>

      {/* 展开内容：带平滑渐显动画 */}
      {expanded && (
        <div className="oa-ma-expanded-panel">
          <div className="oa-ma-tabs-bar">
            <div className="oa-ma-agent-pills">
              {defaultPipeline.map((agent) => (
                <button
                  key={agent.role}
                  type="button"
                  className={`oa-ma-agent-pill ${selectedAgent === agent.role ? "active" : ""}`}
                  onClick={() => setSelectedAgent(agent.role)}
                >
                  <span>{agent.icon}</span>
                  <strong>{agent.name}</strong>
                  <span className="oa-ma-pill-ms">{agent.duration}</span>
                </button>
              ))}
            </div>

            <div className="oa-ma-mode-switch">
              <button
                type="button"
                className={`oa-ma-switch-btn ${activeTab === "dag" ? "active" : ""}`}
                onClick={() => setActiveTab("dag")}
              >
                分工细则
              </button>
              <button
                type="button"
                className={`oa-ma-switch-btn ${activeTab === "payload" ? "active" : ""}`}
                onClick={() => setActiveTab("payload")}
              >
                交接报文 JSON
              </button>
            </div>
          </div>

          <div className="oa-ma-tab-body">
            {activeTab === "dag" ? (
              <div className="oa-ma-dag-detail">
                <div className="oa-ma-dag-summary-bar">
                  <span className="oa-ma-dag-tag" style={{ color: currentAgent.color }}>
                    {currentAgent.tag}
                  </span>
                  <span className="oa-ma-dag-summary-text">{currentAgent.summary}</span>
                </div>

                <ul className="oa-ma-dag-steps">
                  {currentAgent.details.map((text, idx) => (
                    <li key={idx} className="oa-ma-dag-step-item">
                      <span className="oa-ma-dag-step-bullet" style={{ backgroundColor: currentAgent.color }} />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>

                {/* 如果是 Executor，提供直达真实 MCP 沙箱重放的按钮 */}
                {currentAgent.mcpTools && onOpenMcpTool && (
                  <div className="oa-ma-mcp-shortcut-row">
                    <span className="oa-ma-mcp-shortcut-label">关联 MCP 工具:</span>
                    {currentAgent.mcpTools.map((tName) => (
                      <button
                        key={tName}
                        type="button"
                        className="oa-ma-mcp-shortcut-btn"
                        onClick={() => onOpenMcpTool(tName)}
                        title={`在 MCP 协议沙箱中调试调用 ${tName}`}
                      >
                        <span>⚙️ 调试 mcp::{tName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="oa-ma-payload-view">
                <pre className="oa-ma-payload-json">
                  <code>{JSON.stringify(currentAgent.payload, null, 2)}</code>
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
