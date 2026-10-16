/** 草稿相对线上的结构化摘要（借鉴 Proposal diff，不含假业务数据） */

import type { ParsedSkillDoc } from "./skillMarkdown";

export type SkillDraftProposal = {
  triggersAdded: string[];
  triggersRemoved: string[];
  stepsAdded: { id: string; label: string; tool: string }[];
  stepsRemoved: { id: string; label: string; tool: string }[];
  stepsRetooled: { id: string; fromTool: string; toTool: string }[];
};

export function buildSkillDraftProposal(online: ParsedSkillDoc, draft: ParsedSkillDoc): SkillDraftProposal {
  const oTrig = new Set(online.triggers);
  const dTrig = new Set(draft.triggers);
  const triggersAdded = draft.triggers.filter((t) => !oTrig.has(t));
  const triggersRemoved = online.triggers.filter((t) => !dTrig.has(t));

  const oSteps = new Map(online.steps.map((s) => [s.id, s]));
  const dSteps = new Map(draft.steps.map((s) => [s.id, s]));

  const stepsAdded = draft.steps.filter((s) => !oSteps.has(s.id)).map((s) => ({ id: s.id, label: s.label, tool: s.tool }));
  const stepsRemoved = online.steps.filter((s) => !dSteps.has(s.id)).map((s) => ({ id: s.id, label: s.label, tool: s.tool }));

  const stepsRetooled: SkillDraftProposal["stepsRetooled"] = [];
  for (const s of draft.steps) {
    const prev = oSteps.get(s.id);
    if (prev && prev.tool !== s.tool) stepsRetooled.push({ id: s.id, fromTool: prev.tool, toTool: s.tool });
  }

  return { triggersAdded, triggersRemoved, stepsAdded, stepsRemoved, stepsRetooled };
}

export function skillDraftProposalSummary(p: SkillDraftProposal): string {
  const bits: string[] = [];
  if (p.triggersAdded.length) bits.push(`触发 +${p.triggersAdded.length}`);
  if (p.triggersRemoved.length) bits.push(`触发 −${p.triggersRemoved.length}`);
  if (p.stepsAdded.length) bits.push(`步骤 +${p.stepsAdded.length}`);
  if (p.stepsRemoved.length) bits.push(`步骤 −${p.stepsRemoved.length}`);
  if (p.stepsRetooled.length) bits.push(`改工具 ${p.stepsRetooled.length}`);
  return bits.length ? bits.join(" · ") : "结构与线上一致";
}
