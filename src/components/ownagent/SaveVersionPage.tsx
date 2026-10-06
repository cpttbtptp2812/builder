import { useEffect, useMemo, useState, type FormEvent } from "react";
import { allRunnableSkills, isAnswerLayerSkill } from "../../lib/agentSkills";
import { saveCatalogSet, suggestedSetName, unpublishedLabels } from "../../lib/catalogSets";
import { skillLabel } from "../../lib/skillRouter";
import { openProductView } from "./productNav";

const SAVED_NOTE_KEY = "oa-version-saved";

/** 保存当前线上技能：单独一页，名称和备注写在这里。 */
export function SaveVersionPage() {
  const [name, setName] = useState(() => suggestedSetName());
  const [note, setNote] = useState("");
  const skills = useMemo(() => allRunnableSkills().filter((s) => !isAnswerLayerSkill(s.id)), []);
  const drafts = unpublishedLabels();

  useEffect(() => {
    const field = document.getElementById("oa-save-name");
    if (field instanceof HTMLInputElement) field.focus();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    const set = saveCatalogSet(name, note, "version");
    sessionStorage.setItem(SAVED_NOTE_KEY, `已保存「${set.name}」`);
    openProductView("compare");
  }

  function saveDraft() {
    const set = saveCatalogSet(name, note, "draft");
    sessionStorage.setItem(SAVED_NOTE_KEY, `已存草稿「${set.name}」`);
    openProductView("drafts");
  }

  return (
    <div className="oa-ui oa-page oa-vpage">
      <form onSubmit={submit}>
        <header className="oa-vpage-head">
          <div>
            <button type="button" className="oa-vpage-back" onClick={() => openProductView("compare")}>技能</button>
            <h1>保存当前版本</h1>
            <p>记下现在线上的技能。没发布的修改不会写入。</p>
          </div>
          <div className="oa-vpage-actions">
            <button type="button" className="oa-vpage-ghost" onClick={() => openProductView("compare")}>取消</button>
            <button type="button" className="oa-vpage-ghost" onClick={saveDraft}>存草稿</button>
            <button type="submit" className="oa-vpage-primary">保存</button>
          </div>
        </header>
        <section className="oa-vpage-sheet">
          <div className="oa-vpage-fields">
            <label className="oa-vpage-name">
              <span>名称</span>
              <input id="oa-save-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：上线前" />
            </label>
            <label className="oa-vpage-note">
              <span>备注</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="这一版留作什么用，客户确认了什么，改了哪些地方" />
            </label>
          </div>
          {drafts.length ? <p className="oa-vpage-warn">{drafts.join("、")}还没发布，不会进这一版。</p> : null}
        </section>
        <section className="oa-vpage-sheet">
          <h2>这一版会记下</h2>
          <ul className="oa-vpage-list">
            {skills.map((skill) => (
              <li key={skill.id}>
                <strong>{skillLabel(skill)}</strong>
                <span>{skill.description}</span>
              </li>
            ))}
          </ul>
        </section>
      </form>
    </div>
  );
}
