/** 产品模式：LLM 只做技能路由（不跑 RAG 工具环） */

import { allRunnableSkills, isCustomerSkill, type AgentSkill } from "./agentSkills";
import { isLlmConfigured, resolveLlmBaseUrl, type LlmConfig } from "./llmConfig";

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

  const baseUrl = resolveLlmBaseUrl(config.baseUrl);
  const headers: Record<string, string> = {};
  if (config.apiKey.trim()) headers.Authorization = `Bearer ${config.apiKey.trim()}`;
  const system = [
    "你是 OwnAgent 产品技能路由器。用户要用「办事技能」处理业务，不是闲聊或搜文档。",
    "只能从下面列表选一个 skill id；若明显不属于任何技能，回复 JSON：{\"skillId\":null}。",
    "只输出一行 JSON，不要 markdown。",
    "",
    skillCatalogBlock(skills),
  ].join("\n");

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    signal: opts?.signal,
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      max_tokens: 120,
      messages: [
        { role: "system", content: system },
        { role: "user", content: query.trim() },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
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
