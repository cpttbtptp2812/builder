/** 已上线 Skill 整包 — 覆盖内置目录，供运行时与开发者试跑 */

import type { AgentSkill } from "./agentSkills";
import { getAppliedSkill } from "./skillCompareStore";
import { enrichSkillCatalog, hydrateSkill, type SkillManifestCore } from "./skillMarkdown";
import { apiFetch } from "./apiClient";

const SERVER_LIVE_KEY = "ownagent:server-live-skills";

type ServerLiveSkill = { skillId: string; version: string; raw: string; publishedAt: string };

function serverLiveMap(): Record<string, ServerLiveSkill> {
  try {
    return JSON.parse(localStorage.getItem(SERVER_LIVE_KEY) ?? "{}") as Record<string, ServerLiveSkill>;
  } catch {
    return {};
  }
}

export async function syncServerLiveSkills(): Promise<number> {
  const body = await apiFetch<{ skills?: ServerLiveSkill[] }>("/skills/live");
  if (!body?.skills) return 0;
  const map = Object.fromEntries(body.skills.map((row) => [row.skillId, row]));
  localStorage.setItem(SERVER_LIVE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("ownagent:live-skills-updated"));
  return body.skills.length;
}

/** 单技能：若有现用版则用其 raw 重新 hydrate */
export function overlayPublishedRaw(core: SkillManifestCore): SkillManifestCore {
  if (typeof localStorage === "undefined") return core;
  const server = serverLiveMap()[core.id];
  if (server) {
    return hydrateSkill(server.raw, {
      id: core.id,
      skillPath: `live://${core.id}@${server.version}`,
    });
  }
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
