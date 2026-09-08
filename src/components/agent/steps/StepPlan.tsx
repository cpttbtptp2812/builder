import { AGENT_SKILLS, explainDiscovery } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

const SAMPLE = "对本站做发布前检查，探活并确认关键页面可访问";

export function StepPlan() {
  const top = explainDiscovery(SAMPLE)[0]?.skill ?? AGENT_SKILLS[0]!;
  const dag = [
    { id: "planner", role: "规划", out: top.plan[0] ?? "read context" },
    { id: "executor", role: "执行", out: top.plan.slice(1, -1).join(" → ") || "tools/call" },
    { id: "reviewer", role: "汇总", out: top.plan[top.plan.length - 1] ?? "summarize" },
  ];
  return (
    <StepShell id="plan">
      <p className="agent-step-sample">
        selected skill = <code>{top.id}</code>
      </p>
      <ol className="agent-step-dag agent-step-dag--roles">
        {dag.map((n, i) => (
          <li key={n.id}>
            <strong>{n.role}</strong>
            <code>{n.id}</code>
            <span>{n.out}</span>
            {i < dag.length - 1 ? <em>then</em> : null}
          </li>
        ))}
      </ol>
    </StepShell>
  );
}
