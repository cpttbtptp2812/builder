import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentPlatformLab } from "../components/fx/AgentPlatformLab";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { AgentSkillsDemo } from "../components/fx/AgentSkillsDemo";
import { EvalLabPanel } from "../components/fx/EvalLabPanel";
import { McpBridgeDemo } from "../components/fx/McpBridgeDemo";
import { WorkGuide } from "../components/WorkGuide";
import { WorkTechDeepLinks } from "../components/WorkTechDeepLinks";
import { getWork } from "../data/works";

const TABS = [
  { id: "agent", label: "对话", sub: "Guest + MCP Trace" },
  { id: "skills", label: "Skills", sub: "Router + 流水线" },
  { id: "platform", label: "Platform", sub: "RAG + Multi-Agent" },
  { id: "eval", label: "路由测试", sub: "回归用例" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(raw: string | null, skill?: string | null): TabId {
  if (raw === "skills" || skill) return "skills";
  if (raw === "platform") return "platform";
  if (raw === "eval") return "eval";
  return "agent";
}

/** 开发调试 — Agent / Skills / Platform / 路由测试 合一 */
export function WorkDevDebug() {
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get("tab"), params.get("try") ?? params.get("skill"));
  const trySkillId = params.get("try") ?? params.get("skill");
  const [autoAgent, setAutoAgent] = useState(false);
  const chatRef = useRef<HTMLElement>(null);
  const sse = getWork("sse");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    if (params.get("demo") === "1" || params.get("demo") === "true") setAutoAgent(true);
  }, [params]);

  const active = useMemo(() => TABS.find((t) => t.id === tab) ?? TABS[0], [tab]);

  function setTab(id: TabId) {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    if (id !== "skills") {
      next.delete("try");
      next.delete("skill");
    }
    setParams(next, { replace: true });
  }

  return (
    <div className="work-dev-debug">
      <WorkGuide slug="dev-debug" />
      <BackendStatusBar compact />

      <nav className="dev-debug-tabs" aria-label="开发调试">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dev-debug-tab${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <strong>{t.label}</strong>
            <span>{t.sub}</span>
          </button>
        ))}
      </nav>

      <div className="dev-debug-panel">
        <header className="dev-debug-panel-head">
          <h2>{active.label}</h2>
          <p>{active.sub}</p>
        </header>

        {tab === "agent" && (
          <div className="dev-debug-stack">
            <section ref={chatRef}>
              <AgentProductDemo autoStart={autoAgent} />
            </section>
            <section>
              <h3 className="work-subsection-title">MCP 手动调试</h3>
              <McpBridgeDemo />
            </section>
          </div>
        )}

        {tab === "skills" && <AgentSkillsDemo initialSkillId={trySkillId} trySkillId={trySkillId} />}

        {tab === "platform" && <AgentPlatformLab />}

        {tab === "eval" && <EvalLabPanel />}
      </div>

      {sse && tab === "agent" && (
        <WorkTechDeepLinks intro="SSE 流式协议细节：" links={[sse]} />
      )}
    </div>
  );
}
