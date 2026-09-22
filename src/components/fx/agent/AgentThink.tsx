import { useEffect, useState } from "react";

const PHASES = [
  "正在分析问题…",
  "检索知识库…",
  "推理生成中…",
];

/** 思考中占位 — 带相位动画 */
export function AgentThink() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPhase((p) => (p + 1) % PHASES.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="ua-think">
      <div className="ua-think-dots">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
      <span className="ua-think-label" key={phase}>
        {PHASES[phase]}
      </span>
    </div>
  );
}
