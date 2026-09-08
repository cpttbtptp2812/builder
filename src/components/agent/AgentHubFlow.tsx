import type { CSSProperties } from "react";
import { STEP_REGISTRY, type StepId } from "./steps";

const ROWS: StepId[][] = [
  ["nlu", "intent", "entity", "plan", "context"],
  ["dsl", "manage", "pattern"],
  ["engine", "mech", "ctrl"],
  ["browser", "mcp", "kb"],
];

export function AgentHubFlow({
  activeId,
  onSelect,
}: {
  activeId: StepId;
  onSelect: (id: StepId) => void;
}) {
  return (
    <div className="hub-flow">
      <header className="hub-flow-head">
        <strong>点一步，看一步</strong>
        <span>不会自动切换，也不会离开本页</span>
      </header>
      <div className="hub-flow-board">
        {ROWS.map((row) => (
          <div key={row.join("-")} className="hub-flow-row" data-cols={row.length}>
            {row.map((id) => {
              const step = STEP_REGISTRY[id];
              const on = activeId === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`hub-flow-node${on ? " on" : ""}`}
                  style={{ "--hub-color": step.color } as CSSProperties}
                  aria-pressed={on}
                  onClick={() => onSelect(id)}
                >
                  <strong>{step.label}</strong>
                  <span>{step.sub}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
