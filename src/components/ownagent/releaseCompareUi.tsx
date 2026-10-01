import { buildReleaseGateSummary, downloadReportJson } from "../../lib/releaseGate";
import type { SkillCompareResult } from "../../lib/skillCompareEngine";
import { reportToMarkdown, type SkillFullCompareReport } from "../../lib/skillCompareReport";
import { humanVerdict, stepShortLabel } from "./skillVerUi";
import { ScmCompareViz } from "./ScmVisuals";

export function downloadFullReportMd(report: SkillFullCompareReport, skillId: string) {
  const blob = new Blob([reportToMarkdown(report)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${skillId}-v${report.baselineVersion}-to-v${report.candidateVersion}-检查报告.md`;
  a.click();
  URL.revokeObjectURL(url);
}

export function FullCompareReport({
  report,
  skillId,
  heroReasons = [],
  hideQueryTable = false,
}: {
  report: SkillFullCompareReport;
  skillId: string;
  heroReasons?: string[];
  /** 逐句表已在外层展示时设为 true，避免重复 */
  hideQueryTable?: boolean;
}) {
  const issues = report.risks.filter((r) => r.level !== "low");
  const bad = report.queryResults.filter((q) => q.routeDrift || q.traceChanged).length;
  const scmFlat = report.scm && report.scm.baselinePass === report.scm.candidatePass;
  const hideIssues = heroReasons.length > 0 && report.verdict.level === "warn";

  return (
    <div className="own-skill-ver-report own-skill-ver-report--compact">
      <section className="own-compare-report-section">
        <h3>确定性覆盖</h3>
        <p>
          Exact {report.coverage.exactPct}%（{report.coverage.exact}/{report.coverage.total} 步）
          {report.coverage.exactPct < 80 ? "；未覆盖步骤只产生 WARN，不作为因果 BLOCK 依据。" : "；达到门禁可信阈值。"}
        </p>
        {report.coverage.mockHints.length ? (
          <ul>{report.coverage.mockHints.map((hint) => <li key={hint}>{hint}</li>)}</ul>
        ) : null}
      </section>
      {report.scm && !scmFlat ? (
        <section className="own-compare-report-section own-scm-inline">
          <h3>因果传播</h3>
          <ScmCompareViz
            consequence={{
              baselinePass: report.scm.baselinePass,
              candidatePass: report.scm.candidatePass,
              deltaSuccess: report.scm.deltaSuccess,
              pivotalOnBaseline: report.scm.pivotalStepId
                ? {
                    stepId: report.scm.pivotalStepId,
                    tool: report.scm.pivotalTool ?? "",
                    stepIndex: 0,
                    mode: "exact",
                    baselinePass: report.scm.baselinePass,
                    counterfactualPass: true,
                    deltaSuccess: 1,
                    pivotal: true,
                    intervention: "fix",
                    detail: "",
                  }
                : null,
            }}
          />
        </section>
      ) : null}

      {!hideIssues && issues.length ? (
        <section className="own-compare-report-section">
          <h3>需要注意（{issues.length}）</h3>
          <ul className="own-compare-risk-list">
            {issues.map((r, i) => (
              <li key={i} className={`own-compare-risk own-compare-risk--${r.level === "high" ? "fail" : "warn"}`}>
                <span className="own-compare-risk-badge">{r.level === "high" ? "严重" : "注意"}</span>
                <div>
                  <strong>{r.title}</strong>
                  <p>{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!hideQueryTable ? (
        <details className="own-compare-report-section own-skm-details" open={bad > 0}>
          <summary>
            <h3>逐句测试结果（{report.queryResults.length} 句{bad ? `，${bad} 句不同` : ""}）</h3>
          </summary>
          <div className="own-compare-table-wrap">
            <table className="own-compare-table">
              <thead>
                <tr>
                  <th>用户说法</th>
                  <th>现用版交给</th>
                  <th>新版交给</th>
                  <th>结果</th>
                </tr>
              </thead>
              <tbody>
                {report.queryResults.map((q, i) => (
                  <tr key={i} className={q.routeDrift || q.traceChanged ? "own-compare-row-warn" : undefined}>
                    <td>{q.query}</td>
                    <td>{q.routeBaseline ?? "没有技能接手"}</td>
                    <td>{q.routeCandidate ?? "没有技能接手"}</td>
                    <td>{q.routeDrift ? "交给的技能变了" : q.traceChanged ? `步骤变了：${q.traceSummary}` : "一致"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </div>
  );
}

export function CompareSideColumn({
  title,
  side,
  other,
  highlight,
}: {
  title: string;
  side: SkillCompareResult["baseline"];
  other: SkillCompareResult["baseline"];
  highlight?: boolean;
}) {
  const routeChanged = side.routedSkillId !== other.routedSkillId;
  return (
    <article className={highlight ? "own-compare-col own-compare-col--new" : "own-compare-col"}>
      <header>
        <h3>{title}</h3>
        <span className={side.traceOk ? "own-skill-badge ok" : "own-skill-badge warn"}>{side.traceOk ? "回答成功" : "回答失败"}</span>
      </header>
      <dl className="own-compare-facts">
        <div>
          <dt>交给哪个技能处理</dt>
          <dd className={routeChanged ? "own-compare-warn" : ""}>
            {side.routedSkillName ?? "没有技能接手"}
            {routeChanged ? "（和另一版不同）" : ""}
          </dd>
        </div>
        <div>
          <dt>执行的步骤</dt>
          <dd>{side.steps.map((s) => stepShortLabel(s)).join(" → ") || "无"}</dd>
        </div>
        <div>
          <dt>回答内容</dt>
          <dd className="own-compare-answer">{side.answerPreview}</dd>
        </div>
      </dl>
    </article>
  );
}

export { buildReleaseGateSummary, downloadReportJson, humanVerdict };
