import { useEffect, useState } from "react";
import { MCP_TOOLS } from "../../../lib/mcpBridgeLab";

const STORAGE_KEY = "uniagent-mcp-enabled";
const DEFAULT_ENABLED = MCP_TOOLS.map((t) => t.name);

function loadEnabled(): string[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ENABLED;
    const parsed = JSON.parse(raw) as string[];
    return parsed.filter((n) => MCP_TOOLS.some((t) => t.name === n));
  } catch {
    return DEFAULT_ENABLED;
  }
}

/** MCP 工具注册表 — 对齐 tianyangbuilder ResourcesSection + ResourceSelectModal */
export function AgentMcpRegistry({
  enabled,
  onChange,
}: {
  enabled: string[];
  onChange: (names: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(enabled);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(enabled));
  }, [enabled]);

  function toggle(name: string) {
    setDraft((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function save() {
    onChange(draft.length ? draft : DEFAULT_ENABLED);
    setOpen(false);
  }

  return (
    <section className="agent-mcp-registry">
      <header className="agent-mcp-registry-head">
        <div>
          <strong>MCP 工具</strong>
          <span>Agent 会话可调用的 tools/list 注册表</span>
        </div>
        <button type="button" onClick={() => { setDraft(enabled); setOpen(true); }}>
          管理
        </button>
      </header>
      <div className="agent-mcp-registry-chips">
        {enabled.map((name) => {
          const tool = MCP_TOOLS.find((t) => t.name === name);
          return (
            <span key={name} className="agent-mcp-chip" title={tool?.description}>
              <code>{name}</code>
            </span>
          );
        })}
      </div>

      {open && (
        <div className="agent-mcp-modal-backdrop" onClick={() => setOpen(false)}>
          <div className="agent-mcp-modal" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>选择 MCP 工具</strong>
              <button type="button" onClick={() => setOpen(false)} aria-label="关闭">
                ×
              </button>
            </header>
            <p className="agent-mcp-modal-lead">勾选后 Agent / LLM 仅可使用这些工具（Guest 模式按 Skill 流水线执行）。</p>
            <div className="agent-mcp-modal-list">
              {MCP_TOOLS.map((t) => (
                <label key={t.name} className={draft.includes(t.name) ? "on" : ""}>
                  <input
                    type="checkbox"
                    checked={draft.includes(t.name)}
                    onChange={() => toggle(t.name)}
                  />
                  <div>
                    <code>{t.name}</code>
                    <span>{t.description}</span>
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
