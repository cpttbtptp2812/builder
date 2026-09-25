/** 技能影响分析 — 用新旧两个技能目录把语料全量路由一遍，找出抢单、丢单、打平 */

import { allRunnableSkills, type AgentSkill } from "./agentSkills";
import { hydrateFromRaw } from "./skillCompareEngine";
import { SKILL_TRACE_CASES } from "./provingGround";
import { listQueryLog, normalizeQuery, SAMPLE_USER_QUERIES } from "./skillQueryLog";
import { routeKey, routeKeyLabel, routeQuery, type RouteDecision } from "./skillRouter";

export type CorpusSource = "real" | "sample";

export type CorpusQuery = {
  q: string;
  source: CorpusSource;
  /** 真实记录里出现的次数 */
  count: number;
  /** 由说法拼出的句子（帮我X一下），不参与漏答挖掘 */
  synthetic?: boolean;
};

export type WeakTrigger = {
  trigger: string;
  /** 单独说这个词时实际去了哪 */
  toLabel: string;
  reason: string;
};

export type RouteShift = {
  q: string;
  source: CorpusSource;
  count: number;
  from: string;
  fromLabel: string;
  to: string;
  toLabel: string;
  /** 新版下的判定理由 */
  rule: string;
};

export type AmbiguousQuery = {
  q: string;
  source: CorpusSource;
  count: number;
  rivals: { key: string; label: string; score: number }[];
};

export type SkillImpact = {
  corpusSize: number;
  realCount: number;
  usingSamples: boolean;
  /** 原来不归本技能，新版归本技能 */
  gained: RouteShift[];
  /** 原来归本技能，新版不归 */
  lost: RouteShift[];
  /** 与本技能无关的去向变化（内置规则连带影响） */
  others: RouteShift[];
  /** 新版下本技能与其他技能打平 */
  ambiguous: AmbiguousQuery[];
  handled: { before: number; after: number };
  realHandled: { before: number; after: number };
  /** 新版里单独说出来接不住的说法 */
  weakTriggers: WeakTrigger[];
};

/** 用户只说这一个词（帮我X一下）时，新版能否接住 */
export function findWeakTriggers(skillId: string, catalog: AgentSkill[]): WeakTrigger[] {
  const skill = catalog.find((s) => s.id === skillId);
  if (!skill) return [];
  const out: WeakTrigger[] = [];
  for (const t of skill.triggers) {
    const d = routeQuery(`帮我${t}一下`, catalog);
    if (routeKey(d) === skillId) continue;
    const mine = d.ranked.find((r) => r.skill.id === skillId)?.score ?? 0;
    const reason =
      d.kind === "skill"
        ? d.rule.startsWith("内置规则")
          ? `被内置规则优先交给「${d.label}」`
          : `「${d.label}」也有这个说法，分数更高或打平`
        : mine < 2
          ? `只有 ${t.length >= 4 ? 2 : 1} 分，不到接手线 2 分（4 个字及以上的说法才算 2 分）`
          : d.rule;
    out.push({ trigger: t, toLabel: d.label, reason });
  }
  return out;
}

/** 真实记录不足这个数时，混入示例提问 */
export const MIN_REAL_QUERIES = 8;

function synthFromTriggers(catalog: AgentSkill[]): string[] {
  const out: string[] = [];
  for (const s of catalog) {
    for (const t of s.triggers.slice(0, 6)) {
      if (t.length >= 2) out.push(`帮我${t}一下`);
    }
  }
  return out;
}

export function buildCorpus(catalog: AgentSkill[] = allRunnableSkills()): CorpusQuery[] {
  const map = new Map<string, CorpusQuery>();
  for (const e of listQueryLog()) {
    const q = normalizeQuery(e.q);
    const hit = map.get(q);
    if (hit) hit.count += 1;
    else map.set(q, { q, source: "real", count: 1 });
  }
  const realCount = map.size;
  const add = (q: string) => {
    const k = normalizeQuery(q);
    if (!map.has(k)) map.set(k, { q: k, source: "sample", count: 1 });
  };
  if (realCount < MIN_REAL_QUERIES) SAMPLE_USER_QUERIES.forEach(add);
  SKILL_TRACE_CASES.forEach((c) => add(c.query));
  for (const q of synthFromTriggers(catalog)) {
    const k = normalizeQuery(q);
    if (!map.has(k)) map.set(k, { q: k, source: "sample", count: 1, synthetic: true });
  }
  return [...map.values()];
}

export function catalogWith(skillId: string, raw: string, base: AgentSkill[] = allRunnableSkills()): AgentSkill[] {
  const cand = hydrateFromRaw(raw, skillId, "impact");
  return base.some((s) => s.id === skillId) ? base.map((s) => (s.id === skillId ? cand : s)) : [...base, cand];
}

function rivalsOf(d: RouteDecision, skillId: string): AmbiguousQuery["rivals"] | null {
  const top = d.ranked[0];
  if (!top || top.score < 2) return null;
  const tied = d.ranked.filter((r) => r.score === top.score);
  if (tied.length < 2 || !tied.some((r) => r.skill.id === skillId)) return null;
  return tied.map((r) => ({ key: r.skill.id, label: routeKeyLabel(r.skill.id, d.ranked.map((x) => x.skill)), score: r.score }));
}

export function analyzeImpact(skillId: string, baselineRaw: string, candidateRaw: string): SkillImpact {
  const live = allRunnableSkills();
  const before = catalogWith(skillId, baselineRaw, live);
  const after = catalogWith(skillId, candidateRaw, live);
  const corpus = buildCorpus(live);

  const gained: RouteShift[] = [];
  const lost: RouteShift[] = [];
  const others: RouteShift[] = [];
  const ambiguous: AmbiguousQuery[] = [];
  const handled = { before: 0, after: 0 };
  const realHandled = { before: 0, after: 0 };

  for (const c of corpus) {
    const b = routeQuery(c.q, before);
    const a = routeQuery(c.q, after);
    const bk = routeKey(b);
    const ak = routeKey(a);
    const w = c.source === "real" ? c.count : 0;
    if (bk === skillId) {
      handled.before += 1;
      realHandled.before += w;
    }
    if (ak === skillId) {
      handled.after += 1;
      realHandled.after += w;
    }
    if (bk !== ak) {
      const shift: RouteShift = {
        q: c.q,
        source: c.source,
        count: c.count,
        from: bk,
        fromLabel: routeKeyLabel(bk, before),
        to: ak,
        toLabel: routeKeyLabel(ak, after),
        rule: a.rule,
      };
      if (ak === skillId) gained.push(shift);
      else if (bk === skillId) lost.push(shift);
      else others.push(shift);
    }
    const rivals = rivalsOf(a, skillId);
    if (rivals) ambiguous.push({ q: c.q, source: c.source, count: c.count, rivals });
  }

  const realFirst = <T extends { source: CorpusSource; count: number }>(x: T, y: T) =>
    Number(y.source === "real") - Number(x.source === "real") || y.count - x.count;

  const realCount = corpus.filter((c) => c.source === "real").length;
  return {
    corpusSize: corpus.length,
    realCount,
    usingSamples: realCount < MIN_REAL_QUERIES,
    gained: gained.sort(realFirst),
    lost: lost.sort(realFirst),
    others: others.sort(realFirst),
    ambiguous: ambiguous.sort(realFirst),
    handled,
    realHandled,
    weakTriggers: findWeakTriggers(skillId, after),
  };
}
