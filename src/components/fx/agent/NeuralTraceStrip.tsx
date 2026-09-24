import { useMemo } from "react";
import {
  normalizeFlowJournal,
  type FlowJournalId,
  type FlowJournalNode,
} from "../../../lib/turnFlowJournal";

const STEPS: { id: FlowJournalId; short: string }[] = [
  { id: "read", short: "读" },
  { id: "route", short: "定" },
  { id: "fetch", short: "取" },
  { id: "write", short: "写" },
];

/** 输入区上方 · 四段思考进度（运行中） */
export function NeuralTraceStrip({
  journal,
  running,
  elapsedMs,
}: {
  journal: FlowJournalNode[];
  running?: boolean;
  elapsedMs?: number;
}) {
  const nodes = useMemo(() => normalizeFlowJournal(journal), [journal]);
  const active = nodes.find((n) => n.status === "active");
  const done = nodes.filter((n) => n.status === "done").length;
  const pct = Math.min(100, Math.round((done / 4) * 100 + (active ? 8 : 0)));

  if (!running && done === 0) return null;

  return (
    <div className={`ua-neural-strip${running ? " running" : ""}`} role="status" aria-live="polite">
      <div className="ua-neural-strip-head">
        <span className="ua-neural-strip-kicker">思考进度</span>
        <strong>{active?.label ?? (running ? "推理中" : "已完成")}</strong>
        {elapsedMs != null && running && (
          <em>{(elapsedMs / 1000).toFixed(1)}s</em>
        )}
      </div>
      <div className="ua-neural-strip-track" aria-hidden>
        <div className="ua-neural-strip-fill" style={{ width: `${pct}%` }} />
      </div>
      <ol className="ua-neural-strip-steps">
        {STEPS.map(({ id, short }) => {
          const node = nodes.find((n) => n.id === id);
          const status = node?.status ?? "pending";
          return (
            <li key={id} className={`ua-neural-step ${status}${active?.id === id ? " current" : ""}`}>
              <span className="ua-neural-step-dot">{short}</span>
              <span className="ua-neural-step-label">{node?.label ?? id}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
