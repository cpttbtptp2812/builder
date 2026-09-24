/** 对话快捷提问 — 资料库预制问句 + 能力演示句，点击即发送 */

export function ChatQuickPrompts({
  items,
  disabled,
  onPick,
  label = "快捷提问",
}: {
  items: { label: string; text: string; hint?: string }[];
  disabled?: boolean;
  onPick: (text: string) => void;
  label?: string;
}) {
  if (!items.length) return null;

  return (
    <div className="chat-quick-prompts">
      <span className="chat-quick-prompts-label">{label}</span>
      <div className="chat-quick-prompts-list">
        {items.map((item) => (
          <button
            key={item.text}
            type="button"
            className="chat-quick-prompts-chip"
            disabled={disabled}
            title={item.hint ?? item.text}
            onClick={() => onPick(item.text)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
