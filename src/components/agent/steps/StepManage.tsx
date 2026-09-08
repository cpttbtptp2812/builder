import { useState } from "react";
import { StepShell } from "./StepShell";

type Job = { workflowId: string; version: string; status: "queued" | "running" | "done" };

const INITIAL: Job[] = [
  { workflowId: "wf_1a3c", version: "site-analyzer@local", status: "done" },
  { workflowId: "wf_2b90", version: "dom-probe@local", status: "queued" },
  { workflowId: "wf_88e1", version: "workflow-orchestrator@local", status: "running" },
];

function nextStatus(s: Job["status"]): Job["status"] {
  if (s === "queued") return "running";
  if (s === "running") return "done";
  return "done";
}

export function StepManage() {
  const [jobs, setJobs] = useState(INITIAL);

  function advance(id: string) {
    setJobs((prev) => prev.map((j) => (j.workflowId === id ? { ...j, status: nextStatus(j.status) } : j)));
  }

  function enqueue() {
    const n = jobs.length + 1;
    setJobs((prev) => [
      ...prev,
      { workflowId: `wf_${n.toString(16).padStart(4, "0")}`, version: "site-analyzer@local", status: "queued" },
    ]);
  }

  return (
    <StepShell id="manage">
      <div className="agent-step-actions">
        <button type="button" onClick={enqueue}>
          enqueue
        </button>
      </div>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>workflowId</th>
            <th>version pin</th>
            <th>status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.workflowId}>
              <td>
                <code>{j.workflowId}</code>
              </td>
              <td>{j.version}</td>
              <td>{j.status}</td>
              <td>
                <button type="button" disabled={j.status === "done"} onClick={() => advance(j.workflowId)}>
                  {j.status === "done" ? "done" : "advance"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </StepShell>
  );
}
