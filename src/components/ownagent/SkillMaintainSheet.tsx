import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** 维护工具：侧栏打开，不挤占技能列表 */
export function SkillMaintainSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="oa-maintain-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="oa-maintain-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oa-maintain-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="oa-maintain-head">
          <div>
            <h2 id="oa-maintain-title">维护</h2>
            <p>导入导出、批量检查、审批与改进</p>
          </div>
          <button type="button" className="oa-maintain-x" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
        <div className="oa-maintain-scroll">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
