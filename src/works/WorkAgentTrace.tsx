import { Navigate } from "react-router-dom";

/** 旧 Agent Trace 入口 → 合并进 OwnAgent */
export function WorkAgentTrace() {
  return <Navigate to="/work/ownagent?panel=trace" replace />;
}
