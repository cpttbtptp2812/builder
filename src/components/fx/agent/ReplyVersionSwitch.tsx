import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATALOG_SETS_EVENT,
  currentHearing,
  listVersions,
  matchesLiveCatalog,
  restoreCatalogSet,
  type CatalogSet,
} from "../../../lib/catalogSets";
import { SKILL_PUBLISH_EVENT } from "../../../lib/skillCompareStore";

function currentVersionId(versions: CatalogSet[]): string | null {
  const hearing = currentHearing();
  if (hearing && versions.some((set) => set.id === hearing.id && matchesLiveCatalog(set))) return hearing.id;
  return versions.find((set) => matchesLiveCatalog(set))?.id ?? null;
}

/** 和「回放决策」同一行：点版本名展开列表，选中就切换。 */
export function ReplyVersionSwitch({
  disabled,
  canAskAgain,
  onAskAgain,
  onSwitched,
}: {
  disabled?: boolean;
  canAskAgain: boolean;
  onAskAgain: () => void;
  onSwitched?: () => void;
}) {
  const [versions, setVersions] = useState<CatalogSet[]>(() => listVersions());
  const [currentId, setCurrentId] = useState<string | null>(() => currentVersionId(listVersions()));
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [switched, setSwitched] = useState(false);
  const baselineRef = useRef(currentVersionId(listVersions()));
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const refresh = () => {
      const next = listVersions();
      setVersions(next);
      setCurrentId(currentVersionId(next));
      setOpen(false);
    };
    window.addEventListener(CATALOG_SETS_EVENT, refresh);
    window.addEventListener(SKILL_PUBLISH_EVENT, refresh);
    return () => {
      window.removeEventListener(CATALOG_SETS_EVENT, refresh);
      window.removeEventListener(SKILL_PUBLISH_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const closeScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeScroll, true);
    };
  }, [open]);

  if (!versions.length) return null;
  const current = versions.find((set) => set.id === currentId) ?? null;

  function apply(id: string) {
    setOpen(false);
    if (id === currentId) return;
    const result = restoreCatalogSet(id);
    if (!result.ok) {
      setNote(result.reason ?? "没有切换");
      return;
    }
    setSwitched(id !== baselineRef.current);
    setNote(null);
    onSwitched?.();
  }

  return (
    <span className={`ua-reply-ver${open ? " is-open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="ua-reply-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setMenuPos({ top: rect.bottom + 6, left: rect.left });
          setOpen((value) => !value);
        }}
      >
        <em>版本:</em>
        <span>{current?.name ?? versions[0]?.name ?? "未选择"}</span>
        <i aria-hidden />
      </button>
      {open && menuPos
        ? createPortal(
            <span ref={menuRef} className="ua-reply-menu" role="listbox" style={{ top: menuPos.top, left: menuPos.left }}>
              {versions.map((set) => (
                <button
                  key={set.id}
                  type="button"
                  role="option"
                  aria-selected={set.id === currentId}
                  className={set.id === currentId ? "on" : ""}
                  onClick={() => apply(set.id)}
                >
                  <i aria-hidden />
                  <span>{set.name}</span>
                  {set.id === currentId ? <em>当前</em> : null}
                </button>
              ))}
            </span>,
            document.body,
          )
        : null}
      {switched && canAskAgain ? (
        <button type="button" className="ua-reply-again-side" disabled={disabled} onClick={onAskAgain}>
          再问一次
        </button>
      ) : null}
      {note ? <span className="ua-reply-note">{note}</span> : null}
    </span>
  );
}
