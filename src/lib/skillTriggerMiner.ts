/** 漏答挖掘 — 从没人接手的提问里，找出像本技能的活，提炼说法并预演效果 */

import { allRunnableSkills, type AgentSkill } from "./agentSkills";
import { parseSkillMarkdown } from "./skillMarkdown";
import { setTriggers } from "./skillFormEdit";
import { buildCorpus, catalogWith, type CorpusQuery, type CorpusSource } from "./skillImpact";
import { routeKey, routeQuery } from "./skillRouter";

export type TriggerSuggestion = {
  phrase: string;
  /** 加上后能接住的漏答提问 */
  captured: { q: string; source: CorpusSource; count: number }[];
  /** 加上后会从其他技能抢来的提问 */
  stolen: { q: string; fromLabel: string }[];
};

export type MissedQuery = {
  q: string;
  source: CorpusSource;
  count: number;
  similarity: number;
};

export type MiningResult = {
  missed: MissedQuery[];
  suggestions: TriggerSuggestion[];
  usingSamples: boolean;
};

const CJK = /[\u4e00-\u9fff]/;
const EDGE_STOP = new Set("的了吗呢吧啊么是在我你他她它和与及或就都也还又把被给让帮请能会要想看下个这那有没不一过做里".split(""));

/**
 * 领域同义词簇 — 字面不同但指同一件事（预发 ≈ staging ≈ 上线前）。
 * 命中簇内任意词就给文本追加簇标记，让 TF-IDF 能跨字面匹配。
 */
const SYNONYM_GROUPS: { tag: string; words: string[] }[] = [
  { tag: "synrelease", words: ["上线", "发版", "发布", "灰度", "预发", "staging", "预生产", "冒烟", "smoke", "验收", "回归", "release", "部署", "新版本"] },
  { tag: "synavail", words: ["探活", "访问", "打得开", "打不开", "能打开", "挂了", "挂没挂", "宕机", "可用", "报错", "健康"] },
  { tag: "synperf", words: ["性能", "加载", "首屏", "ttfb", "latency", "耗时", "卡顿"] },
  { tag: "synpolicy", words: ["年假", "病假", "请假", "调休", "加班", "报销", "出差", "住宿", "差旅", "制度", "vpn"] },
  { tag: "syndom", words: ["dom", "元素", "按钮", "定位", "定位器", "页面结构", "选择器", "selector"] },
  { tag: "synflow", words: ["workflow", "自动化", "回放", "流程", "跑一遍"] },
  { tag: "synkb", words: ["知识库", "资料库", "文档", "api"] },
];

function expandSynonyms(text: string): string {
  const low = text.toLowerCase();
  const tags = SYNONYM_GROUPS.filter((g) => g.words.some((w) => low.includes(w))).map((g) => g.tag);
  return tags.length ? `${text} ${tags.join(" ")} ${tags.join(" ")}` : text;
}
const STOP_PHRASES = new Set([
  "帮我", "帮忙", "一下", "看看", "看下", "能不能", "可不可以", "怎么", "怎么样", "什么", "这个", "那个",
  "是否", "可以", "请问", "我们", "你们", "现在", "告诉", "的话", "有没有", "多少", "如何", "今天", "今晚",
]);

/** 字符 n-gram（中文 2–3 字）+ 英文单词，用于相似度 */
function grams(text: string): string[] {
  const out: string[] = [];
  const lower = text.toLowerCase();
  for (const w of lower.match(/[a-z][a-z0-9_-]{1,}/g) ?? []) out.push(w);
  for (const run of lower.match(/[\u4e00-\u9fff]+/g) ?? []) {
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i + n <= run.length; i++) out.push(run.slice(i, i + n));
    }
  }
  return out;
}

type Vec = Map<string, number>;

function tf(tokens: string[]): Vec {
  const m: Vec = new Map();
  for (const t of tokens) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Vec, b: Vec): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const [k, v] of a) {
    na += v * v;
    const w = b.get(k);
    if (w) dot += v * w;
  }
  for (const v of b.values()) nb += v * v;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

function skillProfile(s: AgentSkill, raw?: string): string {
  const body = raw ? parseSkillMarkdown(raw).body : "";
  const triggers = s.triggers.join(" ");
  return [s.name, s.description, triggers, triggers, triggers, s.steps.map((x) => x.label).join(" "), body].join(" ");
}

/** 以技能画像为文档集计算 idf，再把提问与各技能做 TF-IDF 余弦 */
export function buildSimilarity(catalog: AgentSkill[], overrideRaw?: { id: string; raw: string }) {
  const docs = catalog.map((s) =>
    tf(grams(expandSynonyms(skillProfile(s, overrideRaw?.id === s.id ? overrideRaw.raw : undefined)))),
  );
  const df = new Map<string, number>();
  for (const d of docs) for (const k of d.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  const n = docs.length;
  const idf = (k: string) => Math.log((n + 1) / ((df.get(k) ?? 0) + 1)) + 1;
  const weigh = (v: Vec): Vec => {
    const out: Vec = new Map();
    for (const [k, c] of v) out.set(k, (1 + Math.log(c)) * idf(k));
    return out;
  };
  const skillVecs = docs.map(weigh);
  return (q: string) => {
    const qv = weigh(tf(grams(expandSynonyms(q))));
    return catalog.map((s, i) => ({ id: s.id, sim: cosine(qv, skillVecs[i]!) })).sort((a, b) => b.sim - a.sim);
  };
}

const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("zh-CN", { granularity: "word" }) : null;

const QUESTION_WORDS = ["什么", "多少", "怎么", "哪些", "哪个", "为什么", "几天", "一下"];

function usablePhrase(p: string): boolean {
  if (p.length < 2 || p.length > 6 || STOP_PHRASES.has(p)) return false;
  if (EDGE_STOP.has(p[0]!) || EDGE_STOP.has(p[p.length - 1]!)) return false;
  return !p.includes("的") && !QUESTION_WORDS.some((w) => p.includes(w));
}

/** 从提问里切出候选说法：分词后的完整词、相邻两词组合、英文单词 */
function phraseCandidates(q: string): string[] {
  const out = new Set<string>();
  for (const w of q.toLowerCase().match(/[a-z][a-z0-9_-]{2,}/g) ?? []) {
    if (!/^(https?|www|com|example)$/.test(w)) out.add(w);
  }
  for (const run of q.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (!segmenter) {
      for (let n = 2; n <= 4; n++) for (let i = 0; i + n <= run.length; i++) out.add(run.slice(i, i + n));
      continue;
    }
    // 词典不认识的行业词（预发、灰度）会被切成单字，先把连续单字并回去
    const words: string[] = [];
    let singles = "";
    const flush = () => {
      if (singles) words.push(singles);
      singles = "";
    };
    for (const seg of segmenter.segment(run)) {
      if (!seg.isWordLike) continue;
      if (seg.segment.length === 1 && !EDGE_STOP.has(seg.segment)) singles += seg.segment;
      else {
        flush();
        words.push(seg.segment);
      }
    }
    flush();
    words.forEach((w, i) => {
      out.add(w);
      if (words[i + 1]) out.add(w + words[i + 1]);
    });
  }
  return [...out].filter((p) => (CJK.test(p) ? usablePhrase(p) : true));
}

export function mineTriggerSuggestions(skillId: string, draftRaw: string, limit = 5): MiningResult {
  const live = allRunnableSkills();
  const catalog = catalogWith(skillId, draftRaw, live);
  const corpus = buildCorpus(live);
  const similarity = buildSimilarity(catalog, { id: skillId, raw: draftRaw });

  const decisions = new Map(corpus.map((c) => [c.q, routeQuery(c.q, catalog)]));
  const missed: MissedQuery[] = [];
  for (const c of corpus) {
    const d = decisions.get(c.q)!;
    if (d.kind === "skill" || c.synthetic) continue;
    const sims = similarity(c.q);
    const mine = sims.find((s) => s.id === skillId)?.sim ?? 0;
    const best = sims[0]!;
    const runner = sims.find((s) => s.id !== skillId)?.sim ?? 0;
    if (best.id === skillId && mine >= 0.03 && mine >= runner * 1.5) {
      missed.push({ q: c.q, source: c.source, count: c.count, similarity: Math.round(mine * 100) / 100 });
    }
  }
  missed.sort((a, b) => Number(b.source === "real") - Number(a.source === "real") || b.similarity - a.similarity);

  const parsed = parseSkillMarkdown(draftRaw);
  const existing = parsed.triggers.map((t) => t.toLowerCase());
  const peerTriggers = live.filter((s) => s.id !== skillId).flatMap((s) => s.triggers.map((t) => t.toLowerCase()));

  // 候选打分：在漏答里出现得多、在整个语料里出现得少、越长越具体
  const allQs = corpus.map((c) => c.q.toLowerCase());
  const scored = new Map<string, number>();
  for (const m of missed) {
    for (const p of phraseCandidates(m.q)) {
      const pl = p.toLowerCase();
      if (existing.some((t) => t === pl || pl.includes(t) || t.includes(pl))) continue;
      if (peerTriggers.some((t) => t === pl || t.includes(pl))) continue;
      const inMissed = missed.filter((x) => x.q.toLowerCase().includes(pl)).length;
      const inAll = allQs.filter((x) => x.includes(pl)).length;
      const specificity = Math.log((allQs.length + 1) / (inAll + 1)) + 1;
      const lenBonus = CJK.test(p) ? Math.min(p.length, 4) / 2 : 1.5;
      scored.set(p, Math.max(scored.get(p) ?? 0, inMissed * specificity * lenBonus));
    }
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([p]) => p);
  const missedSet = new Set(missed.map((m) => m.q));
  const suggestions: TriggerSuggestion[] = [];
  const seenCaptures = new Set<string>();

  for (const phrase of ranked) {
    const trial = catalogWith(skillId, setTriggers(draftRaw, [...parsed.triggers, phrase]), live);
    const captured: TriggerSuggestion["captured"] = [];
    const stolen: TriggerSuggestion["stolen"] = [];
    for (const c of corpus) {
      const before = decisions.get(c.q)!;
      if (!c.q.toLowerCase().includes(phrase.toLowerCase())) continue;
      const after = routeQuery(c.q, trial);
      if (routeKey(after) !== skillId || routeKey(before) === skillId) continue;
      if (missedSet.has(c.q)) captured.push({ q: c.q, source: c.source, count: c.count });
      else if (before.kind === "skill") stolen.push({ q: c.q, fromLabel: before.label });
    }
    if (!captured.length) continue;
    const key = captured.map((c) => c.q).sort().join("|");
    if (seenCaptures.has(key)) continue;
    seenCaptures.add(key);
    suggestions.push({ phrase, captured, stolen });
    if (suggestions.length >= limit * 2) break;
  }

  suggestions.sort((a, b) => a.stolen.length - b.stolen.length || b.captured.length - a.captured.length || b.phrase.length - a.phrase.length);

  return {
    missed,
    suggestions: suggestions.slice(0, limit),
    usingSamples: corpus.filter((c: CorpusQuery) => c.source === "real").length < 8,
  };
}
