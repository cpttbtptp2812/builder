/** 一句话同时是说法、考题和发版实验 */

import { runSkill, type AgentSkill, type SkillTraceStep } from "./agentSkills";
import { exactDoIntervention } from "./deterministicScm";
import { hydrateFromRaw } from "./skillCompareEngine";
import { parseSkillMarkdown } from "./skillMarkdown";
import { COUNTERFACTUAL_OBS, MOCK_PROFILES, SKILL_TRACE_CASES } from "./provingGround";
import { listQueryLog } from "./skillQueryLog";
import { rankSkills, routeQuery, skillLabel } from "./skillRouter";
import { listAllCasesForSkill } from "./skillTraceCaseStore";

const STOP = /^(帮我|帮忙|一下|看看|看下|这个|那个|什么|怎么|能否|能不能|可不可以|请帮|请问|今天|现在)/;

export function weekQueriesForSkill(skillId: string, days = 7): string[] {
  const since = Date.now() - days * 86_400_000;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of [...listQueryLog()].reverse()) {
    if (Date.parse(e.at) < since || e.route !== skillId) continue;
    const q = e.q.trim();
    if (!q || seen.has(q)) continue;
    seen.add(q);
    out.push(q);
    if (out.length >= 8) break;
  }
  return out;
}

/** 发版必问：这周真实问过的，再加上已经记下的题 */
export function releaseQuestions(skillId: string): string[] {
  const out = new Set<string>();
  for (const q of weekQueriesForSkill(skillId)) out.add(q);
  for (const c of listAllCasesForSkill(skillId, SKILL_TRACE_CASES)) out.add(c.query);
  return [...out].slice(0, 6);
}

/** 从客户原话里抽出一句能当说法的短语（至少 4 字，才会单独接住）。取原话里靠前的那截。 */
export function catchPhrase(query: string, triggers: string[]): string | null {
  const existing = triggers.map((t) => t.toLowerCase());
  const bare = query.replace(/https?:\/\/\S+/gi, " ").replace(/\s+/g, "");
  const cands: { text: string; at: number }[] = [];
  for (const run of bare.match(/[\u4e00-\u9fff]+/g) ?? []) {
    const origin = bare.indexOf(run);
    for (let n = 4; n <= Math.min(6, run.length); n += 1) {
      for (let i = 0; i + n <= run.length; i += 1) {
        cands.push({ text: run.slice(i, i + n), at: origin + i });
      }
    }
  }
  for (const w of query.match(/[A-Za-z][A-Za-z0-9_-]{3,}/g) ?? []) {
    cands.push({ text: w, at: query.toLowerCase().indexOf(w.toLowerCase()) });
  }
  const fresh = cands.filter((c) => {
    if (STOP.test(c.text) || /今天|这个|那个/.test(c.text)) return false;
    const l = c.text.toLowerCase();
    return !existing.some((t) => t === l || t.includes(l) || (t.length >= 2 && l.includes(t)));
  });
  fresh.sort((a, b) => a.at - b.at || a.text.length - b.text.length);
  return fresh[0]?.text ?? null;
}

export type GraspSide = {
  id: string;
  label: string;
  ok: number;
  total: number;
  pass: boolean;
  here: boolean;
};

/** 这句话分别交给本技能和最接近的另一家，比谁把步骤跑通 */
export async function graspAgainst(query: string, skillId: string, catalog: AgentSkill[]): Promise<GraspSide[]> {
  const ranked = rankSkills(query, catalog);
  const mine = catalog.find((s) => s.id === skillId);
  const other = ranked.find((r) => r.skill.id !== skillId)?.skill;
  const picks = [mine, other].filter((s): s is AgentSkill => Boolean(s));
  const out: GraspSide[] = [];
  for (const skill of picks) {
    out.push(await graspOne(skill, query, skill.id === skillId));
  }
  return out.sort((a, b) => Number(b.pass) - Number(a.pass) || ratio(b) - ratio(a));
}

async function graspOne(skill: AgentSkill, query: string, here: boolean): Promise<GraspSide> {
  const label = skillLabel(skill);
  if (!skill.runnable || !skill.steps.length) {
    return { id: skill.id, label, ok: 0, total: 0, pass: false, here };
  }
  const { trace } = await runSkill(skill, query, undefined, {
    mockProfile: MOCK_PROFILES[skill.id],
    probeUrl: urlIn(query),
  });
  const ok = trace.filter((t) => t.ok).length;
  return { id: skill.id, label, ok, total: trace.length, pass: trace.length > 0 && ok === trace.length, here };
}

function ratio(s: GraspSide) {
  return s.total ? s.ok / s.total : 0;
}

export function rivalName(query: string, skillId: string, catalog: AgentSkill[]): string | null {
  const top = rankSkills(query, catalog)[0];
  if (!top || top.skill.id === skillId || top.score < 2) return null;
  const mine = rankSkills(query, catalog).find((r) => r.skill.id === skillId);
  if ((mine?.score ?? 0) >= 2) return null;
  return skillLabel(top.skill);
}

export function draftCatches(query: string, skillId: string, catalog: AgentSkill[]): boolean {
  const d = routeQuery(query, catalog);
  return d.kind === "skill" && d.skillId === skillId;
}

/** 把草稿里某一步弄坏，看哪些原来能过的话会翻掉 */
export async function flipIfBroken(
  draftRaw: string,
  skillId: string,
  stepIndex: number,
  queries: string[],
): Promise<{ flipped: string[]; held: string[]; cold: string[] }> {
  const skill = hydrateFromRaw(draftRaw, skillId, "break");
  const step = skill.steps[stepIndex];
  const flipped: string[] = [];
  const held: string[] = [];
  const cold: string[] = [];
  if (!step) return { flipped, held, cold };
  const mock = MOCK_PROFILES[skill.id];
  const br = COUNTERFACTUAL_OBS[skill.id]?.[step.id]?.break ?? { ok: false, error: "这一步被弄坏了" };
  for (const q of queries) {
    const probeUrl = urlIn(q);
    const { trace } = await runSkill(skill, q, undefined, { mockProfile: mock, probeUrl });
    const basePass = trace.length > 0 && trace.every((t) => t.ok);
    if (!basePass) {
      cold.push(q);
      continue;
    }
    const next = await exactDoIntervention(
      skill,
      q,
      trace,
      { kind: "observation", stepIndex, value: br },
      { mockProfile: mock, probeUrl },
    );
    if (answerHeld(next)) held.push(q);
    else flipped.push(q);
  }
  return { flipped, held, cold };
}

export function stepLabels(raw: string): { id: string; label: string }[] {
  return parseSkillMarkdown(raw).steps.map((s) => ({ id: s.id, label: s.label || s.tool }));
}

function answerHeld(trace: SkillTraceStep[]) {
  if (!trace.length || trace.some((t) => !t.ok)) return false;
  const last = trace[trace.length - 1]?.result;
  if (last && typeof last === "object") {
    const o = last as {
      dashboard?: { releaseInspect?: { overall?: string } };
      meta?: { overall?: string };
    };
    const overall = o.dashboard?.releaseInspect?.overall ?? o.meta?.overall;
    if (overall === "fail") return false;
  }
  return true;
}

function urlIn(query: string) {
  return query.match(/https?:\/\/[^\s]+/i)?.[0]?.replace(/[),。，、]+$/u, "");
}
