import type { ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { KnowledgeFeed } from "../fx/agent/KnowledgeFeed";
import { EvalLabPanel } from "../fx/EvalLabPanel";
import { CaseManagementPanel } from "./CaseManagementPanel";
import { ConnectPanel } from "./ConnectPanel";
import { EvalOpsPanel } from "./EvalOpsPanel";
import { GuardPanel } from "./GuardPanel";
import { McpToolsPanel } from "./McpToolsPanel";
import { PromptTemplatePanel } from "./PromptTemplatePanel";
import { RagPanel } from "./RagPanel";
import { SkillComparePanel } from "./SkillComparePanel";
import { EditVersionPage } from "./EditVersionPage";
import { SaveVersionPage } from "./SaveVersionPage";
import { VersionsHub } from "./VersionsHub";
import { VersionsPage } from "./VersionsPage";
import { SkillPlatformPanel } from "./SkillPlatformPanel";
import { TracePanel } from "./TracePanel";

type LineId = "talk" | "materials" | "skill" | "rules";

const MATERIALS = new Set(["rag", "prompts", "feed"]);
const SKILL = new Set(["compare", "versions", "savever", "drafts", "editset", "cases", "fork", "mcp", "eval", "evalops", "trace", "skills"]);
const RULES = new Set(["guard", "connect"]);

export function lineOf(view: string): "talk" | "materials" | "skill" | "rules" | null {
  if (view === "chat") return "talk";
  if (MATERIALS.has(view)) return "materials";
  if (SKILL.has(view)) return "skill";
  if (RULES.has(view)) return "rules";
  return null;
}

function Stations({
  items,
  current,
  onPick,
}: {
  items: { id: string; label: string }[];
  current: string;
  onPick: (id: string) => void;
}) {
  return (
    <nav className="oa-line-stations" aria-label="这一条上的步骤">
      {items.map((item, i) => (
        <button key={item.id} type="button" className={item.id === current ? "on" : ""} onClick={() => onPick(item.id)}>
          <span>{i + 1}</span>
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function LineFrame({
  title,
  desc,
  stations,
  current,
  onPick,
  children,
}: {
  title: string;
  desc: string;
  stations: { id: string; label: string }[];
  current: string;
  onPick: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="oa-ui oa-page oa-main-line">
      <header className="oa-main-line-head">
        <h1>{title}</h1>
        <p>{desc}</p>
      </header>
      <Stations items={stations} current={current} onPick={onPick} />
      {children}
    </div>
  );
}

export function MaterialsLine({ view, onPick }: { view: string; onPick: (id: string) => void }) {
  const current = MATERIALS.has(view) ? view : "rag";
  return (
    <LineFrame
      title="材料"
      desc="资料库、提示词、知识广场都是回答时用的内容，在这一条里切换。"
      current={current}
      onPick={onPick}
      stations={[
        { id: "rag", label: "资料库" },
        { id: "prompts", label: "提示词" },
        { id: "feed", label: "知识广场" },
      ]}
    >
      {current === "rag" ? <RagPanel /> : null}
      {current === "prompts" ? <PromptTemplatePanel /> : null}
      {current === "feed" ? (
        <KnowledgeFeed
          onAskNew={(q) => {
            if (q) sessionStorage.setItem("oa-pending-ask", q);
            onPick("chat");
          }}
        />
      ) : null}
    </LineFrame>
  );
}

const VERSION_VIEWS = new Set(["versions", "savever", "drafts", "editset"]);

function SkillSectionTabs({ current, onPick }: { current: "skill" | "version"; onPick: (id: string) => void }) {
  return (
    <nav className="oa-tabs oa-skill-section-tabs" aria-label="技能和版本">
      <button type="button" className={current === "skill" ? "on" : ""} onClick={() => onPick("compare")}>技能</button>
      <button type="button" className={current === "version" ? "on" : ""} onClick={() => onPick("versions")}>版本</button>
    </nav>
  );
}

export function SkillLine({ view, onPick }: { view: string; onPick: (id: string) => void }) {
  const [params] = useSearchParams();
  if (view === "compare" || VERSION_VIEWS.has(view)) {
    return (
      <div className="oa-skill-home">
        <div className="oa-skill-section">
          <SkillSectionTabs current={view === "compare" ? "skill" : "version"} onPick={onPick} />
        </div>
        {view === "compare" ? <SkillComparePanel /> : null}
        {view === "versions" && params.get("set") ? <VersionsPage /> : null}
        {view === "versions" && !params.get("set") ? <VersionsHub /> : null}
        {view === "drafts" ? <VersionsHub pane="drafts" /> : null}
        {view === "savever" ? <SaveVersionPage /> : null}
        {view === "editset" ? <EditVersionPage /> : null}
      </div>
    );
  }
  return (
    <div className="oa-ui oa-page">
      <button type="button" className="own-skill-ver-back" onClick={() => onPick("compare")}>← 回到技能</button>
      {view === "cases" || view === "fork" ? <CaseManagementPanel /> : null}
      {view === "mcp" ? <McpToolsPanel /> : null}
      {view === "eval" ? <EvalLabPanel /> : null}
      {view === "evalops" ? <EvalOpsPanel /> : null}
      {view === "trace" || view === "skills" ? (
        <>
          <TracePanel />
          <SkillPlatformPanel />
        </>
      ) : null}
    </div>
  );
}

export function RulesLine({ view, onPick }: { view: string; onPick: (id: string) => void }) {
  const current = view === "connect" ? "connect" : "guard";
  return (
    <LineFrame
      title="规则和接入"
      desc="回答规则决定能答什么。接入配置决定模型怎么接上，工具也在这里试。"
      current={current}
      onPick={onPick}
      stations={[
        { id: "guard", label: "回答规则" },
        { id: "connect", label: "接入配置" },
      ]}
    >
      {current === "guard" ? <GuardPanel /> : null}
      {current === "connect" ? <ConnectPanel /> : null}
    </LineFrame>
  );
}
