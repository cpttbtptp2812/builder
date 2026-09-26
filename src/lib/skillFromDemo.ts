/** 演示一遍 → 生成技能：从对话里用户的问法和实际调用的工具，拼出一份 SKILL.md */

import type { OwnChatMessage } from "./ownagentSessions";
import { allRunnableSkills } from "./agentSkills";
import { phraseCandidates } from "./skillTriggerMiner";
import { routeQuery } from "./skillRouter";
import { skillDisplayTitle } from "../components/ownagent/skillVerUi";

type StepTpl = { id: string; label: string; tool: string; args: [string, string][] };

/** 只收录只读、参数能从问句推出来的工具；会改东西的（工单、工作流）不自动生成 */
const STEP_TEMPLATES: Record<string, StepTpl> = {
  http_probe: { id: "probe", label: "站点探活", tool: "http_probe", args: [["url", '"{{probeUrl}}"'], ["method", "GET"]] },
  browser_snapshot: { id: "snapshot", label: "页面快照", tool: "browser_snapshot", args: [["compact", "true"]] },
  knowledge_search: { id: "search", label: "资料检索", tool: "knowledge_search", args: [["query", '"{{query}}"'], ["topK", "5"]] },
  policy_search: { id: "policy", label: "制度检索", tool: "policy_search", args: [["query", '"{{query}}"'], ["topK", "4"]] },
};

export const DEMO_TOOL_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(STEP_TEMPLATES).map((t) => [t.tool, t.label]),
);

export type DemoDraft = {
  name: string;
  description: string;
  triggers: string[];
  tools: string[];
  queries: string[];
  /** 已被其他技能占用的说法 */
  clashes: { phrase: string; skill: string }[];
};

function usefulQuery(q: string): boolean {
  const t = q.trim();
  return t.length >= 2 && !t.startsWith("/");
}

export function demoFromMessages(messages: OwnChatMessage[]): { queries: string[]; tools: string[] } {
  const queries = messages
    .filter((m) => m.role === "user")
    .map((m) => m.rawQuery ?? m.content)
    .filter(usefulQuery)
    .map((q) => q.trim());
  const tools: string[] = [];
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    for (const t of m.tools ?? []) {
      if (STEP_TEMPLATES[t.name] && !tools.includes(t.name)) tools.push(t.name);
    }
  }
  return { queries, tools };
}

/** 这类问题现在是否已经有技能在处理 */
export function currentHandler(queries: string[]): string | null {
  const live = allRunnableSkills();
  for (const q of queries) {
    const d = routeQuery(q, live);
    if (d.kind === "skill" && d.skill) return skillDisplayTitle(d.skill);
  }
  return null;
}

const TIME_WORDS = /今晚|今天|明天|昨天|现在|刚才|马上|一会/;

export function suggestTriggers(queries: string[], limit = 6): string[] {
  const score = new Map<string, number>();
  for (const q of queries) {
    const seen = new Set(phraseCandidates(q.replace(/https?:\/\/\S+/g, " ")).filter((p) => !TIME_WORDS.test(p)));
    for (const p of seen) {
      const bonus = p.length >= 4 ? 1.5 : 1;
      score.set(p, (score.get(p) ?? 0) + bonus);
    }
  }
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([p]) => p);
  const out: string[] = [];
  for (const p of ranked) {
    if (out.some((x) => x.includes(p) || p.includes(x))) continue;
    out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

const TOOL_HINTS: [string, RegExp][] = [
  ["http_probe", /https?:\/\/|网址|网站|站点|环境|打不开|打得开|挂了|访问|可用|探活|上线|发版/],
  ["browser_snapshot", /页面|按钮|元素|结构|dom/i],
  ["policy_search", /制度|年假|病假|请假|报销|加班|调休|出差|考勤/],
];

/** 没有演示过程时，按问题内容推断该做哪些事；都不像就查资料库 */
export function inferTools(queries: string[]): string[] {
  const text = queries.join(" ");
  const hit = TOOL_HINTS.filter(([, re]) => re.test(text)).map(([t]) => t);
  return hit.length ? hit : ["knowledge_search"];
}

export function findClashes(triggers: string[]): DemoDraft["clashes"] {
  const out: DemoDraft["clashes"] = [];
  for (const s of allRunnableSkills()) {
    for (const t of triggers) {
      if (s.triggers.some((x) => x.toLowerCase() === t.toLowerCase())) out.push({ phrase: t, skill: skillDisplayTitle(s) });
    }
  }
  return out;
}

export function draftFromMessages(messages: OwnChatMessage[]): DemoDraft {
  const { queries, tools } = demoFromMessages(messages);
  const triggers = suggestTriggers(queries);
  const first = queries[0]?.replace(/https?:\/\/\S+/g, "").trim() ?? "";
  const name = (triggers.find((t) => t.length >= 3) ?? first.slice(0, 8)) || "我的技能";
  return {
    name,
    description: first ? `像这样的问题：${first.slice(0, 40)}` : "",
    triggers,
    tools: tools.length ? tools : inferTools(queries),
    queries,
    clashes: findClashes(triggers),
  };
}

function yamlStr(s: string): string {
  return JSON.stringify(s.replace(/\s+/g, " ").trim());
}

export function buildSkillMarkdown(d: Pick<DemoDraft, "name" | "description" | "triggers" | "tools" | "queries">): string {
  const steps = d.tools.map((t) => STEP_TEMPLATES[t]).filter((t): t is StepTpl => Boolean(t));
  const lines = [
    "---",
    `name: ${yamlStr(d.name)}`,
    `description: ${yamlStr(d.description || d.name)}`,
    "triggers:",
    ...d.triggers.map((t) => `  - ${yamlStr(t)}`),
    "tools:",
    ...steps.map((s) => `  - ${s.tool}`),
    "steps:",
  ];
  for (const s of steps) {
    lines.push(`  - id: ${s.id}`, `    label: ${s.label}`, `    tool: ${s.tool}`, "    args:");
    for (const [k, v] of s.args) lines.push(`      ${k}: ${v}`);
  }
  lines.push(
    "  - id: summary",
    "    label: 汇总结果",
    "    tool: __compose_steps__",
    "    args:",
    '      query: "{{query}}"',
    ...steps.map((s) => `      ${s.id}: $${s.id}`),
    "---",
    "",
    `# ${d.name}`,
    "",
    "由对话演示自动生成。演示时的问法：",
    "",
    ...d.queries.slice(0, 8).map((q) => `- ${q}`),
    "",
  );
  return lines.join("\n");
}
