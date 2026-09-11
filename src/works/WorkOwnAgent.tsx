import { useSearchParams } from "react-router-dom";
import { BackendStatusBar } from "../components/BackendStatusBar";
import { AgentHubOverview } from "../components/agent/AgentHubOverview";
import { AgentProductDemo } from "../components/fx/AgentProductDemo";
import { EvalLabPanel } from "../components/fx/EvalLabPanel";
import { RagPanel } from "../components/ownagent/RagPanel";
import { SkillRoutePanel } from "../components/ownagent/SkillRoutePanel";
import { TracePanel } from "../components/ownagent/TracePanel";

type PanelId = "chat" | "trace" | "rag" | "skills" | "eval" | "arch";

const PANELS: { id: PanelId; label: string; hint: string }[] = [
  { id: "chat", label: "对话", hint: "流式回复 + 工具调用" },
  { id: "trace", label: "运行追踪", hint: "每步耗时 · 状态 · payload" },
  { id: "rag", label: "知识检索", hint: "分块召回 · chunkId 溯源" },
  { id: "skills", label: "技能路由", hint: "trigger 打分 · Top-1" },
  { id: "eval", label: "回归评测", hint: "路由用例 · 工具指标" },
  { id: "arch", label: "能力全景", hint: "整条链路流程图" },
];

const CAPS = [
  { k: "Agent Loop", v: "流式解析 · tool_call 累积 · 最多 8 轮迭代" },
  { k: "MCP Server", v: "进程内 JSON-RPC 2.0 · Schema 校验" },
  { k: "RAG", v: "文档分块 · 混合打分 · chunkId 引用" },
  { k: "Skills", v: "SKILL.md manifest · trigger 加权路由" },
  { k: "可观测", v: "TraceSpan 时间线 · 本地历史" },
  { k: "双运行时", v: "SQLite 优先 · 失败降级浏览器内" },
];

function isPanel(v: string | null): v is PanelId {
  return PANELS.some((p) => p.id === v);
}

/** OwnAgent — 浏览器内 AI Agent 平台（统一入口） */
export function WorkOwnAgent() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("panel");
  const active: PanelId = isPanel(raw) ? raw : "chat";
  const current = PANELS.find((p) => p.id === active)!;

  function select(id: PanelId) {
    const next = new URLSearchParams(params);
    next.set("panel", id);
    setParams(next, { replace: true });
  }

  return (
    <div className="own-agent">
      <header className="own-hero">
        <div className="own-hero-main">
          <p className="own-eyebrow">个人项目 · 独立设计与开发</p>
          <h1>OwnAgent</h1>
          <p className="own-tagline">
            跑在浏览器里的 AI Agent 平台。
            <strong>听懂问题 → 选技能 → 调工具 → 流式作答</strong>
            ，整条链路可追踪、可回归测试，打开就能用，不需要 API Key。
          </p>
          <BackendStatusBar compact />
        </div>
        <ul className="own-caps">
          {CAPS.map((c) => (
            <li key={c.k}>
              <strong>{c.k}</strong>
              <span>{c.v}</span>
            </li>
          ))}
        </ul>
      </header>

      <nav className="own-tabs" aria-label="OwnAgent 模块">
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

      <section className="own-stage" aria-label={current.label}>
        {active === "chat" ? <AgentProductDemo /> : null}
        {active === "trace" ? <TracePanel /> : null}
        {active === "rag" ? <RagPanel /> : null}
        {active === "skills" ? <SkillRoutePanel /> : null}
        {active === "eval" ? (
          <div className="own-panel">
            <p className="own-panel-lead">
              固定用例跑一遍<strong>技能路由</strong>，看命中率和失败样本；再跑工具 benchmark 看真实耗时。
            </p>
            <EvalLabPanel />
          </div>
        ) : null}
        {active === "arch" ? (
          <div className="own-panel agent-hub">
            <p className="own-panel-lead">
              一句话从进来到答完，中间经过哪些层。点节点看这一步做了什么，右下角可以直接对话。
            </p>
            <AgentHubOverview />
          </div>
        ) : null}
      </section>
    </div>
  );
}
