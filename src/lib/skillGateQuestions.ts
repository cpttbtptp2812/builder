/** 发版检查 / 考试题 / 回归评测 — 同一套「客户必问句」 */

import type { AgentSkill } from "./agentSkills";
import { SKILL_TRACE_CASES } from "./provingGround";
import { listAllCasesForSkill } from "./skillTraceCaseStore";
import { weekQueriesForSkill } from "./skillSentence";
import type { EvalCase } from "./evalops/types";
import { dedupeCases } from "./evalops/dataset";

export type GateQuestionKind = "必问" | "这周问过" | "触发样例";

export type GateQuestionRow = {
  query: string;
  kind: GateQuestionKind;
  caseId?: string;
};

export function listGateQuestionRows(skillId: string): GateQuestionRow[] {
  const week = new Set(weekQueriesForSkill(skillId));
  const rows: GateQuestionRow[] = [];
  const seen = new Set<string>();
  const push = (query: string, kind: GateQuestionKind, caseId?: string) => {
    const q = query.trim();
    if (!q || seen.has(q)) return;
    seen.add(q);
    rows.push({ query: q, kind, caseId });
  };
  for (const item of listAllCasesForSkill(skillId, SKILL_TRACE_CASES)) {
    push(item.query, week.has(item.query) ? "这周问过" : "必问", item.id);
  }
  for (const q of week) push(q, "这周问过");
  return rows;
}

/** 发版全量检查时跑的问句（与 CheckQuestions 列表一致，另加少量触发样例） */
export function listGateQueriesForCheck(skillId: string, skill: AgentSkill, max = 16): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (q: string) => {
    const t = q.trim();
    if (!t || seen.has(t)) return;
    seen.add(t);
    out.push(t);
  };
  for (const row of listGateQuestionRows(skillId)) push(row.query);
  for (const t of skill.triggers.slice(0, 4)) {
    if (t.length >= 2) push(`用户说：${t}，请处理`);
  }
  return out.slice(0, max);
}

export function gateQuestionsToEvalCases(skillId: string): EvalCase[] {
  return listAllCasesForSkill(skillId, SKILL_TRACE_CASES).map((c) => ({
    id: c.id,
    question: c.query,
    tags: [skillId, "skill-gate"],
    origin: "manual" as const,
  }));
}

/** 评测集：linkedSkillId 时与「考试题」同源，cases 仅作追加题 */
export function resolveEvalSuiteCases(suite: { linkedSkillId?: string; cases: EvalCase[] }): EvalCase[] {
  const gate = suite.linkedSkillId ? gateQuestionsToEvalCases(suite.linkedSkillId) : [];
  return dedupeCases([...gate, ...suite.cases]);
}
