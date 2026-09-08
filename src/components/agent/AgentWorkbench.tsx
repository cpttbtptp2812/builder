import type { ReactNode } from "react";
import { AgentPlatformLab } from "../fx/AgentPlatformLab";
import { AgentSkillsDemo } from "../fx/AgentSkillsDemo";
import { EvalLabPanel } from "../fx/EvalLabPanel";
import type { AgentStep } from "./AgentHubOverview";

export type AgentPanel = Exclude<AgentStep, "overview" | "chat">;

const PANELS: { id: AgentPanel; label: string }[] = [
  { id: "skills", label: "流程 / 能力" },
  { id: "platform", label: "规划 / 知识" },
  { id: "eval", label: "运行管控" },
];

/** 单块深度调试 — 可切换面板 */
export function AgentWorkbench({
  panel,
  onPanel,
  trySkillId,
  scene = null,
  minimal = false,
}: {
  panel: AgentPanel;
  onPanel: (id: AgentPanel) => void;
  trySkillId?: string | null;
  scene?: "rag" | "multi-agent" | null;
  minimal?: boolean;
}) {
  let body: ReactNode = null;
  if (panel === "skills") {
    body = <AgentSkillsDemo embedded initialSkillId={trySkillId} trySkillId={trySkillId} />;
  } else if (panel === "platform") {
    body = <AgentPlatformLab embedded initialScene={scene ?? "rag"} />;
  } else {
    body = <EvalLabPanel compact />;
  }

  return (
    <section className={`agent-workbench${minimal ? " agent-workbench--minimal" : ""}`}>
      <nav className="agent-workbench-tabs" aria-label="调试面板">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={panel === p.id ? "on" : ""}
            onClick={() => onPanel(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <div className="agent-workbench-body">{body}</div>
    </section>
  );
}
