import { REPLAY_STEPS } from "../../data/scenarios";
import { useStore } from "../../store";

const MODES = [
  { id: "local", label: "本地执行", detail: "ReplaySDK 在当前 Tab 回放" },
  { id: "cloud", label: "云端调度", detail: "任务入队 → Worker 池执行" },
  { id: "remote", label: "远程 VNC", detail: "noVNC 接管目标浏览器" },
] as const;

export type ExecMode = (typeof MODES)[number]["id"];

export function ExecModeBar({
  mode,
  onChange,
}: {
  mode: ExecMode;
  onChange: (m: ExecMode) => void;
}) {
  const cur = MODES.find((m) => m.id === mode)!;
  return (
    <div className="exec-mode-bar">
      <span className="exec-mode-label">执行模式</span>
      {MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          className={mode === m.id ? "on" : ""}
          onClick={() => onChange(m.id)}
        >
          {m.label}
        </button>
      ))}
      <p className="exec-mode-detail">{cur.detail}</p>
    </div>
  );
}

/** DOM 回放进度 — 与 REPLAY_STEPS 对齐 */
export function ProcessStrip() {
  const replayActive = useStore((s) => s.replayActive);
  const replayStep = useStore((s) => s.replayStep);
  const total = REPLAY_STEPS.length;

  if (!replayActive) return null;

  const pct = Math.round(((replayStep + 1) / total) * 100);

  return (
    <div className="process-strip imean-process">
      <header>
        <strong>ReplaySDK 执行中</strong>
        <span>{pct}% · 步骤 {replayStep + 1}/{total}</span>
      </header>
      <div className="process-strip-track">
        <i style={{ width: `${pct}%` }} />
      </div>
      <ol>
        {REPLAY_STEPS.map((s, i) => (
          <li key={s.selector} className={i <= replayStep ? "on" : ""}>
            <code>{s.label}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
