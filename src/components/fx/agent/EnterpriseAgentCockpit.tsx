import React, { useState } from "react";
import { MCP_TOOLS } from "../../../lib/mcpBridgeLab";
import { loadCognitiveMemory, getActiveScratchpad } from "../../../lib/agentCognitiveMemory";

export type EnterpriseAgentCockpitProps = {
  className?: string;
  onRunScenario?: (prompt: string) => void;
  onOpenMcpSandbox?: (toolName: string) => void;
};

/**
 * 资深 AI Agent 全栈核心工程控制台 (Enterprise Agent Cockpit)
 * 深度聚焦 Boss 直聘资深 Agent 考核四大支柱：
 * 1. 两阶段 MCP 动态检索与 ReAct 自愈回路
 * 2. 混合检索 RAG (Dense + Sparse BM25 + Cross-Encoder Rerank)
 * 3. 认知记忆系统 (短期工作记忆 Scratchpad + 长期语义记忆)
 * 4. OpenTelemetry (OTel) 全链路追踪与零信任风控
 */
export function EnterpriseAgentCockpit({
  className = "",
  onRunScenario,
  onOpenMcpSandbox,
}: EnterpriseAgentCockpitProps) {
  const [activeTab, setActiveTab] = useState<"mcp_react" | "hybrid_rag" | "memory" | "otel">("mcp_react");
  const [expanded, setExpanded] = useState(false);

  // 记忆数据
  const memoryEntities = loadCognitiveMemory();
  const scratchpad = getActiveScratchpad();

  // 混合检索 RAG 模拟对比数据
  const sampleHybridHits = [
    {
      id: "chunk_881",
      title: "《企业报销合规手册2026》第 24 条",
      text: "单笔超过 5,000 元触发高风险审批；报销明细表头须包含部门、含税金额与验真哈希码，禁止模型自行四舍五入累计...",
      denseScore: 0.892,
      sparseScore: 0.945, // BM25 精准命中第24条
      rerankScore: 0.968,
      rankDelta: "+1",
    },
    {
      id: "chunk_412",
      title: "《财务总账落库双阶段提交规范》",
      text: "智能体严禁自主向正式核心结算库执行写入动作。全部写操作必须通过两阶段提交协议挂起，交由人工电子签名确认...",
      denseScore: 0.915,
      sparseScore: 0.820,
      rerankScore: 0.932,
      rankDelta: "-1",
    },
  ];

  return (
    <div className={`oa-cockpit-container ${expanded ? "is-expanded" : ""} ${className}`}>
      {/* 顶部控制台导航条 */}
      <div className="oa-cockpit-bar">
        <div className="oa-cockpit-left">
          <span className="oa-cockpit-badge">ARCH // 资深全栈工程底座</span>
          <div className="oa-cockpit-tabs">
            <button
              type="button"
              className={`oa-cockpit-tab ${activeTab === "mcp_react" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("mcp_react");
                setExpanded(true);
              }}
            >
              ⚡ 两阶段 MCP & ReAct 自愈
            </button>
            <button
              type="button"
              className={`oa-cockpit-tab ${activeTab === "hybrid_rag" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("hybrid_rag");
                setExpanded(true);
              }}
            >
              📚 Hybrid RAG 混合检索与重排
            </button>
            <button
              type="button"
              className={`oa-cockpit-tab ${activeTab === "memory" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("memory");
                setExpanded(true);
              }}
            >
              🧠 认知记忆与 Scratchpad
            </button>
            <button
              type="button"
              className={`oa-cockpit-tab ${activeTab === "otel" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("otel");
                setExpanded(true);
              }}
            >
              🔬 OTel 全链路追踪
            </button>
          </div>
        </div>

        <div className="oa-cockpit-right">
          <button
            type="button"
            className="oa-cockpit-toggle-btn"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "收起架构看板 ▴" : "展开架构看板 ▾"}
          </button>
        </div>
      </div>

      {/* 展开的深度工程架构详情面板 */}
      {expanded && (
        <div className="oa-cockpit-panel">
          {/* 1. MCP 两阶段检索与 ReAct 自愈 */}
          {activeTab === "mcp_react" && (
            <div className="oa-cockpit-tab-content">
              <div className="oa-cockpit-grid-2">
                <div className="oa-cockpit-box">
                  <div className="oa-cockpit-box-head">
                    <strong>Stage 1 · 两阶段动态工具检索 (Tool Vector Retrieval)</strong>
                    <span className="oa-cockpit-tag-green">避免 Prompt 上下文爆炸</span>
                  </div>
                  <p className="oa-cockpit-desc">
                    全量注册工具库共有 <strong>{MCP_TOOLS.length} 个 MCP 服务</strong>。Agent 通过语义与关键词匹配，仅将 Top-2 最相关工具 Schema 注入上下文，单轮节省约 <strong>1,200+ Tokens (~75%)</strong>，杜绝模型幻觉选错工具。
                  </p>
                  <div className="oa-cockpit-tool-pills">
                    <span className="oa-cockpit-tool-pill active">
                      ✓ mcp::dataset_validate (召回度 96.5%)
                    </span>
                    <span className="oa-cockpit-tool-pill active">
                      ✓ mcp::ledger_reconcile (召回度 94.2%)
                    </span>
                    <span className="oa-cockpit-tool-pill dim">
                      ✕ mcp::browser_navigate (已过滤)
                    </span>
                  </div>
                </div>

                <div className="oa-cockpit-box">
                  <div className="oa-cockpit-box-head">
                    <strong>Stage 2 · ReAct 自愈回路与反思 (Reflection Loop)</strong>
                    <span className="oa-cockpit-tag-indigo">生产级容错设计</span>
                  </div>
                  <div className="oa-cockpit-react-log">
                    <div className="oa-react-log-row fail">
                      <span className="oa-log-badge">轮次 1 · 校验拦截</span>
                      <code>Observation: strictNullCheck 必须为 boolean，传入了 "yes"</code>
                    </div>
                    <div className="oa-react-log-row reflect">
                      <span className="oa-log-badge">模型反思 (Reflection)</span>
                      <span>识别类型偏差，校准为 strictNullCheck=true 发起重试</span>
                    </div>
                    <div className="oa-react-log-row ok">
                      <span className="oa-log-badge">轮次 2 · 自愈成功</span>
                      <code>Status 200 OK · 8行明细结构校验通过 (空值率 0.0%)</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Hybrid RAG 混合检索与重排 */}
          {activeTab === "hybrid_rag" && (
            <div className="oa-cockpit-tab-content">
              <div className="oa-cockpit-rag-banner">
                <div className="oa-rag-banner-stat">
                  <span>密集向量 (Dense Cosine)</span>
                  <strong>语义泛化覆盖</strong>
                </div>
                <div className="oa-rag-plus">+</div>
                <div className="oa-rag-banner-stat">
                  <span>稀疏关键词 (Sparse BM25)</span>
                  <strong>精准条款单号匹配</strong>
                </div>
                <div className="oa-rag-plus">➔</div>
                <div className="oa-rag-banner-stat highlight">
                  <span>Cross-Encoder 语义重排</span>
                  <strong>依据可信度 96.8%</strong>
                </div>
              </div>

              <div className="oa-cockpit-rag-hits">
                {sampleHybridHits.map((hit) => (
                  <div key={hit.id} className="oa-cockpit-hit-card">
                    <div className="oa-hit-card-top">
                      <strong>{hit.title}</strong>
                      <div className="oa-hit-scores">
                        <span>Dense: {hit.denseScore}</span>
                        <span>BM25: {hit.sparseScore}</span>
                        <span className="oa-score-rerank">Rerank: {hit.rerankScore} ({hit.rankDelta})</span>
                      </div>
                    </div>
                    <p className="oa-hit-text">{hit.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. 认知记忆与 Scratchpad */}
          {activeTab === "memory" && (
            <div className="oa-cockpit-tab-content">
              <div className="oa-cockpit-grid-2">
                <div className="oa-cockpit-box">
                  <div className="oa-cockpit-box-head">
                    <strong>长期语义记忆库 (Semantic Memory Vault)</strong>
                    <span className="oa-cockpit-tag-indigo">跨轮次自动沉淀</span>
                  </div>
                  <ul className="oa-memory-list">
                    {memoryEntities.map((ent) => (
                      <li key={ent.id} className="oa-memory-item">
                        <span className="oa-mem-key">{ent.key}:</span>
                        <span className="oa-mem-val">{ent.value}</span>
                        <span className="oa-mem-conf">置信度 {(ent.confidence * 100).toFixed(0)}%</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="oa-cockpit-box">
                  <div className="oa-cockpit-box-head">
                    <strong>短期工作记忆草稿板 (Working Scratchpad)</strong>
                    <span className="oa-cockpit-tag-green">任务状态机</span>
                  </div>
                  <div className="oa-scratchpad-goal">
                    <span className="oa-sp-k">当前目标:</span>
                    <span className="oa-sp-v">{scratchpad.currentGoal}</span>
                  </div>
                  <div className="oa-scratchpad-dag">
                    {scratchpad.dagNodes.map((node) => (
                      <div key={node.id} className={`oa-sp-node ${node.status}`}>
                        <span className="oa-sp-dot" />
                        <span>{node.label}</span>
                        <span className="oa-sp-status">{node.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. OTel 全链路追踪 */}
          {activeTab === "otel" && (
            <div className="oa-cockpit-tab-content">
              <div className="oa-otel-tree">
                <div className="oa-otel-span is-root">
                  <div className="oa-span-bar">
                    <span className="oa-span-name">Trace Root // Turn 1 (金融对账与落库)</span>
                    <span className="oa-span-ms">总计 1,980ms · 1,272 tok</span>
                  </div>
                  <div className="oa-span-children">
                    <div className="oa-otel-span">
                      <div className="oa-span-bar">
                        <span className="oa-span-name">├── span.intent_routing (共形预测与置信校验)</span>
                        <span className="oa-span-ms">140ms · 0 tok</span>
                      </div>
                    </div>
                    <div className="oa-otel-span">
                      <div className="oa-span-bar">
                        <span className="oa-span-name">├── span.mcp_tool_retrieval (两阶段工具向量检索)</span>
                        <span className="oa-span-ms">45ms · 节省 1200 tok</span>
                      </div>
                    </div>
                    <div className="oa-otel-span">
                      <div className="oa-span-bar">
                        <span className="oa-span-name">├── span.mcp_exec: dataset_validate (Pydantic 自愈验证)</span>
                        <span className="oa-span-ms">380ms (第2轮通过)</span>
                      </div>
                    </div>
                    <div className="oa-otel-span">
                      <div className="oa-span-bar">
                        <span className="oa-span-name">├── span.mcp_exec: ledger_reconcile (确定性浮点计算)</span>
                        <span className="oa-span-ms">460ms · ¥8,090.00</span>
                      </div>
                    </div>
                    <div className="oa-otel-span">
                      <div className="oa-span-bar">
                        <span className="oa-span-name">└── span.hitl_security_gate (双阶段提交与签名确权)</span>
                        <span className="oa-span-ms">挂起等待人工签名</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
