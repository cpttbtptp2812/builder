import { useEffect, useState } from "react";
import {
  CATALOG_SETS_EVENT,
  compareWithLive,
  currentHearing,
  listCatalogSets,
  restoreCatalogSet,
  saveCatalogSet,
  sentenceAgainstSet,
  suggestedSetName,
  unpublishedLabels,
  type CatalogSet,
  type SetDiff,
} from "../../lib/catalogSets";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";

function refreshSets() {
  return { sets: listCatalogSets(), hearing: currentHearing() };
}

/** 技能列表下方：展开「和现在比」的结果 */
export function CatalogSetDiffPanel({ setId, onClose }: { setId: string; onClose: () => void }) {
  const set = listCatalogSets().find((s) => s.id === setId) ?? null;
  const diff = set ? compareWithLive(set) : null;
  if (!set || !diff) return null;
  return (
    <section className="oa-sets-diff-panel">
      <header>
        <strong>和「{set.name}」比</strong>
        <button type="button" className="own-skill-inline-btn" onClick={onClose}>
          收起
        </button>
      </header>
      <SetDiffView name={set.name} diff={diff} />
    </section>
  );
}

/** @deprecated 用 VersionMenu + CatalogSetDiffPanel */
export function CatalogSetsBar({ onToast }: { onToast: (msg: string) => void }) {
  const [sets, setSets] = useState<CatalogSet[]>(() => listCatalogSets());
  const [hearing, setHearing] = useState<CatalogSet | null>(() => currentHearing());
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [compareId, setCompareId] = useState<string | null>(null);
  const [pending, setPending] = useState<CatalogSet | null>(null);

  useEffect(() => {
    const refresh = () => {
      const next = refreshSets();
      setSets(next.sets);
      setHearing(next.hearing);
    };
    window.addEventListener(CATALOG_SETS_EVENT, refresh);
    window.addEventListener(SKILL_PUBLISH_EVENT, refresh);
    return () => {
      window.removeEventListener(CATALOG_SETS_EVENT, refresh);
      window.removeEventListener(SKILL_PUBLISH_EVENT, refresh);
    };
  }, []);

  const compared = compareId ? sets.find((s) => s.id === compareId) ?? null : null;
  const diff = compared ? compareWithLive(compared) : null;
  const drafts = pending ? unpublishedLabels() : [];

  function save() {
    const set = saveCatalogSet(name);
    setNaming(false);
    onToast(`已存下「${set.name}」。`);
  }

  function restore() {
    if (!pending) return;
    const result = restoreCatalogSet(pending.id);
    setPending(null);
    if (!result.ok) {
      onToast(result.reason ?? "没有换回去");
      return;
    }
    onToast(`已切回「${pending.name}」。`);
  }

  return (
    <section className="oa-sets">
      {hearing ? <p className="oa-sets-hearing">当前版本是「{hearing.name}」。</p> : null}
      {naming ? (
        <div className="oa-sets-name">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="这套回答的名字" />
          <button type="button" className="own-skm-batch-btn own-sfd-primary" onClick={save}>
            存下
          </button>
          <button type="button" className="own-skm-batch-btn" onClick={() => setNaming(false)}>
            取消
          </button>
          <p>存的是现在线上的技能，不含还没发布的修改。</p>
        </div>
      ) : (
        <button
          type="button"
          className="own-skm-batch-btn own-sfd-primary"
          onClick={() => {
            setName(suggestedSetName());
            setNaming(true);
          }}
        >
          存下现在这套
        </button>
      )}

      {sets.length ? (
        <ul className="oa-sets-list">
          {sets.map((set) => (
            <li key={set.id}>
              <span>
                {hearing?.id === set.id ? "正在用 · " : ""}
                {set.name}
              </span>
              <button type="button" className="own-skill-inline-btn" onClick={() => setPending(set)}>
                换回这一套
              </button>
              <button
                type="button"
                className="own-skill-inline-btn"
                onClick={() => setCompareId(compareId === set.id ? null : set.id)}
              >
                {compareId === set.id ? "收起" : "和现在比"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {pending ? (
        <div className="oa-sets-confirm">
          <p>
            切回「{pending.name}」之后，线上就是这一版。
            {drafts.length ? `${drafts.join("、")}里还没发的修改会被盖掉。` : ""}
          </p>
          <button type="button" className="own-skm-batch-btn" onClick={() => setPending(null)}>
            先别换
          </button>
          <button type="button" className="own-skm-batch-btn own-sfd-primary" onClick={restore}>
            换回这一套
          </button>
        </div>
      ) : null}

      {compared && diff ? <SetDiffView name={compared.name} diff={diff} /> : null}
    </section>
  );
}

function SetDiffView({ name, diff }: { name: string; diff: SetDiff }) {
  const shown = diff.moved.slice(0, 8);
  const rest = diff.moved.length - shown.length;
  if (!diff.moved.length && !diff.edited.length) {
    return <p className="oa-sets-diff">这些问法和「{name}」一样。</p>;
  }
  return (
    <div className="oa-sets-diff">
      {shown.length ? (
        <>
          <p>会换人答的</p>
          <ul>
            {shown.map((row) => (
              <li key={row.q}>
                「{row.q}」{name}那套交给{row.from}，现在交给{row.to}
              </li>
            ))}
          </ul>
          {rest > 0 ? <p>还有 {rest} 句会换人答。</p> : null}
        </>
      ) : null}
      {diff.edited.length ? (
        <>
          <p>还是同一个人答，但里面改过</p>
          <ul>
            {diff.edited.map((row) => (
              <li key={row.name}>
                「{row.name}」{row.detail}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {diff.same ? <p>其余 {diff.same} 句一样。</p> : null}
    </div>
  );
}

/** 对话输入框旁：选一套来对照，没有存过就不出现 */
export function CatalogCompareControl({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [sets, setSets] = useState<CatalogSet[]>(() => listCatalogSets());
  const [hearing, setHearing] = useState<CatalogSet | null>(() => currentHearing());

  useEffect(() => {
    const refresh = () => {
      const next = listCatalogSets();
      setSets(next);
      setHearing(currentHearing());
      if (value && !next.some((s) => s.id === value)) onChange("");
    };
    window.addEventListener(CATALOG_SETS_EVENT, refresh);
    window.addEventListener(SKILL_PUBLISH_EVENT, refresh);
    return () => {
      window.removeEventListener(CATALOG_SETS_EVENT, refresh);
      window.removeEventListener(SKILL_PUBLISH_EVENT, refresh);
    };
  }, [onChange, value]);

  if (!sets.length) return null;
  return (
    <div className="ua-set-compare">
      {hearing ? <span>当前版本是「{hearing.name}」。</span> : null}
      <label>
        对照
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">不对照</option>
          {sets.map((set) => (
            <option key={set.id} value={set.id}>
              {set.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function CatalogCompareNote({ query, setId }: { query: string; setId: string }) {
  const set = listCatalogSets().find((s) => s.id === setId);
  if (!set || !query.trim()) return null;
  return <p className="ua-set-note">{sentenceAgainstSet(query, set)}</p>;
}
