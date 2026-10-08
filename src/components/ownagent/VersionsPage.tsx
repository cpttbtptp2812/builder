import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { allRunnableSkills, isAnswerLayerSkill } from "../../lib/agentSkills";
import {
  CATALOG_SETS_EVENT,
  currentHearing,
  faceSet,
  matchesLiveCatalog,
  formatSavedAt,
  listCatalogSets,
  promoteDraft,
  restoreCatalogSet,
  unpublishedLabels,
  type CatalogSet,
} from "../../lib/catalogSets";
import { parseSkillMarkdown } from "../../lib/skillMarkdown";
import { SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";
import { openProductView } from "./productNav";
import { defaultSampleQuery } from "./skillVerUi";

function skillFace(raw: string | undefined) {
  if (!raw?.trim()) return null;
  const doc = parseSkillMarkdown(raw);
  const zh = doc.triggers.map((t) => t.trim()).filter((t) => /[\u4e00-\u9fff]/.test(t));
  const say = (zh.length ? zh : doc.triggers).slice(0, 6).join("、");
  const steps = doc.steps.map((s) => s.label || s.id).filter(Boolean).join(" → ");
  return { desc: doc.description.trim(), say, steps };
}

function triggerPhrases(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return parseSkillMarkdown(raw).triggers.map((t) => t.trim()).filter((t) => t.length >= 2);
}

function asQuestion(phrase: string): string {
  const text = phrase.trim();
  if (text.length >= 6) return text;
  return `我想问一下${text}`;
}

function useToastInline() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = window.setTimeout(() => setMsg(null), 2800);
    return () => window.clearTimeout(t);
  }, [msg]);
  return { show: setMsg, node: msg ? <div className="own-skm-toast" role="status">{msg}</div> : null };
}

/** 对照某一版和现在的差别，再决定要不要切过去。 */
export function VersionsPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToastInline();
  const [sets, setSets] = useState<CatalogSet[]>(() => listCatalogSets());
  const [hearingId, setHearingId] = useState<string | null>(() => currentHearing()?.id ?? null);
  const [pickedId, setPickedId] = useState<string | null>(() => params.get("set") || currentHearing()?.id || listCatalogSets()[0]?.id || null);
  const [confirming, setConfirming] = useState(false);

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

  const picked = pickedId ? sets.find((s) => s.id === pickedId) ?? null : null;
  const versions = sets.filter((set) => set.status !== "draft");
  const liveMatchId = versions.find((set) => matchesLiveCatalog(set))?.id ?? null;
  const hearingMatches = hearingId != null && versions.some((set) => set.id === hearingId && matchesLiveCatalog(set));
  const currentId = hearingMatches ? hearingId : liveMatchId;
  const others = versions.filter((set) => set.id !== currentId);
  const isDraft = picked?.status === "draft";

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (pickedId) next.set("set", pickedId);
    else next.delete("set");
    if (next.toString() !== params.toString()) setParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickedId]);

  const face = useMemo(() => (picked ? faceSet(picked) : null), [picked, sets, hearingId]);
  const changed = face?.skills.filter((row) => row.mark !== "same") ?? [];
  const usingThis = Boolean(picked && !isDraft && currentId === picked.id);

  useEffect(() => {
    if (usingThis) openProductView("compare");
  }, [usingThis]);
  const drafts = confirming && picked ? unpublishedLabels() : [];
  const hasDiff = changed.length > 0 || (face?.asks.length ?? 0) > 0;
  const otherDiffs = useMemo(() => {
    if (!picked || hasDiff) return [];
    return sets
      .filter((set) => set.id !== picked.id)
      .map((set) => {
        const other = faceSet(set);
        const names = other.skills.filter((row) => row.mark !== "same").map((row) => row.name);
        return { set, names, asks: other.asks.length };
      })
      .filter((row) => row.names.length > 0 || row.asks > 0);
  }, [picked, hasDiff, sets]);
  const chips = picked && !others.some((set) => set.id === picked.id) ? [picked, ...others] : others;

  const pairs = useMemo(() => {
    if (!picked) return [];
    const live = allRunnableSkills().filter((s) => !isAnswerLayerSkill(s.id));
    const past = picked.skills.filter((s) => !isAnswerLayerSkill(s.id));
    const liveBy = new Map(live.map((s) => [s.id, s]));
    const pastBy = new Map(past.map((s) => [s.id, s]));
    const ids = [...new Set([...past.map((s) => s.id), ...live.map((s) => s.id)])];
    const diffIds = new Set(face?.skills.filter((row) => row.mark !== "same").map((row) => row.id));
    return ids
      .map((id) => {
        const then = pastBy.get(id);
        const now = liveBy.get(id);
        const row = face?.skills.find((item) => item.id === id);
        return {
          id,
          name: row?.name || then?.name || now?.name || id,
          diff: diffIds.has(id),
          lines: row?.lines ?? [],
          then: skillFace(then?.raw),
          now: skillFace(now?.manifest),
        };
      })
      .sort((a, b) => Number(b.diff) - Number(a.diff) || a.name.localeCompare(b.name, "zh"));
  }, [picked, face]);

  function diffQuery(id: string, name: string): string {
    const ask = face?.asks.find((row) => row.from === name || row.to === name);
    if (ask) return ask.q;
    const thenRaw = picked?.skills.find((s) => s.id === id)?.raw;
    const nowRaw = allRunnableSkills().find((s) => s.id === id)?.manifest;
    const thenT = triggerPhrases(thenRaw);
    const nowT = triggerPhrases(nowRaw);
    const zh = (list: string[]) => list.filter((t) => /[\u4e00-\u9fff]/.test(t));
    const only = [
      ...zh(thenT).filter((t) => !nowT.includes(t)),
      ...zh(nowT).filter((t) => !thenT.includes(t)),
    ];
    const sample = defaultSampleQuery(id, thenT.length ? thenT : nowT);
    if (only.some((t) => sample.includes(t))) return sample;
    const phrase = only[0] || zh(thenT)[0] || zh(nowT)[0] || thenT[0] || nowT[0];
    if (phrase) return asQuestion(phrase);
    return sample;
  }

  function runDiff(query: string) {
    const text = query.trim();
    if (!text || !picked) return;
    sessionStorage.setItem("oa-pending-ask", text);
    window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "chat" } }));
  }

  function restore() {
    if (!picked) return;
    const result = restoreCatalogSet(picked.id);
    setConfirming(false);
    if (!result.ok) {
      toast.show(result.reason ?? "没有切换");
      return;
    }
    toast.show(`已切到「${picked.name}」`);
  }

  return (
    <div className="oa-ui oa-page oa-pair">
      {toast.node}
      <header className="oa-vpage-head">
        <div>
          <button type="button" className="oa-vpage-back" onClick={() => openProductView("versions")}>版本</button>
          <h1>{picked ? `${picked.name} 和现在` : "对比"}</h1>
          <p>
            {picked ? formatSavedAt(picked.savedAt) : "还没有保存过的版本"}
            {picked?.note ? ` · ${picked.note}` : ""}
            {isDraft ? " · 草稿" : ""}
            {usingThis ? " · 当前版本" : ""}
          </p>
        </div>
        <div className="oa-vpage-actions">
          {isDraft && picked ? (
            <button
              type="button"
              className="oa-vpage-ghost"
              onClick={() => {
                const saved = promoteDraft(picked.id);
                if (saved) toast.show(`「${saved.name}」已存成版本`);
              }}
            >
              存成版本
            </button>
          ) : null}
          {usingThis || !picked || isDraft ? null : confirming ? (
            <>
              {drafts.length ? <span className="oa-vpage-warn">{drafts.join("、")}里没发的修改会被盖掉</span> : null}
              <button type="button" className="oa-vpage-ghost" onClick={() => setConfirming(false)}>取消</button>
              <button type="button" className="oa-vpage-primary" onClick={restore}>确认切换</button>
            </>
          ) : (
            <button type="button" className="oa-vpage-primary" onClick={() => setConfirming(true)}>切换到这一版</button>
          )}
        </div>
      </header>

      {chips.length > 1 ? (
        <div className="oa-pair-switch">
          {chips.map((set) => (
            <button
              key={set.id}
              type="button"
              className={pickedId === set.id ? "on" : ""}
              onClick={() => {
                setPickedId(set.id);
                setConfirming(false);
              }}
            >
              {set.name}
              {currentId === set.id ? <em>当前</em> : null}
            </button>
          ))}
        </div>
      ) : null}

      {picked && face ? (
        <section className={hasDiff ? "oa-pair-result is-diff" : "oa-pair-result"}>
          <strong>{hasDiff ? `「${picked.name}」和现在不一样` : `「${picked.name}」和现在一样`}</strong>
          {hasDiff ? (
            <p>
              {changed.length ? changed.map((row) => row.name).join("、") : ""}
              {changed.length && face.asks.length ? " · " : ""}
              {face.asks.length ? `${face.asks.length} 句话会换技能` : ""}
            </p>
          ) : (
            <p>这份记的就是现在线上的技能，所以没有差别。</p>
          )}
        </section>
      ) : null}

      {!hasDiff && otherDiffs.length ? (
        <section className="oa-vpage-sheet">
          <h2>这几版和现在不一样</h2>
          <ul className="oa-vpage-list">
            {otherDiffs.map((row) => (
              <li key={row.set.id}>
                <button
                  type="button"
                  className="oa-diff-jump"
                  onClick={() => {
                    setPickedId(row.set.id);
                    setConfirming(false);
                  }}
                >
                  <strong>{row.set.name}</strong>
                  <span>
                    {row.names.join("、")}
                    {row.names.length && row.asks ? " · " : ""}
                    {row.asks ? `${row.asks} 句话会换技能` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {picked && hasDiff ? (
        <>
          {face?.asks.length ? (
            <ul className="oa-pair-asks">
              {face.asks.map((row) => (
                <li key={row.q}>
                  <div className="oa-pair-ask-q">
                    <strong>「{row.q}」</strong>
                    <button type="button" className="oa-pair-run" onClick={() => runDiff(row.q)}>在对话里跑</button>
                  </div>
                  <span>{picked.name} 交给 {row.from}</span>
                  <span>现在交给 {row.to}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {pairs.some((row) => row.diff) ? (
          <div className="oa-pair-cols">
            <div>
              <h2>{picked.name}</h2>
              <p>保存下来的那一版</p>
            </div>
            <div>
              <h2>现在</h2>
              <p>线上正在用的</p>
            </div>
          </div>
          ) : null}
          {pairs.filter((row) => row.diff).map((row) => {
            const probe = diffQuery(row.id, row.name);
            return (
            <div key={row.id} className="oa-pair-row is-diff">
              <button type="button" className="oa-pair-run" onClick={() => runDiff(probe)}>
                在对话里跑「{probe}」
              </button>
              <article>
                <strong>{row.name}</strong>
                {row.then ? (
                  <>
                    {row.then.desc ? <p className="desc">{row.then.desc}</p> : null}
                    {row.then.say ? <p className="say">说法 · {row.then.say}</p> : null}
                    {row.then.steps ? <p className="steps">步骤 · {row.then.steps}</p> : null}
                  </>
                ) : (
                  <p className="empty">这一版没有</p>
                )}
              </article>
              <article>
                <strong>{row.name}</strong>
                {row.now ? (
                  <>
                    {row.now.desc ? <p className="desc">{row.now.desc}</p> : null}
                    {row.now.say ? <p className="say">说法 · {row.now.say}</p> : null}
                    {row.now.steps ? <p className="steps">步骤 · {row.now.steps}</p> : null}
                    {row.lines.map((line) => (
                      <p key={line} className="delta">{line}</p>
                    ))}
                  </>
                ) : (
                  <p className="empty">现在没有</p>
                )}
              </article>
            </div>
            );
          })}
        </>
      ) : null}
    </div>
  );
}
