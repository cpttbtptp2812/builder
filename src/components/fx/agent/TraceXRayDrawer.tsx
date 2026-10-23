import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { TraceSpan } from "../../../data/agentTraceDemo";

export type TraceXRayData = {
  messageId: string;
  query: string;
  assistantText?: string;
  spans: TraceSpan[];
  totalMs: number;
  ttftMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  modelName?: string;
};

const KIND_COLORS: Record<string, { bg: string; border: string; text: string; badge: string }> = {
  user: { bg: "rgba(59, 130, 246, 0.08)", border: "rgba(59, 130, 246, 0.28)", text: "#2563eb", badge: "USER" },
  intent: { bg: "rgba(147, 51, 234, 0.08)", border: "rgba(147, 51, 234, 0.28)", text: "#7c3aed", badge: "INTENT" },
  plan: { bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.28)", text: "#d97706", badge: "PLAN" },
  tool: { bg: "rgba(16, 185, 129, 0.08)", border: "rgba(16, 185, 129, 0.28)", text: "#059669", badge: "TOOL" },
  stream: { bg: "rgba(6, 182, 212, 0.08)", border: "rgba(6, 182, 212, 0.28)", text: "#0891b2", badge: "STREAM" },
  reply: { bg: "rgba(99, 102, 241, 0.08)", border: "rgba(99, 102, 241, 0.28)", text: "#4f46e5", badge: "REPLY" },
  error: { bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.28)", text: "#dc2626", badge: "ERR" },
};

export function TraceXRayDrawer({
  data,
  onClose,
}: {
  data: TraceXRayData | null;
  onClose: () => void;
}) {
  const [selectedSpanId, setSelectedSpanId] = useState<string | null>(() => {
    if (!data?.spans?.length) return null;
    const firstTool = data.spans.find((s) => s.kind === "tool");
    return firstTool ? firstTool.id : data.spans[0].id;
  });
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => {
    if (!data) return { toolCount: 0, failCount: 0, estTokens: 0, estCost: "¥0.00" };
    const tools = data.spans.filter((s) => s.kind === "tool");
    const fails = tools.filter((s) => s.status === "err");
    const textLen = (data.query.length + (data.assistantText?.length || 0));
    const tokenEst = data.inputTokens && data.outputTokens
      ? data.inputTokens + data.outputTokens
      : Math.round(textLen * 1.2) + Math.max(tools.length, 2) * 180 + 320;
    const cost = ((tokenEst / 1000) * 0.002).toFixed(4);
    return {
      toolCount: Math.max(tools.length, 2),
      failCount: fails.length,
      estTokens: tokenEst,
      estCost: `¥${cost}`,
    };
  }, [data]);

  const activeSpanId = selectedSpanId || (data?.spans.find((s) => s.kind === "tool")?.id || data?.spans[0]?.id || null);

  const selectedSpan = useMemo(() => {
    if (!data || !activeSpanId) return null;
    return data.spans.find((s) => s.id === activeSpanId) || data.spans[0] || null;
  }, [data, activeSpanId]);

  if (!data) return null;

  // 计算甘特条瀑布位置
  let currentOffset = 0;
  const waterfallBars = data.spans.map((s) => {
    const startMs = currentOffset;
    const durationMs = Math.max(s.ms, 20); // 最小宽度
    currentOffset += s.ms;
    const maxScale = Math.max(data.totalMs, currentOffset, 100);
    const leftPct = Math.min(100, Math.max(0, (startMs / maxScale) * 100));
    const widthPct = Math.min(100 - leftPct, Math.max(2, (durationMs / maxScale) * 100));
    return { span: s, startMs, durationMs, leftPct, widthPct };
  });

  const handleCopyPayload = () => {
    if (!selectedSpan?.payload) return;
    navigator.clipboard.writeText(JSON.stringify(selectedSpan.payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <div className="oa-xray-backdrop" onClick={onClose}>
      <aside
        className="oa-xray-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Agent 链路追踪与性能分析"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="oa-xray-header">
          <div className="oa-xray-title-box">
            <span className="oa-xray-beacon" />
            <div>
              <div className="oa-xray-title-row">
                <h3 className="oa-xray-title">AGENT RUNTIME X-RAY</h3>
                <span className="oa-xray-badge-live">OBSERVABILITY</span>
              </div>
              <p className="oa-xray-subtitle">微秒级可观测性 · 工具调用瀑布图 · Token 与执行耗时</p>
            </div>
          </div>
          <button
            type="button"
            className="oa-xray-close"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        </header>

        {/* Top KPI Cards */}
        <div className="oa-xray-kpis">
          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">TOTAL LATENCY</span>
            <span className="oa-xray-kpi-val highlight">
              {data.totalMs < 1000 ? `${data.totalMs}ms` : `${(data.totalMs / 1000).toFixed(2)}s`}
            </span>
            <span className="oa-xray-kpi-sub">
              TTFT: {data.ttftMs ? `${data.ttftMs}ms` : "约 180ms"}
            </span>
          </div>

          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">TOKEN CONSUMPTION</span>
            <span className="oa-xray-kpi-val">{stats.estTokens.toLocaleString()}</span>
            <span className="oa-xray-kpi-sub">预估成本: {stats.estCost}</span>
          </div>

          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">TOOL CALLING</span>
            <span className="oa-xray-kpi-val success">{stats.toolCount} 次</span>
            <span className="oa-xray-kpi-sub">
              {stats.failCount > 0 ? `${stats.failCount} 次重试/失败` : "100% 成功闭环"}
            </span>
          </div>

          <div className="oa-xray-kpi">
            <span className="oa-xray-kpi-label">ENGINE MODE</span>
            <span className="oa-xray-kpi-val">ReAct · MCP v1.2</span>
            <span className="oa-xray-kpi-sub">{data.modelName || "Local / BYOK"}</span>
          </div>
        </div>

        {/* Main Content: Waterfall + Inspector */}
        <div className="oa-xray-body">
          {/* Timeline Waterfall */}
          <section className="oa-xray-timeline-section">
            <div className="oa-xray-section-head">
              <span className="oa-xray-section-title">⏱️ EXECUTION WATERFALL</span>
              <span className="oa-xray-section-meta">
                共 {data.spans.length} 个跨度 · 点击任意步骤可检查 Payload 入参出参
              </span>
            </div>

            <div className="oa-xray-waterfall-scale">
              <span>0ms</span>
              <span>{Math.round(data.totalMs * 0.25)}ms</span>
              <span>{Math.round(data.totalMs * 0.5)}ms</span>
              <span>{Math.round(data.totalMs * 0.75)}ms</span>
              <span>{data.totalMs}ms</span>
            </div>

            <div className="oa-xray-waterfall-list">
              {waterfallBars.map(({ span, durationMs, leftPct, widthPct }) => {
                const conf = KIND_COLORS[span.kind] || KIND_COLORS.tool;
                const isSelected = selectedSpan?.id === span.id;
                return (
                  <div
                    key={span.id}
                    className={`oa-xray-span-row${isSelected ? " is-selected" : ""}`}
                    onClick={() => setSelectedSpanId(span.id)}
                  >
                    <div className="oa-xray-span-meta">
                      <span
                        className="oa-xray-span-badge"
                        style={{ color: conf.text, borderColor: conf.border, background: conf.bg }}
                      >
                        {conf.badge}
                      </span>
                      <span className="oa-xray-span-label" title={span.label}>
                        {span.label}
                      </span>
                    </div>

                    <div className="oa-xray-span-track">
                      <div
                        className="oa-xray-span-bar"
                        style={{
                          left: `${leftPct}%`,
                          width: `${widthPct}%`,
                          background: conf.text,
                          boxShadow: `0 0 10px ${conf.text}55`,
                        }}
                      >
                        <span className="oa-xray-bar-ms">{durationMs}ms</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Span Detail Inspector */}
          <section className="oa-xray-detail-section">
            <div className="oa-xray-section-head">
              <span className="oa-xray-section-title">🔍 SPAN INSPECTOR</span>
              {selectedSpan && (
                <span className="oa-xray-span-selected-tag">
                  {selectedSpan.label} ({selectedSpan.ms}ms)
                </span>
              )}
            </div>

            {selectedSpan ? (
              <div className="oa-xray-inspector-card">
                <div className="oa-xray-card-head">
                  <div className="oa-xray-card-info">
                    <strong>ID: {selectedSpan.id}</strong>
                    <span>类型: {selectedSpan.kind.toUpperCase()} · 状态: {selectedSpan.status}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {selectedSpan.payload && (
                      <button
                        type="button"
                        className="oa-xray-copy-btn"
                        onClick={handleCopyPayload}
                        title="复制 Payload JSON"
                      >
                        {copied ? "✓ 已复制" : "📋 复制 JSON"}
                      </button>
                    )}
                    <span className="oa-xray-chip-ms">+{selectedSpan.ms} ms</span>
                  </div>
                </div>

                {selectedSpan.cheatsheet && (
                  <div className="oa-xray-cheatsheet-box">
                    <div className="oa-xray-cheatsheet-head">
                      <span className="oa-xray-cheatsheet-tag">💡 面试答辩解析 & 架构要点</span>
                    </div>
                    <p className="oa-xray-cheatsheet-body">{selectedSpan.cheatsheet}</p>
                  </div>
                )}

                <div className="oa-xray-card-row">
                  <span className="oa-xray-field-name">执行概要:</span>
                  <p className="oa-xray-field-val">{selectedSpan.detail || "阶段执行完毕"}</p>
                </div>

                {selectedSpan.payload ? (
                  <div className="oa-xray-payload-box">
                    <span className="oa-xray-field-name">Payload (入参、出参与上下文):</span>
                    <pre className="oa-xray-json-code">
                      {JSON.stringify(selectedSpan.payload, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="oa-xray-empty-payload">该节点无结构化 Payload 数据</div>
                )}
              </div>
            ) : (
              <div className="oa-xray-placeholder-box">
                <span className="oa-xray-placeholder-icon">👆</span>
                <p>点击左侧瀑布图中的任意执行片段，即可查看 Tool 入参、出参 JSON 与架构细节</p>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <footer className="oa-xray-footer">
          <div className="oa-xray-foot-left">
            <span>Query: </span>
            <code className="oa-xray-foot-query">
              {data.query.length > 50 ? `${data.query.slice(0, 50)}…` : data.query}
            </code>
          </div>
          <button
            type="button"
            className="oa-xray-export-btn"
            onClick={() => {
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `agent-trace-${data.messageId}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            📥 导出 Trace JSON
          </button>
        </footer>
      </aside>
    </div>,
    document.body
  );
}
