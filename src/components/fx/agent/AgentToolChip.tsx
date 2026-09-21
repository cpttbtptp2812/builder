import { useEffect, useMemo, useRef, useState } from "react";

export type ToolChipState = {
  id: string;
  name: string;
  state: "loading" | "ok" | "error";
  ms?: number;
  preview?: string;
};

const MIN_VISIBLE = 900;
const EXIT_MS = 350;

function formatToolName(name: string) {
  return name.replace(/_/g, " ");
}

/** 内联 Tool Call — 可展开 provenance */
export function AgentToolChip({ tool, sticky = false }: { tool: ToolChipState; sticky?: boolean }) {
  const keep = sticky || Boolean(tool.preview);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [open, setOpen] = useState(false);
  const sinceRef = useRef<number | null>(tool.state === "loading" ? Date.now() : null);
  const displayName = useMemo(() => formatToolName(tool.name), [tool.name]);

  useEffect(() => {
    if (tool.state === "loading" || tool.state === "error") {
      setVisible(true);
      setExiting(false);
      sinceRef.current = Date.now();
    }
  }, [tool.id, tool.state]);

  useEffect(() => {
    if (keep || tool.state === "loading" || tool.state === "error") return;
    if (!visible) return;
    const elapsed = sinceRef.current ? Date.now() - sinceRef.current : MIN_VISIBLE;
    const delay = Math.max(MIN_VISIBLE - elapsed, 0);
    const t1 = window.setTimeout(() => setExiting(true), delay);
    const t2 = window.setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, delay + EXIT_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [tool.state, visible, keep]);

  if (!visible) return null;

  if (tool.state === "error") {
    return (
      <div className={`agent-tool-chip fail${exiting ? " exiting" : ""}`} role="alert">
        <span aria-hidden>⚠</span>
        <strong>{displayName}</strong>
        <em>调用失败</em>
      </div>
    );
  }

  if (tool.state === "ok") {
    return (
      <button
        type="button"
        className={`agent-tool-chip ok sticky${exiting ? " exiting" : ""}${open ? " open" : ""}`}
        onClick={() => tool.preview && setOpen((o) => !o)}
      >
        <span aria-hidden>✓</span>
        <strong>{displayName}</strong>
        {tool.ms != null && <em>{tool.ms}ms</em>}
        {tool.preview && open && <span className="agent-tool-preview">{tool.preview}</span>}
      </button>
    );
  }

  return (
    <div className={`agent-tool-chip loading${exiting ? " exiting" : ""}`} role="status">
      <span aria-hidden>⚙</span>
      <strong>调用 {displayName}</strong>
    </div>
  );
}
