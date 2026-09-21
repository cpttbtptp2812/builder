import type { FlowJournalId } from "../../../lib/turnFlowJournal";

const ORDER: FlowJournalId[] = ["read", "route", "fetch", "write"];

/** SVG 数据流脉冲 — 步骤间动态连线 */
export function FlowPulseCanvas({
  activeId,
  running,
}: {
  activeId?: FlowJournalId | null;
  running?: boolean;
}) {
  const activeIdx = activeId ? ORDER.indexOf(activeId) : -1;

  return (
    <svg className="ua-flow-pulse" viewBox="0 0 40 200" aria-hidden>
      <defs>
        <linearGradient id="ua-flow-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#14b8a6" />
        </linearGradient>
        <filter id="ua-flow-glow">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {[0, 1, 2, 3].map((i) => {
        const y = 18 + i * 46;
        const lit = activeIdx >= i;
        const pulse = running && activeIdx === i;
        return (
          <g key={i}>
            {i < 3 && (
              <line
                x1="20"
                y1={y + 8}
                x2="20"
                y2={y + 38}
                stroke={lit ? "url(#ua-flow-grad)" : "#e2e8f0"}
                strokeWidth={lit ? 2.5 : 1.5}
                strokeLinecap="round"
                opacity={lit ? 1 : 0.45}
              />
            )}
            {pulse && (
              <circle r="4" fill="#14b8a6" filter="url(#ua-flow-glow)">
                <animate attributeName="cy" from={y - 8} to={y + (i < 3 ? 38 : 8)} dur="1.1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;1;0" dur="1.1s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx="20"
              cy={y}
              r={pulse ? 5.5 : 4}
              fill={lit ? (pulse ? "#14b8a6" : "#0f766e") : "#cbd5e1"}
              className={pulse ? "ua-flow-pulse-node" : undefined}
            />
          </g>
        );
      })}
    </svg>
  );
}
