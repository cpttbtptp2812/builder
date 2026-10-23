import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  normalizeFlowJournal,
  type FlowJournalNode,
} from "../../../lib/turnFlowJournal";

/**
 * 输入区上方 · 办理过程与正在办哪一步（高度滑动展开，点外收起，办完自动收拢）
 */
export const NeuralTraceStrip = memo(function NeuralTraceStrip({
  journal,
  running,
  turnStartedAt,
}: {
  journal: FlowJournalNode[];
  running?: boolean;
  turnStartedAt?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const nodes = useMemo(() => normalizeFlowJournal(journal), [journal]);
  const activeNode = nodes.find((n) => n.status === "active") || nodes.find((n) => n.status === "pending");
  const doneCount = nodes.filter((n) => n.status === "done").length;
  const totalSteps = Math.max(nodes.length, 4);

  // 正在办时，如果有新步骤且未关闭，可自适应展开；办完自动收起
  useEffect(() => {
    if (!running) {
      const timer = window.setTimeout(() => setOpen(false), 300);
      return () => window.clearTimeout(timer);
    }
  }, [running]);

  // 点外面收起
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (!running && doneCount === 0) return null;

  const currentLabel = activeNode?.label || (running ? "数据核对与处理中…" : "办理完成");

  return (
    <div
      ref={containerRef}
      className={`oa-process-strip${running ? " is-running" : ""}${open ? " is-expanded" : ""}`}
      role="region"
      aria-label="办理过程"
    >
      <div className="oa-process-strip-bar">
        <div className="oa-process-strip-lead">
          <span className="oa-process-pulse-dot" aria-hidden="true" />
          <span className="oa-process-current-step">
            <strong>正在办：</strong>
            <em>{currentLabel}</em>
          </span>
        </div>

        <button
          type="button"
          className="oa-process-toggle-btn"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span>办理过程 · {totalSteps} 步</span>
          <svg
            className={`oa-process-chevron${open ? " is-open" : ""}`}
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className={`oa-process-steps-drawer${open ? " is-open" : ""}`}>
        <ol className="oa-process-step-list">
          {nodes.map((node, idx) => {
            const isDone = node.status === "done";
            const isActive = node.status === "active";
            return (
              <li
                key={node.id}
                className={`oa-process-step-item is-${node.status}`}
              >
                <span className="oa-process-step-index">
                  {isDone ? "✓" : String(idx + 1)}
                </span>
                <div className="oa-process-step-content">
                  <span className="oa-process-step-title">{node.label}</span>
                  {node.chips && node.chips.length > 0 ? (
                    <span className="oa-process-step-detail">
                      {node.chips.join(" · ")}
                    </span>
                  ) : null}
                </div>
                {isActive && <span className="oa-process-step-live">进行中</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
});
