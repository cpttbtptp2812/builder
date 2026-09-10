import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { getWork } from "../data/works";
import { WorkBuilder } from "./WorkBuilder";
import { WorkCmb } from "./WorkCmb";
import { WorkDevDebug } from "./WorkDevDebug";
import { WorkExtension } from "./WorkExtension";
import { WorkFee } from "./WorkFee";
import { WorkImean } from "./WorkImean";
import { WorkJianchi } from "./WorkJianchi";
import { WorkLocator } from "./WorkLocator";
import { WorkSdk } from "./WorkSdk";
import { WorkSse } from "./WorkSse";

const AGENT_SLUGS = new Set(["agent", "skills", "platform", "eval"]);

/** 旧 Agent 独立页 → 合并入口 + Tab */
function agentHubRedirect(slug: string, params: URLSearchParams): string | null {
  if (!AGENT_SLUGS.has(slug)) return null;
  const next = new URLSearchParams();
  if (slug === "skills") {
    next.set("panel", "skills");
    const trySkill = params.get("try") ?? params.get("skill");
    if (trySkill) next.set("try", trySkill);
  } else if (slug === "platform") {
    next.set("panel", "platform");
  } else if (slug === "eval") {
    next.set("panel", "eval");
  } else {
    next.set("step", "chat");
  }
  return `/work/dev-debug?${next.toString()}`;
}

export function WorkRouter() {
  const { slug } = useParams();
  const [params] = useSearchParams();

  const legacy = slug ? agentHubRedirect(slug, params) : null;
  if (legacy) return <Navigate to={legacy} replace />;

  const work = slug ? getWork(slug) : null;
  if (!work) return <Navigate to="/" replace />;

  switch (work.kind) {
    case "product-tool":
      return <Navigate to="/tools/extensions" replace />;
    case "dev-debug":
      return <WorkDevDebug />;
    case "automation-chat":
      return <WorkImean />;
    case "flow-builder":
      return <WorkBuilder />;
    case "sse-lab":
    case "stream-probe":
      return <WorkSse />;
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
