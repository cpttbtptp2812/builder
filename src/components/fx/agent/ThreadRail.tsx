/** 会话时间轴 — 一键跳到任意一轮 */
export function ThreadRail({
  items,
  activeId,
  onJump,
}: {
  items: { id: string; label: string; role: "user" | "assistant" }[];
  activeId?: string | null;
  onJump: (id: string) => void;
}) {
  if (items.length < 2) return null;
  return (
    <nav className="ua-rail" aria-label="会话时间轴">
      {items.map((it, i) => (
        <button
          key={it.id}
          type="button"
          className={`${it.role}${activeId === it.id ? " on" : ""}`}
          title={it.label}
          onClick={() => onJump(it.id)}
        >
          <i />
          <span>{i + 1}</span>
        </button>
      ))}
    </nav>
  );
}
