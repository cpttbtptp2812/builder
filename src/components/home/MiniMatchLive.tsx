import { useEffect, useState } from "react";

const PRESET = "批量改价上架";
const MATCHES = [
  { title: "批量改价上架", score: 94 },
  { title: "异常订单排查", score: 87 },
];

/** 首页 iMean — 产品链路预览 */
export function MiniMatchLive() {
  const [phase, setPhase] = useState(0);
  const [scores, setScores] = useState([0, 0]);

  useEffect(() => {
    const cycle = () => {
      setPhase(0);
      setScores([0, 0]);
      window.setTimeout(() => setPhase(1), 500);
      MATCHES.forEach((m, i) => {
        window.setTimeout(() => {
          setScores((prev) => {
            const next = [...prev];
            next[i] = m.score;
            return next;
          });
        }, 900 + i * 350);
      });
      window.setTimeout(() => setPhase(2), 2400);
    };
    cycle();
    const loop = window.setInterval(cycle, 5800);
    return () => clearInterval(loop);
  }, []);

  return (
    <div className="mini-live mini-match" onClick={(e) => e.stopPropagation()}>
      <div className="mini-live-head">
        <span className="live-pulse">LIVE</span>
        <span className="mini-live-label">iMean 自动化</span>
      </div>
      <div className="mini-imean-body">
        <div className="mini-agent-bubble user sm">{PRESET}</div>
        {phase >= 1 && (
          <div className="mini-match-rows">
            {MATCHES.map((m, i) => (
              <div key={m.title} className="mini-bar-row">
                <span>{m.title}</span>
                <div className="mini-bar-track"><i style={{ width: `${scores[i]}%` }} /></div>
                <em>{scores[i] ? `${scores[i]}%` : "—"}</em>
              </div>
            ))}
          </div>
        )}
        {phase >= 2 && (
          <div className="mini-imean-replay">
            <span className="mini-replay-dot" /> DOM 回放执行中
          </div>
        )}
      </div>
    </div>
  );
}
