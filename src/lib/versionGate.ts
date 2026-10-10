/** 切换前对照：同一句话在现在和候选版上的去向、说法、知识缺口。不改线上。 */

import { faqAnswerMarkdown, matchFaq } from "../data/productFaq";
import type { AgentSkill } from "./agentSkills";
import { faqHeadKey, skillsForVersion } from "./catalogSets";
import { matchKnowledgeSection } from "./ownKnowledge";
import { listQueryLog } from "./skillQueryLog";
import { executeContract, contractPolicyFromSteps } from "./contractEngine";
import { executeData, dataRecipeFromSteps } from "./dataEngine";
import { executeFlow, flowPolicyFromSteps } from "./flowEngine";
import { executeImage, imagePolicyFromSteps } from "./imageEngine";
import { executeSheet, sheetRecipeFromQuery, sheetRecipeFromSteps, type WorkGrid } from "./sheetEngine";
import { paperForSkill, type WorkPaper } from "./workPaper";
import { routeKey, routeQuery, skillLabel, type RouteDecision } from "./skillRouter";

export type GateBoard = { name: string; score: number };

export type GateSide = {
  who: string;
  text: string;
  gap: boolean;
  /** 路由去向，用来判断是不是改道 */
  key: string;
  score: number;
  margin: number;
  rule: string;
  hits: string[];
  board: GateBoard[];
  steps: string;
  grid: WorkGrid | null;
  paper: WorkPaper | null;
};

export type GateRow = {
  q: string;
  changed: boolean;
  tags: string[];
  live: GateSide;
  next: GateSide;
};

export type VersionGateReport = {
  rows: GateRow[];
  changed: number;
  same: number;
  gapMoves: number;
  routeFlips: number;
  stepDiffs: number;
  tightened: number;
  added: string[];
  removed: string[];
};

const DEEP = [
  "按部门汇总报销表，标出和发票对不上的",
  "测算这笔授信额度",
  "审查这份借款合同",
  "市场部9600报销单现在走到哪",
  "识别这份借款凭证影像",
];
const FIXED: string[] = [];
const QUESTION_KEY = "ownagent:gate-questions";
const MAX_QUESTIONS = 12;

export function normalizeGateQuestions(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const text = item.trim().replace(/\s+/g, " ");
    if (!text || text.length > 80 || text.startsWith("/") || seen.has(text)) continue;
    seen.add(text);
    out.push(text);
    if (out.length >= MAX_QUESTIONS) break;
  }
  return out;
}

/** 客户改过的测试问句。没改过就用最近对话加固定题。 */
export function readGateQuestions(): string[] {
  try {
    const raw = localStorage.getItem(QUESTION_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : null;
    if (Array.isArray(list)) {
      const cleaned = normalizeGateQuestions([...DEEP, ...list]);
      if (cleaned.length) return cleaned;
    }
  } catch {
    /* 坏数据就回到默认问句 */
  }
  return gateQuestions();
}

export function writeGateQuestions(list: string[]) {
  const cleaned = normalizeGateQuestions(list);
  if (!cleaned.length) return;
  localStorage.setItem(QUESTION_KEY, JSON.stringify(cleaned));
}

function spokenLine(raw: string | undefined): string {
  if (!raw) return "";
  return raw.match(/^\s*text:\s*"([^"]+)"/m)?.[1]?.trim() ?? "";
}

function firstLine(text: string): string {
  const line = text.replace(/\*\*/g, "").split("\n").map((part) => part.trim()).find(Boolean) ?? "";
  return line.length > 76 ? `${line.slice(0, 76)}…` : line;
}

function clarifyText(query: string, skills: AgentSkill[]): { who: string; text: string } | null {
  const key = faqHeadKey(query, skills);
  if (!key) return null;
  const parts = key.split("|").filter(Boolean);
  if (parts.length < 2 || !parts.includes("@answer")) return null;
  const labels = parts
    .filter((part) => part !== "@answer")
    .map((part) => part.slice(part.indexOf(":") + 1))
    .filter(Boolean);
  return { who: "要先确认", text: labels.length ? `${labels.join("、")}，或查现成答案` : "有两种理解，先确认再答" };
}

function traceOf(decision: RouteDecision): Pick<GateSide, "key" | "score" | "margin" | "rule" | "hits" | "board" | "steps"> {
  const skill = decision.skill;
  return {
    key: routeKey(decision),
    score: decision.score,
    margin: decision.margin,
    rule: decision.rule,
    hits: decision.hits.slice(0, 4),
    board: decision.ranked
      .filter((row) => row.score > 0)
      .slice(0, 3)
      .map((row) => ({ name: skillLabel(row.skill), score: row.score })),
    steps: skill?.steps.map((step) => step.label || step.id).join(" → ") ?? "",
  };
}

function computedBundle(query: string, skill: AgentSkill): { text: string; grid: WorkGrid | null; paper: WorkPaper | null } | null {
  const paper = paperForSkill(skill, query);
  const sheet = sheetRecipeFromSteps(skill.steps);
  if (sheet) {
    const ran = executeSheet(query, sheetRecipeFromQuery(query, sheet));
    return { text: ran.summary, grid: null, paper };
  }
  const data = dataRecipeFromSteps(skill.steps);
  if (data) {
    const ran = executeData(data);
    return { text: ran.summary, grid: null, paper };
  }
  const contract = contractPolicyFromSteps(skill.steps);
  if (contract) {
    const ran = executeContract(contract);
    return { text: ran.summary, grid: null, paper };
  }
  const flow = flowPolicyFromSteps(skill.steps);
  if (flow) {
    const ran = executeFlow(query, flow);
    return { text: ran.summary, grid: null, paper };
  }
  const image = imagePolicyFromSteps(skill.steps);
  if (image) {
    const ran = executeImage(image);
    return { text: ran.summary, grid: null, paper };
  }
  return null;
}

/** 这一版如果现在被问到这句话，客户会看到什么，以及路由为什么这么判。 */
export function previewTurn(query: string, skills: AgentSkill[]): GateSide {
  const decision = routeQuery(query, skills);
  const trace = traceOf(decision);
  const split = clarifyText(query, skills);
  if (split) return { ...split, gap: false, grid: null, paper: null, ...trace };
  if (decision.kind !== "skill" || !decision.skill) {
    return { who: "没有技能接", text: "这句话没有技能接", gap: true, grid: null, paper: null, ...trace };
  }
  const said = spokenLine(decision.skill.manifest);
  if (said) return { who: decision.label, text: said, gap: true, grid: null, paper: null, ...trace };
  const computed = computedBundle(query, decision.skill);
  if (computed) return { who: decision.label, text: computed.text, gap: false, grid: computed.grid, paper: computed.paper, ...trace };
  if (decision.skillId === "product-faq") {
    const kb = matchKnowledgeSection(query);
    if (kb) return { who: "查现成答案", text: firstLine(kb.section.a), gap: false, grid: null, paper: null, ...trace };
    const faq = matchFaq(query);
    if (faq && faq.score >= 0.8) return { who: "查现成答案", text: firstLine(faqAnswerMarkdown(faq.entry)), gap: false, grid: null, paper: null, ...trace };
    return { who: "查现成答案", text: "资料里没有这段", gap: true, grid: null, paper: null, ...trace };
  }
  return {
    who: decision.label,
    text: trace.steps || "按这个技能的步骤回答",
    gap: false,
    grid: null,
    paper: null,
    ...trace,
  };
}

function sameTurn(left: GateSide, right: GateSide): boolean {
  return left.who === right.who && left.text === right.text && left.gap === right.gap && left.key === right.key && left.steps === right.steps && left.rule === right.rule;
}

function rowTags(left: GateSide, right: GateSide): string[] {
  const tags: string[] = [];
  if (left.key !== right.key) tags.push("改道");
  if (left.text !== right.text || left.who !== right.who) tags.push("说法");
  if (left.steps !== right.steps) tags.push("步骤");
  if (left.gap !== right.gap) tags.push("缺口");
  if (left.key === right.key && right.margin + 1 < left.margin) tags.push("分差变小");
  return tags;
}

export function gateQuestions(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string) => {
    const text = raw.trim().replace(/\s+/g, " ");
    if (!text || text.length > 42 || text.startsWith("/") || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };
  for (const text of DEEP) push(text);
  for (const row of listQueryLog()) push(row.q);
  for (const text of FIXED) push(text);
  return out.slice(0, 8);
}

export function buildVersionGate(versionId: string, questions = readGateQuestions()): VersionGateReport {
  const live = skillsForVersion(null);
  const next = skillsForVersion(versionId);
  const rows = normalizeGateQuestions(questions).map((q) => {
    const left = previewTurn(q, live);
    const right = previewTurn(q, next);
    return { q, changed: !sameTurn(left, right), tags: rowTags(left, right), live: left, next: right };
  });
  rows.sort((a, b) => Number(b.changed) - Number(a.changed) || b.tags.length - a.tags.length);
  const liveNames = new Map(live.map((skill) => [skill.id, skillLabel(skill)]));
  const nextNames = new Map(next.map((skill) => [skill.id, skillLabel(skill)]));
  return {
    rows,
    changed: rows.filter((row) => row.changed).length,
    same: rows.filter((row) => !row.changed).length,
    gapMoves: rows.filter((row) => row.live.gap !== row.next.gap).length,
    routeFlips: rows.filter((row) => row.live.key !== row.next.key).length,
    stepDiffs: rows.filter((row) => row.live.steps !== row.next.steps).length,
    tightened: rows.filter((row) => row.tags.includes("分差变小")).length,
    added: [...nextNames].filter(([id]) => !liveNames.has(id)).map(([, label]) => label),
    removed: [...liveNames].filter(([id]) => !nextNames.has(id)).map(([, label]) => label),
  };
}
