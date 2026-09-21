import { useEffect, useMemo, useRef, useState } from "react";

export type PaletteItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  kbd?: string;
  run: () => void;
};

/** ⌘K / Ctrl+K 命令盘 */
export function OwnCommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (it) =>
        it.label.toLowerCase().includes(needle) ||
        it.hint?.toLowerCase().includes(needle) ||
        it.group.toLowerCase().includes(needle),
    );
  }, [items, q]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setIdx(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    setIdx(0);
  }, [q]);

  if (!open) return null;

  const groups = [...new Set(filtered.map((i) => i.group))];

  function choose(i: number) {
    const item = filtered[i];
    if (!item) return;
    item.run();
    onClose();
  }

  return (
    <div className="own-palette-back" onClick={onClose} role="presentation">
      <div
        className="own-palette"
        role="dialog"
        aria-label="命令"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIdx((n) => Math.min(filtered.length - 1, n + 1));
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            setIdx((n) => Math.max(0, n - 1));
          }
          if (e.key === "Enter") {
            e.preventDefault();
            choose(idx);
          }
        }}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="跳转、新会话、斜杠命令…"
        />
        <div className="own-palette-list">
          {filtered.length === 0 && <p className="own-palette-empty">没有匹配项</p>}
          {groups.map((g) => (
            <section key={g}>
              <header>{g}</header>
              {filtered
                .filter((i) => i.group === g)
                .map((it) => {
                  const i = filtered.indexOf(it);
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={i === idx ? "on" : ""}
                      onMouseEnter={() => setIdx(i)}
                      onClick={() => choose(i)}
                    >
                      <span>{it.label}</span>
                      {it.hint && <em>{it.hint}</em>}
                      {it.kbd && <kbd>{it.kbd}</kbd>}
                    </button>
                  );
                })}
            </section>
          ))}
        </div>
        <footer>
          <span>↑↓ 选择</span>
          <span>Enter 执行</span>
          <span>Esc 关闭</span>
        </footer>
      </div>
    </div>
  );
}
