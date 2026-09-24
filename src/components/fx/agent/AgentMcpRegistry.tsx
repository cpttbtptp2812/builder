import { useEffect, useState } from "react";
import { MCP_TOOLS } from "../../../lib/mcpBridgeLab";

const STORAGE_KEY = "uniagent-mcp-enabled";
const DEFAULT_ENABLED = MCP_TOOLS.map((t) => t.name);

function loadEnabled(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ENABLED;
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((n) => MCP_TOOLS.some((t) => t.name === n));
  } catch {
    return DEFAULT_ENABLED;
  }
}

/** MCP 工具注册表 — 中文产品文案 */
export function AgentMcpRegistry({
  enabled,
  onChange,
  compact = false,
}: {
  enabled: string[];
  onChange: (names: string[]) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(enabled);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  }, [enabled]);

  function toggle(name: string) {
    setDraft((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function save() {
    onChange(draft.length ? draft : DEFAULT_ENABLED);
    setOpen(false);
  }

  return (
    <section className={`agent-mcp-registry${compact ? " compact" : ""}`}>
      <header className="agent-mcp-registry-head">
        {compact ? null : (
          <div>
            <strong>MCP 工具</strong>
            <span>Agent 可调用的 tools/list</span>
          </div>
        )}
        <button type="button" onClick={() => { setDraft(enabled); setOpen(true); }}>
          {compact ? `工具 · ${enabled.length}` : "管理"}
        </button>
      </header>
      {!compact && (
        <div className="agent-mcp-registry-chips">
          {enabled.map((name) => {
            const tool = MCP_TOOLS.find((t) => t.name === name);
            return (
              <span key={name} className="agent-mcp-chip" title={tool?.descriptionZh}>
                <code>{tool?.labelZh ?? name}</code>
              </span>
            );
          })}
        </div>
      )}

      {open && (
        <div className="agent-mcp-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="agent-mcp-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>选择能力工具</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭">
                ×
              </button>
            </header>
            <p className="agent-mcp-modal-lead">
              勾选后 Agent 对话会调用对应 MCP 工具（探活、检索、快照、制度、工单等）。
            </p>
            <div className="agent-mcp-modal-list">
              {MCP_TOOLS.map((t) => (
                <label key={t.name} className={draft.includes(t.name) ? "on" : ""}>
                  <input
                    type="checkbox"
                    checked={draft.includes(t.name)}
                    onChange={() => toggle(t.name)}
                  />
                  <div>
                    <strong>{t.labelZh}</strong>
                    <code>{t.name}</code>
                    <span>{t.descriptionZh}</span>
                  </div>
                </label>
              ))}
            </div>
            <footer>
              <button type="button" className="ghost" onClick={() => setDraft(DEFAULT_ENABLED)}>
                全选
              </button>
              <button type="button" className="primary" onClick={save}>
                确定 · {draft.length} 个工具
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}

export { loadEnabled as loadEnabledMcpTools };
