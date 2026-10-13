/** 产品模式：LLM 只做技能路由（不跑 RAG 工具环） */

import { allRunnableSkills, isCustomerSkill, type AgentSkill } from "./agentSkills";
import { isLlmConfigured, type LlmConfig } from "./llmConfig";
import { callByokLlm } from "./byokLlm";

function routableSkills(catalog?: AgentSkill[]): AgentSkill[] {
  const base = catalog?.length ? catalog : allRunnableSkills();
  return base.filter((s) => s.runnable && s.steps.length > 0 && isCustomerSkill(s.id));
}

function skillCatalogBlock(skills: AgentSkill[]): string {
  return skills
    .map((s) => {
      const triggers = s.triggers.slice(0, 6).join("、") || "—";
      return `- ${s.id} · ${s.name} · 说法：${triggers}`;
    })
    .join("\n");
}

/** 模型从办事技能表里选一个 id；选不出返回 null */
export async function llmPickSkillId(
  query: string,
  config: LlmConfig,
  opts?: { catalog?: AgentSkill[]; signal?: AbortSignal },
): Promise<string | null> {
  if (!isLlmConfigured(config)) return null;
  const skills = routableSkills(opts?.catalog);
  if (!skills.length) return null;

  const system = [
    "你是 OwnAgent 产品技能路由器。用户要用「办事技能」处理业务，不是闲聊或搜文档。",
    "只能从下面列表选一个 skill id；若明显不属于任何技能，回复 JSON：{\"skillId\":null}。",
    "只输出一行 JSON，不要 markdown。",
    "",
    skillCatalogBlock(skills),
  ].join("\n");

  if (opts?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const raw = await callByokLlm(
    config,
    [
      { role: "system", content: system },
      { role: "user", content: query.trim() },
    ],
    { temperature: 0, maxTokens: 120 },
  );
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as { skillId?: string | null };
    const id = parsed.skillId?.trim();
    if (!id) return null;
    return skills.some((s) => s.id === id) ? id : null;
  } catch {
    return null;
  }
}
