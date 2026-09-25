/** 一句话改技能 — 自然语言 → 结构化修改操作（规则解析，配置了大模型时优先用模型） */

import { isLlmConfigured, loadLlmConfig, resolveLlmBaseUrl } from "./llmConfig";
import { parseSkillMarkdown, type ParsedSkillDoc } from "./skillMarkdown";
import { moveStepTo, removeStep, renameStep, setDescription, setTriggers } from "./skillFormEdit";

export type NlEditOp =
  | { op: "add_triggers"; values: string[] }
  | { op: "remove_triggers"; values: string[] }
  | { op: "set_description"; value: string }
  | { op: "rename_step"; index: number; label: string }
  | { op: "remove_step"; index: number }
  | { op: "move_step"; from: number; to: number };

export type NlEditPlan = {
  ops: NlEditOp[];
  /** 每个操作的大白话 */
  lines: string[];
  /** 没看懂的片段 */
  unknown: string[];
  result: string;
  engine: "rules" | "llm";
};

const CN_NUM: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

export function stepName(label: string): string {
  const [head, ...rest] = label.split(" · ");
  const tail = rest.join(" · ").trim();
  return /^[a-z_]+$/i.test(head!.trim()) && tail ? tail : head!.trim();
}

function cleanValue(s: string): string {
  return s.replace(/^[\s「『“"'‘]+|[\s」』”"'’。．.!！]+$/g, "").trim();
}

function splitValues(s: string): string[] {
  return s
    .split(/[,，、;；\n]|\s和\s|和|及|以及/)
    .map(cleanValue)
    .filter((v) => v.length >= 1 && v.length <= 20);
}

function parseOrdinal(s: string, total: number): number | null {
  const t = s.replace(/\s/g, "");
  if (/^(最前|最前面|开头|最开始|第一个)$/.test(t)) return 0;
  if (/^(最后|最后面|末尾|最后一步|最后一个)$/.test(t)) return total - 1;
  const m = t.match(/^第?([0-9]+|[一二两三四五六七八九十])(步|个|项)?$/);
  if (!m) return null;
  const n = /\d/.test(m[1]!) ? Number(m[1]) : CN_NUM[m[1]!]!;
  return n >= 1 && n <= total ? n - 1 : null;
}

/** 按序号、步骤名、步骤 id 找步骤 */
function findStep(ref: string, doc: ParsedSkillDoc): number | null {
  const r = cleanValue(ref).replace(/(这一?步|步骤|那一?步)$/, "").replace(/^(步骤|把)/, "").trim();
  if (!r) return null;
  const ord = parseOrdinal(r, doc.steps.length);
  if (ord != null) return ord;
  const low = r.toLowerCase();
  const exact = doc.steps.findIndex((s) => s.id.toLowerCase() === low || stepName(s.label) === r);
  if (exact >= 0) return exact;
  const fuzzy = doc.steps.findIndex(
    (s) => s.label.toLowerCase().includes(low) || (low.length >= 2 && low.includes(stepName(s.label).toLowerCase())),
  );
  return fuzzy >= 0 ? fuzzy : null;
}

function resolvePosition(ref: string, doc: ParsedSkillDoc, from: number): number | null {
  const t = cleanValue(ref).replace(/(去|来|上|里)$/, "");
  const ord = parseOrdinal(t, doc.steps.length);
  if (ord != null) return ord;
  const before = t.match(/^(.+?)(之前|前面|前边|前)$/);
  if (before) {
    const i = findStep(before[1]!, doc);
    if (i == null) return null;
    return from < i ? i - 1 : i;
  }
  const after = t.match(/^(.+?)(之后|后面|后边|后)$/);
  if (after) {
    const i = findStep(after[1]!, doc);
    if (i == null) return null;
    return from < i ? i : i + 1;
  }
  return null;
}

export function applyNlOp(raw: string, op: NlEditOp): string {
  const doc = parseSkillMarkdown(raw);
  switch (op.op) {
    case "add_triggers": {
      const next = [...doc.triggers];
      for (const v of op.values) if (!next.includes(v)) next.push(v);
      return setTriggers(raw, next);
    }
    case "remove_triggers":
      return setTriggers(raw, doc.triggers.filter((t) => !op.values.includes(t)));
    case "set_description":
      return setDescription(raw, op.value);
    case "rename_step":
      return renameStep(raw, op.index, op.label);
    case "remove_step":
      return removeStep(raw, op.index);
    case "move_step":
      return moveStepTo(raw, op.from, op.to);
  }
}

export function describeOp(op: NlEditOp, doc: ParsedSkillDoc): string {
  const name = (i: number) => `第 ${i + 1} 步「${stepName(doc.steps[i]?.label ?? "?")}」`;
  switch (op.op) {
    case "add_triggers":
      return `添加说法：${op.values.join("、")}`;
    case "remove_triggers":
      return `删除说法：${op.values.join("、")}`;
    case "set_description":
      return `说明改为：「${op.value}」`;
    case "rename_step":
      return `${name(op.index)} 改名为「${op.label}」`;
    case "remove_step":
      return `删除${name(op.index)}`;
    case "move_step":
      return `${name(op.from)} 移到第 ${op.to + 1} 位`;
  }
}

/** 单个子句 → 操作；doc 为执行到此前的最新状态 */
function parseClause(clause: string, doc: ParsedSkillDoc): NlEditOp | null {
  const c = clause.trim().replace(/^(然后|再|并且|并|还有|另外|同时|顺便)/, "").trim();
  if (!c) return null;
  let m: RegExpMatchArray | null;

  if ((m = c.match(/^(?:把)?(?:技能)?(?:说明|描述|简介|介绍)(?:改成|改为|换成|写成|改)[:：]?\s*(.+)$/))) {
    const value = cleanValue(m[1]!);
    return value ? { op: "set_description", value } : null;
  }

  if (
    (m = c.match(/^(?:再)?(?:加上|添加|增加|新增|补充|加)(?:几个|一些|个)?(?:说法|触发词|关键词|问法|叫法)[:：]?\s*(.+)$/)) ||
    (m = c.match(/^(?:让)?用户(?:说|问|提到)(.+?)(?:的时候|时)?也(?:能|要|会)?(?:触发|用到|用上|走这个|找到)/))
  ) {
    const values = splitValues(m[1]!).filter((v) => !doc.triggers.includes(v));
    return values.length ? { op: "add_triggers", values } : null;
  }

  if ((m = c.match(/^(?:删掉|删除|去掉|移除|不要|拿掉)(?:说法|触发词|关键词|问法)[:：]?\s*(.+)$/))) {
    const values = splitValues(m[1]!).filter((v) => doc.triggers.includes(v));
    return values.length ? { op: "remove_triggers", values } : null;
  }

  if ((m = c.match(/^(?:把)?(.+?)(?:挪|移|放|调|排|提)(?:到|在)(.+)$/))) {
    const from = findStep(m[1]!, doc);
    if (from != null) {
      const to = resolvePosition(m[2]!, doc, from);
      if (to != null && to !== from) return { op: "move_step", from, to };
    }
  }

  if ((m = c.match(/^(?:把)?(.+?)(?:改名为|改名成|重命名为|改叫|改成|改为|叫做|换成)(.+)$/))) {
    const i = findStep(m[1]!, doc);
    const label = cleanValue(m[2]!);
    if (i != null && label) return { op: "rename_step", index: i, label };
  }

  if ((m = c.match(/^(?:删掉|删除|去掉|移除|不要|拿掉)(.+)$/))) {
    const target = m[1]!;
    const values = splitValues(target).filter((v) => doc.triggers.includes(v));
    if (values.length) return { op: "remove_triggers", values };
    const i = findStep(target, doc);
    if (i != null && doc.steps.length > 1) return { op: "remove_step", index: i };
  }

  return null;
}

export function splitClauses(text: string): string[] {
  return text
    .split(/[;；。\n]|[，,]\s*(?=然后|再|并且|并|还有|另外|同时|把|删|去掉|移除|不要|加|添加|增加|新增|说明|描述|第|最后一步)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function finalize(raw: string, ops: NlEditOp[], unknown: string[], engine: NlEditPlan["engine"]): NlEditPlan {
  let cur = raw;
  const lines: string[] = [];
  const kept: NlEditOp[] = [];
  for (const op of ops) {
    const doc = parseSkillMarkdown(cur);
    const next = applyNlOp(cur, op);
    if (next === cur) continue;
    lines.push(describeOp(op, doc));
    kept.push(op);
    cur = next;
  }
  return { ops: kept, lines, unknown, result: cur, engine };
}

export function planNlEditByRules(raw: string, text: string): NlEditPlan {
  let cur = raw;
  const ops: NlEditOp[] = [];
  const unknown: string[] = [];
  for (const clause of splitClauses(text)) {
    const doc = parseSkillMarkdown(cur);
    const op = parseClause(clause, doc);
    if (!op) {
      unknown.push(clause);
      continue;
    }
    ops.push(op);
    cur = applyNlOp(cur, op);
  }
  return finalize(raw, ops, unknown, "rules");
}

function validateOps(input: unknown, doc: ParsedSkillDoc): NlEditOp[] {
  if (!Array.isArray(input)) return [];
  const n = doc.steps.length;
  const idx = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : null);
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map(cleanValue).filter(Boolean) : []);
  const out: NlEditOp[] = [];
  for (const o of input as Record<string, unknown>[]) {
    if (!o || typeof o !== "object") continue;
    if (o.op === "add_triggers" && strs(o.values).length) out.push({ op: "add_triggers", values: strs(o.values) });
    else if (o.op === "remove_triggers" && strs(o.values).length) out.push({ op: "remove_triggers", values: strs(o.values) });
    else if (o.op === "set_description" && typeof o.value === "string" && o.value.trim()) out.push({ op: "set_description", value: o.value.trim() });
    else if (o.op === "rename_step" && idx(o.index) != null && typeof o.label === "string" && o.label.trim())
      out.push({ op: "rename_step", index: idx(o.index)!, label: o.label.trim() });
    else if (o.op === "remove_step" && idx(o.index) != null) out.push({ op: "remove_step", index: idx(o.index)! });
    else if (o.op === "move_step" && idx(o.from) != null && idx(o.to) != null) out.push({ op: "move_step", from: idx(o.from)!, to: idx(o.to)! });
  }
  return out;
}

async function planByLlm(raw: string, text: string, signal?: AbortSignal): Promise<NlEditPlan | null> {
  const cfg = loadLlmConfig();
  if (!isLlmConfigured(cfg)) return null;
  const doc = parseSkillMarkdown(raw);
  const state = {
    description: doc.description,
    triggers: doc.triggers,
    steps: doc.steps.map((s, i) => ({ index: i, id: s.id, label: s.label, tool: s.tool })),
  };
  const system = [
    "你把运维人员对一个 AI 技能的修改要求，翻译成 JSON 操作列表。只输出 JSON：{\"ops\":[...],\"unknown\":[未理解的原话片段]}。",
    "可用操作（index 从 0 开始，按顺序执行，每步基于上一步执行后的状态）：",
    '{"op":"add_triggers","values":[string]} {"op":"remove_triggers","values":[已有说法]} {"op":"set_description","value":string}',
    '{"op":"rename_step","index":n,"label":string} {"op":"remove_step","index":n} {"op":"move_step","from":n,"to":n}',
    "不能新增步骤、不能改工具；做不到的放进 unknown。",
  ].join("\n");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (cfg.apiKey.trim()) headers.Authorization = `Bearer ${cfg.apiKey.trim()}`;
  const res = await fetch(`${resolveLlmBaseUrl(cfg.baseUrl)}/chat/completions`, {
    method: "POST",
    headers,
    signal,
    body: JSON.stringify({
      model: cfg.model,
      temperature: 0,
      stream: false,
      messages: [
        { role: "system", content: system },
        { role: "user", content: `当前技能：${JSON.stringify(state)}\n修改要求：${text}` },
      ],
    }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content ?? "";
  const json = content.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  const parsed = JSON.parse(json) as { ops?: unknown; unknown?: unknown };
  const ops = validateOps(parsed.ops, doc);
  if (!ops.length) return null;
  const unknown = Array.isArray(parsed.unknown) ? parsed.unknown.filter((x): x is string => typeof x === "string") : [];
  return finalize(raw, ops, unknown, "llm");
}

/** 有大模型就先用模型，失败或没配置时回退规则 */
export async function planNlEdit(raw: string, text: string, signal?: AbortSignal): Promise<NlEditPlan> {
  try {
    const viaLlm = await planByLlm(raw, text, signal);
    if (viaLlm) return viaLlm;
  } catch {
    /* 回退规则 */
  }
  return planNlEditByRules(raw, text);
}

export const NL_EDIT_EXAMPLES = [
  "加上说法：预发、staging、冒烟测试",
  "把资料库对照挪到最前面",
  "删掉说法 smoke；第 2 步改名为 检查页面结构",
  "说明改成：上线前自动检查网址能否正常打开",
];
