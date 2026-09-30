import type { SkillFullCompareReport, QueryCompareRow } from "../../lib/skillCompareReport";
import { listGateQuestionRows } from "../../lib/skillGateQuestions";

function outcome(row: QueryCompareRow | undefined): { tone: string; text: string } {
  if (!row) return { tone: "wait", text: "—" };
  if (row.verdictLevel === "reject") return { tone: "bad", text: row.note || "不过" };
  if (row.routeDrift) return { tone: "bad", text: "路由变了" };
  if (row.traceChanged) return { tone: "warn", text: row.traceSummary || "步骤变了" };
  if (row.verdictLevel === "warn") return { tone: "warn", text: row.note || "注意" };
  return { tone: "ok", text: "过" };
}

/** 检查前：展示将跑哪些必问句（只读，编辑在问法库） */
export function GateQuestionsPreview({ skillId }: { skillId: string }) {
  const rows = listGateQuestionRows(skillId);
  if (!rows.length) {
    return <p className="own-ver-hint">还没有必问句，请在下方问法库添加。</p>;
  }
  return (
    <ol className="own-rel-gate-list" aria-label="将检查的必问句">
      {rows.map((row, i) => (
        <li key={row.query}>
          <span className="own-rel-gate-no">{i + 1}</span>
          <span className="own-rel-gate-q">{row.query}</span>
        </li>
      ))}
    </ol>
  );
}

/** 必问句检查结果 — 只读表格，嵌在结论里，不单独占 Tab */
export function GateResultsTable({
  skillId,
  report,
  compact = true,
}: {
  skillId: string;
  report: SkillFullCompareReport;
  compact?: boolean;
}) {
  const rows = listGateQuestionRows(skillId);
  const byQuery = new Map(report.queryResults.map((q) => [q.query, q]));

  return (
    <div className="own-gate-table-wrap">
      <table className="own-gate-table">
        <thead>
          <tr>
            <th>必问句</th>
            <th>结果</th>
            {!compact ? <th>类型</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const r = outcome(byQuery.get(row.query));
            return (
              <tr key={row.query} className={`is-${r.tone}`}>
                <td>{row.query}</td>
                <td>
                  <span className={`own-gate-pill is-${r.tone}`}>{r.text}</span>
                </td>
                {!compact ? <td>{row.kind}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
      {report.liveProbeUsed ? <p className="own-gate-table-note">含链接的句子已做真实探活。</p> : null}
    </div>
  );
}
