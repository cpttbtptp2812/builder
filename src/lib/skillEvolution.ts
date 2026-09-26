/** 技能进化 — 汇总所有技能的漏答挖掘结果，给出可一键采纳的改进建议，以及没有技能能接的问题 */

import { allRunnableSkills, isAnswerLayerSkill, SKILL_CATALOG } from "./agentSkills";
import { buildCorpus, type CorpusSource } from "./skillImpact";
import { routeQuery } from "./skillRouter";
import { mineTriggerSuggestions, type TriggerSuggestion } from "./skillTriggerMiner";
import { parseSkillMarkdown } from "./skillMarkdown";
import { setTriggers } from "./skillFormEdit";
import { newestDraftForSkill, saveNewVersionDraft } from "./skillCompareStore";
import { installImportedMarkdown, readImportedRecords } from "./importedSkills";
import { skillDisplayTitle } from "../components/ownagent/skillVerUi";

export type EvolutionSuggestion = TriggerSuggestion & { skillId: string; skillName: string };

export type OrphanQuery = { q: string; source: CorpusSource; count: number };

export type EvolutionReport = {
  suggestions: EvolutionSuggestion[];
  orphans: OrphanQuery[];
  usingSamples: boolean;
};

/** 技能当前的工作底稿：有未发布草稿就在草稿上继续改 */
function workingRaw(skillId: string, fallback: string): string {
  return newestDraftForSkill(skillId)?.raw ?? fallback;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function analyzeEvolution(): Promise<EvolutionReport> {
  const live = allRunnableSkills();
  const suggestions: EvolutionSuggestion[] = [];
  let usingSamples = false;

  for (const s of live) {
    if (isAnswerLayerSkill(s.id)) continue;
    await tick();
    const mining = mineTriggerSuggestions(s.id, workingRaw(s.id, s.manifest), 3);
    usingSamples ||= mining.usingSamples;
    for (const sug of mining.suggestions) suggestions.push({ ...sug, skillId: s.id, skillName: skillDisplayTitle(s) });
  }

  const captured = new Set(suggestions.flatMap((s) => s.captured.map((c) => c.q)));
  const orphans = buildCorpus(live)
    .filter((c) => !c.synthetic && !captured.has(c.q) && routeQuery(c.q, live).kind === "open")
    .map(({ q, source, count }) => ({ q, source, count }))
    .sort((a, b) => Number(b.source === "real") - Number(a.source === "real") || b.count - a.count);

  suggestions.sort(
    (a, b) => a.stolen.length - b.stolen.length || b.captured.length - a.captured.length,
  );
  return { suggestions, orphans, usingSamples };
}

/** 采纳：内置技能写入草稿（仍需检查发布）；导入技能直接更新 */
export function acceptSuggestion(s: EvolutionSuggestion): "draft" | "imported" {
  const live = allRunnableSkills().find((x) => x.id === s.skillId);
  if (!live) throw new Error("技能不存在");
  const base = workingRaw(s.skillId, live.manifest);
  const parsed = parseSkillMarkdown(base);
  const next = setTriggers(base, [...parsed.triggers, s.phrase]);

  if (SKILL_CATALOG.some((x) => x.id === s.skillId)) {
    saveNewVersionDraft(s.skillId, next, parsed.name || live.name);
    return "draft";
  }
  const taken = new Set(readImportedRecords().map((r) => r.id).filter((id) => id !== s.skillId));
  installImportedMarkdown(next, taken, s.skillId);
  return "imported";
}
