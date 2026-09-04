import { useEffect, useMemo, useRef, useState } from "react";

export type ToolChipState = {
  id: string;
  name: string;
  state: "loading" | "ok" | "error";
  ms?: number;
};

const MIN_VISIBLE = 900;
const EXIT_MS = 350;

const TOOL_LABELS: Record<string, string> = {
  http_probe: "HTTP Probe",
  knowledge_search: "Knowledge",
  browser_snapshot: "DOM Snapshot",
  workflow_run: "Workflow",
  browser_navigate: "Navigate",
};

function formatToolName(name: string) {
  return TOOL_LABELS[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 内联 Tool Call 卡片 — 对齐 tianyangAgent McpToolCard */
export function AgentToolChip({ tool }: { tool: ToolChipState }) {
  const [visible, setVisible] = useState(tool.state !== "ok");
  const [exiting, setExiting] = useState(false);
  const sinceRef = useRef<number | null>(tool.state === "loading" ? Date.now() : null);
  const displayName = useMemo(() => formatToolName(tool.name), [tool.name]);
  const fullText = `调用 ${displayName}`;
  const chars = fullText.split("");

  useEffect(() => {
    if (tool.state === "loading" || tool.state === "error") {
      setVisible(true);
      setExiting(false);
      sinceRef.current = Date.now();
    }
  }, [tool.id, tool.state]);

  useEffect(() => {
    if (tool.state === "loading" || tool.state === "error") return;
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
  }, [tool.state, visible]);

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
      <div className={`agent-tool-chip ok${exiting ? " exiting" : ""}`}>
        <span aria-hidden>✓</span>
        <strong>{displayName}</strong>
        {tool.ms != null && <em>{tool.ms}ms</em>}
      </div>
    );
  }

  return (
    <div className={`agent-tool-chip loading${exiting ? " exiting" : ""}`} role="status">
      <span aria-hidden>🔧</span>
      <span className="agent-tool-chip-wave">
        {chars.map((c, i) => (
          <span
            key={i}
            className="tool-call-wave-char"
            style={{ animationDelay: `${i * 60}ms`, animationDuration: `${1.2 + chars.length * 0.02}s` }}
          >
            {c}
          </span>
        ))}
      </span>
    </div>
  );
}
