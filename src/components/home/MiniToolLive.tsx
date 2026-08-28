import { useEffect, useState } from "react";

const TOOLS = ["HTTP Probe", "Knowledge", "VNC Snapshot"];
const PHASES = ["SSE", "Reasoning", "Tool", "VNC"];

/** 首页 UniAgent — 产品界面预览 */
export function MiniToolLive() {
  const [phase, setPhase] = useState(0);
  const [tool, setTool] = useState(0);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setPhase((p) => {
        const next = (p + 1) % PHASES.length;
        if (next === 2) setTool((t) => (t + 1) % TOOLS.length);
        return next;
      });
    }, 1100);
    return () => clearInterval(tick);
  }, []);

  return (
    <div className="mini-live mini-agent" onClick={(e) => e.stopPropagation()}>
      <div className="mini-live-head">
        <span className="live-pulse indigo">LIVE</span>
        <span className="mini-live-label">UniAgent 对话</span>
      </div>
      <div className="mini-agent-body">
        <div className="mini-agent-chat">
          <div className="mini-agent-bubble user">发布前检查 staging</div>
          {phase >= 1 && (
            <div className="mini-agent-bubble reason">💭 匹配 DevOps 流程…</div>
          )}
          {phase >= 2 && (
            <div className="mini-agent-bubble tool">🔧 {TOOLS[tool]}</div>
          )}
          {phase >= 3 && (
            <div className="mini-agent-bubble vnc">🖥 noVNC 远程浏览器</div>
          )}
        </div>
        <div className="mini-agent-tags">
          {PHASES.map((p, i) => (
            <span key={p} className={i <= phase ? "on" : ""}>{p}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
