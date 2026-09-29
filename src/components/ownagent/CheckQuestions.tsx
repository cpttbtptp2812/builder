import { useState } from "react";
import { SKILL_TRACE_CASES } from "../../lib/provingGround";
import type { QueryCompareRow, SkillFullCompareReport } from "../../lib/skillCompareReport";
import { weekQueriesForSkill } from "../../lib/skillSentence";
import { listAllCasesForSkill } from "../../lib/skillTraceCaseStore";
import { SkillClauseRead, clauseChanged, useSkillClauses } from "./SkillClauseNote";

type Row = { query: string; kind: string };

function questionsFor(skillId: string, report: SkillFullCompareReport | null): Row[] {
  const week = new Set(weekQueriesForSkill(skillId));
  const rows: Row[] = [];
  const seen = new Set<string>();
  const push = (query: string, kind: string) => {
    const q = query.trim();
    if (!q || seen.has(q)) return;
    seen.add(q);
    rows.push({ query: q, kind });
  };
  for (const item of listAllCasesForSkill(skillId, SKILL_TRACE_CASES)) {
    push(item.query, week.has(item.query) ? "这周问过" : "必问");
  }
  for (const q of week) push(q, "这周问过");
  for (const q of report?.queryResults ?? []) {
    if (!seen.has(q.query)) push(q.query, "一起查的");
  }
  return rows;
}

function outcome(row: QueryCompareRow | undefined): { tone: string; text: string } {
  if (!row) return { tone: "wait", text: "还没查" };
  if (row.verdictLevel === "reject") return { tone: "bad", text: row.note || "这句过不了" };
  if (row.routeDrift) {
    return {
      tone: "bad",
      text: `原来交给${row.routeBaseline ?? "没人"}，现在交给${row.routeCandidate ?? "没人"}`,
    };
  }
  if (row.traceChanged) return { tone: "warn", text: row.traceSummary || "回答步骤变了" };
  if (row.verdictLevel === "warn") return { tone: "warn", text: row.note || "要看一眼" };
  return { tone: "ok", text: "过了" };
}

/** 发版检查的正文：要问的句子，以及每句过不过。 */
export function CheckQuestions({
  skillId,
  report,
  checking,
  canCheck,
  onCheck,
  onAsk,
}: {
  skillId: string;
  report: SkillFullCompareReport | null;
  checking: boolean;
  canCheck: boolean;
  onCheck?: () => void;
  onAsk?: (query: string) => void;
}) {
  const clauses = useSkillClauses(skillId);
  const changed = clauseChanged(clauses);
  const [open, setOpen] = useState<string | null>(null);
  const rows = questionsFor(skillId, report);
  const byQuery = new Map((report?.queryResults ?? []).map((q) => [q.query, q]));
  const bad = (report?.queryResults ?? []).filter(
    (q) => q.verdictLevel === "reject" || q.routeDrift,
  ).length;
  const lead = !report
    ? canCheck
      ? `发版前会问这 ${rows.length} 句。点检查，看每句过不过。`
      : `还没有改动。下面是发版时会问的 ${rows.length} 句。改一版之后，再查它们过不过。`
    : bad > 0
      ? `${report.queryResults.length} 句里有 ${bad} 句过不了，先别发。`
      : report.verdict.level === "warn"
        ? "句子都过了，但有几处要你看一眼再发。"
        : `这 ${report.queryResults.length} 句都过了。`;

  return (
    <section className="own-check-qs">
      <h3>要检查的问题</h3>
      <p className={bad > 0 ? "is-bad" : report && report.verdict.level === "approve" ? "is-ok" : undefined}>{lead}</p>
      <ol>
        {rows.map((row) => {
          const result = outcome(report ? byQuery.get(row.query) : undefined);
          const expanded = open === row.query;
          return (
            <li key={row.query} className="own-check-q-item">
              <div className="own-check-q-row">
                <button type="button" className="own-check-q" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : row.query)}>
                  {row.query}
                </button>
                <em>{row.kind}</em>
                <strong className={`is-${report ? result.tone : "wait"}`}>{report ? result.text : changed ? "有一段会变" : "还没查"}</strong>
              </div>
              {expanded && onAsk ? <SkillClauseRead skillId={skillId} query={row.query} onAsk={onAsk} /> : null}
            </li>
          );
        })}
      </ol>
      {canCheck && onCheck ? (
        <button type="button" onClick={onCheck} disabled={checking}>
          {checking ? "正在问这几句…" : "检查这些问题"}
        </button>
      ) : null}
    </section>
  );
}
