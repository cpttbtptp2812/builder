import { useEffect, useState } from "react";
import { SKILL_TRACE_CASES } from "../../lib/provingGround";
import type { QueryCompareRow, SkillFullCompareReport } from "../../lib/skillCompareReport";
import { weekQueriesForSkill } from "../../lib/skillSentence";
import { listAllCasesForSkill } from "../../lib/skillTraceCaseStore";
import { CheckSeal, gateLead, releaseGateLevel } from "./ScmVisuals";
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
  showProgressSeal = true,
  showRecheck = true,
  showStatusLine = true,
  allowClauseAsk = true,
  hideListUntilReport = false,
  hideQuestionList = false,
  embedded = false,
}: {
  skillId: string;
  report: SkillFullCompareReport | null;
  checking: boolean;
  canCheck?: boolean;
  onCheck?: () => void;
  onAsk?: (query: string) => void;
  showProgressSeal?: boolean;
  showRecheck?: boolean;
  showStatusLine?: boolean;
  allowClauseAsk?: boolean;
  hideListUntilReport?: boolean;
  hideQuestionList?: boolean;
  /** 在 own-check-board 内：不重复外边距 */
  embedded?: boolean;
}) {
  const clauses = useSkillClauses(skillId);
  const changed = clauseChanged(clauses);
  const [open, setOpen] = useState<string | null>(null);
  const rows = questionsFor(skillId, report);
  const byQuery = new Map((report?.queryResults ?? []).map((q) => [q.query, q]));
  const listed = rows.map((row) => byQuery.get(row.query)).filter((row): row is QueryCompareRow => !!row);
  const bad = listed.filter((row) => row.verdictLevel === "reject" || row.routeDrift).length;

  const [seen, setSeen] = useState(0);
  const [walking, setWalking] = useState(false);
  useEffect(() => {
    if (!report || checking) {
      setSeen(0);
      setWalking(false);
      return;
    }
    setWalking(true);
    setSeen(0);
    let i = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      i += 1;
      setSeen(i);
      if (i < rows.length) window.setTimeout(step, 420);
      else window.setTimeout(() => { if (!cancelled) setWalking(false); }, 500);
    };
    const t = window.setTimeout(step, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [report, checking, rows.length]);

  const copy = report ? gateLead(releaseGateLevel(report.verdict.level), report.scm) : null;
  const phase = checking ? "run" : report ? (walking && seen < rows.length ? "read" : "done") : "idle";
  const sealVisible = showProgressSeal && (checking || (report && !showStatusLine && phase !== "done"));

  const lead = checking
    ? "正在分别问现用版和新版。"
    : !report
      ? canCheck
        ? `发版前会问这 ${rows.length} 句。点检查，看每句过不过。`
        : `还没有改动。下面是发版时会问的 ${rows.length} 句。改一版之后，再查它们过不过。`
      : bad > 0
        ? `${rows.length} 句里有 ${bad} 句过不了，先别发。`
        : report.verdict.level === "warn"
          ? "这几句都过了，有一处要看一眼再发。"
          : `这 ${rows.length} 句都过了。`;

  return (
    <section className={`own-check-qs${embedded ? " own-check-qs--embedded" : ""}`} aria-busy={checking}>
      {sealVisible ? (
        <CheckSeal
          phase={phase === "idle" ? "done" : phase}
          seen={checking ? 0 : seen}
          total={rows.length}
          title={copy?.title}
          note={phase === "done" && !report ? copy?.note : undefined}
          baselineVersion={report?.baselineVersion}
          candidateVersion={report?.candidateVersion}
          tone={report ? releaseGateLevel(report.verdict.level) : undefined}
        />
      ) : null}

      {!embedded && !checking && !report ? (
        <h3 className="own-check-qs-title">要检查的问题</h3>
      ) : null}

      {!checking && !report && !embedded ? (
        <p className="own-check-idle">会检查下面 {rows.length} 句（含触发样例）；与底部「只检查不发布」同一次流程。</p>
      ) : null}

      {showStatusLine && report && !checking ? (
        <p className={`own-check-list-lead${bad > 0 ? " is-bad" : report.verdict.level === "approve" ? " is-ok" : " is-warn"}`}>
          {lead}
          {report.liveProbeUsed ? " 带链接的句子已真实探活。" : ""}
        </p>
      ) : null}

      {!showStatusLine && !embedded && report && !checking ? (
        <p className={`own-check-list-lead${bad > 0 ? " is-bad" : report.verdict.level === "approve" ? " is-ok" : " is-warn"}`}>
          {lead}
        </p>
      ) : null}

      {report && !checking && !showStatusLine ? (
        <header className="own-check-list-head">
          <h4>必问句明细</h4>
          {report.liveProbeUsed ? <span className="own-check-list-tag">已探活</span> : null}
        </header>
      ) : null}

      {!hideQuestionList && (hideListUntilReport && !report && !checking ? null : (
        <ol className={report && !checking ? "own-check-q-list own-check-q-list--done" : "own-check-q-list"}>
          {rows.map((row) => {
            const result = outcome(report ? byQuery.get(row.query) : undefined);
            const expanded = open === row.query;
            const waiting = checking || !report;
            const tone = waiting ? "wait" : result.tone;
            const text = waiting ? (changed ? "有一段会变" : "—") : result.text;

            return (
              <li key={row.query} className="own-check-q-item">
                <div className="own-check-q-row">
                  <button type="button" className="own-check-q" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : row.query)}>
                    {row.query}
                  </button>
                  <em>{row.kind}</em>
                  <strong className={`is-${tone}`}>{text}</strong>
                </div>
                {expanded ? (
                  <SkillClauseRead skillId={skillId} query={row.query} onAsk={allowClauseAsk ? onAsk : undefined} />
                ) : null}
              </li>
            );
          })}
        </ol>
      ))}

      {canCheck && onCheck && showRecheck ? (
        <div className="own-check-actions">
          <button type="button" className="own-check-secondary-btn" onClick={onCheck} disabled={checking}>
            {checking ? "检查中…" : report ? "重新检查（不发布）" : "只检查不发布"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
