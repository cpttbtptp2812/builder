/** 已上线 Skill 整包 — 覆盖内置目录，供运行时与开发者试跑 */

import type { AgentSkill } from "./agentSkills";
import { getAppliedSkill } from "./skillCompareStore";
import { enrichSkillCatalog, hydrateSkill, type SkillManifestCore } from "./skillMarkdown";

/** 单技能：若有现用版则用其 raw 重新 hydrate */
export function overlayPublishedRaw(core: SkillManifestCore): SkillManifestCore {
  if (typeof localStorage === "undefined") return core;
  const pub = getAppliedSkill(core.id);
  if (!pub) return core;
  return hydrateSkill(pub.raw, {
    id: core.id,
    skillPath: `published://${core.id}@${pub.version}`,
  });
}

/** 整目录 overlay + 重新 compile（触发词冲突等需全量 peers） */
export function overlayPublishedCatalog(builtins: AgentSkill[]): AgentSkill[] {
  if (typeof localStorage === "undefined") return builtins;
  const cores = builtins.map((s) => overlayPublishedRaw(s));
  return enrichSkillCatalog(cores, "browser") as AgentSkill[];
}

export function publishedVersionLabel(skillId: string): string | null {
  return getAppliedSkill(skillId)?.version ?? null;
}

export function publishedAppliedAt(skillId: string): string | null {
  return getAppliedSkill(skillId)?.appliedAt ?? null;
}
