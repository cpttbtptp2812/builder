/** 思考中占位 — 对齐 tianyangAgent Think */
export function AgentThink() {
  return (
    <div className="agent-think" aria-label="思考中">
      {[0, 1, 2].map((i) => (
        <span key={i} className="agent-think-dot" style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
    </div>
  );
}
