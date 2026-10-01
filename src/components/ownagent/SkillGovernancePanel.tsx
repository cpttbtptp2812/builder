import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient";

type Governance = {
  dependencyGraph: { nodes: string[]; edges: Array<{ from: string; to: string }> };
  ambiguity: { ambiguousCount: number; pairs: Array<{ skills: [string, string]; queryCount: number }> };
  impact: { changed: string[]; impacted: Array<{ skillId: string; distance: number }> };
};

export function SkillGovernancePanel() {
  const [report, setReport] = useState<Governance | null>(null);
  useEffect(() => {
    void apiFetch<Governance>("/skill-gate/governance").then((value) => setReport(value));
  }, []);
  if (!report) return null;
  return (
    <details className="oa-skill-governance">
      <summary>
        全局治理 · {report.dependencyGraph.nodes.length} Skills · {report.ambiguity.ambiguousCount} 条路由含糊
      </summary>
      <div>
        <p>依赖边：{report.dependencyGraph.edges.length || "无显式依赖"}</p>
        {report.dependencyGraph.edges.length ? (
          <ul>
            {report.dependencyGraph.edges.map((edge) => (
              <li key={`${edge.from}->${edge.to}`}>{edge.from} → {edge.to}</li>
            ))}
          </ul>
        ) : null}
        {report.ambiguity.pairs.length ? (
          <ul>
            {report.ambiguity.pairs.slice(0, 6).map((pair) => (
              <li key={pair.skills.join(":")}>
                {pair.skills.join(" ↔ ")} · {pair.queryCount} 条问法
              </li>
            ))}
          </ul>
        ) : <p>当前回归集没有同分路由。</p>}
      </div>
    </details>
  );
}
