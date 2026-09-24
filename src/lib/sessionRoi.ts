/** 会话 ROI — 广场优先省 Token（本地持久化，可对接 Admin API） */

const KEY = "ownagent-session-roi-v1";
const TOKENS_PER_AI_TURN = 820;

export type RoiSnapshot = {
  totalQueries: number;
  plazaHits: number;
  aiTurns: number;
  tokensSavedEst: number;
  lastPlazaQuery?: string;
  updatedAt: number;
};

function read(): RoiSnapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as RoiSnapshot;
  } catch {
    /* ignore */
  }
  return {
    totalQueries: 0,
    plazaHits: 0,
    aiTurns: 0,
    tokensSavedEst: 0,
    updatedAt: Date.now(),
  };
}

function write(s: RoiSnapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("ownagent:roi-updated"));
  } catch {
    /* ignore */
  }
}

export function getRoiSnapshot(): RoiSnapshot {
  return read();
}

export function recordTurnRoi(opts: { plazaHit: boolean; query: string }) {
  const prev = read();
  const next: RoiSnapshot = {
    ...prev,
    totalQueries: prev.totalQueries + 1,
    plazaHits: prev.plazaHits + (opts.plazaHit ? 1 : 0),
    aiTurns: prev.aiTurns + (opts.plazaHit ? 0 : 1),
    tokensSavedEst: prev.tokensSavedEst + (opts.plazaHit ? TOKENS_PER_AI_TURN : 0),
    lastPlazaQuery: opts.plazaHit ? opts.query.slice(0, 80) : prev.lastPlazaQuery,
    updatedAt: Date.now(),
  };
  write(next);
  return next;
}

export function plazaHitRate(s: RoiSnapshot): number {
  if (!s.totalQueries) return 0;
  return Math.round((s.plazaHits / s.totalQueries) * 100);
}
