import type React from "react";
import type { WorkPaper } from "../../../lib/workPaper";
import { paperBrief, paperExportGrid } from "../../../lib/workPaper";

export function WorkPaperArtifactCard({
  paper,
  active,
  onOpenDrawer,
  onDownloadCsv,
  inlineExpanded,
  onToggleInline,
  children,
}: {
  paper: WorkPaper;
  active: boolean;
  onOpenDrawer: () => void;
  onDownloadCsv: () => void;
  inlineExpanded: boolean;
  onToggleInline: () => void;
  children?: React.ReactNode;
}) {
  const brief = paperBrief(paper);
  const metrics = paper.kind === "tables" ? paper.metrics.slice(0, 4) : [];
  const grid = paperExportGrid(paper);
  const rowCount =
    grid?.rows?.length ??
    ("items" in paper && Array.isArray(paper.items) ? paper.items.length : 0);

  return (
    <div className={`oa-artifact-card${active ? " is-active" : ""}${inlineExpanded ? " is-expanded" : ""}`}>
      <div className="oa-artifact-card-header">
        <div className="oa-artifact-card-title-group">
          <div className="oa-artifact-card-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2.5" y="2.5" width="15" height="15" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2.5 7.5h15M7.5 7.5v10M12.5 7.5v10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="oa-artifact-card-headings">
            <div className="oa-artifact-card-badge-row">
              <span className="oa-artifact-tag">{brief.tag || "业务文书"}</span>
              {brief.issues > 0 ? (
                <span className="oa-artifact-badge is-warn">⚠️ {brief.issues} 项待复核</span>
              ) : (
                <span className="oa-artifact-badge is-ok">✓ 数据校验通过</span>
              )}
              {rowCount > 0 && <span className="oa-artifact-meta">{rowCount} 行明细</span>}
            </div>
            <strong className="oa-artifact-title">{brief.title}</strong>
          </div>
        </div>

        <button
          type="button"
          className="oa-artifact-btn-quick-open"
          onClick={onOpenDrawer}
          title="在右侧宽屏抽屉展开查看完整表格"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M12.5 8.5v4a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h4M9.5 2.5h4v4M6.5 9.5l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {brief.subtitle ? <p className="oa-artifact-subtitle">{brief.subtitle}</p> : null}

      {metrics.length > 0 && (
        <div className="oa-artifact-metrics">
          {metrics.map((m, idx) => (
            <div key={idx} className={`oa-artifact-metric-item ${m.tone || ""}`}>
              <span className="oa-artifact-metric-lbl">{m.label}</span>
              <strong className="oa-artifact-metric-val">{m.value}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="oa-artifact-actions">
        <button
          type="button"
          className={`oa-artifact-btn oa-artifact-btn--primary${active ? " is-active" : ""}`}
          onClick={onOpenDrawer}
          title="在右侧抽屉展开查看完整多维数据表格并办理"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M12.5 8.5v4a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h4M9.5 2.5h4v4M6.5 9.5l7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{active ? "正在右侧抽屉展示中" : "在右侧抽屉打开表格"}</span>
        </button>

        <button
          type="button"
          className={`oa-artifact-btn oa-artifact-btn--toggle${inlineExpanded ? " is-expanded" : ""}`}
          onClick={onToggleInline}
          title={inlineExpanded ? "收起就地预览" : "在对话流中就地预览表格"}
        >
          <span>{inlineExpanded ? "收起预览 ▴" : "就地预览 ▾"}</span>
        </button>

        <button
          type="button"
          className="oa-artifact-btn oa-artifact-btn--subtle"
          hidden={active}
          onClick={onDownloadCsv}
          title="下载当前表格为 CSV 格式"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2.5v7.5m0 0l-3-3m3 3l3-3M3 13.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>下载 CSV</span>
        </button>
      </div>

      {inlineExpanded && (
        <div className="oa-artifact-inline-box">
          <div className="oa-artifact-inline-banner">
            <span>就地表格预览（如需完整多列及横向编辑，建议点击上方「在右侧抽屉打开」）</span>
            <button type="button" className="oa-artifact-inline-close" onClick={onToggleInline}>
              收起
            </button>
          </div>
          <div className="oa-artifact-inline-scroll">{children}</div>
        </div>
      )}
    </div>
  );
}
