import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATALOG_SETS_EVENT,
  currentHearing,
  decisionFork,
  hearSet,
  listVersions,
  matchesLiveCatalog,
  restoreCatalogSet,
  type CatalogSet,
  type DecisionFork,
  type ForkSide,
} from "../../../lib/catalogSets";
import { SKILL_PUBLISH_EVENT } from "../../../lib/skillCompareStore";

function ForkLane({ side, split, said }: { side: ForkSide; split: boolean; said?: boolean }) {
  const max = Math.max(side.score, ...side.board.map((row) => row.score), 1);
  return (
    <section className={`ua-fork-lane${split ? " is-split" : ""}`}>
      <em>{side.label}</em>
      <strong className="ua-fork-who">{side.who}</strong>
      <p className="ua-fork-score">
        <b>{side.score}</b>
        <span>分 · 领先 {side.margin}</span>
      </p>
      <p className="ua-fork-rule">{side.rule}</p>
      {side.hits.length ? (
        <p className="ua-fork-hits">{side.hits.map((hit) => <span key={hit}>{hit}</span>)}</p>
      ) : null}
      {side.board.length ? (
        <ol className="ua-fork-board">
          {side.board.map((row) => (
            <li key={row.name}>
              <span>{row.name}</span>
              <i><b style={{ width: `${Math.round((row.score / max) * 100)}%` }} /></i>
              <em>{row.score}</em>
            </li>
          ))}
        </ol>
      ) : null}
      {side.said ? <p className={`ua-fork-said${said || split ? " is-split" : ""}`}>{side.said}</p> : null}
    </section>
  );
}

const SWITCH_FROM_KEY = "oa-ver-from";

function switchedFromOrigin(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const origin = sessionStorage.getItem(SWITCH_FROM_KEY);
  const hearing = currentHearing()?.id ?? null;
  return Boolean(origin && hearing && origin !== hearing);
}

function currentVersionId(versions: CatalogSet[]): string | null {
  const hearing = currentHearing();
  if (hearing && versions.some((set) => set.id === hearing.id)) return hearing.id;
  return versions.find((set) => matchesLiveCatalog(set))?.id ?? null;
}

/** 和「回放决策」同一行：点版本名展开列表，选中就切换。 */
export function ReplyVersionSwitch({
  disabled,
  canAskAgain,
  query = "",
  onAskAgain,
  onSwitched,
}: {
  disabled?: boolean;
  canAskAgain: boolean;
  query?: string;
  onAskAgain: () => void;
  onSwitched?: () => void;
}) {
  const [versions, setVersions] = useState<CatalogSet[]>(() => listVersions());
  const [currentId, setCurrentId] = useState<string | null>(() => currentVersionId(listVersions()));
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [switched, setSwitched] = useState(() => switchedFromOrigin());
  const [fork, setFork] = useState<{ id: string; top: number; left: number; data: DecisionFork } | null>(null);
  const forkRef = useRef<HTMLElement>(null);
  const baselineRef = useRef(currentVersionId(listVersions()));
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const refresh = () => {
      const next = listVersions();
      setVersions(next);
      setCurrentId(currentVersionId(next));
      setOpen(false);
      setFork(null);
    };
    window.addEventListener(CATALOG_SETS_EVENT, refresh);
    window.addEventListener(SKILL_PUBLISH_EVENT, refresh);
    return () => {
      window.removeEventListener(CATALOG_SETS_EVENT, refresh);
      window.removeEventListener(SKILL_PUBLISH_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    if (!open && !fork) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target) || forkRef.current?.contains(target)) return;
      setOpen(false);
      setFork(null);
    };
    const closeScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeScroll, true);
    };
  }, [open, fork]);

  const asked = query.trim();
  const diffIds = useMemo(() => {
    const ids = new Set<string>();
    if (!open || !asked) return ids;
    for (const set of versions) {
      if (set.id !== currentId && hearSet(asked, set)) ids.add(set.id);
    }
    return ids;
  }, [open, asked, versions, currentId]);
  if (!versions.length) return null;
  const current = versions.find((set) => set.id === currentId) ?? null;
  const ranked = open
    ? [...versions].sort((a, b) => {
        if (a.id === currentId) return -1;
        if (b.id === currentId) return 1;
        return Number(diffIds.has(b.id)) - Number(diffIds.has(a.id));
      })
    : versions;

  function apply(id: string) {
    setOpen(false);
    setFork(null);
    if (id === currentId) return;
    const name = versions.find((set) => set.id === id)?.name ?? "";
    const result = restoreCatalogSet(id);
    if (!result.ok) {
      setNote(result.reason ?? "没有切换");
      return;
    }
    setCurrentId(id);
    if (!sessionStorage.getItem(SWITCH_FROM_KEY) && baselineRef.current) {
      sessionStorage.setItem(SWITCH_FROM_KEY, baselineRef.current);
    }
    const origin = sessionStorage.getItem(SWITCH_FROM_KEY);
    const moved = Boolean(origin && origin !== id);
    if (!moved) sessionStorage.removeItem(SWITCH_FROM_KEY);
    setSwitched(moved);
    setNote(name ? `已换到「${name}」` : null);
    onSwitched?.();
  }

  function showFork(set: CatalogSet, anchor: HTMLElement) {
    const data = decisionFork(asked, set);
    if (!data) return;
    const rect = anchor.getBoundingClientRect();
    const width = Math.min(560, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
    const below = rect.bottom + 8;
    const top = below + 320 > window.innerHeight ? Math.max(12, rect.top - 328) : below;
    setOpen(false);
    setFork({ id: set.id, top, left, data });
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
              {ranked.map((set) => {
                const differs = diffIds.has(set.id);
                return (
                  <span key={set.id} className={set.id === currentId ? "ua-reply-opt on" : "ua-reply-opt"}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={set.id === currentId}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        apply(set.id);
                      }}
                    >
                      <span>{set.name}</span>
                      {set.id === currentId ? <em>当前</em> : null}
                    </button>
                    {differs ? (
                      <button
                        type="button"
                        className="ua-reply-diff"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          showFork(set, event.currentTarget);
                        }}
                      >
                        不同
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </span>,
            document.body,
          )
        : null}
      {fork
        ? createPortal(
            <article ref={forkRef} className="ua-fork" style={{ top: fork.top, left: fork.left }}>
              <header className="ua-fork-head">
                <strong>决策分叉</strong>
                <span>{fork.data.query}</span>
                <button type="button" onClick={() => setFork(null)}>关闭</button>
              </header>
              <p className="ua-fork-note">{fork.data.note}</p>
              <div className="ua-fork-grid">
                <ForkLane side={fork.data.live} split={fork.data.splitOn === "route"} />
                <span className="ua-fork-spine" aria-hidden><i /><b /><i /></span>
                <ForkLane side={fork.data.alt} split={fork.data.splitOn === "route"} said={fork.data.splitOn === "words"} />
              </div>
              <footer className="ua-fork-foot">
                <button
                  type="button"
                  disabled={disabled}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    apply(fork.id);
                  }}
                >
                  切换到这一版
                </button>
              </footer>
            </article>,
            document.body,
          )
        : null}
      {switched && canAskAgain ? (
        <button type="button" className="ua-reply-again-side" disabled={disabled} onClick={onAskAgain}>
          再问一次
        </button>
      ) : null}
      {note ? <span className={note.startsWith("已换到") ? "ua-reply-note is-ok" : "ua-reply-note"}>{note}</span> : null}
    </span>
  );
}
