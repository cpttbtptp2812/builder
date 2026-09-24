import type { ReleaseInspectReport } from "../../../lib/releaseInspect";

const STATUS_LABEL = { pass: "通过", warn: "注意", fail: "失败" } as const;

export function ReleaseInspectCard({
  report,
  compact = false,
}: {
  report: ReleaseInspectReport;
  compact?: boolean;
}) {
  const overallLabel =
    report.overall === "pass"
      ? "页面正常"
      : report.overall === "warn"
        ? "基本可用"
        : "无法访问";

  return (
    <div className={`release-inspect-card overall-${report.overall}${compact ? " compact" : ""}`}>
      <header className="release-inspect-head">
        <div>
          <span className="release-inspect-kicker">发布前巡检</span>
          <strong>{report.pageTitle ?? overallLabel}</strong>
          {report.pageTitle ? (
            <span className="release-inspect-subtitle">{overallLabel}</span>
          ) : null}
        </div>
        <div className="release-inspect-meta">
          <span>{(report.ms / 1000).toFixed(1)}s</span>
        </div>
      </header>
      {report.siteSummary ? (
        <p className="release-inspect-summary">{report.siteSummary}</p>
      ) : null}
      <p className="release-inspect-url">{report.targetUrl}</p>
      <ul className="release-inspect-checks">
        {report.checks.map((c) => (
          <li key={c.id} className={`check-${c.status}`}>
            <span className="release-inspect-status">{STATUS_LABEL[c.status]}</span>
            <strong>{c.label}</strong>
            <p>{c.detail}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
