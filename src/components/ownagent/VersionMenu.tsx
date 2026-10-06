import { useEffect, useRef, useState } from "react";
import {
  CATALOG_SETS_EVENT,
  currentHearing,
  listCatalogSets,
  restoreCatalogSet,
  saveCatalogSet,
  suggestedSetName,
  unpublishedLabels,
  updateCatalogSet,
  type CatalogSet,
} from "../../lib/catalogSets";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";

/** 右上角版本：保存、改备注、切换 */
export function VersionMenu({
  onToast,
  compareId,
  onCompare,
}: {
  onToast: (msg: string) => void;
  compareId?: string | null;
  onCompare?: (id: string | null) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState<CatalogSet[]>(() => listCatalogSets());
  const [hearingId, setHearingId] = useState<string | null>(() => currentHearing()?.id ?? null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    const refresh = () => {
      setSets(listCatalogSets());
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
      if (event.key === "Escape") setOpen(false);
    };
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  const hearing = sets.find((s) => s.id === hearingId) ?? null;
  const picked = sets.find((s) => s.id === pickedId) ?? null;
  const label = hearing?.name ?? "当前";

  function openMenu() {
    setSaving(false);
    setConfirming(false);
    setPickedId(hearingId);
    const current = listCatalogSets().find((s) => s.id === hearingId);
    setName(current?.name ?? "");
    setNote(current?.note ?? "");
    setOpen((v) => !v);
  }

  function pick(set: CatalogSet) {
    setPickedId(set.id);
    setName(set.name);
    setNote(set.note);
    setSaving(false);
    setConfirming(false);
  }

  function saveNew() {
    const set = saveCatalogSet(name, note);
    setSaving(false);
    setPickedId(set.id);
    setName(set.name);
    setNote(set.note);
    onToast(`已保存「${set.name}」`);
  }

  function saveEdit() {
    if (!picked) return;
    updateCatalogSet(picked.id, { name, note });
    onToast(`已保存「${name.trim() || picked.name}」`);
  }

  function restore() {
    if (!picked) return;
    const result = restoreCatalogSet(picked.id);
    setConfirming(false);
    if (!result.ok) {
      onToast(result.reason ?? "没有切换");
      return;
    }
    onToast(`已切换到「${picked.name}」`);
    setOpen(false);
  }

  const drafts = confirming && picked ? unpublishedLabels() : [];

  return (
    <div className="oa-ver-wrap" ref={root}>
      <button type="button" className={open ? "oa-ver-btn on" : "oa-ver-btn"} aria-expanded={open} onClick={openMenu}>
        <span>版本</span>
        <strong>{label}</strong>
      </button>
      {open ? (
        <div className="oa-ver-panel" role="dialog" aria-label="版本">
          {saving ? (
            <form
              className="oa-ver-form"
              onSubmit={(e) => {
                e.preventDefault();
                saveNew();
              }}
            >
              <p>记下现在线上的全部技能。</p>
              <label>
                名称
                <input value={name} autoFocus onChange={(e) => setName(e.target.value)} placeholder="例如：上线前" />
              </label>
              <label>
                备注
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="一句，方便以后认出来" />
              </label>
              <div className="oa-ver-form-actions">
                <button type="button" onClick={() => setSaving(false)}>
                  取消
                </button>
                <button type="submit" className="is-primary">
                  保存
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="oa-ver-save"
              onClick={() => {
                setSaving(true);
                setConfirming(false);
                setName(suggestedSetName());
                setNote("");
              }}
            >
              保存当前这套
            </button>
          )}

          <ul className="oa-ver-list">
            <li>
              <button
                type="button"
                className={!pickedId ? "on" : ""}
                onClick={() => {
                  setPickedId(null);
                  setConfirming(false);
                  setSaving(false);
                }}
              >
                <span className="oa-ver-name">当前线上</span>
                {!hearing ? <em>正在用</em> : null}
              </button>
            </li>
            {sets.map((set) => (
              <li key={set.id}>
                <button type="button" className={pickedId === set.id ? "on" : ""} onClick={() => pick(set)}>
                  <span className="oa-ver-name">{set.name}</span>
                  {set.note ? <span className="oa-ver-note">{set.note}</span> : null}
                  {hearingId === set.id ? <em>正在用</em> : null}
                </button>
              </li>
            ))}
          </ul>

          {picked && !saving ? (
            confirming ? (
              <div className="oa-ver-confirm">
                <p>
                        切到「{set.name}」后，线上就是这一版。
                  {drafts.length ? `${drafts.join("、")}里还没发的修改会被盖掉。` : ""}
                </p>
                <div className="oa-ver-form-actions">
                  <button type="button" onClick={() => setConfirming(false)}>
                    取消
                  </button>
                  <button type="button" className="is-primary" onClick={restore}>
                    确认切换
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="oa-ver-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveEdit();
                }}
              >
                <label>
                  名称
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                  备注
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="一句，方便以后认出来" />
                </label>
                <div className="oa-ver-ops">
                  {onCompare ? (
                    <button
                      type="button"
                      onClick={() => {
                        onCompare(compareId === picked.id ? null : picked.id);
                        setOpen(false);
                      }}
                    >
                      {compareId === picked.id ? "收起对比" : "和现在比"}
                    </button>
                  ) : null}
                  <button type="button" onClick={() => setConfirming(true)}>
                    切换到这一版
                  </button>
                  <button type="submit" className="is-primary">
                    保存备注
                  </button>
                </div>
              </form>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
