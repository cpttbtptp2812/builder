import type { ReactNode } from "react";
import type { StepId } from "./registry";

export function StepShell({ id, children }: { id: StepId; children: ReactNode }) {
  return (
    <div className="agent-step-demo" data-step={id}>
      {children}
    </div>
  );
}
