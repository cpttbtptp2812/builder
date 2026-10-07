import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CATALOG_SETS_EVENT,
  activeVersionId,
  decisionFork,
  hearSet,
  listVersions,
  scoreVersion,
  skillsForVersion,
  type CatalogSet,
  type DecisionFork,
  type ForkSide,
  type VersionScorecard,
} from "../../../lib/catalogSets";
import { SKILL_PUBLISH_EVENT } from "../../../lib/skillCompareStore";

function ScoreList({ card, baseline }: { card: VersionScorecard; baseline: string }) {
  const changed = card.rows.filter((row) => row.moved || row.liveOk !== row.altOk);
  if (!changed.length) return <p className="ua-score-empty">这 {card.total} 题和{baseline}走得一样。</p>;
  return (
    <ol>
      {changed.map((row) => (
        <li key={row.q}>
          <b>{row.note || row.q}</b>
          <span>{baseline}交给{row.liveWho}{row.liveOk ? "，对了" : "，偏了"}。这一版交给{row.altWho}{row.altOk ? "，对了" : "，偏了"}。</span>
        </li>
      ))}
    </ol>
  );
}

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

export type ReplyVersionBinding = {
  messageId: string;
  versionId: string;
  originId: string;
  scorecard: VersionScorecard | null;
  note: string | null;
};

type PinnedReplyVersion = { versionId: string; originId: string };

/** 每条回复第一次出现时的版本。之后全局切换不能改写它。 */
const replyVersionLock = new Map<string, PinnedReplyVersion>();

export function rememberReplyVersion(messageId: string, versionId: string, originId = versionId, force = false) {
  if (!messageId || !versionId) return;
  if (!force && replyVersionLock.has(messageId)) return;
  replyVersionLock.set(messageId, { versionId, originId });
}

export function replyVersionFor(messageId: string): string | null {
  return replyVersionLock.get(messageId)?.versionId ?? null;
}

/** 和「回放决策」同一行：点版本名展开列表，选中就只切换这一条回复。 */
export function ReplyVersionSwitch({
  messageId,
  disabled,
  canAskAgain,
  query = "",
  versionId,
  originId,
  scorecard: _scorecard = null,
  noteText: _noteText = null,
  onBind,
  onAskAgain,
  onSwitched,
}: {
  messageId: string;
  disabled?: boolean;
  canAskAgain: boolean;
  query?: string;
  versionId?: string;
  originId?: string;
  scorecard?: VersionScorecard | null;
  noteText?: string | null;
  onBind: (binding: ReplyVersionBinding) => void;
  onAskAgain: (versionId: string) => void;
  onSwitched?: () => void;
}) {
  const [versions, setVersions] = useState<CatalogSet[]>(() => listVersions());
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [localNote, setLocalNote] = useState<string | null>(null);
  const [fork, setFork] = useState<{ id: string; top: number; left: number; data: DecisionFork } | null>(null);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [scorePos, setScorePos] = useState<{ top: number; left: number } | null>(null);
  const forkRef = useRef<HTMLElement>(null);
  const scoreRef = useRef<HTMLElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLSpanElement>(null);
  const onBindRef = useRef(onBind);
  const seededRef = useRef(false);
  const homeId = useRef<string | null>(originId ?? versionId ?? null);
  const originRef = useRef<string | null>(originId ?? versionId ?? null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [armedScore, setArmedScore] = useState<VersionScorecard | null>(null);
  if (!homeId.current && (originId || versionId)) homeId.current = originId ?? versionId ?? null;
  if (!originRef.current && (originId || versionId)) originRef.current = originId ?? versionId ?? null;
  if (!homeId.current) {
    const seen = activeVersionId();
    if (seen) {
      homeId.current = seen;
      if (!originRef.current) originRef.current = seen;
      rememberReplyVersion(messageId, seen, originRef.current);
    }
  }
  onBindRef.current = onBind;
  const labelId = originRef.current ?? homeId.current;
  const currentId = pickedId ?? labelId;
  const note = localNote;
  const switched = Boolean(pickedId && labelId && pickedId !== labelId);
  const activeCard = switched ? armedScore : null;

  useEffect(() => {
    if (versionId || seededRef.current) return;
    const id = originRef.current ?? homeId.current;
    if (!id) return;
    seededRef.current = true;
    rememberReplyVersion(messageId, id, id);
    onBindRef.current({ messageId, versionId: id, originId: id, scorecard: null, note: null });
  }, [versionId, messageId]);

  useEffect(() => {
    if (!originId || !versionId || originId === versionId) return;
    onBindRef.current({ messageId, versionId: originId, originId, scorecard: null, note: null });
  }, [originId, versionId, messageId]);

  useEffect(() => {
    const refresh = () => {
      setVersions(listVersions());
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
    if (!open && !fork && !scoreOpen) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target) || forkRef.current?.contains(target) || scoreRef.current?.contains(target)) return;
      setOpen(false);
      setFork(null);
      setScoreOpen(false);
    };
    const closeScroll = () => setOpen(false);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", closeScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", closeScroll, true);
    };
  }, [open, fork, scoreOpen]);

  const asked = query.trim();
  const diffIds = useMemo(() => {
    const ids = new Set<string>();
    if (!open || !asked) return ids;
    for (const set of versions) {
      if (set.id !== labelId && hearSet(asked, set, labelId)) ids.add(set.id);
    }
    return ids;
  }, [open, asked, versions, labelId]);
  if (!versions.length) return null;
  const current = versions.find((set) => set.id === labelId) ?? null;
  const baselineName = versions.find((set) => set.id === originId)?.name ?? "原来这版";
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
    const picked = versions.find((set) => set.id === id);
    const name = picked?.name ?? "";
    const origin = originRef.current ?? originId ?? homeId.current ?? id;
    originRef.current = origin;
    if (id === origin) {
      setPickedId(null);
      setArmedScore(null);
      setLocalNote(null);
      setScoreOpen(false);
      return;
    }
    const nextCard = picked ? scoreVersion(picked, skillsForVersion(origin)) : null;
    setPickedId(id);
    setArmedScore(nextCard);
    setScoreOpen(false);
    setLocalNote(name ? `已换到「${name}」` : null);
    onSwitched?.();
  }

  function askAgain() {
    if (!pickedId) return;
    const chosen = pickedId;
    setPickedId(null);
    setArmedScore(null);
    setLocalNote(null);
    setScoreOpen(false);
    onAskAgain(chosen);
  }

  function showFork(set: CatalogSet, anchor: HTMLElement) {
    const raw = decisionFork(asked, set, labelId);
    if (!raw) return;
    const data = current?.name ? { ...raw, live: { ...raw.live, label: current.name } } : raw;
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
        <span>{current?.name ?? (currentId ? "未选择" : versions[0]?.name ?? "未选择")}</span>
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
        <button type="button" className="ua-reply-again-side" disabled={disabled} onClick={askAgain}>
          再问一次
        </button>
      ) : null}
      {switched && activeCard ? (
        <button
          type="button"
          className="ua-reply-score"
          aria-expanded={scoreOpen}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const width = 360;
            setScorePos({ top: rect.bottom + 8, left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)) });
            setScoreOpen((value) => !value);
          }}
        >
          路由 {activeCard.altOk}/{activeCard.total}
        </button>
      ) : null}
      {switched && scoreOpen && activeCard && scorePos
        ? createPortal(
            <article ref={scoreRef} className="ua-score" style={{ top: scorePos.top, left: scorePos.left }}>
              <header>
                <strong>成绩单</strong>
                <span>固定 {activeCard.total} 题，这一版对 {activeCard.altOk}，{baselineName}对 {activeCard.liveOk}</span>
              </header>
              <ScoreList card={activeCard} baseline={baselineName} />
            </article>,
            document.body,
          )
        : null}
      {note ? <span className={note.startsWith("已换到") ? "ua-reply-note is-ok" : "ua-reply-note"}>{note}</span> : null}
    </span>
  );
}
