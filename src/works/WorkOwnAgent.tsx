import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentHubOverview } from "../components/agent/AgentHubOverview";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { EvalLabPanel } from "../components/fx/EvalLabPanel";
import { GuardPanel } from "../components/ownagent/GuardPanel";
import { RagPanel } from "../components/ownagent/RagPanel";
import { SkillPlatformPanel } from "../components/ownagent/SkillPlatformPanel";
import { TracePanel } from "../components/ownagent/TracePanel";

type TabId = "product" | "theory";
type ViewId = "chat" | "skills" | "rag" | "guard" | "trace" | "eval";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "chat", label: "对话" },
  { id: "skills", label: "技能" },
  { id: "rag", label: "知识" },
  { id: "guard", label: "能力锁" },
  { id: "trace", label: "追踪" },
  { id: "eval", label: "评测" },
];

function resolveTab(tab: string | null, panel: string | null): TabId {
  if (tab === "theory" || panel === "arch") return "theory";
  if (tab === "product") return "product";
  if (panel && panel !== "arch") return "product";
  return "product";
}

function resolveView(panel: string | null, view: string | null): ViewId {
  const raw = view || panel;
  if (raw === "skills" || raw === "codrive") return "skills";
  if (VIEWS.some((v) => v.id === raw)) return raw as ViewId;
  return "chat";
}

/** OwnAgent 产品工作台 */
export function WorkOwnAgent() {
  const [params, setParams] = useSearchParams();
  const tab = resolveTab(params.get("tab"), params.get("panel"));
  const view = resolveView(params.get("panel"), params.get("view"));

  function go(nextTab: TabId, nextView?: ViewId) {
    const next = new URLSearchParams();
    next.set("tab", nextTab);
    if (nextTab === "product") next.set("view", nextView ?? view);
    const trySkill = params.get("try") ?? params.get("skill");
    if (trySkill) next.set("try", trySkill);
    setParams(next, { replace: true });
  }

  useEffect(() => {
    function onGo(ev: Event) {
      const detail = (ev as CustomEvent<{ view?: ViewId; tab?: TabId }>).detail ?? {};
      if (detail.tab === "theory") go("theory");
      else if (detail.view) go("product", detail.view);
    }
    window.addEventListener("ownagent:go", onGo);
    return () => window.removeEventListener("ownagent:go", onGo);
  }, [view]);

  return (
    <div className={`own-app ${tab}${view === "chat" && tab === "product" ? " chat-focus" : ""}`}>
      <header className="own-app-bar">
        <div className="own-app-brand">
          <strong>OwnAgent</strong>
        </div>
        <nav className="own-app-tabs" aria-label="OwnAgent">
          <button type="button" className={tab === "product" ? "on" : ""} onClick={() => go("product")}>
            产品
          </button>
          <button type="button" className={tab === "theory" ? "on" : ""} onClick={() => go("theory")}>
            理论
          </button>
        </nav>
        <div className="own-app-actions">
          <BackendStatusBar compact quiet />
          <button type="button" className="own-cmd" onClick={() => window.dispatchEvent(new Event("ownagent:palette"))}>
            命令
          </button>
          <Link to="/" className="own-exit">
            退出
          </Link>
        </div>
      </header>

      {tab === "theory" ? (
        <div className="own-theory">
          <AgentHubOverview />
        </div>
      ) : (
        <>
          <aside className="own-app-side">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className={view === v.id ? "on" : ""} onClick={() => go("product", v.id)}>
                {v.label}
              </button>
            ))}
          </aside>
          <div className={`own-app-stage${view === "chat" ? " is-chat" : ""}`}>
            {view === "chat" ? <AgentProductDemo hubMode /> : null}
            {view === "skills" ? <SkillPlatformPanel /> : null}
            {view === "rag" ? <RagPanel /> : null}
            {view === "guard" ? <GuardPanel /> : null}
            {view === "trace" ? <TracePanel /> : null}
            {view === "eval" ? <EvalLabPanel /> : null}
          </div>
        </>
      )}
    </div>
  );
}
