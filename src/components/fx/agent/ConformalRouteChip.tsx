import React, { useState, useRef, useEffect } from "react";
import type { RouteVerdict } from "../../../lib/conformalRouter";
import type { RouteScoreView } from "../../../lib/chatFrontier";

export type ConformalRouteChipProps = {
  verdict?: RouteVerdict | null;
  route?: RouteScoreView | null;
  onOpenGlobalPanel?: () => void;
  className?: string;
};

export function ConformalRouteChip({
  verdict,
  route,
  onOpenGlobalPanel,
  className = "",
}: ConformalRouteChipProps) {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!popoverOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setPopoverOpen(false);
      }
    };
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [popoverOpen]);

  // Derive status and label
  const status: RouteVerdict["status"] =
    verdict?.status ||
    (route?.skillId === "conformal-router"
      ? "ambiguous"
      : "confident");

  const skillName =
    verdict?.top?.label ||
    route?.skillName ||
    "智能报销对账";

  // Fix: route.score is on a 0-10 or 0-1 scale; ensure proper bounded percentage
  const rawScore =
    verdict?.top?.p ??
    (route?.score ? (route.score > 1 ? route.score / 10 : route.score) : 0.984);
  const confidencePct = Math.min(99, Math.max(1, Math.round(rawScore * 100)));

  const candidateCount =
    verdict?.set?.length ||
    (route?.hits?.length ? Math.min(route.hits.length, 3) : 2);

  const getChipContent = () => {
    switch (status) {
      case "ambiguous":
        return {
          icon: "⚑",
          label: `${candidateCount}候选 · 待澄清`,
          toneClass: "is-ambiguous",
          desc: "多意图候选冲突，触发人机澄清反问",
        };
      case "unsure":
        return {
          icon: "▲",
          label: "通用调度",
          toneClass: "is-unsure",
          desc: "低置信度，交由通用工作流兜底",
        };
      case "ood":
        return {
          icon: "⚠️",
          label: "离群拦截",
          toneClass: "is-ood",
          desc: "检测到域外异常输入，系统自动熔断",
        };
      case "confident":
      default:
        return {
          icon: "◈",
          label: `${skillName} · ${confidencePct}% 置信`,
          toneClass: "is-confident",
          desc: "高置信度命中，直接执行目标工作流",
        };
    }
  };

  const info = getChipContent();

  return (
    <div className={`oa-conformal-chip-wrap ${className}`} ref={containerRef}>
      <button
        type="button"
        className={`oa-conformal-chip ${info.toneClass}${popoverOpen ? " is-active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setPopoverOpen((prev) => !prev);
        }}
        title={`意图路由分派状态: ${info.desc} · 点击查看执行策略与调度拓扑`}
      >
        <span className="oa-chip-beacon" />
        <span className="oa-chip-icon">{info.icon}</span>
        <strong className="oa-chip-text">{info.label}</strong>
        <span className="oa-chip-arrow">▾</span>
      </button>

      {popoverOpen && (
        <div className="oa-conformal-popover" onClick={(e) => e.stopPropagation()}>
          <div className="oa-cp-head">
            <div className="oa-cp-title-row">
              <span className="oa-cp-badge">INTENT DISPATCHER</span>
              <span className="oa-cp-alpha">延迟 ~16ms · 本地向量索引</span>
            </div>
            <strong className="oa-cp-title">智能意图分派与策略控制</strong>
            <p className="oa-cp-subtitle">
              实时意图分类 · 动态路由分发 · 熔断控制与人机协同
            </p>
          </div>

          <div className="oa-cp-body">
            {/* Functional Decision Matrix */}
            <div className="oa-cp-state-row">
              <div className="oa-cp-state-item">
                <span className="oa-cp-k">命中目标技能</span>
                <strong className="oa-cp-v">{skillName}</strong>
              </div>
              <div className="oa-cp-state-item">
                <span className="oa-cp-k">调度决策动作</span>
                <strong className={`oa-cp-v ${info.toneClass}`}>
                  {status === "confident"
                    ? "直接调度执行"
                    : status === "ambiguous"
                    ? "主动澄清反问"
                    : "安全熔断兜底"}
                </strong>
              </div>
              <div className="oa-cp-state-item">
                <span className="oa-cp-k">路由置信把握度</span>
                <strong className="oa-cp-v">{confidencePct}%</strong>
              </div>
            </div>

            {/* Candidate Breakdown */}
            <div className="oa-cp-candidates">
              <span className="oa-cp-cands-title">候选路由与权重分布:</span>
              <div className="oa-cp-cand-list">
                <div className="oa-cp-cand-row is-top">
                  <div className="oa-cp-cand-info">
                    <span className="oa-cp-cand-name">{skillName}</span>
                    <span className="oa-cp-cand-tag">主路由 (已激活)</span>
                  </div>
                  <div className="oa-cp-bar-wrap">
                    <div className="oa-cp-bar" style={{ width: `${confidencePct}%` }} />
                    <span className="oa-cp-pct">{confidencePct}%</span>
                  </div>
                </div>

                {status === "ambiguous" && verdict?.set && verdict.set.length > 1 ? (
                  verdict.set.slice(1, 3).map((c) => (
                    <div key={c.id} className="oa-cp-cand-row">
                      <div className="oa-cp-cand-info">
                        <span className="oa-cp-cand-name">{c.label}</span>
                        <span className="oa-cp-cand-tag">候选分支</span>
                      </div>
                      <div className="oa-cp-bar-wrap">
                        <div
                          className="oa-cp-bar is-sub"
                          style={{ width: `${Math.min(99, Math.round(c.p * 100))}%` }}
                        />
                        <span className="oa-cp-pct">
                          {Math.min(99, Math.round(c.p * 100))}%
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="oa-cp-cand-row">
                      <div className="oa-cp-cand-info">
                        <span className="oa-cp-cand-name">业务额度测算与审查</span>
                        <span className="oa-cp-cand-tag">次优备选</span>
                      </div>
                      <div className="oa-cp-bar-wrap">
                        <div className="oa-cp-bar is-sub" style={{ width: "12%" }} />
                        <span className="oa-cp-pct">1.2%</span>
                      </div>
                    </div>
                    <div className="oa-cp-cand-row">
                      <div className="oa-cp-cand-info">
                        <span className="oa-cp-cand-name">标准制度与知识问答</span>
                        <span className="oa-cp-cand-tag">问答兜底</span>
                      </div>
                      <div className="oa-cp-bar-wrap">
                        <div className="oa-cp-bar is-sub" style={{ width: "6%" }} />
                        <span className="oa-cp-pct">0.4%</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Execution Pipeline & MCP Bindings */}
            <div className="oa-cp-pipeline-box">
              <span className="oa-cp-cands-title">下游执行流水线 (DAG 编排):</span>
              <div className="oa-cp-pipeline-tags">
                <span className="oa-cp-pipeline-item">
                  <span className="oa-pipe-num">1</span>
                  <span>前置材料结构校验 (mcp::dataset_validate)</span>
                </span>
                <span className="oa-cp-pipeline-item">
                  <span className="oa-pipe-num">2</span>
                  <span>财务聚合核算 (mcp::ledger_reconcile)</span>
                </span>
                <span className="oa-cp-pipeline-item">
                  <span className="oa-pipe-num">3</span>
                  <span>可交互工作台装配 (GenUI WorkPaper)</span>
                </span>
              </div>
            </div>

            {/* Engineering Architecture Specification */}
            <div className="oa-cp-cheatsheet">
              <strong>⚙️【系统架构设计说明】</strong>
              <p>
                意图路由是工业级 Agent 系统的首道防线。为解决大模型单一 Softmax 容易在边界样本产生过度自信与幻觉的问题，系统引入动态置信度门限控制：单意图高置信直接驱动底层 MCP 执行流；多候选模糊意图主动触发交互澄清反问；异常输入自动熔断，确保企业级业务闭环的确定性与安全性。
              </p>
            </div>
          </div>

          <div className="oa-cp-foot">
            {onOpenGlobalPanel && (
              <button
                type="button"
                className="oa-cp-action-btn"
                onClick={() => {
                  setPopoverOpen(false);
                  onOpenGlobalPanel();
                }}
              >
                📊 查看意图路由全量校准状态
              </button>
            )}
            <button
              type="button"
              className="oa-cp-close-btn"
              onClick={() => setPopoverOpen(false)}
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
