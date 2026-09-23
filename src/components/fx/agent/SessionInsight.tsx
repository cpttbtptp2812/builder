/**
 * SessionInsight — 对话质量雷达图
 * 右侧面板第3标签"洞察"
 *
 * 5 维可视化：知识覆盖 / 响应效率 / 引用密度 / 推理深度 / 答案质量
 */
import { useMemo } from "react";
import type { OwnChatMessage } from "../../../lib/ownagentSessions";

/* ─── types ─────────────────────────────────────────────── */
type Dims = {
  coverage: number;   // 0-100  avg groundedness
  speed: number;      // 0-100  inverse normalized response time
  citation: number;   // 0-100  avg hitCount normalized
  depth: number;      // 0-100  avg flowJournal nodes
  quality: number;    // 0-100  composite
};

type TurnBar = {
  label: string;
  g: number;
  ms: number;
};

/* ─── compute ────────────────────────────────────────────── */
function computeDims(messages: OwnChatMessage[]): { dims: Dims; bars: TurnBar[]; total: number } {
  const ass = messages.filter((m) => m.role === "assistant");
  if (ass.length === 0) {
    return { dims: { coverage: 0, speed: 0, citation: 0, depth: 0, quality: 0 }, bars: [], total: 0 };
  }

  const avgG = avg(ass.map((m) => m.answerInsight?.groundedness ?? 0));
  const msTimes = ass.map((m) => m.ms ?? 0).filter((v) => v > 0);
  const avgMs = msTimes.length ? avg(msTimes) : 3000;
  const speedScore = Math.max(0, Math.min(100, Math.round(100 - (avgMs - 500) / 50)));

  const avgHits = avg(ass.map((m) => m.answerInsight?.hitCount ?? 0));
  const citationScore = Math.min(100, Math.round(avgHits * 12));

  const avgDepth = avg(ass.map((m) => (m.flowJournal?.length ?? 0)));
  const depthScore = Math.min(100, Math.round(avgDepth * 18));

  const qualityScore = Math.round((avgG * 0.4 + citationScore * 0.3 + depthScore * 0.3));

  const bars: TurnBar[] = ass.map((m, i) => ({
    label: `第${i + 1}轮`,
    g: m.answerInsight?.groundedness ?? 0,
    ms: m.ms ?? 0,
  }));

  return {
    dims: {
      coverage: Math.round(avgG),
      speed: speedScore,
      citation: citationScore,
      depth: depthScore,
      quality: qualityScore,
    },
    bars,
    total: ass.length,
  };
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

/* ─── radar geometry ─────────────────────────────────────── */
const N = 5;
const CX = 68, CY = 72, R = 52;
const LABELS = ["知识覆盖", "响应效率", "引用密度", "推理深度", "答案质量"];

function axisXY(i: number, r: number): [number, number] {
  const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

function polygonPoints(values: number[]): string {
  return values
    .map((v, i) => {
      const [x, y] = axisXY(i, (v / 100) * R);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/* ─── subcomponents ──────────────────────────────────────── */
function Radar({ dims }: { dims: Dims }) {
  const vals = [dims.coverage, dims.speed, dims.citation, dims.depth, dims.quality];
  const poly = polygonPoints(vals);

  // Grid rings at 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0].map((f) => polygonPoints([100 * f, 100 * f, 100 * f, 100 * f, 100 * f]));

  const scoreColor = (v: number) =>
    v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="ua-radar-wrap">
      <svg viewBox="0 0 136 144" className="ua-radar-svg">
        {/* Grid rings */}
        {rings.map((pts, ri) => (
          <polygon key={ri} points={pts} fill="none" stroke="#e2e8f0" strokeWidth="0.6" />
        ))}

        {/* Axis lines */}
        {LABELS.map((_, i) => {
          const [x, y] = axisXY(i, R);
          return (
            <line key={i} x1={CX} y1={CY} x2={x.toFixed(1)} y2={y.toFixed(1)}
              stroke="#e2e8f0" strokeWidth="0.6" />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={poly}
          fill="rgba(99,102,241,0.15)"
          stroke="#6366f1"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {vals.map((v, i) => {
          const [x, y] = axisXY(i, (v / 100) * R);
          return (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="3.5"
              fill={scoreColor(v)} stroke="#fff" strokeWidth="1.2" />
          );
        })}

        {/* Axis labels */}
        {LABELS.map((label, i) => {
          const [lx, ly] = axisXY(i, R + 13);
          const anchor =
            lx < CX - 5 ? "end" : lx > CX + 5 ? "start" : "middle";
          return (
            <text key={i} x={lx.toFixed(1)} y={ly.toFixed(1)}
              textAnchor={anchor} dominantBaseline="central"
              fontSize="7.5" fontWeight="600" fill="#475569">
              {label}
            </text>
          );
        })}

        {/* Center dot */}
        <circle cx={CX} cy={CY} r="2" fill="#6366f1" />
      </svg>

      {/* Score legend */}
      <div className="ua-radar-legend">
        {LABELS.map((label, i) => {
          const v = vals[i]!;
          return (
            <div key={i} className="ua-radar-legend-row">
              <span className="ua-radar-legend-dot"
                style={{ background: v >= 75 ? "#10b981" : v >= 50 ? "#f59e0b" : "#ef4444" }} />
              <span className="ua-radar-legend-name">{label}</span>
              <span className="ua-radar-legend-val">{v}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TurnBars({ bars }: { bars: TurnBar[] }) {
  if (bars.length === 0) return null;
  const maxMs = Math.max(...bars.map((b) => b.ms), 1);

  return (
    <div className="ua-insight-turns">
      <div className="ua-insight-turns-head">
        <span>每轮回答质量</span>
        <span className="ua-insight-turns-hint">绿 = 知识覆盖率 · 灰 = 响应时长</span>
      </div>
      <div className="ua-insight-bars">
        {bars.map((b, i) => (
          <div key={i} className="ua-insight-bar-row">
            <span className="ua-insight-bar-label">{b.label}</span>
            <div className="ua-insight-bar-track">
              {/* Coverage bar */}
              <div
                className="ua-insight-bar-fill"
                style={{
                  width: `${b.g}%`,
                  background: b.g >= 75 ? "#10b981" : b.g >= 50 ? "#f59e0b" : "#ef4444",
                }}
              />
            </div>
            <span className="ua-insight-bar-val">{b.g}%</span>
            {b.ms > 0 && (
              <span className="ua-insight-bar-ms">{(b.ms / 1000).toFixed(1)}s</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── main ───────────────────────────────────────────────── */
export function SessionInsight({ messages }: { messages: OwnChatMessage[] }) {
  const { dims, bars, total } = useMemo(() => computeDims(messages), [messages]);

  const isEmpty = total === 0;

  const overallScore = isEmpty
    ? 0
    : Math.round((dims.coverage + dims.speed + dims.citation + dims.depth + dims.quality) / 5);

  return (
    <div className="ua-session-insight">
      {/* Header */}
      <div className="ua-si-head">
        <div className="ua-si-title">
          <span className="ua-si-kicker">Session Analytics</span>
          <strong>对话质量洞察</strong>
          <em>{isEmpty ? "完成一轮对话后查看" : `基于 ${total} 轮对话分析`}</em>
        </div>
        {!isEmpty && (
          <div className="ua-si-score">
            <span
              className="ua-si-score-val"
              style={{ color: overallScore >= 75 ? "#10b981" : overallScore >= 50 ? "#f59e0b" : "#ef4444" }}
            >
              {overallScore}
            </span>
            <span className="ua-si-score-label">综合评分</span>
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="ua-si-empty">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <polygon points="24,6 44,42 4,42" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" strokeLinejoin="round"/>
            <polygon points="24,12 38,38 10,38" fill="none" stroke="#e2e8f0" strokeWidth="0.8"/>
            <polygon points="24,18 32,34 16,34" fill="none" stroke="#e2e8f0" strokeWidth="0.8"/>
            <circle cx="24" cy="24" r="2" fill="#cbd5e1"/>
          </svg>
          <p>开始对话后，质量雷达将实时生成</p>
          <em>5 维分析：覆盖率 · 速度 · 引用 · 深度 · 质量</em>
        </div>
      ) : (
        <>
          <Radar dims={dims} />
          <TurnBars bars={bars} />

          {/* Gap alert if coverage is low */}
          {dims.coverage < 60 && (
            <div className="ua-si-gap-hint">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1.5L11.5 11H.5L6 1.5Z" stroke="#d97706" strokeWidth="1.3" strokeLinejoin="round"/>
                <path d="M6 4.5v2.5" stroke="#d97706" strokeWidth="1.3" strokeLinecap="round"/>
                <circle cx="6" cy="9" r="0.7" fill="#d97706"/>
              </svg>
              <span>知识覆盖率偏低，建议向知识库补充相关文档以提升回答质量</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
