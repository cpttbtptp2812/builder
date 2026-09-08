import { useMemo } from "react";
import { runRouterEval } from "../../../lib/evalHarness";
import { StepShell } from "./StepShell";

export function StepCtrl() {
  const rows = useMemo(() => runRouterEval(), []);
  const pass = rows.filter((r) => r.pass).length;
  return (
    <StepShell id="ctrl">
      <p className="agent-step-sample">
        accuracy = {pass}/{rows.length} · retry = exp backoff 200ms × 3
      </p>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>case</th>
            <th>expected</th>
            <th>predicted</th>
            <th>pass</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={r.pass ? "is-ok" : "is-fail"}>
              <td>{r.id}</td>
              <td>
                <code>{r.expectedSkillId}</code>
              </td>
              <td>
                <code>{r.predictedSkillId}</code>
              </td>
              <td>{r.pass ? "true" : "false"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StepShell>
  );
}
