/** 一整套技能的版本：保存客户现在听到的，之后可以改名称、切换回去 */

import { allRunnableSkills, isAnswerLayerSkill, SKILL_CATALOG, type AgentSkill } from "./agentSkills";
import { matchFaq } from "../data/productFaq";
import { routeKey, routeKeyLabel, routeQuery, skillLabel } from "./skillRouter";
import { getRouterEvalCases } from "./evalHarness";
import { enrichSkillCatalog, hydrateSkill, parseSkillMarkdown } from "./skillMarkdown";
import { listGateQuestionRows } from "./skillGateQuestions";
import { listQueryLog } from "./skillQueryLog";
import {
  discardDraftsForSkill,
  newestDraftForSkill,
  publishSkillVersion,
  revertToBuiltin,
  skillsWithPendingDrafts,
  SKILL_PUBLISH_EVENT,
} from "./skillCompareStore";
import { installImportedMarkdown, readImportedRecords, removeImportedSkill } from "./importedSkills";

export const CATALOG_SETS_EVENT = "ownagent:catalog-sets";

export type SetSkill = { id: string; name: string; raw: string; imported: boolean };

export type CatalogSet = {
  id: string;
  name: string;
  note: string;
  savedAt: string;
  skills: SetSkill[];
  /** 缺省是已保存的版本。草稿只出现在草稿库。 */
  status?: "version" | "draft";
};

export type SentenceMove = { q: string; from: string; to: string };
export type SkillEdit = { name: string; detail: string };
export type SetDiff = { moved: SentenceMove[]; edited: SkillEdit[]; same: number };

export type SetSkillRow = {
  id: string;
  name: string;
  thenSay: string;
  nowSay: string;
  mark: "same" | "changed" | "only-then" | "only-now";
  detail: string;
  lines: string[];
};

export type HeldAsk = { q: string; who: string };

export type SetCompareFace = {
  skills: SetSkillRow[];
  asks: SentenceMove[];
  held: HeldAsk[];
  sameAsks: number;
};

const KEY = "ownagent:catalog-sets";
const MAX_SETS = 20;

type Store = { sets: CatalogSet[]; hearingId: string | null };

let restoreDepth = 0;

function emptyStore(): Store {
  return { sets: [], hearingId: null };
}

function readStore(): Store {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "") as Store;
    const sets = Array.isArray(parsed?.sets)
      ? parsed.sets
          .filter((s) => s?.id && s?.name && Array.isArray(s.skills))
          .map((s) => ({
            ...s,
            note: typeof s.note === "string" ? s.note : "",
            status: s.status === "draft" ? "draft" as const : "version" as const,
          }))
      : [];
    return { sets, hearingId: parsed?.hearingId ?? null };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store) {
  const next = JSON.stringify(store);
  if (localStorage.getItem(KEY) === next) return;
  localStorage.setItem(KEY, next);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CATALOG_SETS_EVENT));
}

export function suggestedSetName(now = new Date()): string {
  return `${now.getMonth() + 1}月${now.getDate()}日`;
}

let seeding = false;

function saySkill(id: string, title: string, triggers: string[], text: string): SetSkill {
  const trig = triggers.map((t) => `  - ${t}`).join("\n");
  return {
    id,
    name: title,
    imported: true,
    raw: `---
name: ${id}
description: ${title} — ${text}
triggers:
${trig}
steps:
  - id: say
    label: 直接回答
    tool: __say__
    args:
      text: "${text}"
---

# ${id}

${text}
`,
  };
}

function buildSampleSets(base: SetSkill[]): CatalogSet[] {
  const withSkill = (id: string, tune: (raw: string) => string) =>
    cloneSkills(base).map((s) => (s.id === id ? { ...s, raw: tune(s.raw) } : s));
  return [
    {
      id: "set-sample-sheet-net",
      name: "表格改成不含税",
      note: "同一张报销表改成去税汇总，缺票先过",
      savedAt: "2026-06-02T10:00:00.000Z",
      status: "version",
      skills: withSkill("sheet-desk", retuneSheet),
    },
    {
      id: "set-sample-data-tight",
      name: "额度系数收紧",
      note: "稳定系数 0.7 改 0.5，信用系数 1.15 改 1",
      savedAt: "2026-05-28T10:00:00.000Z",
      status: "version",
      skills: withSkill("data-desk", retuneData),
    },
    {
      id: "set-sample-contract-strict",
      name: "合同审查从严",
      note: "评估超过 90 天就高风险，期限和还款也升到高",
      savedAt: "2026-05-12T10:00:00.000Z",
      status: "version",
      skills: withSkill("contract-desk", retuneContract),
    },
    {
      id: "set-sample-flow-loose",
      name: "报销流程放宽",
      note: "差额只警告，总监线抬到 20000",
      savedAt: "2026-05-20T10:00:00.000Z",
      status: "version",
      skills: withSkill("flow-desk", retuneFlow),
    },
    {
      id: "set-sample-image-strict",
      name: "影像置信度抬高",
      note: "置信度线从 0.70 抬到 0.85，期限字段不再采用",
      savedAt: "2026-05-02T10:00:00.000Z",
      status: "version",
      skills: withSkill("image-desk", retuneImage),
    },
  ];
}

function retuneSheet(raw: string): string {
  return raw
    .replace("金额含税，按部门求和", "金额去掉税额，再按部门求和")
    .replace("容差 0，缺票直接拦截", "容差 1，缺票先过")
    .replace("写出部门合计和被拦截的行", "写出不含税合计，缺票只警告")
    .replace(/tax: include/g, "tax: exclude")
    .replace(/tolerance: 0/g, "tolerance: 1")
    .replace(/missing: block/g, "missing: pass");
}

function retuneData(raw: string): string {
  return raw
    .replace("月均乘稳定系数再乘偿债比例", "稳定系数收到 0.5 再乘偿债比例")
    .replace("再乘信用、行业、年限", "信用系数按 1，不再加成")
    .replace(/stability: 0\.7/g, "stability: 0.5")
    .replace(/credit: 1\.15/g, "credit: 1");
}

function retuneContract(raw: string): string {
  return raw
    .replace("给每条标高中低", "期限、还款、评估一律标高")
    .replace(/appraisalDays: 180/g, "appraisalDays: 90")
    .replace(/strict: false/g, "strict: true");
}

function retuneImage(raw: string): string {
  return raw
    .replace("低于置信度线的字段弃用", "置信度低于 0.85 的字段弃用")
    .replace(/minConfidence: 0\.7/g, "minConfidence: 0.85");
}

function retuneFlow(raw: string): string {
  return raw
    .replace("核发票，没有就退回", "核发票，没有也可以后补")
    .replace("差额大于 0 就停在财务复核", "差额只警告，不拦截")
    .replace("5000 到部门负责人，10000 到总监", "5000 到部门负责人，20000 才到总监")
    .replace(/directorAt: 10000/g, "directorAt: 20000")
    .replace(/mismatch: block/g, "mismatch: warn")
    .replace(/missing: return/g, "missing: later");
}

function liveSnapshot(): SetSkill[] {
  const imported = new Set(readImportedRecords().map((r) => r.id));
  return allRunnableSkills().map((s) => ({
    id: s.id,
    name: skillLabel(s),
    raw: s.manifest,
    imported: imported.has(s.id),
  }));
}

function cloneSkills(skills: SetSkill[]): SetSkill[] {
  return skills.map((s) => ({ ...s }));
}

function sameSkillList(a: SetSkill[], b: SetSkill[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((skill, index) => {
    const other = b[index];
    return other?.id === skill.id && other.raw === skill.raw && other.imported === skill.imported;
  });
}

/** 示例版本如果和线上完全一样，就改写成有差别的那一份。用户自己的版本不动。 */
function seedDistinctCatalogSets() {
  if (typeof localStorage === "undefined" || seeding) return;
  const base = liveSnapshot();
  if (!base.length) return;
  seeding = true;
  try {
    const store = readStore();
    const samples = buildSampleSets(base);
    const keep = new Set(samples.map((sample) => sample.id));
    let changed = false;
    const nextSets = store.sets.filter((set) => !set.id.startsWith("set-sample-") || keep.has(set.id));
    if (nextSets.length !== store.sets.length) {
      store.sets = nextSets;
      changed = true;
    }
    if (store.hearingId?.startsWith("set-sample-") && !keep.has(store.hearingId)) {
      store.hearingId = null;
      changed = true;
    }
    for (const sample of samples) {
      const existing = store.sets.find((s) => s.id === sample.id);
      if (!existing) {
        if (store.sets.length >= MAX_SETS) continue;
        store.sets.push(sample);
        changed = true;
        continue;
      }
      if (
        existing.name === sample.name
        && existing.note === sample.note
        && existing.status === "version"
        && sameSkillList(existing.skills, sample.skills)
      ) continue;
      existing.name = sample.name;
      existing.note = sample.note;
      existing.skills = sample.skills;
      existing.status = "version";
      changed = true;
    }
    if (changed) {
      store.sets = store.sets.slice(0, MAX_SETS);
      writeStore(store);
    }
  } finally {
    seeding = false;
  }
}

export function listCatalogSets(): CatalogSet[] {
  seedDistinctCatalogSets();
  return readStore().sets;
}

export function listVersions(): CatalogSet[] {
  return listCatalogSets().filter((s) => s.status !== "draft");
}

export function listDrafts(): CatalogSet[] {
  return listCatalogSets().filter((s) => s.status === "draft");
}

export function currentHearing(): CatalogSet | null {
  const store = readStore();
  if (!store.hearingId) return null;
  return store.sets.find((s) => s.id === store.hearingId) ?? null;
}

export function noteLivePublished() {
  if (restoreDepth > 0) return;
  const store = readStore();
  if (!store.hearingId) return;
  store.hearingId = null;
  writeStore(store);
}

export function unpublishedLabels(): string[] {
  const live = new Map(allRunnableSkills().map((s) => [s.id, skillLabel(s)]));
  return skillsWithPendingDrafts().map((id) => live.get(id) || newestDraftForSkill(id)?.name || id);
}

export function saveCatalogSet(name: string, note = "", status: "version" | "draft" = "version"): CatalogSet {
  const set: CatalogSet = {
    id: `set-${Date.now()}`,
    name: name.trim() || suggestedSetName(),
    note: note.trim(),
    savedAt: new Date().toISOString(),
    status,
    skills: liveSnapshot(),
  };
  const store = readStore();
  store.sets = [set, ...store.sets].slice(0, MAX_SETS);
  writeStore(store);
  return set;
}

export function updateCatalogSet(id: string, patch: { name?: string; note?: string; skills?: SetSkill[] }) {
  const store = readStore();
  const set = store.sets.find((s) => s.id === id);
  if (!set) return;
  if (typeof patch.name === "string") {
    const name = patch.name.trim();
    if (name) set.name = name;
  }
  if (typeof patch.note === "string") set.note = patch.note.trim();
  if (patch.skills) set.skills = patch.skills;
  writeStore(store);
}

export function deleteCatalogSet(id: string): boolean {
  const store = readStore();
  const next = store.sets.filter((s) => s.id !== id);
  if (next.length === store.sets.length) return false;
  store.sets = next;
  if (store.hearingId === id) store.hearingId = null;
  writeStore(store);
  return true;
}

export function promoteDraft(id: string): CatalogSet | null {
  const store = readStore();
  const set = store.sets.find((s) => s.id === id);
  if (!set || set.status !== "draft") return null;
  set.status = "version";
  set.savedAt = new Date().toISOString();
  writeStore(store);
  return set;
}

function sameRaw(a: string | undefined, b: string | undefined) {
  return (a ?? "").trim() === (b ?? "").trim();
}

/** 这一版和线上正在用的技能一致（没发布的草稿不算）。 */
export function matchesLiveCatalog(set: CatalogSet): boolean {
  const live = cachedLiveSkills().filter((s) => !isAnswerLayerSkill(s.id));
  const past = set.skills.filter((s) => !isAnswerLayerSkill(s.id));
  if (live.length !== past.length) return false;
  const liveRaw = new Map(live.map((s) => [s.id, s.manifest]));
  return past.every((s) => liveRaw.has(s.id) && sameRaw(s.raw, liveRaw.get(s.id)));
}

export function restoreCatalogSet(id: string): { ok: boolean; reason?: string } {
  const store = readStore();
  const set = store.sets.find((s) => s.id === id);
  if (!set) return { ok: false, reason: "找不到这一版" };

  const builtin = new Map(SKILL_CATALOG.map((s) => [s.id, s.manifest]));
  const live = new Map(allRunnableSkills().map((s) => [s.id, s.manifest]));
  const keepImported = new Set(set.skills.filter((s) => s.imported).map((s) => s.id));

  restoreDepth += 1;
  try {
    for (const draftId of skillsWithPendingDrafts()) discardDraftsForSkill(draftId);
    for (const rec of readImportedRecords()) {
      if (!keepImported.has(rec.id)) removeImportedSkill(rec.id);
    }
    for (const skill of set.skills) {
      if (skill.imported || !builtin.has(skill.id)) {
        if (!sameRaw(readImportedRecords().find((r) => r.id === skill.id)?.raw, skill.raw)) {
          const taken = new Set(readImportedRecords().map((r) => r.id).filter((x) => x !== skill.id));
          installImportedMarkdown(skill.raw, taken, skill.id);
        }
        continue;
      }
      if (sameRaw(live.get(skill.id), skill.raw)) continue;
      if (sameRaw(builtin.get(skill.id), skill.raw)) {
        revertToBuiltin(skill.id, skill.name);
        continue;
      }
      publishSkillVersion(skill.id, skill.name, skill.raw, `还原自「${set.name}」`, "rollback");
    }
  } finally {
    restoreDepth -= 1;
  }

  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SKILL_PUBLISH_EVENT));
  const next = readStore();
  next.hearingId = id;
  writeStore(next);
  return { ok: true };
}

function who(kind: string, label: string): string {
  return kind === "skill" ? label : "没人接";
}

function editDetail(pastRaw: string, liveRaw: string): string {
  const past = new Set(parseSkillMarkdown(pastRaw).triggers);
  const live = new Set(parseSkillMarkdown(liveRaw).triggers);
  const added = [...live].filter((t) => !past.has(t));
  const removed = [...past].filter((t) => !live.has(t));
  if (added.length) return `多认了「${added.slice(0, 3).join("」「")}」`;
  if (removed.length) return `不再认「${removed.slice(0, 3).join("」「")}」`;
  return "里面的步骤或说明改过";
}

function clipText(text: string, n = 48): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= n ? t : `${t.slice(0, n)}…`;
}

function listDelta(label: string, past: string[], live: string[]): string | null {
  const added = live.filter((t) => t && !past.includes(t));
  const removed = past.filter((t) => t && !live.includes(t));
  if (!added.length && !removed.length) return null;
  const parts: string[] = [];
  if (removed.length) parts.push(`少了${removed.slice(0, 5).map((t) => `「${t}」`).join("")}`);
  if (added.length) parts.push(`多了${added.slice(0, 5).map((t) => `「${t}」`).join("")}`);
  return `${label}${parts.join("，")}`;
}

export function skillChangeLines(pastRaw?: string, liveRaw?: string): string[] {
  if (pastRaw && !liveRaw) return ["现在没有这个技能。切回去会把它带回来。"];
  if (!pastRaw && liveRaw) return ["这一版里没有。切回去会把它拿掉。"];
  if (!pastRaw || !liveRaw || sameRaw(pastRaw, liveRaw)) return [];
  const past = parseSkillMarkdown(pastRaw);
  const live = parseSkillMarkdown(liveRaw);
  const lines: string[] = [];
  const triggers = listDelta("认的说法", past.triggers, live.triggers);
  if (triggers) lines.push(triggers);
  if (past.description.trim() !== live.description.trim()) {
    lines.push(`说明从「${clipText(past.description) || "空"}」改成「${clipText(live.description) || "空"}」`);
  }
  const stepText = (steps: { label: string; id: string }[]) => steps.map((s) => s.label || s.id).filter(Boolean).join(" → ");
  const beforeSteps = stepText(past.steps);
  const afterSteps = stepText(live.steps);
  if (beforeSteps !== afterSteps) {
    lines.push(`步骤从「${clipText(beforeSteps, 72) || "空"}」改成「${clipText(afterSteps, 72) || "空"}」`);
  }
  if (!lines.length) lines.push("正文改过，客户说法和步骤没变。");
  return lines;
}

function sayLine(raw: string | undefined): string {
  if (!raw) return "没有这个技能";
  const triggers = parseSkillMarkdown(raw).triggers.map((t) => t.trim()).filter((t) => t.length >= 2);
  const zh = triggers.filter((t) => /[\u4e00-\u9fff]/.test(t));
  const picked = (zh.length ? zh : triggers).slice(0, 4);
  if (!picked.length) return "不靠说法来认";
  return picked.join("、");
}

function textHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function liveStorageSig(): string {
  if (typeof localStorage === "undefined") return "";
  const applied = localStorage.getItem("ownagent:skill-applied") ?? "";
  const imported = localStorage.getItem("ownagent:imported-skills") ?? "";
  return `${textHash(applied)}:${textHash(imported)}`;
}

let liveCache: { sig: string; skills: AgentSkill[] } | null = null;

function cachedLiveSkills(): AgentSkill[] {
  const sig = liveStorageSig();
  if (liveCache?.sig === sig) return liveCache.skills;
  const skills = allRunnableSkills();
  liveCache = { sig, skills };
  return skills;
}

const rawCatalogCache = new Map<string, AgentSkill[]>();

function catalogFromRaws(rows: SetSkill[]): AgentSkill[] {
  const key = rows.map((s) => `${s.id}:${textHash(s.raw)}`).join("|");
  const hit = rawCatalogCache.get(key);
  if (hit) return hit;
  const cores = rows.map((s) => hydrateSkill(s.raw, { id: s.id, skillPath: `set://${s.id}` }));
  const catalog = enrichSkillCatalog(cores, "browser").filter((s) => s.runnable) as AgentSkill[];
  rawCatalogCache.set(key, catalog);
  if (rawCatalogCache.size > 24) rawCatalogCache.delete(rawCatalogCache.keys().next().value!);
  return catalog;
}

export function questionsForSets(past: CatalogSet, live: AgentSkill[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (q: string) => {
    const text = q.trim();
    if (text.length < 2 || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };
  for (const skill of [...past.skills, ...live]) {
    for (const row of listGateQuestionRows(skill.id)) push(row.query);
  }
  for (const entry of listQueryLog()) push(entry.q);
  return out.slice(0, 40);
}

export function diffCatalogs(
  past: readonly AgentSkill[],
  live: readonly AgentSkill[],
  pastRaw: ReadonlyMap<string, string>,
  liveRaw: ReadonlyMap<string, string>,
  queries: readonly string[],
): SetDiff {
  const moved: SentenceMove[] = [];
  const editedById = new Map<string, SkillEdit>();
  let same = 0;
  for (const q of queries) {
    const before = routeQuery(q, past as AgentSkill[]);
    const after = routeQuery(q, live as AgentSkill[]);
    const from = who(before.kind, before.label);
    const to = who(after.kind, after.label);
    if (routeKey(before) !== routeKey(after)) {
      moved.push({ q, from, to });
      continue;
    }
    const skillId = after.skillId;
    if (skillId && !sameRaw(pastRaw.get(skillId), liveRaw.get(skillId))) {
      if (!editedById.has(skillId)) {
        editedById.set(skillId, { name: to, detail: editDetail(pastRaw.get(skillId) ?? "", liveRaw.get(skillId) ?? "") });
      }
      continue;
    }
    same += 1;
  }
  return { moved, edited: [...editedById.values()], same };
}

export function compareWithLive(set: CatalogSet): SetDiff {
  const live = allRunnableSkills();
  const past = catalogFromRaws(set.skills);
  const pastRaw = new Map(set.skills.map((s) => [s.id, s.raw]));
  const liveRaw = new Map(live.map((s) => [s.id, s.manifest]));
  return diffCatalogs(past, live, pastRaw, liveRaw, questionsForSets(set, live));
}

export function faceSet(set: CatalogSet): SetCompareFace {
  const liveAll = allRunnableSkills();
  const live = liveAll.filter((s) => !isAnswerLayerSkill(s.id));
  const past = set.skills.filter((s) => !isAnswerLayerSkill(s.id));
  const liveById = new Map(live.map((s) => [s.id, s]));
  const pastById = new Map(past.map((s) => [s.id, s]));
  const ids = [...new Set([...past.map((s) => s.id), ...live.map((s) => s.id)])];
  const skills: SetSkillRow[] = ids.map((id) => {
    const then = pastById.get(id);
    const now = liveById.get(id);
    const name = (now ? skillLabel(now) : then?.name) || id;
    if (then && !now) {
      return { id, name, thenSay: sayLine(then.raw), nowSay: "没有这个技能", mark: "only-then", detail: "现在没有", lines: skillChangeLines(then.raw, undefined) };
    }
    if (!then && now) {
      return { id, name, thenSay: "没有这个技能", nowSay: sayLine(now.manifest), mark: "only-now", detail: "当时没有", lines: skillChangeLines(undefined, now.manifest) };
    }
    const same = sameRaw(then?.raw, now?.manifest);
    return {
      id,
      name,
      thenSay: sayLine(then?.raw),
      nowSay: sayLine(now?.manifest),
      mark: same ? "same" : "changed",
      detail: same ? "一样" : editDetail(then?.raw ?? "", now?.manifest ?? ""),
      lines: same ? [] : skillChangeLines(then?.raw, now?.manifest),
    };
  });
  const rank = { changed: 0, "only-then": 1, "only-now": 2, same: 3 } as const;
  skills.sort((a, b) => rank[a.mark] - rank[b.mark] || a.name.localeCompare(b.name, "zh"));

  const pastCatalog = catalogFromRaws(set.skills);
  const asks: SentenceMove[] = [];
  const held: HeldAsk[] = [];
  let sameAsks = 0;
  for (const q of questionsForSets(set, liveAll)) {
    const before = routeQuery(q, pastCatalog);
    const after = routeQuery(q, liveAll);
    const to = who(after.kind, after.label);
    if (routeKey(before) === routeKey(after)) {
      sameAsks += 1;
      if (held.length < 8) held.push({ q, who: to });
      continue;
    }
    asks.push({ q, from: who(before.kind, before.label), to });
  }
  return { skills, asks, held, sameAsks };
}

export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 对话里对照某一版：一句话说明路由/内容差在哪 */
export function sentenceAgainstSet(query: string, set: CatalogSet): string {
  const q = query.trim();
  if (!q) return "";
  const past = catalogFromRaws(set.skills);
  const live = allRunnableSkills();
  const before = routeQuery(q, past);
  const after = routeQuery(q, live);
  const from = who(before.kind, before.label);
  const to = who(after.kind, after.label);
  if (routeKey(before) !== routeKey(after)) {
    return `现在会交给${to}答。「${set.name}」会交给${from}。`;
  }
  const skillId = after.skillId;
  const pastRaw = set.skills.find((s) => s.id === skillId)?.raw;
  const liveRaw = live.find((s) => s.id === skillId)?.manifest;
  if (skillId && !sameRaw(pastRaw, liveRaw)) {
    return `还是会交给${to}答，但「${set.name}」里认的内容不一样。`;
  }
  return `还是会交给${to}答`;
}

function spokenLine(raw: string | undefined): string {
  if (!raw) return "";
  const matched = raw.match(/^\s*text:\s*"([^"]+)"/m);
  return matched?.[1]?.trim() ?? "";
}

export type ForkSide = {
  label: string;
  who: string;
  score: number;
  margin: number;
  hits: string[];
  rule: string;
  said: string;
  board: { name: string; score: number; hits: string[] }[];
};

export type DecisionFork = {
  query: string;
  /** route：去向不同。words：去向相同，认的说法不同。 */
  splitOn: "route" | "words";
  note: string;
  live: ForkSide;
  alt: ForkSide;
};

function forkSide(label: string, decision: ReturnType<typeof routeQuery>, said: string): ForkSide {
  return {
    label,
    who: decision.kind === "skill" ? decision.label : "没有技能接",
    score: decision.score,
    margin: decision.margin,
    hits: decision.hits.slice(0, 4),
    rule: decision.rule,
    said,
    board: decision.ranked
      .filter((row) => row.score > 0)
      .slice(0, 3)
      .map((row) => ({ name: skillLabel(row.skill), score: row.score, hits: row.hits.slice(0, 3) })),
  };
}

/** 正在生效的那一版。回复上的切换不会改这里。 */
export function activeVersionId(): string | null {
  const versions = listVersions();
  const hearing = currentHearing();
  if (hearing && versions.some((set) => set.id === hearing.id) && matchesLiveCatalog(hearing)) return hearing.id;
  return versions.find((set) => matchesLiveCatalog(set))?.id ?? versions[0]?.id ?? null;
}

/** 用某一版自己的技能做对照。不传则用当前生效的技能。 */
export function skillsForVersion(id: string | null | undefined): AgentSkill[] {
  if (id) {
    const set = listVersions().find((item) => item.id === id);
    if (set?.skills.length) return catalogFromRaws(set.skills);
  }
  return cachedLiveSkills();
}

/** 同一句话在这条回复的版本和另一版上的两条判定。不改线上。 */
export function decisionFork(query: string, set: CatalogSet, baselineId?: string | null): DecisionFork | null {
  const q = query.trim();
  if (!q) return null;
  const past = catalogFromRaws(set.skills);
  const live = skillsForVersion(baselineId);
  const before = routeQuery(q, past);
  const after = routeQuery(q, live);
  const said = spokenLine(before.skillId ? set.skills.find((skill) => skill.id === before.skillId)?.raw : undefined);
  const note = hearSet(q, set, baselineId);
  if (!note) return null;
  return {
    query: q,
    splitOn: routeKey(before) !== routeKey(after) ? "route" : "words",
    note,
    live: forkSide("现在", after, ""),
    alt: forkSide(set.name, before, said),
  };
}

export type ScoreRow = {
  q: string;
  note: string;
  expect: string;
  liveWho: string;
  altWho: string;
  liveOk: boolean;
  altOk: boolean;
  moved: boolean;
};

export type VersionScorecard = {
  setId: string;
  name: string;
  total: number;
  liveOk: number;
  altOk: number;
  rows: ScoreRow[];
};

let pinnedScore: VersionScorecard | null = null;

function laneWho(decision: ReturnType<typeof routeQuery>): string {
  return decision.kind === "skill" ? decision.label : "没有技能接";
}

/** 用固定路由题给某一版打分，对照切换前的线上。不改技能。 */
export function scoreVersion(set: CatalogSet, live = cachedLiveSkills()): VersionScorecard {
  const past = catalogFromRaws(set.skills);
  const rows = getRouterEvalCases().map((item) => {
    const alt = routeQuery(item.query, past);
    const now = routeQuery(item.query, live);
    return {
      q: item.query,
      note: item.note ?? "",
      expect: routeKeyLabel(item.expectedSkillId, live),
      liveWho: laneWho(now),
      altWho: laneWho(alt),
      liveOk: now.skillId === item.expectedSkillId,
      altOk: alt.skillId === item.expectedSkillId,
      moved: routeKey(now) !== routeKey(alt),
    };
  });
  return {
    setId: set.id,
    name: set.name,
    total: rows.length,
    liveOk: rows.filter((row) => row.liveOk).length,
    altOk: rows.filter((row) => row.altOk).length,
    rows,
  };
}

export function pinVersionScore(set: CatalogSet): VersionScorecard {
  pinnedScore = scoreVersion(set);
  return pinnedScore;
}

export function clearVersionScore() {
  pinnedScore = null;
}

export function takeVersionScore(): VersionScorecard | null {
  return pinnedScore;
}

const FAQ_STOPS = ["怎么办", "怎么", "如何", "什么", "哪些", "有没有", "是否", "可以", "一下"];

function contentTokens(text: string): string[] {
  const cleaned = text.replace(/[？?！!。，,\s]/g, "");
  const parts = cleaned
    .split(new RegExp(FAQ_STOPS.join("|"), "g"))
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  return parts.length ? parts : cleaned.length >= 2 ? [cleaned] : [];
}

function skillTitle(skill: Pick<AgentSkill, "name" | "description">): string {
  const head = skill.description.split(/[—–\-]/)[0]?.trim();
  return head && head.length >= 2 && head.length <= 24 ? head : skill.name;
}

/** 这句话会不会在「查现成答案」和别的技能之间二选一。只看和这句有关的技能。 */
export function faqHeadKey(query: string, skills: AgentSkill[]): string {
  const faq = matchFaq(query);
  if (!faq || faq.score < 0.8) return "";
  const tokens = contentTokens(faq.entry.q);
  const heads: string[] = [];
  for (const skill of skills) {
    if (skill.id === "product-faq") continue;
    const blob = `${skillTitle(skill)}\n${skill.description}\n${skill.triggers.join("\n")}`;
    if (tokens.some((token) => blob.includes(token))) heads.push(`${skill.id}:${skillTitle(skill)}`);
  }
  if (skills.some((skill) => skill.id === "product-faq")) heads.push("@answer");
  return heads.sort().join("|");
}

/** 这一版对这句话的分流，和当前线上是不是同一套。 */
export function versionAgreesWithLive(query: string, skills: AgentSkill[]): boolean {
  return faqHeadKey(query, skills) === faqHeadKey(query, allRunnableSkills());
}

function faqHeadNote(query: string, skills: AgentSkill[]): string {
  const faq = matchFaq(query);
  const tokens = faq ? contentTokens(faq.entry.q) : [];
  const rivals = skills.filter((skill) => {
    if (skill.id === "product-faq" || !tokens.length) return false;
    const blob = `${skillTitle(skill)}\n${skill.description}\n${skill.triggers.join("\n")}`;
    return tokens.some((token) => blob.includes(token));
  });
  if (rivals.length && skills.some((skill) => skill.id === "product-faq")) {
    const labels = rivals.slice(0, 2).map((skill) => skillTitle(skill));
    return clipText(`要先确认：${[...labels, "查现成答案"].join(" / ")}`, 36);
  }
  const said = spokenLine(skills.find((skill) => skill.id === routeQuery(query, skills).skillId)?.manifest);
  if (said) return clipText(said, 36);
  if (!skills.some((skill) => skill.id === "product-faq")) {
    const decision = routeQuery(query, skills);
    return decision.kind === "skill" ? `交给${decision.label}` : "没有技能接";
  }
  return clipText(faq?.entry.a.split("\n")[0] ?? "查现成答案", 36);
}

/** 这句相对这条回复的版本，在另一版里是否会换说法。一样时返回空。 */
export function hearSet(query: string, set: CatalogSet, baselineId?: string | null): string {
  const q = query.trim();
  if (!q) return "";
  const past = catalogFromRaws(set.skills);
  const live = skillsForVersion(baselineId);
  const before = routeQuery(q, past);
  const after = routeQuery(q, live);
  const said = spokenLine(before.skillId ? set.skills.find((s) => s.id === before.skillId)?.raw : undefined);
  if (routeKey(before) !== routeKey(after)) {
    if (said) return clipText(said, 36);
    const from = before.kind === "skill" ? before.label : "没有技能接";
    const to = after.kind === "skill" ? after.label : "没有技能接";
    return `交给${from}，现在是${to}`;
  }
  const skillId = before.skillId || after.skillId;
  const pastRaw = set.skills.find((s) => s.id === skillId)?.raw;
  const liveRaw = live.find((s) => s.id === skillId)?.manifest;
  const saidPast = spokenLine(pastRaw);
  const saidLive = spokenLine(liveRaw);
  if ((saidPast || saidLive) && saidPast !== saidLive) return clipText(saidPast || saidLive, 36);
  if (skillId && pastRaw && liveRaw) {
    const pastDoc = parseSkillMarkdown(pastRaw);
    const liveDoc = parseSkillMarkdown(liveRaw);
    const stepsOf = (steps: { label: string; id: string }[]) => steps.map((s) => s.label || s.id).join(" → ");
    if (stepsOf(pastDoc.steps) !== stepsOf(liveDoc.steps)) {
      const line = skillChangeLines(pastRaw, liveRaw).find((item) => item.startsWith("步骤")) ?? "步骤不一样";
      return clipText(line, 36);
    }
  }
  if (faqHeadKey(q, past) !== faqHeadKey(q, live)) return faqHeadNote(q, past);
  return "";
}
