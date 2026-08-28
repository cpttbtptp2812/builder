import { Navigate, useParams } from "react-router-dom";
import { getWork } from "../data/works";
import { WorkAgent } from "./WorkAgent";
import { WorkBuilder } from "./WorkBuilder";
import { WorkCmb } from "./WorkCmb";
import { WorkExtension } from "./WorkExtension";
import { WorkFee } from "./WorkFee";
import { WorkImean } from "./WorkImean";
import { WorkJianchi } from "./WorkJianchi";
import { WorkLocator } from "./WorkLocator";
import { WorkSdk } from "./WorkSdk";
import { WorkSse } from "./WorkSse";

export function WorkRouter() {
  const { slug } = useParams();
  const work = slug ? getWork(slug) : null;
  if (!work) return <Navigate to="/" replace />;

  switch (work.kind) {
    case "automation-chat": return <WorkImean />;
    case "agent-chat": return <WorkAgent />;
    case "flow-builder": return <WorkBuilder />;
    case "sse-lab": return <WorkSse />;
    case "locator-lab": return <WorkLocator />;
    case "extension-demo": return <WorkExtension />;
    case "replay-sdk": return <WorkSdk />;
    case "perf-lab": return <WorkJianchi />;
    case "multi-channel": return <WorkCmb />;
    case "micro-frontend": return <WorkFee />;
    default: return <Navigate to="/" replace />;
  }
}
