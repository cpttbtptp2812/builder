import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { WorkPaper } from "../../lib/workPaper";
import { paperDrawerTitle } from "../../lib/workPaper";
import { WorkPaperView } from "./WorkPaper";

export function WorkPaperDrawer({
  paper,
  open,
  onClose,
  onAsk,
  interactive = true,
}: {
  paper: WorkPaper | null;
  open: boolean;
  onClose: () => void;
  onAsk?: (text: string) => void;
  interactive?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !paper) return null;

  return createPortal(
    <div className="oa-work-drawer-back" onClick={onClose} role="presentation">
      <aside
        className="oa-work-drawer"
        onClick={(ev) => ev.stopPropagation()}
        aria-label={paperDrawerTitle(paper)}
      >
        <header className="oa-work-drawer-head">
          <div>
            <strong>{paperDrawerTitle(paper)}</strong>
            <p>左侧继续对话，这里看完整文书和明细</p>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="oa-work-drawer-body">
          <WorkPaperView paper={paper} interactive={interactive} onAsk={onAsk} />
        </div>
      </aside>
    </div>,
    document.body,
  );
}
