import { useEffect, useMemo, useState } from "react";
import {
  flowJournalStats,
  normalizeFlowJournal,
  type FlowEvidence,
  type FlowJournalId,
  type FlowJournalNode,
} from "../../../lib/turnFlowJournal";
import { FlowEvidenceCard } from "./FlowEvidenceCard";
import { FlowPulseCanvas } from "./FlowPulseCanvas";

const ORDER: FlowJournalId[] = ["read", "route", "fetch", "write"];

/** 右侧动态思考图 — 证据卡片 + 脉冲连线 + 步骤回放 */
export function TurnFlowPanel({
  journal,
  running,
  turnStartedAt,
  runtime,
  ragRuntime,
  onEvidenceClick,
  onClose,
}: {
  journal: FlowJournalNode[];
  running?: boolean;
  turnStartedAt?: number | null;
  runtime?: "server" | "local";
  ragRuntime?: "server" | "local";
  onEvidenceClick?: (ev: FlowEvidence) => void;
  onClose?: () => void;
}) {
  const [selectedId, setSelectedId] = useState<FlowJournalId | null>(null);
  const [linkedEvidenceId, setLinkedEvidenceId] = useState<string | null>(null);
  const [replayIdx, setReplayIdx] = useState<number | null>(null);
  const [replayPlaying, setReplayPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const nodes = useMemo(() => normalizeFlowJournal(journal), [journal]);
  const active = nodes.find((n) => n.status === "active");
  const stats = useMemo(() => flowJournalStats(nodes), [nodes]);

  useEffect(() => {
    if (running && active?.id) setSelectedId(active.id);
  }, [running, active?.id]);

  useEffect(() => {
    if (!running || !turnStartedAt) return;
    const tick = () => setElapsed(Math.max(0, Date.now() - turnStartedAt));
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [running, turnStartedAt]);

  useEffect(() => {
    if (!replayPlaying || replayIdx == null) return;
    const id = window.setInterval(() => {
      setReplayIdx((i) => {
        if (i == null || i >= ORDER.length - 1) {
          setReplayPlaying(false);
          return i;
        }
        const next = i + 1;
        setSelectedId(ORDER[next]!);
        return next;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [replayPlaying, replayIdx]);

  const displayId = replayIdx != null ? ORDER[replayIdx]! : selectedId ?? active?.id ?? null;
  const selected = nodes.find((n) => n.id === displayId) ?? active ?? null;

  function pick(id: FlowJournalId) {
    setReplayPlaying(false);
    setReplayIdx(null);
    setSelectedId((s) => (s === id ? null : id));
  }

  function startReplay() {
    setReplayPlaying(true);
    setReplayIdx(0);
    setSelectedId(ORDER[0]!);
  }

  function handleEvidence(ev: FlowEvidence) {
    setLinkedEvidenceId(ev.id);
    onEvidenceClick?.(ev);
    window.setTimeout(() => setLinkedEvidenceId(null), 2200);
  }

  if (!nodes.length) {
    return (
      <aside className="ua-flow-live empty premium" aria-label="思考过程">
        <div className="ua-flow-live-ambient" aria-hidden />
        <header className="ua-flow-live-head">
          <div>
            <span className="ua-flow-live-kicker">Neural Trace</span>
            <strong>思考过程</strong>
            <p>提问后，这里会实时展示理解、检索与生成路径。</p>
          </div>
          {onClose && (
            <button type="button" className="ua-flow-close" onClick={onClose} aria-label="关闭思考面板" title="关闭">
              ×
            </button>
          )}
        </header>
      </aside>
    );
  }

  return (
    <aside className={`ua-flow-live premium${running ? " running" : ""}`} aria-label="思考过程">
      <div className="ua-flow-live-ambient" aria-hidden />

      <header className="ua-flow-live-head">
        <div>
          <span className="ua-flow-live-kicker">Neural Trace</span>
          <strong>{running ? "实时推理中" : "推理已完成"}</strong>
          <p>{running ? "证据逐条落入时间线，点击可核对来源" : "可回放步骤或点击证据定位左侧答复"}</p>
          {(runtime || ragRuntime) && (
            <div className="ua-flow-runtime-badges">
              {runtime && <span className={`ua-flow-runtime ua-flow-runtime--${runtime}`}>Agent · {runtime === "server" ? "SQLite API" : "浏览器"}</span>}
              {ragRuntime && <span className={`ua-flow-runtime ua-flow-runtime--${ragRuntime}`}>Hybrid RAG · {ragRuntime === "server" ? "服务端" : "本地"}</span>}
            </div>
          )}
        </div>
        {onClose && (
          <button type="button" className="ua-flow-close" onClick={onClose} aria-label="关闭思考面板" title="关闭">
            ×
          </button>
        )}
      </header>

      <div className="ua-flow-metrics">
        <div className="ua-flow-metric">
          <em>证据</em>
          <strong>{stats.evidenceCount}</strong>
        </div>
        {stats.avgScore != null && (
          <div className="ua-flow-metric highlight">
            <em>平均相关度</em>
            <strong>{Math.round(stats.avgScore * 100)}%</strong>
          </div>
        )}
        <div className="ua-flow-metric">
          <em>{running ? "耗时" : "步骤"}</em>
          <strong>{running ? `${(elapsed / 1000).toFixed(1)}s` : `${stats.doneSteps}/4`}</strong>
        </div>
      </div>

      {!running && nodes.some((n) => n.evidence.length > 0) && (
        <div className="ua-flow-replay">
          <button type="button" className="ua-flow-replay-btn" onClick={startReplay} disabled={replayPlaying}>
            {replayPlaying ? "回放中…" : "▶ 回放推理路径"}
          </button>
          <input
            type="range"
            min={0}
            max={3}
            value={replayIdx ?? ORDER.indexOf(displayId ?? "read")}
            className="ua-flow-replay-scrub"
            onChange={(e) => {
              const idx = Number(e.target.value);
              setReplayPlaying(false);
              setReplayIdx(idx);
              setSelectedId(ORDER[idx]!);
            }}
            aria-label="步骤回放"
          />
        </div>
      )}

      <div className="ua-flow-stage">
        <FlowPulseCanvas activeId={displayId} running={running} />

        <ol className="ua-flow-timeline">
          {nodes.map((node, i) => {
            const expanded = displayId === node.id;
            const nodeEvidence = node.evidence;

            return (
              <li
                key={node.id}
                className={`ua-flow-node ${node.status}${expanded ? " expanded selected" : ""}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <button type="button" className="ua-flow-node-hit" onClick={() => pick(node.id)}>
                  <span className="ua-flow-dot" aria-hidden />
                  <span className="ua-flow-node-copy">
                    <strong>{node.label}</strong>
                    <em>
                      {node.status === "active" && running
                        ? "信号流入中…"
                        : node.status === "done"
                          ? `${nodeEvidence.length} 条证据`
                          : node.hint}
                    </em>
                  </span>
                  <span className={`ua-flow-node-status ${node.status}`}>
                    {node.status === "done" ? "✓" : node.status === "active" ? "●" : "○"}
                  </span>
                </button>

                {expanded && nodeEvidence.length > 0 && (
                  <div className="ua-flow-evidence-stack">
                    {nodeEvidence.map((ev, ei) => (
                      <FlowEvidenceCard
                        key={ev.id}
                        item={ev}
                        index={ei}
                        linked={linkedEvidenceId === ev.id}
                        onClick={ev.kind === "hit" ? () => handleEvidence(ev) : undefined}
                      />
                    ))}
                  </div>
                )}

                {!expanded && nodeEvidence.length > 0 && node.status !== "pending" && (
                  <div className="ua-flow-node-preview">
                    {nodeEvidence.slice(0, 2).map((ev) => (
                      <span key={ev.id} className="ua-flow-thought-chip">
                        {ev.title}
                        {ev.score != null && <i>{Math.round(ev.score * 100)}%</i>}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
