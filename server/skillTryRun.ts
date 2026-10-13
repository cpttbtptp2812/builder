/** 技能页试跑：任意版本 SKILL 原文 + 试跑会话里的材料 → 与对话办事同一套 runSkillManifestOnServer */

import { enrichSkillCatalog, hydrateSkill } from "../src/lib/skillMarkdown.ts";
import type { ProductLlmConfig } from "../src/lib/llmProductBrief.ts";
import { runSkillManifestOnServer } from "./skills.ts";

export type InlineRunInput = {
  skillId: string;
  raw: string;
  query?: string;
  sessionId?: string;
  productWorkbench?: boolean;
  llmConfig?: ProductLlmConfig;
};

export type InlineRunOutcome =
  | { ok: true; result: Awaited<ReturnType<typeof runSkillManifestOnServer>> }
  | { ok: false; error: string };

export async function runInlineSkill(input: InlineRunInput): Promise<InlineRunOutcome> {
  const skillId = input.skillId?.trim();
  if (!skillId || !input.raw?.trim()) return { ok: false, error: "skillId and raw required" };
  const skill = enrichSkillCatalog(
    [hydrateSkill(input.raw, { id: skillId, skillPath: `inline://${skillId}` })],
    "server",
  )[0];
  if (!skill) return { ok: false, error: "skill compile failed" };
  const compileErr = (skill.diagnostics ?? []).find((d) => d.level === "error");
  if (compileErr) return { ok: false, error: compileErr.message };
  const result = await runSkillManifestOnServer(skill, input.query ?? "", input.sessionId ?? "gate-inline", {
    productWorkbench: input.productWorkbench !== false,
    llmConfig: input.llmConfig,
  });
  return { ok: true, result };
}
