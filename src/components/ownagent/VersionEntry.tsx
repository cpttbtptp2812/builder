import { useEffect, useRef, useState } from "react";
import {
  CATALOG_SETS_EVENT,
  currentHearing,
  deleteCatalogSet,
  listDrafts,
  listVersions,
  matchesLiveCatalog,
  restoreCatalogSet,
  unpublishedLabels,
  type CatalogSet,
} from "../../lib/catalogSets";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";
import { openProductView } from "./productNav";

/** 右上角：保存、草稿库、版本下拉。下拉里切换、对比、修改、删除。 */
export function VersionEntry({ onToast }: { onToast: (msg: string) => void }) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<CatalogSet[]>(() => listVersions());
  const [draftCount, setDraftCount] = useState(() => listDrafts().length);
  const [hearingId, setHearingId] = useState<string | null>(() => currentHearing()?.id ?? null);
  const [pending, setPending] = useState<CatalogSet | null>(null);
  const [removing, setRemoving] = useState<CatalogSet | null>(null);

  useEffect(() => {
    const refresh = () => {
      setSets(listVersions());
      setDraftCount(listDrafts().length);
      setHearingId(currentHearing()?.id ?? null);
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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  function close() {
    setOpen(false);
    setPending(null);
    setRemoving(null);
  }

  function remove() {
    if (!removing) return;
    const name = removing.name;
    deleteCatalogSet(removing.id);
    onToast(`已删除「${name}」`);
    setRemoving(null);
    setPending(null);
  }

  const liveMatchId = sets.find((set) => matchesLiveCatalog(set))?.id ?? null;
  const hearingMatches = hearingId != null && sets.some((set) => set.id === hearingId && matchesLiveCatalog(set));
  const currentId = hearingMatches ? hearingId : liveMatchId;
  const hearing = sets.find((s) => s.id === currentId) ?? null;
  const label = hearing?.name ?? "当前";
  const drafts = pending ? unpublishedLabels() : [];

  function restore() {
    if (!pending) return;
    const result = restoreCatalogSet(pending.id);
    if (!result.ok) {
      onToast(result.reason ?? "没有切换");
      setPending(null);
      return;
    }
    onToast(`已切到「${pending.name}」`);
    close();
  }

  return (
    <div className="oa-head-vers">
      <button type="button" className="oa-save-current" onClick={() => openProductView("savever")}>
        保存当前版本
      </button>
      <button type="button" className="oa-save-current" onClick={() => openProductView("drafts")}>
        草稿库{draftCount ? ` ${draftCount}` : ""}
      </button>
      <div className="oa-ver-wrap" ref={root}>
        <button type="button" className={open ? "oa-ver-btn on" : "oa-ver-btn"} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          <span className="oa-ver-kicker">版本</span>
          <strong>{label}</strong>
          <i aria-hidden />
        </button>
        {open ? (
          <div className="oa-ver-drop" role="menu">
            <ul>
              {sets.map((set) => (
                <li key={set.id}>
                  <button
                    type="button"
                    className={currentId === set.id ? "on" : ""}
                    onClick={() => {
                      if (currentId === set.id) return;
                      setRemoving(null);
                      setPending(set);
                    }}
                  >
                    <span>{set.name}</span>
                    {set.note ? <small>{set.note}</small> : null}
                    {currentId === set.id ? <em>当前</em> : null}
                  </button>
                  <div className="oa-ver-acts">
                    <button type="button" className="oa-ver-link" onClick={() => openProductView("editset", { set: set.id })}>
                      修改
                    </button>
                    {currentId === set.id ? null : (
                      <button type="button" className="oa-ver-link" onClick={() => openProductView("versions", { set: set.id })}>
                        对比
                      </button>
                    )}
                    <button
                      type="button"
                      className="oa-ver-link is-danger"
                      onClick={() => {
                        setPending(null);
                        setRemoving(set);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
              {!sets.length ? <li className="oa-ver-none">还没有保存过的版本</li> : null}
            </ul>
            {removing ? (
              <div className="oa-ver-drop-confirm">
                <p>删除「{removing.name}」。线上正在用的技能不会变。</p>
                <div>
                  <button type="button" onClick={() => setRemoving(null)}>取消</button>
                  <button type="button" className="is-danger" onClick={remove}>删除</button>
                </div>
              </div>
            ) : null}
            {pending && !removing ? (
              <div className="oa-ver-drop-confirm">
                <p>
                  切换到「{pending.name}」
                  {drafts.length ? `，${drafts.join("、")}里没发的修改会被盖掉` : ""}
                </p>
                <div>
                  <button type="button" onClick={() => setPending(null)}>取消</button>
                  <button type="button" className="is-primary" onClick={restore}>切换</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
