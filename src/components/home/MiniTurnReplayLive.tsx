import { useEffect, useState } from "react";
import {
  DEMO_REPLAY_JOURNAL,
  DEMO_REPLAY_MS,
  DEMO_REPLAY_QUERY,
} from "../../data/turnReplayDemo";

const LABELS = ["读", "定", "取", "写"];

/** OwnAgent 首页预览 — 真实 Turn 回放缩略剧场（非 CSS 假动画） */
export function MiniTurnReplayLive() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setStep((s) => (s + 1) % (DEMO_REPLAY_JOURNAL.length + 1));
    }, 900);
    return () => clearInterval(tick);
  }, []);

  const activeNode = step < DEMO_REPLAY_JOURNAL.length ? DEMO_REPLAY_JOURNAL[step] : null;

  return (
    <div className="mini-live mini-turn-replay" onClick={(e) => e.stopPropagation()}>
      <div className="mini-live-head">
        <span className="live-pulse plaza">零 Token</span>
        <span className="mini-live-label">Turn 回放</span>
      </div>
      <p className="mini-turn-replay-q">{DEMO_REPLAY_QUERY}</p>
      <div className="mini-turn-replay-track">
        {LABELS.map((short, i) => (
          <span
            key={short}
            className={`mini-turn-replay-dot${i <= step ? " on" : ""}${i === step ? " current" : ""}`}
          >
            {short}
          </span>
        ))}
      </div>
      {activeNode && (
        <div className="mini-turn-replay-detail">
          <strong>{activeNode.label}</strong>
          <span>{activeNode.chips[0] ?? activeNode.hint}</span>
        </div>
      )}
      {step >= DEMO_REPLAY_JOURNAL.length && (
        <div className="mini-turn-replay-done">
          广场命中 · 省 ~820 Token · {(DEMO_REPLAY_MS / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}
