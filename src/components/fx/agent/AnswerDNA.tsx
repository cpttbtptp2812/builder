import { useMemo, useState } from "react";
import type { FlowJournalNode } from "../../../lib/turnFlowJournal";

type DNASegment = {
  title: string;
  score: number;
  excerpt: string;
  color: string;
};

const PALETTE = [
  "#6366f1", "#14b8a6", "#f59e0b", "#ec4899",
  "#22c55e", "#0ea5e9", "#a855f7", "#f97316",
];

function buildDNA(flowJournal: FlowJournalNode[]): DNASegment[] {
  const seen = new Map<string, DNASegment>();
  let colorIdx = 0;

  for (const node of flowJournal) {
    for (const ev of node.evidence) {
      if (ev.kind !== "hit" || !ev.title?.trim()) continue;
      if (seen.has(ev.title)) continue;
      seen.set(ev.title, {
        title: ev.title,
        score: ev.score ?? 0.5,
        excerpt: ev.excerpt ?? "",
        color: PALETTE[colorIdx++ % PALETTE.length]!,
      });
    }
  }

  const segs = [...seen.values()];
  // Normalize to 100%
  const total = segs.reduce((s, x) => s + x.score, 0) || 1;
  return segs.map((s) => ({ ...s, score: s.score / total }));
}

/** Answer DNA — 每条答复下的来源基因条 */
export function AnswerDNA({ flowJournal }: { flowJournal?: FlowJournalNode[] }) {
  const [hovered, setHovered] = useState<DNASegment | null>(null);

  const segments = useMemo(
    () => buildDNA(flowJournal ?? []),
    [flowJournal],
  );

  if (!segments.length) return null;

  return (
    <div className="ua-dna">
      <div className="ua-dna-label">
        <span>Answer DNA</span>
        <em>{segments.length} 个知识来源</em>
      </div>
      <div className="ua-dna-bar">
        {segments.map((seg, i) => (
          <div
            key={i}
            className="ua-dna-seg"
            style={{ flex: seg.score, background: seg.color }}
            onMouseEnter={() => setHovered(seg)}
            onMouseLeave={() => setHovered(null)}
            title={seg.title}
          />
        ))}
      </div>

      {hovered && (
        <div className="ua-dna-tooltip">
          <header style={{ borderLeftColor: hovered.color }}>
            <strong>{hovered.title}</strong>
            <span>{Math.round(hovered.score * 100)}% 贡献</span>
          </header>
          {hovered.excerpt && <p>{hovered.excerpt.slice(0, 120)}{hovered.excerpt.length > 120 ? "…" : ""}</p>}
        </div>
      )}

      <div className="ua-dna-keys">
        {segments.map((seg, i) => (
          <span key={i} className="ua-dna-key">
            <span className="ua-dna-key-dot" style={{ background: seg.color }} />
            <span>{seg.title.length > 14 ? seg.title.slice(0, 14) + "…" : seg.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
