import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { WorkPaper } from "../../lib/workPaper";
import type { LedgerInvoiceOverride } from "../../lib/productPaperPatch";
import type { MutableRefObject } from "react";
import { gridToCsv } from "../../lib/productDataStore";
import { downloadText } from "../../lib/importedSkills";
import { paperDrawerTitle, paperExportGrid } from "../../lib/workPaper";
import { WorkPaperView } from "./WorkPaper";
import type { ProductDataSlot } from "../../lib/productDataStore";
import { ProductRunInsights } from "../platform/ProductRunInsights";
import { getSessionId } from "../../lib/sessionId";
import { PerspectiveSheet } from "../fx/agent/PerspectiveSheet";
import { DeskSurface } from "../fx/agent/deskSurface";
import type { ProductRunView } from "../../lib/productRun/types";
import type { ArtifactTable } from "../../lib/chatArtifacts";

export function WorkPaperDrawer({
  paper,
  open,
  onClose,
  onAsk,
  onApplyFix,
  onReplaceMaterial,
  onSealDeliverable,
  deliverySealed,
  interactive = true,
  ledgerInvoiceOverridesRef,
  insight,
  table = null,
  run = null,
  onAuditMerkle,
}: {
  paper: WorkPaper | null;
  open: boolean;
  onClose: () => void;
  onAsk?: (text: string) => void;
  onApplyFix?: () => void | Promise<void>;
  onReplaceMaterial?: (slot: ProductDataSlot, csv: string, title: string) => void | Promise<void>;
  /** 人工复核通过后办结归档 */
  onSealDeliverable?: () => void | Promise<void>;
  deliverySealed?: boolean;
  interactive?: boolean;
  ledgerInvoiceOverridesRef?: MutableRefObject<LedgerInvoiceOverride>;
  insight?: { processId: string; skillId: string; version: string } | null;
  table?: ArtifactTable | null;
  run?: ProductRunView | null;
  onAuditMerkle?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || (!paper && !table && !run)) return null;

  const subtitle = paper ? paperDrawerTitle(paper) : table?.title?.trim() || "";
  const grid = paper ? paperExportGrid(paper) : null;
  const downloadCsv = () => {
    if (!paper || !grid) return;
    downloadText(
      `${paperDrawerTitle(paper).replace(/[\\/:*?"<>|]/g, " ")}.csv`,
      gridToCsv(grid.columns, grid.rows),
      "text/csv;charset=utf-8",
    );
  };

  return createPortal(
    <div className="oa-work-drawer-back" onClick={onClose} role="presentation">
      <aside
        className={table ? "oa-work-drawer is-detail" : paper?.kind === "tables" ? "oa-work-drawer is-desk-tables" : "oa-work-drawer"}
        onClick={(ev) => ev.stopPropagation()}
        aria-label="详情"
      >
        <header className="oa-work-drawer-head">
          <div>
            <strong>详情</strong>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className="oa-work-drawer-actions">
            {onAuditMerkle && (
              <button
                type="button"
                className="oa-work-drawer-dl"
                style={{ borderColor: "#f59e0b", color: "#d97706", background: "rgba(245, 158, 11, 0.08)" }}
                onClick={onAuditMerkle}
                title="查看 Merkle Tree 密码学防篡改审计树与零信任验真"
              >
                🛡️ 密码学存证
              </button>
            )}
            {grid ? (
              <button type="button" className="oa-work-drawer-dl" onClick={downloadCsv}>
                下载 CSV
              </button>
            ) : null}
            <button type="button" className="oa-work-drawer-close" onClick={onClose} aria-label="关闭">
              ×
            </button>
          </div>
        </header>
        <div className="oa-work-drawer-body">
          {table ? <PerspectiveSheet table={table} embedded /> : null}
          {run ? (
            <div className="oa-detail-trace">
              <DeskSurface run={run} mode="trace" />
            </div>
          ) : null}
          {paper ? (
            <WorkPaperView
              paper={paper}
              layout="drawer"
              interactive={interactive}
              onAsk={onAsk}
              onApplyFix={onApplyFix}
              onReplaceMaterial={onReplaceMaterial}
              onSealDeliverable={onSealDeliverable}
              deliverySealed={deliverySealed}
              ledgerInvoiceOverridesRef={ledgerInvoiceOverridesRef}
            />
          ) : null}
          {insight ? (
            <ProductRunInsights
              placement="drawer"
              sessionId={getSessionId()}
              processId={insight.processId}
              skillId={insight.skillId}
              version={insight.version}
            />
          ) : null}
        </div>
        {grid ? (
          <footer className="oa-work-drawer-foot">
            <button type="button" className="oa-work-drawer-dl" onClick={downloadCsv}>
              下载 CSV
            </button>
          </footer>
        ) : null}
      </aside>
    </div>,
    document.body,
  );
}
