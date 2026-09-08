import { AGENT_SKILLS, getSkill } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

export function StepDsl() {
  const skill = getSkill("site-analyzer") ?? AGENT_SKILLS[0]!;
  return (
    <StepShell id="dsl">
      <p className="agent-step-sample">
        skillPath = <code>{skill.skillPath}</code>
      </p>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>field</th>
            <th>value</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>id</td>
            <td>
              <code>{skill.id}</code>
            </td>
          </tr>
          <tr>
            <td>triggers</td>
            <td>{skill.triggers.join(" · ")}</td>
          </tr>
          <tr>
            <td>tools</td>
            <td>{skill.tools.join(" · ")}</td>
          </tr>
          {skill.steps.map((s) => (
            <tr key={s.id}>
              <td>
                step <code>{s.id}</code>
              </td>
              <td>
                {s.tool} · {s.label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </StepShell>
  );
}
