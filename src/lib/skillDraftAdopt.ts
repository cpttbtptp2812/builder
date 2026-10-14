/** 把办事里试出来的改动（分叉参数、求解出的规则）写成技能草稿，交给发版检查 */

import { getBuiltinSkill, getSkill } from "./agentSkills";
import { resolveCreditFlowDeskSkill } from "./creditFlowSkillsCatalog";
import { newestDraftForSkill, requestSkillOpen, resolveBaselineRaw, saveNewVersionDraft } from "./skillCompareStore";

export function onlineSkillRaw(skillId: string): string {
  const manifest = getBuiltinSkill(skillId)?.manifest ?? resolveCreditFlowDeskSkill(skillId)?.manifest ?? getSkill(skillId)?.manifest ?? "";
  return resolveBaselineRaw(skillId, manifest);
}

function yamlScalar(v: unknown): string {
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = String(v);
  return /^[\p{L}\p{N}_.\-/|]+$/u.test(s) && !/^(true|false|null|\d[\d.]*)$/i.test(s) ? s : JSON.stringify(s);
}

/**
 * 改 stepId 这一步 args 里已声明的参数；后面步骤里声明了同名参数的也跟着改（与运行台分叉同语义）。
 * 只改已有的行，不新增参数。
 */
export function patchStepArgs(raw: string, stepId: string, changes: Record<string, unknown>): { raw: string; applied: string[] } {
  const lines = raw.split("\n");
  const applied: string[] = [];
  let reached = false;
  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i]!.match(/^(\s*)-\s+id:\s*["']?([^"'\s#]+)/);
    if (!head) continue;
    const stepIndent = head[1]!.length;
    let end = i + 1;
    while (end < lines.length) {
      const l = lines[end]!;
      if (l.trim() && (l.match(/^(\s*)/)![1]!.length <= stepIndent || /^---\s*$/.test(l))) break;
      end += 1;
    }
    if (head[2] === stepId) reached = true;
    if (reached) {
      const own = head[2] === stepId;
      for (const [key, value] of Object.entries(changes)) {
        const re = new RegExp(`^([ \\t]*)${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:[^\\r]*(\\r?)$`);
        for (let j = i + 1; j < end; j += 1) {
          if (!re.test(lines[j]!)) continue;
          lines[j] = lines[j]!.replace(re, `$1${key}: ${yamlScalar(value)}$2`);
          if (own || !applied.includes(key)) applied.push(own ? key : `${key}@${head[2]}`);
          break;
        }
      }
    }
    i = end - 1;
  }
  return { raw: lines.join("\n"), applied };
}

/** 存成该技能的草稿（已有草稿则在其上继续改），并打开技能发版页 */
export function adoptIntoDraft(skillId: string, raw: string, name: string) {
  saveNewVersionDraft(skillId, raw, name);
  requestSkillOpen(skillId);
  window.location.hash = "#/work/ownagent?view=compare";
}

/** 草稿基底：已有草稿就接着改，没有就从线上版开始 */
export function draftBase(skillId: string): string {
  return newestDraftForSkill(skillId)?.raw ?? onlineSkillRaw(skillId);
}
