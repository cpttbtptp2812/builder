import { useMemo, useState } from "react";
import { AGENT_SKILLS, explainDiscovery } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

const SAMPLE = "对本站做发布前检查，探活并确认关键页面可访问";

export function StepIntent() {
  const [q, setQ] = useState(SAMPLE);
  const rows = useMemo(() => explainDiscovery(q), [q]);
  const winner = rows.find((r) => r.score > 0);
  const qLower = q.trim().toLowerCase();

  return (
    <StepShell id="intent">
      <input className="agent-step-input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="辨认意图输入" />
      <p className="agent-step-sample">
        {winner ? (
          <>
            Top-1 = <code>{winner.skill.id}</code> · {winner.score} 分 · 其余丢掉
          </>
        ) : (
          <>全员 0 分，停住，不兜底乱走</>
        )}
      </p>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>skill</th>
            <th>score</th>
            <th>命中</th>
            <th>没打上的 trigger</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const missed = r.skill.triggers.filter((t) => !qLower.includes(t.toLowerCase()));
            return (
              <tr key={r.skill.id} className={i === 0 && r.score > 0 ? "is-top" : ""}>
                <td>
                  <code>{r.skill.id}</code>
                </td>
                <td>{r.score}</td>
                <td>
                  {r.breakdown.length
                    ? r.breakdown.map((b) => `${b.trigger}+${b.points}`).join(" · ")
                    : "—"}
                </td>
                <td className="is-mute">{missed.slice(0, 4).join(" · ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="agent-step-hint">长词 ≥4 字 +2，短词 +1。改问句看谁被抬高。</p>
      <ul className="step-live-triggers">
        {AGENT_SKILLS.flatMap((s) => s.triggers).filter((t, i, a) => a.indexOf(t) === i).slice(0, 18).map((t) => (
          <li key={t} data-hit={qLower.includes(t.toLowerCase()) ? "1" : "0"}>
            {t}
          </li>
        ))}
      </ul>
    </StepShell>
  );
}
