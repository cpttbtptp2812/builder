/** 产品左栏 — 会话 + 模块 + 轮次锚点 + 现场状态 */

const MODULES = [
  { id: "chat", label: "对话", view: "chat" },
  { id: "skills", label: "技能", view: "skills" },
  { id: "rag", label: "知识", view: "rag" },
  { id: "guard", label: "能力锁", view: "guard" },
  { id: "trace", label: "追踪", view: "trace" },
  { id: "eval", label: "评测", view: "eval" },
] as const;

export type DockSession = {
  id: string;
  title: string;
  updatedAt: string;
};

export type DockAnchor = {
  id: string;
  label: string;
  role: "user" | "assistant";
};

export function ProductDock({
  sessions,
  activeId,
  onSelect,
  onNew,
  modeHint,
  toolCount,
  running,
  anchors,
  focusId,
  onJump,
}: {
  sessions: DockSession[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  modeHint: string;
  toolCount: number;
  running: boolean;
  anchors: DockAnchor[];
  focusId?: string | null;
  onJump: (id: string) => void;
}) {
  return (
    <aside className="ua-dock" aria-label="工作台">
      <div className="ua-dock-brand">
        <div>
          <strong>工作台</strong>
          <span>上下文常驻</span>
        </div>
        <button type="button" className="ua-dock-new" onClick={onNew} disabled={running}>
          + 新对话
        </button>
      </div>

      <section className="ua-dock-sec">
        <header>模块</header>
        <nav className="ua-dock-mods">
          {MODULES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={m.id === "chat" ? "on" : ""}
              onClick={() =>
                window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: m.view } }))
              }
            >
              {m.label}
            </button>
          ))}
        </nav>
      </section>

      <section className="ua-dock-sec grow">
        <header>
          会话
          <em>{sessions.length}</em>
        </header>
        <ul className="ua-dock-sessions">
          {sessions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className={s.id === activeId ? "on" : ""}
                onClick={() => onSelect(s.id)}
              >
                <strong>{s.title || "未命名"}</strong>
                <em>{s.updatedAt.slice(5, 16).replace("T", " ")}</em>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {anchors.length > 0 ? (
        <section className="ua-dock-sec">
          <header>
            本轮锚点
            <em>{anchors.length}</em>
          </header>
          <ul className="ua-dock-anchors">
            {anchors.slice(-8).map((a, i) => (
              <li key={a.id}>
                <button
                  type="button"
                  className={`${a.role}${focusId === a.id ? " on" : ""}`}
                  onClick={() => onJump(a.id)}
                  title={a.label}
                >
                  <i />
                  <span>
                    #{anchors.length > 8 ? anchors.length - 8 + i + 1 : i + 1}{" "}
                    {a.role === "user" ? "问" : "答"}
                  </span>
                  <em>{a.label}</em>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="ua-dock-live">
        <header>现场</header>
        <div className="ua-dock-live-grid">
          <div>
            <em>模式</em>
            <strong>{modeHint}</strong>
          </div>
          <div>
            <em>工具</em>
            <strong>{toolCount}</strong>
          </div>
          <div>
            <em>状态</em>
            <strong className={running ? "run" : ""}>{running ? "推理中" : "待命"}</strong>
          </div>
        </div>
      </section>
    </aside>
  );
}
