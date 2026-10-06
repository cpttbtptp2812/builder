import { useEffect, useState } from "react";
import {
  CATALOG_SETS_EVENT,
  deleteCatalogSet,
  formatSavedAt,
  listDrafts,
  promoteDraft,
  type CatalogSet,
} from "../../lib/catalogSets";
import { openProductView } from "./productNav";

const NOTE_KEY = "oa-version-saved";

/** 草稿库：还没存成版本的快照。不改线上正在用的技能。 */
export function DraftLibraryPage() {
  const [drafts, setDrafts] = useState<CatalogSet[]>(() => listDrafts());
  const [toast, setToast] = useState<string | null>(null);
  const [removing, setRemoving] = useState<CatalogSet | null>(null);

  useEffect(() => {
    const refresh = () => setDrafts(listDrafts());
    window.addEventListener(CATALOG_SETS_EVENT, refresh);
    return () => window.removeEventListener(CATALOG_SETS_EVENT, refresh);
  }, []);

  useEffect(() => {
    const note = sessionStorage.getItem(NOTE_KEY);
    if (!note) return;
    setToast(note);
    const clear = window.setTimeout(() => sessionStorage.removeItem(NOTE_KEY), 0);
    const hide = window.setTimeout(() => setToast(null), 2800);
    return () => {
      window.clearTimeout(clear);
      window.clearTimeout(hide);
    };
  }, []);

  function remove() {
    if (!removing) return;
    deleteCatalogSet(removing.id);
    setToast(`已删除草稿「${removing.name}」`);
    setRemoving(null);
  }

  function promote(set: CatalogSet) {
    const saved = promoteDraft(set.id);
    if (!saved) return;
    setToast(`「${saved.name}」已存成版本`);
  }

  return (
    <div className="oa-ui oa-page oa-vpage">
      {toast ? <div className="own-skm-toast" role="status">{toast}</div> : null}
      <header className="oa-vpage-head">
        <div>
          <button type="button" className="oa-vpage-back" onClick={() => openProductView("compare")}>技能</button>
          <h1>草稿库</h1>
          <p>先存下来，改完再决定要不要变成版本。草稿不会换掉线上正在用的技能。</p>
        </div>
        <div className="oa-vpage-actions">
          <button type="button" className="oa-vpage-primary" onClick={() => openProductView("savever")}>存一份草稿</button>
        </div>
      </header>
      {drafts.length ? (
        <ul className="oa-draft-list">
          {drafts.map((set) => (
            <li key={set.id}>
              <div>
                <strong>{set.name}</strong>
                <p>
                  {formatSavedAt(set.savedAt)}
                  {set.note ? ` · ${set.note}` : ""}
                </p>
              </div>
              <div className="oa-vpage-actions">
                <button type="button" className="oa-vpage-ghost" onClick={() => openProductView("editset", { set: set.id })}>修改</button>
                <button type="button" className="oa-vpage-ghost" onClick={() => openProductView("versions", { set: set.id })}>对比</button>
                <button type="button" className="oa-vpage-ghost" onClick={() => promote(set)}>存成版本</button>
                <button type="button" className="oa-vpage-ghost is-danger" onClick={() => setRemoving(set)}>删除</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <section className="oa-vpage-sheet">
          <h2>还没有草稿</h2>
          <p className="oa-draft-empty">保存当前版本时可以先存草稿，改名称和备注之后再存成版本。</p>
        </section>
      )}
      {removing ? (
        <div className="oa-draft-confirm">
          <p>删除草稿「{removing.name}」。线上正在用的技能不会变。</p>
          <div>
            <button type="button" className="oa-vpage-ghost" onClick={() => setRemoving(null)}>取消</button>
            <button type="button" className="oa-vpage-primary is-danger" onClick={remove}>删除</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
