import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeFlowJournal,
  type FlowJournalNode,
} from "../../../lib/turnFlowJournal";

const STEP_MS = 720;

/** Turn 回放剧场 — 逐步重播 Agent 读→定→取→写决策链 */
export function TurnReplayTheater({
  query,
  journal,
  totalMs,
  onClose,
  autoPlay = true,
}: {
  query: string;
  journal: FlowJournalNode[];
  totalMs?: number;
  onClose: () => void;
  autoPlay?: boolean;
}) {
  const nodes = useMemo(() => normalizeFlowJournal(journal), [journal]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(autoPlay);

  const visible = nodes.slice(0, step + 1);
  const done = step >= nodes.length - 1;

  useEffect(() => {
    if (!playing || done) return;
    const t = window.setTimeout(() => setStep((s) => Math.min(s + 1, nodes.length - 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, done, step, nodes.length]);

  const replay = useCallback(() => {
    setStep(0);
    setPlaying(true);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="turn-replay-overlay" role="dialog" aria-modal="true" aria-label="Turn 回放">
      <div className="turn-replay-panel">
        <header className="turn-replay-head">
          <div>
            <span className="turn-replay-kicker">Turn 回放 · 决策剧场</span>
            <h3>{query.slice(0, 64)}{query.length > 64 ? "…" : ""}</h3>
          </div>
          <button type="button" className="turn-replay-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <ol className="turn-replay-steps">
          {visible.map((node, i) => (
            <li
              key={node.id}
              className={`turn-replay-step ${node.status}${i === step && playing && !done ? " active" : ""}`}
            >
              <div className="turn-replay-step-head">
                <span className="turn-replay-step-idx">{i + 1}</span>
                <strong>{node.label}</strong>
                <em>{node.hint}</em>
              </div>
              {node.chips.length > 0 && (
                <ul className="turn-replay-chips">
                  {node.chips.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              )}
              {node.evidence.length > 0 && (
                <ul className="turn-replay-evidence">
                  {node.evidence.map((ev) => (
                    <li key={ev.id}>
                      <strong>{ev.title}</strong>
                      {ev.excerpt && <p>{ev.excerpt}</p>}
                      {ev.meta && <span>{ev.meta}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>

        <footer className="turn-replay-foot">
          {typeof totalMs === "number" && (
            <span className="turn-replay-ms">原耗时 {(totalMs / 1000).toFixed(1)}s</span>
          )}
          <div className="turn-replay-actions">
            <button type="button" onClick={() => setPlaying((p) => !p)} disabled={done && !playing}>
              {playing && !done ? "暂停" : done ? "已完成" : "继续"}
            </button>
            <button type="button" onClick={replay}>
              重播
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
