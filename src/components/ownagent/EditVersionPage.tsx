import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { isAnswerLayerSkill } from "../../lib/agentSkills";
import {
  CATALOG_SETS_EVENT,
  deleteCatalogSet,
  listCatalogSets,
  promoteDraft,
  updateCatalogSet,
  type CatalogSet,
  type SetSkill,
} from "../../lib/catalogSets";
import { openProductView } from "./productNav";

const NOTE_KEY = "oa-version-saved";

function load(id: string | null): CatalogSet | null {
  if (!id) return null;
  return listCatalogSets().find((s) => s.id === id) ?? null;
}

/** 修改某一版或一份草稿的名称、备注，以及这一版里留哪些技能。 */
export function EditVersionPage() {
  const [params] = useSearchParams();
  const id = params.get("set");
  const [set, setSet] = useState<CatalogSet | null>(() => load(id));
  const [name, setName] = useState(() => load(id)?.name ?? "");
  const [note, setNote] = useState(() => load(id)?.note ?? "");
  const [skills, setSkills] = useState<SetSkill[]>(() => (load(id)?.skills ?? []).filter((s) => !isAnswerLayerSkill(s.id)));
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const next = load(id);
      if (!next) return;
      setSet(next);
    };
    window.addEventListener(CATALOG_SETS_EVENT, refresh);
    return () => window.removeEventListener(CATALOG_SETS_EVENT, refresh);
  }, [id]);

  function back() {
    openProductView(set?.status === "draft" ? "drafts" : "versions");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!set) return;
    const hidden = set.skills.filter((s) => isAnswerLayerSkill(s.id));
    updateCatalogSet(set.id, { name, note, skills: [...skills, ...hidden] });
    sessionStorage.setItem(NOTE_KEY, `已修改「${name.trim() || set.name}」`);
    openProductView(set.status === "draft" ? "drafts" : "versions");
  }

  function promote() {
    if (!set) return;
    const hidden = set.skills.filter((s) => isAnswerLayerSkill(s.id));
    updateCatalogSet(set.id, { name, note, skills: [...skills, ...hidden] });
    const saved = promoteDraft(set.id);
    if (!saved) return;
    sessionStorage.setItem(NOTE_KEY, `「${saved.name}」已存成版本`);
    openProductView("versions");
  }

  function remove() {
    if (!set) return;
    deleteCatalogSet(set.id);
    sessionStorage.setItem(NOTE_KEY, `已删除「${set.name}」`);
    openProductView(set.status === "draft" ? "drafts" : "versions");
  }

  if (!set) {
    return (
      <div className="oa-ui oa-page oa-vpage">
        <header className="oa-vpage-head">
          <div>
            <button type="button" className="oa-vpage-back" onClick={() => openProductView("versions")}>版本</button>
            <h1>找不到这一版</h1>
          </div>
        </header>
      </div>
    );
  }

  const isDraft = set.status === "draft";

  return (
    <div className="oa-ui oa-page oa-vpage">
      <form onSubmit={submit}>
        <header className="oa-vpage-head">
          <div>
            <button type="button" className="oa-vpage-back" onClick={back}>{isDraft ? "草稿库" : "版本"}</button>
            <h1>{isDraft ? "修改草稿" : "修改版本"}</h1>
            <p>只改这份记录。线上正在用的技能不会变。</p>
          </div>
          <div className="oa-vpage-actions">
            <button type="button" className="oa-vpage-ghost is-danger" onClick={() => setRemoving(true)}>删除</button>
            {isDraft ? <button type="button" className="oa-vpage-ghost" onClick={promote}>存成版本</button> : null}
            <button type="button" className="oa-vpage-ghost" onClick={back}>取消</button>
            <button type="submit" className="oa-vpage-primary">保存修改</button>
          </div>
        </header>
        <section className="oa-vpage-sheet">
          <div className="oa-vpage-fields">
            <label className="oa-vpage-name">
              <span>名称</span>
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="oa-vpage-note">
              <span>备注</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="这一版留作什么用" />
            </label>
          </div>
        </section>
        <section className="oa-vpage-sheet">
          <h2>这一版里的技能</h2>
          <ul className="oa-vpage-list">
            {skills.map((skill) => (
              <li key={skill.id} className="is-edit">
                <strong>{skill.name}</strong>
                <button
                  type="button"
                  className="oa-ver-link is-danger"
                  onClick={() => setSkills((rows) => rows.filter((row) => row.id !== skill.id))}
                >
                  拿掉
                </button>
              </li>
            ))}
            {!skills.length ? <li><strong>这一版里没有技能</strong><span>保存后，切回去会按这份空记录来。</span></li> : null}
          </ul>
        </section>
      </form>
      {removing ? (
        <div className="oa-draft-confirm">
          <p>删除「{set.name}」。线上正在用的技能不会变。</p>
          <div>
            <button type="button" className="oa-vpage-ghost" onClick={() => setRemoving(false)}>取消</button>
            <button type="button" className="oa-vpage-primary is-danger" onClick={remove}>删除</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
