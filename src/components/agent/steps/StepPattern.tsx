import { useState } from "react";
import { StepShell } from "./StepShell";

const GRAPH: Record<"seq" | "par" | "branch", string> = {
  seq: "http_probe → browser_snapshot → compose",
  par: "http_probe  ∥  browser_snapshot   →   compose",
  branch: "http_probe  ─┬─ ok → snapshot\n            └─ fail → retry",
};

export function StepPattern() {
  const [mode, setMode] = useState<"seq" | "par" | "branch">("seq");
  return (
    <StepShell id="pattern">
      <div className="agent-step-modes">
        {(["seq", "par", "branch"] as const).map((m) => (
          <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>
            {m}
          </button>
        ))}
      </div>
      <pre className="agent-step-pre">{GRAPH[mode]}</pre>
    </StepShell>
  );
}
