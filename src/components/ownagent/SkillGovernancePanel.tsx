import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/apiClient";
import { getSkill } from "../../lib/agentSkills";
import { skillDisplayTitle } from "./skillVerUi";

type Governance = {
  dependencyGraph: { nodes: string[]; edges: Array<{ from: string; to: string }> };
  ambiguity: { ambiguousCount: number; pairs: Array<{ skills: [string, string]; queryCount: number }> };
  impact: { changed: string[]; impacted: Array<{ skillId: string; distance: number }> };
};

function skillLabel(id: string): string {
  const skill = getSkill(id);
  return skill ? skillDisplayTitle(skill) : id;
}

function summaryText(calls: number, clashes: number): string {
  if (calls && clashes) return `有技能会调用别的技能，另外有 ${clashes} 句问法两套技能都想接`;
  if (calls) return "有技能会调用别的技能。改被调用的那个之前，先看谁还在用它";
  if (clashes) return `有 ${clashes} 句问法，两套技能都想接`;
  return "这些技能各自独立，也没有抢同一句问法";
}

export function SkillGovernancePanel() {
  const [report, setReport] = useState<Governance | null>(null);
  useEffect(() => {
    void apiFetch<Governance>("/skill-gate/governance").then((value) => setReport(value));
  }, []);
  if (!report) return null;

  const edges = report.dependencyGraph.edges;
  const pairs = report.ambiguity.pairs;

  return (
    <details className="oa-skill-governance">
      <summary>{summaryText(edges.length, report.ambiguity.ambiguousCount)}</summary>
      <div>
        {edges.length ? (
          <>
            <p>下面每一行，前面的技能会用到后面的技能。改后面那个时，先确认前面的还能用。</p>
            <ul>
              {edges.map((edge) => (
                <li key={`${edge.from}->${edge.to}`}>
                  {skillLabel(edge.from)} 会用到 {skillLabel(edge.to)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>现在没有技能去调用另一个技能。</p>
        )}
        {pairs.length ? (
          <>
            <p>下面这些问法，两套技能得分一样。客户说这句话时，可能进错技能。</p>
            <ul>
              {pairs.slice(0, 6).map((pair) => (
                <li key={pair.skills.join(":")}>
                  {pair.skills.map(skillLabel).join(" 和 ")}，有 {pair.queryCount} 句问法会撞在一起
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>现在没有两套技能在抢同一句问法。</p>
        )}
      </div>
    </details>
  );
}
