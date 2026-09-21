import type { RouteScoreView } from "../../../lib/chatFrontier";

/** 路由置信度 — 对齐理论 intent / skill router */
export function RouteScoreChip({ route }: { route: RouteScoreView }) {
  const conf =
    route.path === "skill"
      ? Math.min(99, Math.round(40 + route.score * 18))
      : route.path === "multi"
        ? 88
        : route.path === "llm"
          ? 90
          : route.path === "eval"
            ? 100
            : route.path === "knowledge" || route.path === "about-site"
              ? 72
              : 55;

  return (
    <div className="ua-route" title={route.hits.join(" · ") || route.path}>
      <span className="ua-route-conf">{conf}%</span>
      <strong>{route.skillName || route.path}</strong>
      {route.hits.length > 0 && <em>{route.hits.slice(0, 2).join(" · ")}</em>}
    </div>
  );
}
