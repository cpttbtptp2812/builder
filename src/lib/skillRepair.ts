/** 修复不完整 / 损坏的 SKILL.md — 补 frontmatter、name、triggers、steps */

import { buildSkillMarkdown } from "./skillFromDemo";
import { canFormEdit, setDescription, setName, setTriggers } from "./skillFormEdit";
import { parseSkillMarkdown } from "./skillMarkdown";

const KNOWLEDGE_STEP_LINES = [
  "tools:",
  "  - knowledge_search",
  "steps:",
  "  - id: search",
  "    label: knowledge_search · 分块召回",
  "    tool: knowledge_search",
  "    args:",
  '      query: "{{query}}"',
  "      topK: 5",
  "  - id: compose",
  "    label: 合成引用面板",
  "    tool: __compose_knowledge__",
  "    args:",
  "      hits: $searchResult",
  '      query: "{{query}}"',
];

function inferTriggers(label: string, body: string): string[] {
  const text = `${label} ${body}`;
  const out = new Set<string>();
  if (/收费|价格|多少钱|套餐/.test(text)) {
    out.add("收费");
    out.add("怎么收费");
    out.add("价格");
  }
  if (/知识|检索|搜索|文档|语料/.test(text)) {
    out.add("知识检索");
    out.add("检索");
    out.add("搜索");
  }
  for (const w of label.split(/[\s\-—–]+/).filter((x) => x.length >= 2)) out.add(w);
  return [...out].slice(0, 10);
}

function slugName(skillId: string, label: string): string {
  const fromId = skillId.trim();
  if (/^[a-z0-9-]+$/i.test(fromId)) return fromId;
  const ascii = label
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || "imported-skill";
}

function insertKnowledgeSteps(raw: string): string {
  if (!canFormEdit(raw)) return raw;
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return raw;
  const end = text.indexOf("\n---", 3);
  if (end < 0) return raw;
  const fm = text.slice(4, end).split("\n");
  const body = text.slice(end + 4).replace(/^[ \t]*\n/, "");

  const stripKeys = new Set(["tools", "steps"]);
  const kept: string[] = [];
  for (let i = 0; i < fm.length; ) {
    const line = fm[i]!;
    const key = line.split(":")[0]?.trim();
    if (key && stripKeys.has(key)) {
      i += 1;
      while (i < fm.length && (fm[i]!.trim() === "" || /^\s/.test(fm[i]!))) i += 1;
      continue;
    }
    kept.push(line);
    i += 1;
  }
  kept.push(...KNOWLEDGE_STEP_LINES);
  return `---\n${kept.join("\n")}\n---\n${body ? `\n${body}` : ""}`;
}

export function repairSkillMarkdown(
  raw: string,
  skillId: string,
): { raw: string; fixes: string[]; changed: boolean } {
  const fixes: string[] = [];
  let text = raw.trim() ? raw : "";
  const parsed = parseSkillMarkdown(text || " ");
  const label =
    parsed.description.split(/[—–\-]/)[0]?.trim() ||
    parsed.name ||
    skillId.replace(/-/g, " ");
  const name = slugName(skillId, label);

  if (!canFormEdit(text)) {
    fixes.push("补全 YAML frontmatter");
    text = buildSkillMarkdown({
      name,
      description: label,
      triggers: inferTriggers(label, parsed.body),
      tools: ["knowledge_search"],
      queries: [],
    });
    return { raw: text, fixes, changed: true };
  }

  let next = text;
  if (!parsed.name) {
    next = setName(next, name);
    fixes.push("补上 name");
  }
  if (!parsed.description.trim()) {
    next = setDescription(next, label);
    fixes.push("补上 description");
  }
  const reparsed = parseSkillMarkdown(next);
  if (reparsed.triggers.length === 0) {
    next = setTriggers(next, inferTriggers(label, reparsed.body));
    fixes.push("补上 triggers");
  }
  const reparsed2 = parseSkillMarkdown(next);
  if (reparsed2.steps.length === 0) {
    next = insertKnowledgeSteps(next);
    fixes.push("补上 knowledge_search 步骤");
  }

  return { raw: next, fixes, changed: next.trim() !== raw.trim() };
}

export function needsSkillRepair(raw: string): boolean {
  const p = parseSkillMarkdown(raw);
  return !p.ok || p.triggers.length === 0 || p.steps.length === 0 || !canFormEdit(raw);
}
