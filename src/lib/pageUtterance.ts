/** 把用户的一句话认成「让当前页面做一件事」。认不出就交给原来的对话。 */

import { allRunnableSkills, type AgentSkill } from "./agentSkills";
import type { PageToolResult } from "./pageTools";
import { newestDraftForSkill } from "./skillCompareStore";

export type PageUtterance =
  | { kind: "say"; text: string }
  | {
      kind: "call";
      name: string;
      args: Record<string, unknown>;
      told: (result: PageToolResult) => string;
    };

const LINES: { word: string; view: string; label: string }[] = [
  { word: "知识广场", view: "feed", label: "知识广场" },
  { word: "回答规则", view: "guard", label: "规则" },
  { word: "资料库", view: "rag", label: "资料" },
  { word: "提示词", view: "prompts", label: "提示词" },
  { word: "对话", view: "chat", label: "对话" },
  { word: "技能", view: "compare", label: "技能" },
  { word: "资料", view: "rag", label: "资料" },
  { word: "广场", view: "feed", label: "知识广场" },
  { word: "规则", view: "guard", label: "规则" },
  { word: "接入", view: "connect", label: "接入" },
];

function titleOf(skill: AgentSkill): string {
  const head = skill.description.split(/[—–-]/)[0]?.trim();
  if (head && head.length >= 2 && head.length <= 24) return head;
  return skill.name;
}

function findSkill(hint: string): AgentSkill | null {
  const h = hint.replace(/技能|草稿/g, "").trim();
  if (!h) return null;
  const skills = allRunnableSkills();
  const hit =
    skills.find((s) => titleOf(s) === h || s.name === h || s.id === h) ??
    skills.find((s) => titleOf(s).includes(h) || h.includes(titleOf(s)));
  return hit ?? null;
}

function hitsOf(content: unknown): { title: string }[] {
  if (!content || typeof content !== "object" || !("hits" in content)) return [];
  const hits = (content as { hits?: { title?: string }[] }).hits;
  return Array.isArray(hits) ? hits.filter((h) => h?.title) as { title: string }[] : [];
}

export function interpretPageUtterance(text: string): PageUtterance | null {
  const q = text.trim();

  const publish = q.match(/^(?:请|帮我)?发布\s*(.+?)\s*的?草稿\s*$/);
  if (publish?.[1]) {
    const skill = findSkill(publish[1]);
    if (!skill) return { kind: "say", text: `这一页上没有叫「${publish[1].trim()}」的技能。` };
    const label = titleOf(skill);
    if (!newestDraftForSkill(skill.id)) {
      return { kind: "say", text: `「${label}」没有草稿。先改一版，再让这一页发布。` };
    }
    return {
      kind: "call",
      name: "publish_draft",
      args: { skillId: skill.id, skillLabel: label },
      told: (result) =>
        result.denied
          ? "你拒绝了。草稿还在，没有发布。"
          : result.isError
            ? "没有发布。这个技能现在没有可发的草稿。"
            : `已允许发布「${label}」。页面打开了发版检查，过不了不会上线。`,
    };
  }

  const save = q.match(
    /^把[「『"'](.+?)[」』"']\s*(?:记成|收进|加进|写成)\s*(.+?)\s*(?:的)?(?:必问|测试问题)\s*$/,
  );
  if (save?.[1] && save[2]) {
    const skill = findSkill(save[2]);
    if (!skill) return { kind: "say", text: `这一页上没有叫「${save[2].trim()}」的技能，这句话没记下。` };
    const label = titleOf(skill);
    const query = save[1].trim();
    return {
      kind: "call",
      name: "save_question",
      args: { skillId: skill.id, query, skillLabel: label },
      told: (result) =>
        result.denied
          ? "你拒绝了。这句没有写进必问。"
          : `已把「${query}」记成「${label}」的必问。发版时会再问这句。`,
    };
  }

  const open = q.match(/^(?:请|帮我)?(?:打开|去|切到|进入)(?:一下)?\s*(.+?)\s*(?:页|栏)?$/);
  if (open?.[1]) {
    const line = LINES.find((item) => item.word === open[1].trim());
    if (line) {
      return {
        kind: "call",
        name: "open_line",
        args: { view: line.view },
        told: (result) => (result.isError ? "这一页打不开那个栏目。" : `已打开${line.label}。`),
      };
    }
  }

  const search =
    q.match(/^(?:请|帮我)?(?:在)?资料库?(?:里|中)?(?:帮我)?(?:搜|查|找)(?:一下|下)?\s*[：:]?\s*(.+)$/) ??
    q.match(/^(?:请|帮我)?(?:搜|查|找)(?:一下|下)?资料库?\s*[：:]?\s*(.+)$/);
  const searchText = search?.[1]?.trim();
  if (searchText && !/^(资料|资料库)$/.test(searchText)) {
    return {
      kind: "call",
      name: "search_library",
      args: { query: searchText },
      told: (result) => {
        if (result.isError) return "资料库这次没查成。";
        const hits = hitsOf(result.content);
        const titles = hits.slice(0, 3).map((h) => h.title).join("、");
        return titles
          ? `已打开资料，找到 ${hits.length} 条：${titles}。`
          : `已打开资料。资料库里没有和「${searchText}」对得上的条目。`;
      },
    };
  }

  return null;
}
