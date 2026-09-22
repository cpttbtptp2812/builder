import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OwnChatMessage } from "../../../lib/ownagentSessions";

/* ─── types ─────────────────────────────────────────────── */
type KNode = {
  id: string;         // full title (unique key)
  label: string;      // display label (smart-stripped)
  fullLabel: string;  // full title for detail panel
  count: number;      // times cited
  score: number;      // best relevance score
  excerpts: string[];
  firstTurn: number;  // which turn it first appeared
  x: number; y: number; vx: number; vy: number;
  pulse: boolean;
};
type KEdge = { from: string; to: string; weight: number; turnIdx: number };

/* ─── palette (by turn index) ───────────────────────────── */
const TURN_COLORS = [
  "#818cf8", // turn 0 — indigo
  "#34d399", // turn 1 — emerald
  "#f472b6", // turn 2 — pink
  "#fbbf24", // turn 3 — amber
  "#38bdf8", // turn 4 — sky
  "#a78bfa", // turn 5 — violet
  "#fb923c", // turn 6 — orange
];
function tc(i: number) { return TURN_COLORS[i % TURN_COLORS.length]!; }

/* ─── smart label: strip shared prefix ─────────────────── */
function commonPrefix(strs: string[]): string {
  if (strs.length < 2) return "";
  let p = strs[0]!;
  for (const s of strs) {
    while (!s.startsWith(p)) p = p.slice(0, -1);
    if (!p) return "";
  }
  return p;
}

function smartLabel(full: string, prefix: string): string {
  if (prefix.length > 4) {
    const rest = full.slice(prefix.length).replace(/^[\s\-–—·:：,，]+/, "").trim();
    if (rest.length >= 2) return rest;
  }
  // Fallback: take part after last separator
  const m = full.match(/[\-–—·:：]\s*(.+)$/);
  if (m) return m[1]!.trim();
  return full;
}

/* ─── build graph ────────────────────────────────────────── */
function buildGraph(messages: OwnChatMessage[]) {
  const nodeMap = new Map<string, {
    count: number; score: number; excerpts: string[]; firstTurn: number;
  }>();
  const edgeMap = new Map<string, { weight: number; turnIdx: number }>();
  let turnIdx = 0;

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const batch = new Set<string>();

    for (const jn of msg.flowJournal ?? []) {
      for (const ev of jn.evidence ?? []) {
        if (ev.kind !== "hit" || !ev.title?.trim()) continue;
        const k = ev.title.trim();
        if (!nodeMap.has(k)) {
          nodeMap.set(k, { count: 0, score: 0, excerpts: [], firstTurn: turnIdx });
        }
        const cur = nodeMap.get(k)!;
        cur.count += 1;
        cur.score = Math.max(cur.score, ev.score ?? 0);
        if (ev.excerpt && !cur.excerpts.includes(ev.excerpt))
          cur.excerpts.push(ev.excerpt);
        cur.excerpts = cur.excerpts.slice(0, 3);
        batch.add(k);
      }
    }

    const ba = [...batch];
    for (let i = 0; i < ba.length; i++) {
      for (let j = i + 1; j < ba.length; j++) {
        const ek = [ba[i], ba[j]].sort().join("\x00");
        const prev = edgeMap.get(ek) ?? { weight: 0, turnIdx };
        edgeMap.set(ek, { weight: prev.weight + 1, turnIdx: prev.turnIdx });
      }
    }
    turnIdx++;
  }

  // Compute smart labels
  const ids = [...nodeMap.keys()];
  const prefix = commonPrefix(ids);
  const labelMap = new Map(ids.map((id) => [id, smartLabel(id, prefix)]));

  return { nodeMap, edgeMap, labelMap, turnCount: turnIdx };
}

/* ─── initial ring placement ─────────────────────────────── */
function ringPlace(ids: string[], W: number, H: number) {
  const pos = new Map<string, { x: number; y: number }>();
  const n = ids.length;
  if (!n) return pos;
  if (n === 1) { pos.set(ids[0]!, { x: W / 2, y: H / 2 }); return pos; }
  const cx = W / 2, cy = H / 2;
  const r = Math.min(cx, cy) * 0.52;
  ids.forEach((id, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    pos.set(id, { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  });
  return pos;
}

/* ─── main ───────────────────────────────────────────────── */
export function KnowledgeConstellation({
  messages,
  running,
  activeEvidence = [],
  onClose,
}: {
  messages: OwnChatMessage[];
  running?: boolean;
  activeEvidence?: string[];
  onClose?: () => void;
}) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const animRef    = useRef<number | null>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const nodesRef   = useRef<KNode[]>([]);
  const edgesRef   = useRef<KEdge[]>([]);
  const idxRef     = useRef<Map<string, number>>(new Map());
  const tickRef    = useRef(0);
  const [dims, setDims]       = useState({ w: 1, h: 1 });
  const [selected, setSel]    = useState<KNode | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: KNode } | null>(null);

  /* resize observer */
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setDims({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setDims({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  /* build graph data */
  const { nodeMap, edgeMap, labelMap, turnCount } = useMemo(
    () => buildGraph(messages), [messages]
  );

  /* sync nodes/edges preserving positions */
  useEffect(() => {
    const prev = new Map(nodesRef.current.map((n) => [n.id, n]));
    const ids   = [...nodeMap.keys()];
    const place = ringPlace(ids.filter((id) => !prev.has(id)), dims.w, dims.h);

    nodesRef.current = ids.map((id) => {
      const info = nodeMap.get(id)!;
      const p    = prev.get(id);
      const base = p ?? { x: place.get(id)?.x ?? dims.w / 2, y: place.get(id)?.y ?? dims.h / 2, vx: 0, vy: 0 };
      return {
        id, label: labelMap.get(id) ?? id, fullLabel: id,
        count: info.count, score: info.score, excerpts: info.excerpts,
        firstTurn: info.firstTurn, pulse: activeEvidence.includes(id),
        x: base.x, y: base.y, vx: base.vx, vy: base.vy,
      };
    });

    edgesRef.current = [...edgeMap.entries()].map(([k, v]) => {
      const [a, b] = k.split("\x00");
      return { from: a!, to: b!, weight: v.weight, turnIdx: v.turnIdx };
    });

    idxRef.current = new Map(nodesRef.current.map((n, i) => [n.id, i]));
  }, [nodeMap, edgeMap, labelMap, activeEvidence, dims]);

  /* draw loop */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) { animRef.current = requestAnimationFrame(draw); return; }
    const dpr  = window.devicePixelRatio || 1;
    const W    = canvas.width  / dpr;
    const H    = canvas.height / dpr;
    const ctx  = canvas.getContext("2d")!;
    tickRef.current++;
    const T    = tickRef.current;
    const PAD  = 55;

    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const idx   = idxRef.current;
    const cx = W / 2, cy = H / 2;

    /* physics */
    for (const n of nodes) {
      n.vx += (cx - n.x) * 0.0015;
      n.vy += (cy - n.y) * 0.0015;
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!, b = nodes[j]!;
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = Math.max(dx * dx + dy * dy, 1);
        const f  = 3200 / d2;
        a.vx += dx * f; a.vy += dy * f;
        b.vx -= dx * f; b.vy -= dy * f;
      }
    }
    for (const e of edges) {
      const ai = idx.get(e.from), bi = idx.get(e.to);
      if (ai == null || bi == null) continue;
      const a = nodes[ai]!, b = nodes[bi]!;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d  = Math.sqrt(dx * dx + dy * dy) + 0.01;
      const rest = Math.max(70, 120 - e.weight * 12);
      const f  = (d - rest) * 0.018;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }
    for (const n of nodes) {
      n.vx *= 0.80; n.vy *= 0.80;
      n.x = Math.max(PAD, Math.min(W - PAD, n.x + n.vx));
      n.y = Math.max(PAD, Math.min(H - PAD, n.y + n.vy));
    }

    /* clear */
    ctx.clearRect(0, 0, W, H);

    /* bg glow */
    const bg = ctx.createRadialGradient(cx, cy * 0.55, 0, cx, cy, Math.max(W, H) * 0.75);
    bg.addColorStop(0, "rgba(99,102,241,0.07)");
    bg.addColorStop(0.5, "rgba(20,184,166,0.03)");
    bg.addColorStop(1, "transparent");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    /* edges */
    for (const e of edges) {
      const ai = idx.get(e.from), bi = idx.get(e.to);
      if (ai == null || bi == null) continue;
      const a = nodes[ai]!, b = nodes[bi]!;
      const col = tc(e.turnIdx);
      const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      grad.addColorStop(0, col + "55");
      grad.addColorStop(1, tc(nodes[bi]!.firstTurn) + "44");

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 1 + e.weight * 0.4;
      ctx.setLineDash([5, 9]);
      ctx.lineDashOffset = -(T * 0.3);
      ctx.globalAlpha = 0.65;
      const mx = (a.x + b.x) / 2 + (b.y - a.y) * 0.12;
      const my = (a.y + b.y) / 2 - (b.x - a.x) * 0.12;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo(mx, my, b.x, b.y);
      ctx.stroke();
      ctx.restore();
    }

    /* nodes */
    for (const n of nodes) {
      const col   = tc(n.firstTurn);
      const baseR = Math.max(18, 14 + n.count * 4 + n.score * 5);
      const pulse = n.pulse ? 1 + Math.sin(T * 0.1) * 0.18 : 1;
      const R     = baseR * pulse;
      const isSel = selected?.id === n.id;

      /* outer glow */
      const glowR = R + (isSel ? 14 : 8) + (n.pulse ? Math.sin(T * 0.1) * 4 : 0);
      const glow  = ctx.createRadialGradient(n.x, n.y, R * 0.5, n.x, n.y, glowR);
      glow.addColorStop(0, col + (isSel ? "55" : "33"));
      glow.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      /* node body */
      const ng = ctx.createRadialGradient(n.x - R * 0.3, n.y - R * 0.3, 0, n.x, n.y, R);
      ng.addColorStop(0, lightenHex(col));
      ng.addColorStop(0.65, col);
      ng.addColorStop(1, darkenHex(col));
      ctx.beginPath();
      ctx.arc(n.x, n.y, R, 0, Math.PI * 2);
      ctx.fillStyle = ng;
      ctx.fill();

      /* border */
      ctx.beginPath();
      ctx.arc(n.x, n.y, R, 0, Math.PI * 2);
      ctx.strokeStyle = isSel ? "#ffffff55" : "#ffffff1a";
      ctx.lineWidth = isSel ? 2 : 1;
      ctx.stroke();

      /* pulse orbit */
      if (n.pulse || isSel) {
        const or = R + 5 + Math.sin(T * 0.12) * 3;
        ctx.beginPath();
        ctx.arc(n.x, n.y, or, 0, Math.PI * 2);
        ctx.strokeStyle = col + "88";
        ctx.lineWidth   = 1.5;
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = T * 0.5;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      /* citation count badge (top-right) */
      if (n.count > 1) {
        const bx = n.x + R * 0.72, by = n.y - R * 0.72;
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#0f172a";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(bx, by, 8, 0, Math.PI * 2);
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.font = "bold 8px ui-sans-serif";
        ctx.fillStyle = col;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(n.count), bx, by);
      }

      /* label — always inside node */
      const maxChars = Math.max(4, Math.floor(R / 5.5));
      const short  = n.label.length > maxChars ? n.label.slice(0, maxChars - 1) + "…" : n.label;
      const fsize  = Math.max(10, Math.min(13, R * 0.62));
      ctx.font = `600 ${fsize}px "PingFang SC","Microsoft YaHei",ui-sans-serif`;
      ctx.textAlign    = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle    = "#ffffff";
      ctx.shadowColor  = "rgba(0,0,0,0.6)";
      ctx.shadowBlur   = 4;
      ctx.fillText(short, n.x, n.y);
      ctx.shadowBlur = 0;
    }

    animRef.current = requestAnimationFrame(draw);
  }, [selected]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [draw]);

  /* DPR canvas resize */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dims.w < 2 || dims.h < 2) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = dims.w * dpr;
    canvas.height = dims.h * dpr;
    canvas.style.width  = `${dims.w}px`;
    canvas.style.height = `${dims.h}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
  }, [dims]);

  /* click → select or deselect */
  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const r  = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const hit = nodesRef.current.find((n) => {
      const R = Math.max(18, 14 + n.count * 4 + n.score * 5) + 6;
      return Math.hypot(n.x - px, n.y - py) <= R;
    });
    setSel(hit ?? null);
    setTooltip(null);
  }

  /* hover tooltip */
  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const r  = (e.target as HTMLCanvasElement).getBoundingClientRect();
    const px = e.clientX - r.left, py = e.clientY - r.top;
    const hit = nodesRef.current.find((n) => {
      const R = Math.max(18, 14 + n.count * 4 + n.score * 5) + 6;
      return Math.hypot(n.x - px, n.y - py) <= R;
    });
    if (hit) {
      setTooltip({ x: e.clientX - r.left, y: e.clientY - r.top, node: hit });
    } else {
      setTooltip(null);
    }
  }

  const nodeCount  = [...nodeMap.keys()].length;
  const edgeCount  = edgeMap.size;
  const isEmpty    = nodeCount === 0 && !running;

  return (
    <aside className="ua-constellation" aria-label="知识星图">

      {/* ── Header ── */}
      <header className="ua-constellation-head">
        <div className="ua-constellation-title">
          <span className="ua-constellation-kicker">Knowledge Graph</span>
          <strong className="ua-constellation-name">知识引用图谱</strong>
          <em>
            {isEmpty
              ? "发起提问后，AI 引用的知识将在此可视化"
              : `本次对话引用了 ${nodeCount} 个知识片段，跨 ${turnCount} 轮对话`}
          </em>
        </div>
        {onClose && (
          <button type="button" className="ua-constellation-close" onClick={onClose} aria-label="关闭">×</button>
        )}
      </header>

      {/* ── How-it-works guide strip (only when has data) ── */}
      {!isEmpty && (
        <div className="ua-constellation-guide">
          <span>● 节点 = 知识片段，越大被引用越多</span>
          <span>⌇ 连线 = 同一回答中共同出现</span>
          <span>颜色 = 第几轮对话引入</span>
        </div>
      )}

      {/* ── Turn legend (color → turn) ── */}
      {!isEmpty && turnCount > 1 && (
        <div className="ua-constellation-turns">
          {Array.from({ length: turnCount }, (_, i) => (
            <span key={i} className="ua-constellation-turn-badge" style={{ background: tc(i) + "22", color: tc(i), borderColor: tc(i) + "55" }}>
              第 {i + 1} 轮
            </span>
          ))}
        </div>
      )}

      {/* ── Canvas ── */}
      <div ref={wrapRef} className="ua-constellation-canvas-wrap">
        {isEmpty ? (
          <div className="ua-constellation-empty">
            <div className="ua-constellation-diagram" aria-hidden>
              {/* Mini illustrative diagram */}
              <svg width="120" height="80" viewBox="0 0 120 80">
                <circle cx="60" cy="40" r="14" fill="#6366f122" stroke="#818cf8" strokeWidth="1.5" />
                <circle cx="20" cy="20" r="8"  fill="#34d39922" stroke="#34d399" strokeWidth="1" />
                <circle cx="100" cy="18" r="8" fill="#f472b622" stroke="#f472b6" strokeWidth="1" />
                <circle cx="18" cy="62" r="6"  fill="#fbbf2422" stroke="#fbbf24" strokeWidth="1" />
                <circle cx="102" cy="60" r="6" fill="#38bdf822" stroke="#38bdf8" strokeWidth="1" />
                <line x1="60" y1="40" x2="20" y2="20" stroke="#818cf844" strokeWidth="1" strokeDasharray="3 4" />
                <line x1="60" y1="40" x2="100" y2="18" stroke="#818cf844" strokeWidth="1" strokeDasharray="3 4" />
                <line x1="60" y1="40" x2="18" y2="62" stroke="#818cf844" strokeWidth="1" strokeDasharray="3 4" />
                <line x1="60" y1="40" x2="102" y2="60" stroke="#818cf844" strokeWidth="1" strokeDasharray="3 4" />
                <text x="60" y="44" textAnchor="middle" fill="#818cf8" fontSize="9" fontWeight="600">AI</text>
              </svg>
            </div>
            <p>知识引用图谱</p>
            <em>AI 每次回答时引用的知识片段<br />将以节点形式实时出现在此处</em>
          </div>
        ) : (
          <>
            <canvas
              ref={canvasRef}
              className="ua-constellation-canvas"
              onClick={onCanvasClick}
              onMouseMove={onMouseMove}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: tooltip ? "pointer" : "default" }}
            />
            {/* Hover tooltip */}
            {tooltip && !selected && (
              <div
                className="ua-constellation-tooltip"
                style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
              >
                <strong>{tooltip.node.fullLabel}</strong>
                <span>引用 {tooltip.node.count} 次 · 第 {tooltip.node.firstTurn + 1} 轮引入</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Selected detail ── */}
      {selected && (
        <div className="ua-constellation-detail">
          <div className="ua-cd-head">
            <span className="ua-cd-dot" style={{ background: tc(selected.firstTurn) }} />
            <div className="ua-cd-meta">
              <strong title={selected.fullLabel}>{selected.fullLabel}</strong>
              <span>第 {selected.firstTurn + 1} 轮引入 · 共引用 {selected.count} 次</span>
            </div>
            <button type="button" onClick={() => setSel(null)} aria-label="关闭详情">×</button>
          </div>
          {selected.excerpts.length > 0 ? (
            <div className="ua-cd-excerpts">
              {selected.excerpts.map((ex, i) => (
                <blockquote key={i} style={{ borderLeftColor: tc(selected.firstTurn) }}>{ex}</blockquote>
              ))}
            </div>
          ) : (
            <p className="ua-cd-noex">暂无摘录，继续对话可积累更多来源内容。</p>
          )}
        </div>
      )}
    </aside>
  );
}

/* ─── color helpers ──────────────────────────────────────── */
function lightenHex(hex: string) {
  const [r, g, b] = parseHex(hex);
  return `rgb(${Math.min(255, r + 75)},${Math.min(255, g + 75)},${Math.min(255, b + 75)})`;
}
function darkenHex(hex: string) {
  const [r, g, b] = parseHex(hex);
  return `rgb(${Math.max(0, r - 35)},${Math.max(0, g - 35)},${Math.max(0, b - 35)})`;
}
function parseHex(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
