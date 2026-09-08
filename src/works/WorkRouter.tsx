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

const LEGACY_DEV_SLUGS = new Set(["agent", "skills", "platform", "eval"]);

/** 旧 slug → dev-debug tab */
function legacyTab(slug: string, trySkill: string | null) {
  if (slug === "skills" || trySkill) return "skills";
  if (slug === "platform") return "platform";
  if (slug === "eval") return "eval";
  return "agent";
}

export function WorkRouter() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const trySkill = params.get("try") ?? params.get("skill");

  if (slug && LEGACY_DEV_SLUGS.has(slug)) {
    const tab = legacyTab(slug, trySkill);
    const q = new URLSearchParams(params);
    q.set("tab", tab);
    if (trySkill && tab === "skills") q.set("try", trySkill);
    return <Navigate to={`/work/dev-debug?${q.toString()}`} replace />;
  }

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
