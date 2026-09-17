import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentHubOverview } from "../components/agent/AgentHubOverview";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { EvalLabPanel } from "../components/fx/EvalLabPanel";
import { GuardPanel } from "../components/ownagent/GuardPanel";
import { RagPanel } from "../components/ownagent/RagPanel";
import { TracePanel } from "../components/ownagent/TracePanel";

type PanelId = "arch" | "chat" | "trace" | "rag" | "guard" | "eval";

const PANELS: { id: PanelId; label: string; hint: string }[] = [
  { id: "arch", label: "能力全景", hint: "点节点看这一层" },
  { id: "chat", label: "对话", hint: "流式回复 + 工具" },
  { id: "trace", label: "运行追踪", hint: "每步 payload" },
  { id: "rag", label: "知识检索", hint: "chunkId 溯源" },
  { id: "guard", label: "能力锁", hint: "工单预演" },
  { id: "eval", label: "回归评测", hint: "路由命中率" },
];

function resolvePanel(v: string | null): PanelId {
  if (v === "skills" || v === "codrive") return "arch";
  if (PANELS.some((p) => p.id === v)) return v as PanelId;
  return "arch";
}

/** OwnAgent — 能力全景图是产品主界面 */
export function WorkOwnAgent() {
  const [params, setParams] = useSearchParams();
  const stageRef = useRef<HTMLElement>(null);
  const raw = params.get("panel");
  const active = resolvePanel(raw);
  const current = PANELS.find((p) => p.id === active)!;

  useEffect(() => {
    if (!raw) return;
    stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active, raw]);

  function select(id: PanelId) {
    const next = new URLSearchParams(params);
    next.set("panel", id);
    setParams(next, { replace: true });
  }

  return (
    <div className="own-agent">
      <header className="own-bar">
        <div>
          <p className="own-eyebrow">个人项目</p>
          <h1>OwnAgent</h1>
        </div>
        <BackendStatusBar compact />
      </header>

      <nav className="own-tabs" aria-label="OwnAgent">
        {PANELS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={p.id === active ? "active" : ""}
            aria-current={p.id === active ? "page" : undefined}
            onClick={() => select(p.id)}
          >
            <span className="own-tab-no">{String(i + 1).padStart(2, "0")}</span>
            <strong>{p.label}</strong>
            <em>{p.hint}</em>
          </button>
        ))}
      </nav>

      <section className="own-stage" aria-label={current.label} ref={stageRef}>
        {active === "arch" ? (
          <div className="own-panel agent-hub">
            <AgentHubOverview />
          </div>
        ) : null}
        {active === "chat" ? <AgentProductDemo /> : null}
        {active === "trace" ? <TracePanel /> : null}
        {active === "rag" ? <RagPanel /> : null}
        {active === "guard" ? <GuardPanel /> : null}
        {active === "eval" ? <EvalLabPanel /> : null}
      </section>
    </div>
  );
}
