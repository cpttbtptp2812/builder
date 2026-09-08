import { useMemo, useState } from "react";
import { explainDiscovery } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

const SAMPLE = "对本站做发布前检查，探活并确认关键页面可访问";

export function StepIntent() {
  const [q, setQ] = useState(SAMPLE);
  const rows = useMemo(() => explainDiscovery(q), [q]);
  return (
    <StepShell id="intent">
      <input className="agent-step-input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="辨认意图输入" />
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>skill</th>
            <th>score</th>
            <th>breakdown</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.skill.id} className={i === 0 && r.score > 0 ? "is-top" : ""}>
              <td>
                <code>{r.skill.id}</code>
              </td>
              <td>{r.score}</td>
              <td>{r.breakdown.map((b) => `${b.trigger}+${b.points}`).join(" · ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StepShell>
  );
}
