/** 离底时回到最新答复 */
export function ResultLocator({
  visible,
  label,
  onLocate,
}: {
  visible: boolean;
  label: string;
  onLocate: () => void;
}) {
  if (!visible) return null;
  return (
    <button type="button" className="ua-locator" onClick={onLocate}>
      <strong>回到最新答复</strong>
      <em>{label}</em>
      <span className="ua-locator-go" aria-hidden>
        ↓
      </span>
    </button>
  );
}
