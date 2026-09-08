import { useState } from "react";
import { getSkill, runSkill } from "../../../lib/agentSkills";
import { StepShell } from "./StepShell";

export function StepBrowser() {
  const [rows, setRows] = useState<{ tool: string; ms: number; ok: boolean }[]>([]);
  const [http, setHttp] = useState<{ status?: number; latencyMs?: number } | null>(null);
  const [running, setRunning] = useState(false);
  const skill = getSkill("site-analyzer");

  async function run() {
    if (!skill) return;
    setRunning(true);
    const { trace, result } = await runSkill(skill, "探活本站", undefined, { snapshotRoot: document.body });
    setRows(trace.map((t) => ({ tool: t.tool, ms: t.ms, ok: t.ok })));
    const dash = result.dashboard as { http?: { status?: number; latencyMs?: number } } | undefined;
    setHttp(dash?.http ?? null);
    setRunning(false);
  }

  return (
    <StepShell id="browser">
      <div className="agent-step-actions">
        <button type="button" onClick={() => void run()} disabled={running}>
          {running ? "probing…" : "http_probe 本页"}
        </button>
        {http && (
          <span>
            status {http.status ?? "—"} · {http.latencyMs ?? "—"}ms
          </span>
        )}
      </div>
      {rows.length > 0 && (
        <table className="agent-step-table">
          <thead>
            <tr>
              <th>tool</th>
              <th>ms</th>
              <th>ok</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tool} className={r.ok ? "is-ok" : "is-fail"}>
                <td>
                  <code>{r.tool}</code>
                </td>
                <td>{r.ms}</td>
                <td>{String(r.ok)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </StepShell>
  );
}
