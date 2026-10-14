/**
 * 技能变异体：故意把 SKILL 改坏一点，看检查集能不能发现。
 * 数值变异只针对报销规则参数；结构变异（删步、换序、换工具）对所有办事技能都适用。
 */

import { parseSkillMarkdown } from "./skillMarkdown";
import { ledgerStepRules, patchLedgerArgs } from "./ledgerRuleModel";

export type MutantKind = "param" | "remove" | "swap" | "tool";

export type SkillMutant = {
  id: string;
  kind: MutantKind;
  label: string;
  raw: string;
};

export const MUTANT_KIND_LABEL: Record<MutantKind, string> = {
  param: "改参数",
  remove: "删一步",
  swap: "换顺序",
  tool: "换工具",
};

type StepBlock = { id: string; tool: string; lines: string[] };

function splitSteps(raw: string): { head: string[]; blocks: StepBlock[]; tail: string[] } | null {
  const lines = raw.split("\n");
  const stepsAt = lines.findIndex((l) => /^steps:\s*\r?$/.test(l));
  if (stepsAt < 0) return null;
  const head = lines.slice(0, stepsAt + 1);
  const blocks: StepBlock[] = [];
  let i = stepsAt + 1;
  let stepIndent = -1;
  while (i < lines.length) {
    const line = lines[i]!;
    const m = line.match(/^(\s*)-\s+id:\s*(\S+)/);
    if (!m) break;
    if (stepIndent < 0) stepIndent = m[1]!.length;
    if (m[1]!.length !== stepIndent) break;
    const block: StepBlock = { id: m[2]!.replace(/["'\r]/g, ""), tool: "", lines: [line] };
    i += 1;
    while (i < lines.length) {
      const next = lines[i]!;
      const indent = next.match(/^(\s*)/)![1]!.length;
      if (next.trim() && indent <= stepIndent) break;
      block.lines.push(next);
      i += 1;
    }
    block.tool = block.lines.map((l) => l.match(/^\s*tool:\s*(\S+)/)?.[1]).find(Boolean)?.replace(/\r$/, "") ?? "";
    blocks.push(block);
  }
  if (!blocks.length) return null;
  return { head, blocks, tail: lines.slice(i) };
}

function joinSteps(parts: { head: string[]; blocks: StepBlock[]; tail: string[] }): string {
  return [...parts.head, ...parts.blocks.flatMap((b) => b.lines), ...parts.tail].join("\n");
}

function yuan(v: number): string {
  return `${Number.isInteger(v) ? v : Number(v.toFixed(2))}`;
}

function paramMutants(raw: string): SkillMutant[] {
  const rules = ledgerStepRules(parseSkillMarkdown(raw).steps);
  const ref = rules.find((r) => r.tool === "__sheet_report__") ?? rules.find((r) => r.tool === "__sheet_escalation__");
  if (!ref) return [];
  const r = ref.recipe;
  const out: SkillMutant[] = [];
  const add = (id: string, label: string, patch: Parameters<typeof patchLedgerArgs>[1]) => {
    const mutated = patchLedgerArgs(raw, patch);
    if (mutated !== raw) out.push({ id, kind: "param", label, raw: mutated });
  };
  const tolTo = r.tolerance === 0 ? 1 : r.tolerance * 2;
  add("tol-up", `发票容差 ${yuan(r.tolerance)} → ${yuan(tolTo)} 元`, { tolerance: tolTo });
  add("missing-flip", `缺票策略 ${r.missing === "block" ? "拦截 → 放行" : "放行 → 拦截"}`, { missing: r.missing === "block" ? "pass" : "block" });
  add("tax-flip", `入账口径 ${r.tax === "exclude" ? "不含税 → 含税" : "含税 → 不含税"}`, { tax: r.tax === "exclude" ? "include" : "exclude" });
  const lines: [keyof typeof r.escalation, string][] = [
    ["leadAt", "负责人线"],
    ["directorAt", "总监线"],
    ["financeReviewAt", "财务复核线"],
  ];
  for (const [key, label] of lines) {
    const v = r.escalation[key];
    for (const [tag, f] of [["down", 0.9], ["up", 1.1]] as const) {
      const to = Math.round(v * f * 100) / 100;
      add(`${key}-${tag}`, `${label} ${yuan(v)} → ${yuan(to)} 元`, { [key]: to });
    }
  }
  const cap = r.maxSingleAmount;
  add("cap-down", `单行上限 ${yuan(cap)} → ${yuan(cap / 2)} 元`, { maxSingleAmount: cap / 2 });
  return out;
}

const NEUTRAL_TOOL: Record<string, string> = {
  __sheet_reconcile__: "__sheet_normalize__",
  __sheet_missing_guard__: "__sheet_normalize__",
  __sheet_escalation__: "__sheet_aggregate__",
  __sheet_report__: "__sheet_deliver_detail__",
};

function structuralMutants(raw: string): SkillMutant[] {
  const parts = splitSteps(raw);
  if (!parts) return [];
  const out: SkillMutant[] = [];
  const { blocks } = parts;
  const core = blocks.filter((b) => b.tool.startsWith("__") && b.tool !== "__llm_product_brief__");
  for (const b of core.slice(1)) {
    out.push({
      id: `remove-${b.id}`,
      kind: "remove",
      label: `删掉「${b.id}」步`,
      raw: joinSteps({ ...parts, blocks: blocks.filter((x) => x !== b) }),
    });
  }
  for (let k = 1; k + 1 < core.length; k += 1) {
    const a = core[k]!;
    const b = core[k + 1]!;
    const ia = blocks.indexOf(a);
    const ib = blocks.indexOf(b);
    const swapped = [...blocks];
    swapped[ia] = b;
    swapped[ib] = a;
    out.push({ id: `swap-${a.id}-${b.id}`, kind: "swap", label: `「${a.id}」与「${b.id}」换序`, raw: joinSteps({ ...parts, blocks: swapped }) });
  }
  for (const b of core) {
    const to = NEUTRAL_TOOL[b.tool];
    if (!to) continue;
    const lines = b.lines.map((l) => l.replace(/^(\s*tool:\s*)\S+?(\r?)$/, `$1${to}$2`));
    out.push({
      id: `tool-${b.id}`,
      kind: "tool",
      label: `「${b.id}」改用 ${to}`,
      raw: joinSteps({ ...parts, blocks: blocks.map((x) => (x === b ? { ...b, lines } : x)) }),
    });
  }
  return out;
}

export function generateSkillMutants(raw: string): SkillMutant[] {
  return [...paramMutants(raw), ...structuralMutants(raw)];
}
