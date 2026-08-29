import type { TimeMachineStep } from "../../data/secretRomance";

function fmtTime(at: number) {
  const d = new Date(at);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

/** 右侧时光机 — 记录并回溯每一步 */
export function SecretTimeMachine({
  steps,
  activeId,
  onJump,
  collapsed,
  onToggle,
}: {
  steps: TimeMachineStep[];
  activeId: string | null;
  onJump: (step: TimeMachineStep) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className={`secret-time-machine${collapsed ? " collapsed" : ""}`}>
      <button
        type="button"
        className="secret-time-machine-toggle"
        onClick={onToggle}
        title={collapsed ? "展开时光机" : "收起时光机"}
      >
        {collapsed ? "⏳" : "▸"}
      </button>

      {!collapsed && (
        <>
          <header className="secret-time-machine-head">
            <h3>时光机</h3>
            <p>{steps.length} 步</p>
          </header>

          <ol className="secret-time-machine-track">
            {steps.map((step, i) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={`secret-time-machine-node${activeId === step.id ? " active" : ""}`}
                  onClick={() => onJump(step)}
                  title={step.detail}
                >
                  <span className="secret-time-machine-icon">{step.icon ?? "·"}</span>
                  <span className="secret-time-machine-body">
                    <strong>{step.label}</strong>
                    {step.detail && <small>{step.detail}</small>}
                    <time>{fmtTime(step.at)}</time>
                  </span>
                  <span className="secret-time-machine-idx">{i + 1}</span>
                </button>
              </li>
            ))}
          </ol>

          {steps.length === 0 && (
            <p className="secret-time-machine-empty">故事开始后会记录在这里</p>
          )}
        </>
      )}
    </aside>
  );
}
