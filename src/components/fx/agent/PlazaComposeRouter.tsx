/** 输入区预检索 — 打字时并行查广场 / 技能路由 / 资料库；结果保留到下一次检索完成，避免闪动 */

import { useEffect, useRef, useState } from "react";
import { retrieveRag } from "../../../lib/ragEngine";
import { listPlaza, type PlazaItem } from "../../../lib/plazaFeed";
import { routeQuery, skillLabel } from "../../../lib/skillRouter";
import { listCompareDrafts, requestSkillOpen } from "../../../lib/skillCompareStore";
import { catalogWith } from "../../../lib/skillImpact";

export type Precheck = {
  q: string;
  loading: boolean;
  plaza: PlazaItem[];
  skill: { name: string; why: string; rule: string } | null;
  rag: { title: string; score: number } | null;
  /** 有未发布草稿能接住这句，但线上版接不住 */
  draftCatch: { skillId: string; name: string; version: string } | null;
};

const EMPTY: Precheck = { q: "", loading: false, plaza: [], skill: null, rag: null, draftCatch: null };

function findDraftCatch(q: string, liveSkillId: string | null): Precheck["draftCatch"] {
  for (const d of listCompareDrafts()) {
    if (d.skillId === liveSkillId) continue;
    const r = routeQuery(q, catalogWith(d.skillId, d.raw));
    if (r.kind === "skill" && r.skillId === d.skillId) {
      return { skillId: d.skillId, name: r.skill ? skillLabel(r.skill) : d.name, version: d.version };
    }
  }
  return null;
}

export function usePrecheck(input: string, running: boolean): Precheck {
  const [state, setState] = useState<Precheck>(EMPTY);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reqId = useRef(0);
  const q = input.trim();

  useEffect(() => {
    clearTimeout(timer.current);
    if (running || q.length < 2 || q.startsWith("/")) {
      reqId.current++;
      setState(EMPTY);
      return;
    }
    const req = ++reqId.current;
    setState((s) => (s.loading ? s : { ...s, loading: true }));
    timer.current = setTimeout(async () => {
      // 路由与资料库是本地计算，先出结果；广场可能走网络，回来后再补
      const route = routeQuery(q);
      const liveSkillId = route.kind === "skill" ? route.skillId : null;
      const top = retrieveRag(q, 1).hits[0];
      setState((s) => ({
        q,
        loading: true,
        plaza: s.plaza,
        skill: route.kind === "skill" && route.skill
          ? {
              name: skillLabel(route.skill),
              why: route.rule.startsWith("命中说法")
                ? `命中 ${route.hits.slice(0, 3).join("、")}`
                : route.rule.replace(/^内置规则：/, "按内置规则 · ").replace(/（[^）]*）$/, ""),
              rule: route.rule,
            }
          : null,
        rag: top ? { title: top.projectName || top.chunkId, score: Math.round(top.score * 100) } : null,
        draftCatch: findDraftCatch(q, liveSkillId),
      }));
      let plaza: PlazaItem[] = [];
      try {
        plaza = (await listPlaza(q, 3)).items;
      } catch { /* 广场不可用时只看路由 */ }
      if (req !== reqId.current) return;
      setState((s) => ({ ...s, plaza, loading: false }));
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q, running]);

  return state;
}

/** 输入文字下方的「发送后会怎样」：开始输入才展开，输入过程中只换文字不跳动 */
export function PrecheckLine({ pre }: { pre: Precheck }) {
  const hasResult = Boolean(pre.q);
  const open = hasResult || pre.loading;
  return (
    <div className={`oc-pre-wrap${open ? " open" : ""}`} aria-hidden={!open}>
      <div className="oc-pre-clip">{open ? <PrecheckBody pre={pre} hasResult={hasResult} /> : null}</div>
    </div>
  );
}

function PrecheckBody({ pre, hasResult }: { pre: Precheck; hasResult: boolean }) {
  return (
    <div className={`oc-pre${pre.loading ? " is-loading" : ""}`} aria-live="polite">
      <span className="oc-pre-label">发送后 →</span>
      {pre.plaza.length > 0 && <span className="oc-pre-tag plaza">广场有 {pre.plaza.length} 条现成答案</span>}
      {pre.skill ? (
        <span className="oc-pre-tag skill" title={pre.skill.rule}>
          交给技能「{pre.skill.name}」
          <em>{pre.skill.why}</em>
        </span>
      ) : hasResult ? (
        <span className="oc-pre-tag none">没有技能接手，走通用回答</span>
      ) : null}
      {pre.rag && !pre.skill && <span className="oc-pre-tag rag">资料库 · {pre.rag.title}</span>}
      {pre.draftCatch && (
        <button
          type="button"
          className="oc-pre-tag draft"
          title="草稿不会生效，去技能管理发布"
          onClick={() => requestSkillOpen(pre.draftCatch!.skillId)}
        >
          「{pre.draftCatch.name}」草稿 v{pre.draftCatch.version} 能接住这句，但还没发布 →
        </button>
      )}
      {pre.loading && <span className="oc-pre-spin" aria-label="检索中" />}
    </div>
  );
}

/** 广场现成答案：浮在输入框上方，不挤压布局 */
export function PlazaHitPop({
  pre,
  onUsePlaza,
}: {
  pre: Precheck;
  onUsePlaza: (item: PlazaItem) => void;
}) {
  if (!pre.plaza.length) return null;
  return (
    <div className="oc-pop oc-plaza" aria-label="广场现成答案">
      <div className="oc-pop-head">广场里有相近问题，可直接采用（不调用 AI）</div>
      <ul>
        {pre.plaza.map((hit) => (
          <li key={hit.id}>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onUsePlaza(hit)}>
              <strong>{hit.question}</strong>
              <span>
                {hit.answer.replace(/\s+/g, " ").slice(0, 80)}
                {hit.answer.length > 80 ? "…" : ""}
              </span>
              <em>采用</em>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
