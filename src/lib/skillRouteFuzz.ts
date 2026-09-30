/** 路由邻域扫描 — 对触发说法做变体，看新版会不会被别的技能抢走 */

import { AGENT_SKILLS, allRunnableSkills, type AgentSkill } from "./agentSkills";
import { hydrateFromRaw } from "./skillCompareEngine";
import { attachCompileToManifest, hydrateSkill } from "./skillMarkdown";
import { routeQuery } from "./skillRouter";

export type RouteFuzzRow = {
  variant: string;
  kind: string;
  baselineSkillId: string | null;
  candidateSkillId: string | null;
  baselineLabel: string;
  candidateLabel: string;
  /** 现用版会交给本技能，新版交给了别的 */
  lostRoute: boolean;
  /** 现用版没交给本技能，新版抢到了 */
  gainedRoute: boolean;
};

export type RouteFuzzReport = {
  skillId: string;
  variantsTested: number;
  lostCount: number;
  gainedCount: number;
  rows: RouteFuzzRow[];
};

function hydratePair(skillId: string, baselineRaw: string, candidateRaw: string) {
  const hydrate = (raw: string, label: string) => {
    const core = hydrateSkill(raw, { id: skillId, skillPath: `fuzz://${label}` });
    const peers = AGENT_SKILLS.filter((s) => s.id !== skillId).map((s) => ({ id: s.id, triggers: s.triggers }));
    return attachCompileToManifest(core, { skillId, env: "browser", peers }) as AgentSkill;
  };
  const baselineSkill = hydrate(baselineRaw, "baseline");
  const candidateSkill = hydrate(candidateRaw, "candidate");
  const live = allRunnableSkills();
  const catalogBase = live.map((s) => (s.id === skillId ? baselineSkill : s));
  const catalogCand = live.map((s) => (s.id === skillId ? candidateSkill : s));
  return { catalogBase, catalogCand };
}

const PREFIXES = ["请", "帮我", "能不能"];
const TYPO_SWAPS: [string, string][] = [
  ["检查", "检察"],
  ["上线", "上線"],
  ["发布", "发版"],
  ["巡检", "巡檢"],
];

function pushVariant(out: Map<string, string>, text: string, kind: string) {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length < 3 || t.length > 120) return;
  if (!out.has(t)) out.set(t, kind);
}

export function generateRouteVariants(triggers: string[], skillId: string): { text: string; kind: string }[] {
  const map = new Map<string, string>();
  for (const raw of triggers) {
    const t = raw.trim();
    if (t.length < 2) continue;
    pushVariant(map, t, "原说法");
    pushVariant(map, `用户说：${t}，请处理`, "口语包装");
    for (const p of PREFIXES) pushVariant(map, `${p}${t}`, "加前缀");
    if (t.length >= 4) {
      pushVariant(map, t.slice(0, -1), "少一字");
      pushVariant(map, t.slice(1), "漏首字");
    }
    for (const [a, b] of TYPO_SWAPS) {
      if (t.includes(a)) pushVariant(map, t.replace(a, b), "常见错字");
      if (t.includes(b)) pushVariant(map, t.replace(b, a), "错字还原");
    }
  }
  pushVariant(map, defaultSkillProbe(skillId, triggers), "技能场景句");
  return [...map.entries()].map(([text, kind]) => ({ text, kind })).slice(0, 48);
}

function defaultSkillProbe(skillId: string, triggers: string[]): string {
  if (skillId === "release-inspector") return "发布前验收 https://example.com 能不能发";
  const t = triggers[0];
  return t ? `请${t}` : "请处理一下";
}

export async function runRouteFuzzScan(opts: {
  skillId: string;
  baselineRaw: string;
  candidateRaw: string;
}): Promise<RouteFuzzReport> {
  const { catalogBase, catalogCand } = hydratePair(opts.skillId, opts.baselineRaw, opts.candidateRaw);
  const skill = catalogBase.find((s) => s.id === opts.skillId)!;
  const variants = generateRouteVariants(skill.triggers, opts.skillId);
  const rows: RouteFuzzRow[] = [];

  for (const { text, kind } of variants) {
    const b = routeQuery(text, catalogBase);
    const c = routeQuery(text, catalogCand);
    const baselineSkillId = b.skillId;
    const candidateSkillId = c.skillId;
    const lostRoute = baselineSkillId === opts.skillId && candidateSkillId !== opts.skillId;
    const gainedRoute = baselineSkillId !== opts.skillId && candidateSkillId === opts.skillId;
    if (!lostRoute && !gainedRoute && baselineSkillId === candidateSkillId) continue;
    rows.push({
      variant: text,
      kind,
      baselineSkillId,
      candidateSkillId,
      baselineLabel: b.label,
      candidateLabel: c.label,
      lostRoute,
      gainedRoute,
    });
  }

  const lost = rows.filter((r) => r.lostRoute);
  const gained = rows.filter((r) => r.gainedRoute);
  return {
    skillId: opts.skillId,
    variantsTested: variants.length,
    lostCount: lost.length,
    gainedCount: gained.length,
    rows: [...lost, ...gained].slice(0, 24),
  };
}
