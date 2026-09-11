import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { getWork } from "../data/works";
import { WorkBuilder } from "./WorkBuilder";
import { WorkCmb } from "./WorkCmb";
import { WorkExtension } from "./WorkExtension";
import { WorkFee } from "./WorkFee";
import { WorkImean } from "./WorkImean";
import { WorkJianchi } from "./WorkJianchi";
import { WorkLocator } from "./WorkLocator";
import { WorkSdk } from "./WorkSdk";
import { WorkSse } from "./WorkSse";
import { WorkAgentTrace } from "./WorkAgentTrace";
import { WorkOwnAgent } from "./WorkOwnAgent";
import { WorkStreamProbe } from "./WorkStreamProbe";

/** 旧的散落入口 → OwnAgent 对应 Tab */
const LEGACY_PANEL: Record<string, string> = {
  agent: "chat",
  "dev-debug": "arch",
  skills: "skills",
  platform: "rag",
  eval: "eval",
  "agent-trace": "trace",
};

function ownAgentRedirect(slug: string, params: URLSearchParams): string | null {
  const panel = LEGACY_PANEL[slug];
  if (!panel) return null;
  const next = new URLSearchParams({ panel });
  const trySkill = params.get("try") ?? params.get("skill");
  if (panel === "skills" && trySkill) next.set("try", trySkill);
  return `/work/ownagent?${next.toString()}`;
}

export function WorkRouter() {
  const { slug } = useParams();
  const [params] = useSearchParams();

  const legacy = slug ? ownAgentRedirect(slug, params) : null;
  if (legacy) return <Navigate to={legacy} replace />;

  const work = slug ? getWork(slug) : null;
  if (!work) return <Navigate to="/" replace />;

  switch (work.kind) {
    case "product-tool":
      return <Navigate to="/tools/extensions" replace />;
    case "automation-chat":
      return <WorkImean />;
    case "flow-builder":
      return <WorkBuilder />;
    case "sse-lab":
      return <WorkSse />;
    case "stream-probe":
      return <WorkStreamProbe />;
    case "agent-trace":
      return <WorkAgentTrace />;
    case "own-agent":
      return <WorkOwnAgent />;
    case "locator-lab":
      return <WorkLocator />;
    case "extension-demo":
      return <WorkExtension />;
    case "replay-sdk":
      return <WorkSdk />;
    case "perf-lab":
      return <WorkJianchi />;
    case "multi-channel":
      return <WorkCmb />;
    case "micro-frontend":
      return <WorkFee />;
    default:
      return <Navigate to="/" replace />;
  }
}
