/** 紧凑可点击的处理状态 — 点击打开详情抽屉 */
export function FlowStatusChip({
  running,
  stepLabel,
  progress,
  onOpen,
  visible,
}: {
  running: boolean;
  stepLabel?: string;
  progress?: number;
  onOpen: () => void;
  visible: boolean;
}) {
  if (!visible) return null;

  const title = running
    ? stepLabel
      ? `正在${stepLabel}`
      : "正在处理"
    : "查看本轮处理路径";

  return (
    <div className="ua-flow-chip-row">
      <button type="button" className={`ua-flow-chip${running ? " running" : ""}`} onClick={onOpen} aria-live="polite">
        {running && <i className="ua-flow-chip-dot" aria-hidden />}
        <span className="ua-flow-chip-text">{title}</span>
        {progress != null && progress > 0 && (
          <span className="ua-flow-chip-pct">{progress}%</span>
        )}
        <span className="ua-flow-chip-action">查看详情</span>
      </button>
    </div>
  );
}
