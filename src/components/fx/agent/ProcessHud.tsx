/** 处理中状态 — 与右侧路径图联动 */
export function ProcessHud({
  running,
  label,
  stepLabel,
  progress,
}: {
  running: boolean;
  stages?: unknown;
  toolCount?: number;
  streamChars?: number;
  label?: string;
  stepLabel?: string;
  progress?: number;
}) {
  if (!running) return null;
  return (
    <div className="ua-process-hud ua-process-hud-plain" aria-live="polite">
      <i className="ua-process-dot" aria-hidden />
      <div className="ua-process-copy">
        <strong>{stepLabel ?? label ?? "正在处理…"}</strong>
        {stepLabel && label && <span>{label}</span>}
      </div>
      {progress != null && progress > 0 && (
        <span className="ua-process-pct">{progress}%</span>
      )}
    </div>
  );
}
