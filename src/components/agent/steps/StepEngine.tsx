import { useState } from "react";
import { AGENT_SKILLS, getSkill, runSkill } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

export function StepEngine() {
  const [skillId, setSkillId] = useState(AGENT_SKILLS[0]!.id);
  const skill = getSkill(skillId) ?? AGENT_SKILLS[0]!;
  const [pc, setPc] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const op = skill.steps[pc];

  function reset() {
    setPc(0);
    setLog([]);
  }

  async function stepOnce() {
    if (!op || running) return;
    setRunning(true);
    const { trace } = await runSkill(
      { ...skill, steps: [op] },
      skill.description,
      undefined,
      { snapshotRoot: document.body },
    );
    const row = trace[0];
    setLog((prev) => [...prev, `pc=${pc} ${row?.ok ? "ok" : "fail"} ${op.tool} ${row?.ms ?? 0}ms`]);
    setPc((n) => Math.min(n + 1, skill.steps.length));
    setRunning(false);
  }

  return (
    <StepShell id="engine">
      <div className="agent-step-actions">
        <select value={skillId} onChange={(e) => { setSkillId(e.target.value); reset(); }} aria-label="选择 Skill">
          {AGENT_SKILLS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id}
            </option>
          ))}
        </select>
        <button type="button" disabled={!op || running} onClick={() => void stepOnce()}>
          {running ? "dispatch…" : "step()"}
        </button>
        <button type="button" onClick={reset}>
          reset
        </button>
        <span>
          pc = {pc} / {skill.steps.length}
        </span>
      </div>
      <ol className="agent-step-ir">
        {skill.steps.map((s, i) => (
          <li key={s.id} className={i === pc ? "is-pc" : i < pc ? "is-done" : ""}>
            <em>{i}</em>
            <code>{s.tool}</code>
            <span>{s.label}</span>
          </li>
        ))}
      </ol>
      {log.length > 0 && <p className="agent-step-sample">{log[log.length - 1]}</p>}
    </StepShell>
  );
}
