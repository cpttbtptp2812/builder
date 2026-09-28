/** 作者自定义 Skill trace case — localStorage，与内置 SKILL_TRACE_CASES 合并 */

import type { SkillTraceCase, TraceExpectation } from "./provingGround";
import type { OutcomeGrader } from "./scmOutcome";

const KEY = "ownagent:skill-trace-cases";

export type CustomSkillTraceCase = SkillTraceCase & {
  custom: true;
  grader?: OutcomeGrader;
  note?: string;
};

type Store = Record<string, CustomSkillTraceCase[]>;

function readStore(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  localStorage.setItem(KEY, JSON.stringify(store));
}

export function listCustomCases(skillId: string): CustomSkillTraceCase[] {
  return readStore()[skillId] ?? [];
}

export function listAllCasesForSkill(skillId: string, builtin: SkillTraceCase[]): SkillTraceCase[] {
  const custom = listCustomCases(skillId);
  const ids = new Set(custom.map((c) => c.id));
  return [...custom, ...builtin.filter((c) => c.skillId === skillId && !ids.has(c.id))];
}

export function saveCustomCase(caseRow: Omit<CustomSkillTraceCase, "custom">): CustomSkillTraceCase {
  const store = readStore();
  const row: CustomSkillTraceCase = { ...caseRow, custom: true };
  const list = store[row.skillId] ?? [];
  const i = list.findIndex((c) => c.id === row.id);
  if (i >= 0) list[i] = row;
  else list.push(row);
  store[row.skillId] = list;
  writeStore(store);
  return row;
}

export function deleteCustomCase(skillId: string, caseId: string) {
  const store = readStore();
  store[skillId] = (store[skillId] ?? []).filter((c) => c.id !== caseId);
  writeStore(store);
}

export function caseFromSkillSteps(
  skillId: string,
  query: string,
  steps: { id: string; tool: string }[],
  opts?: { grader?: OutcomeGrader; probeUrl?: string },
): CustomSkillTraceCase {
  const expectSteps: TraceExpectation[] = steps.map((s) => ({ stepId: s.id, tool: s.tool }));
  return {
    id: `custom-${skillId}-${Date.now().toString(36)}`,
    skillId,
    query,
    probeUrl: opts?.probeUrl,
    custom: true,
    grader: opts?.grader ?? { kind: "skeleton" },
    expect: { steps: expectSteps },
  };
}
