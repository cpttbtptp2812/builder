import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AGENT_SKILLS,
  ROUTER_EXAMPLES,
  SKILL_ROUTER_DOC,
  explainDiscovery,
  getSkill,
  runSkill,
  type AgentSkill,
  type SkillDiscoveryRow,
  type SkillResult,
  type SkillTraceStep,
} from "../../lib/agentSkills";
import { McpBridgeDemo } from "./McpBridgeDemo";

type LabTab = "router" | (typeof AGENT_SKILLS)[number]["id"] | "mcp";

const SKILL_LABELS: Record<string, string> = {
  "site-analyzer": "Site Audit",
  "dom-probe": "DOM Probe",
  "workflow-orchestrator": "Workflow",
};

function MetricCard({ label, value, unit, tone = "neutral" }: { label: string; value: string | number | null | undefined; unit?: string; tone?: "ok" | "fail" | "neutral" }) {
  return (
    <div className={`skill-metric ${tone}`}>
      <span className="skill-metric-label">{label}</span>
      <strong className="skill-metric-value">
        {value ?? "—"}
        {unit && value != null ? <em>{unit}</em> : null}
      </strong>
    </div>
  );
}

function PipelineTrace({ trace, expanded, onToggle }: { trace: SkillTraceStep[]; expanded: string | null; onToggle: (id: string | null) => void }) {
  if (trace.length === 0) return null;
  return (
    <ol className="skill-pipeline-trace">
      {trace.map((s, i) => (
        <li key={s.stepId} className={s.ok ? "ok" : "fail"}>
          <button type="button" className="skill-pipeline-head" onClick={() => onToggle(expanded === s.stepId ? null : s.stepId)}>
            <span className="skill-pipeline-idx">{String(i + 1).padStart(2, "0")}</span>
            <code>{s.tool}</code>
            <span className="skill-pipeline-label">{s.label}</span>
            <span className="skill-pipeline-ms">{s.ms}ms</span>
            <span className="skill-pipeline-chevron">{expanded === s.stepId ? "▾" : "▸"}</span>
          </button>
          {expanded === s.stepId && s.result != null && (
            <pre className="skill-pipeline-json">{JSON.stringify(s.result, null, 2)}</pre>
          )}
        </li>
      ))}
    </ol>
  );
}

function SiteAuditDashboard({ dashboard }: { dashboard: Record<string, unknown> }) {
  const http = dashboard.http as { status?: number; latencyMs?: number; ok?: boolean; url?: string } | undefined;
  const dom = dashboard.dom as { a11yNodes?: number } | undefined;
  const perf = dashboard.perf as {
    ttfbMs?: number | null;
    domContentLoadedMs?: number | null;
    loadMs?: number | null;
    resourceCount?: number;
    memoryMb?: number | null;
  } | undefined;

  return (
    <div className="skill-dashboard skill-dashboard--audit">
      <div className="skill-dashboard-section">
        <header>
          <strong>http_probe</strong>
          <span>真实 fetch HEAD</span>
        </header>
        <div className="skill-metric-grid">
          <MetricCard label="Status" value={http?.status} tone={http?.ok ? "ok" : "fail"} />
          <MetricCard label="Latency" value={http?.latencyMs} unit="ms" tone={http?.latencyMs != null && http.latencyMs < 400 ? "ok" : "neutral"} />
          <MetricCard label="Target" value={http?.url ? new URL(http.url).pathname : "—"} />
        </div>
      </div>
      <div className="skill-dashboard-section">
        <header>
          <strong>Performance API</strong>
          <span>Navigation Timing · 浏览器原生</span>
        </header>
        <div className="skill-metric-grid cols-4">
          <MetricCard label="TTFB" value={perf?.ttfbMs} unit="ms" />
          <MetricCard label="DCL" value={perf?.domContentLoadedMs} unit="ms" />
          <MetricCard label="Load" value={perf?.loadMs} unit="ms" />
          <MetricCard label="Resources" value={perf?.resourceCount} />
          {perf?.memoryMb != null && <MetricCard label="JS Heap" value={perf.memoryMb} unit="MB" />}
        </div>
      </div>
      <div className="skill-dashboard-section">
        <header>
          <strong>browser_snapshot</strong>
          <span>a11y tree 节点数</span>
        </header>
        <MetricCard label="A11y Nodes" value={dom?.a11yNodes} />
      </div>
    </div>
  );
}

function DomProbeDashboard({ dashboard }: { dashboard: Record<string, unknown> }) {
  const probe = dashboard.domProbe as {
    totalNodes?: number;
    byRole?: Record<string, number>;
    interactive?: number;
    density?: number;
    sample?: { role: string; name: string; tag: string }[];
  } | undefined;

  const roles = Object.entries(probe?.byRole ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="skill-dashboard skill-dashboard--dom">
      <div className="skill-metric-grid cols-3">
        <MetricCard label="Total Nodes" value={probe?.totalNodes} />
        <MetricCard label="Interactive" value={probe?.interactive} />
        <MetricCard label="Density" value={probe?.density != null ? `${probe.density}%` : null} />
      </div>
      {roles.length > 0 && (
        <div className="skill-role-bars">
          {roles.slice(0, 8).map(([role, count]) => (
            <div key={role} className="skill-role-bar">
              <span>{role}</span>
              <div className="skill-role-track">
                <i style={{ width: `${Math.min(100, (count / (probe?.totalNodes ?? 1)) * 100)}%` }} />
              </div>
              <em>{count}</em>
            </div>
          ))}
        </div>
      )}
      {probe?.sample && probe.sample.length > 0 && (
        <table className="skill-dom-sample">
          <thead>
            <tr>
              <th>role</th>
              <th>tag</th>
              <th>name</th>
            </tr>
          </thead>
          <tbody>
            {probe.sample.map((n, i) => (
              <tr key={i}>
                <td>
                  <code>{n.role}</code>
                </td>
                <td>{n.tag}</td>
                <td>{n.name || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="skill-dashboard-link">
        同源算法见 <Link to="/work/locator">Locator Lab</Link> — browser_snapshot → 定位策略
      </p>
    </div>
  );
}

function WorkflowDashboard({ dashboard, meta }: { dashboard: Record<string, unknown>; meta?: Record<string, unknown> }) {
  const wf = dashboard.workflow as { runId?: string; workflowId?: string; status?: string; replaySteps?: number } | undefined;
  const surface = dashboard.executionSurface as { interactiveNodes?: number } | undefined;

  return (
    <div className="skill-dashboard skill-dashboard--workflow">
      <div className="skill-metric-grid cols-3">
        <MetricCard label="runId" value={wf?.runId?.slice(0, 12)} />
        <MetricCard label="workflowId" value={wf?.workflowId} />
        <MetricCard label="Status" value={wf?.status} tone={wf?.status === "queued" ? "ok" : "neutral"} />
      </div>
      <div className="skill-metric-grid cols-2">
        <MetricCard label="Replay Steps" value={wf?.replaySteps} />
        <MetricCard label="Execution Surface" value={surface?.interactiveNodes} unit=" interactive" />
      </div>
      {meta?.sdkLab && (
        <p className="skill-dashboard-link">
          TaskQueue 上游见 <Link to={String(meta.sdkLab)}>SDK Lab</Link> — workflow_run 入队协议
        </p>
      )}
    </div>
  );
}

function SkillRuntimePanel({
  skill,
  snapshotRoot,
  autoRun = true,
}: {
  skill: AgentSkill;
  snapshotRoot: Element | null;
  autoRun?: boolean;
}) {
  const [trace, setTrace] = useState<SkillTraceStep[]>([]);
  const [result, setResult] = useState<SkillResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const execute = useCallback(async () => {
    setRunning(true);
    setTrace([]);
    setResult(null);
    setExpanded(null);
    const out = await runSkill(skill, skill.description, (step) => setTrace((prev) => [...prev, step]), {
      snapshotRoot,
    });
    setResult(out.result);
    setRunning(false);
    if (out.trace.length > 0) setExpanded(out.trace[out.trace.length - 1]!.stepId);
  }, [skill, snapshotRoot]);

  useEffect(() => {
    if (autoRun) void execute();
  }, [autoRun, execute]);

  const dashboard = result?.dashboard;

  return (
    <div className="skill-runtime-panel">
      <div className="skill-runtime-toolbar">
        <ul className="skill-plan-steps">
          {skill.plan.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <button type="button" className="skill-panel-primary" onClick={() => void execute()} disabled={running}>
          {running ? "Pipeline running…" : "Re-run pipeline"}
        </button>
      </div>

      {running && trace.length === 0 && <div className="skill-runtime-loading">MCP tools/call · 进程内 Server</div>}

      <PipelineTrace trace={trace} expanded={expanded} onToggle={setExpanded} />

      {dashboard && skill.id === "site-analyzer" && <SiteAuditDashboard dashboard={dashboard} />}
      {dashboard && skill.id === "dom-probe" && <DomProbeDashboard dashboard={dashboard} />}
      {dashboard && skill.id === "workflow-orchestrator" && (
        <WorkflowDashboard dashboard={dashboard} meta={result?.meta} />
      )}
    </div>
  );
}

function RouterLab({
  query,
  onQueryChange,
  onSelectSkill,
  selectedId,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  onSelectSkill: (id: string) => void;
  selectedId: string | null;
}) {
  const rows = useMemo(() => explainDiscovery(query), [query]);
  const winner = rows[0];

  return (
    <div className="skill-router-lab">
      <p className="skill-panel-lead">
        可见算法路由 — 不是黑盒 LLM。按 trigger 词长加权打分，<code>explainDiscovery()</code> 返回完整 breakdown。
      </p>
      <div className="skill-panel-row">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="输入意图触发词…"
          spellCheck={false}
        />
        <div className="skill-router-chips">
          {ROUTER_EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" onClick={() => onQueryChange(ex.query)}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <table className="skill-router-matrix">
        <thead>
          <tr>
            <th>Skill</th>
            <th>Score</th>
            <th>Trigger hits</th>
            <th>Breakdown</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <RouterRow
              key={row.skill.id}
              row={row}
              active={selectedId === row.skill.id}
              winner={winner?.score ? winner.skill.id === row.skill.id && row.score > 0 : false}
              onRun={() => onSelectSkill(row.skill.id)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RouterRow({
  row,
  active,
  winner,
  onRun,
}: {
  row: SkillDiscoveryRow;
  active: boolean;
  winner: boolean;
  onRun: () => void;
}) {
  return (
    <tr className={[active ? "on" : "", winner ? "winner" : ""].filter(Boolean).join(" ")}>
      <td>
        <code>{row.skill.name}</code>
      </td>
      <td>
        <strong>{row.score}</strong>
      </td>
      <td>{row.hits.length ? row.hits.join(", ") : "—"}</td>
      <td className="skill-router-breakdown">
        {row.breakdown.length === 0
          ? "—"
          : row.breakdown.map((b) => (
              <span key={b.trigger}>
                {b.trigger} <em>+{b.points}</em>
              </span>
            ))}
      </td>
      <td>
        <button type="button" className="skill-router-run" onClick={onRun} disabled={row.score === 0}>
          Run →
        </button>
      </td>
    </tr>
  );
}

/** SkillForge Runtime Lab — 路由矩阵 + MCP 流水线 + DevTools 面板 */
export function AgentSkillsDemo({ initialSkillId = null }: { initialSkillId?: string | null; trySkillId?: string | null }) {
  const [snapshotRoot, setSnapshotRoot] = useState<Element | null>(null);
  const [tab, setTab] = useState<LabTab>(() => {
    if (initialSkillId && getSkill(initialSkillId)) return initialSkillId as LabTab;
    return "router";
  });
  const [routerQuery, setRouterQuery] = useState(ROUTER_EXAMPLES[0]!.query);

  useEffect(() => {
    if (initialSkillId && getSkill(initialSkillId)) setTab(initialSkillId as LabTab);
  }, [initialSkillId]);

  const activeSkill = tab !== "router" && tab !== "mcp" ? getSkill(tab) : null;

  function selectSkill(id: string) {
    setTab(id as LabTab);
  }

  return (
    <div className="skill-runtime-lab" ref={(el) => setSnapshotRoot(el)}>
      <nav className="skill-workbench-tabs" aria-label="Runtime Lab">
        <button type="button" className={tab === "router" ? "on" : ""} onClick={() => setTab("router")}>
          ◈ Router Lab
        </button>
        {AGENT_SKILLS.map((s) => (
          <button key={s.id} type="button" className={tab === s.id ? "on" : ""} onClick={() => setTab(s.id)}>
            {SKILL_LABELS[s.id] ?? s.name}
          </button>
        ))}
        <button type="button" className={tab === "mcp" ? "on" : ""} onClick={() => setTab("mcp")}>
          MCP Console
        </button>
      </nav>

      <div className="skill-workbench-grid">
        <div className="skill-workbench-main">
          {tab === "router" && (
            <>
              <header className="skill-workbench-head">
                <div>
                  <code>skill-router</code>
                  <h3>Trigger 加权路由 · explainDiscovery()</h3>
                </div>
              </header>
              <RouterLab
                query={routerQuery}
                onQueryChange={setRouterQuery}
                onSelectSkill={selectSkill}
                selectedId={activeSkill?.id ?? null}
              />
            </>
          )}

          {activeSkill && (
            <>
              <header className="skill-workbench-head">
                <div>
                  <code>{activeSkill.name}</code>
                  <h3>{activeSkill.description}</h3>
                </div>
                <span className="skill-md-path">{activeSkill.skillPath}</span>
              </header>
              <SkillRuntimePanel skill={activeSkill} snapshotRoot={snapshotRoot} autoRun={tab === activeSkill.id} />
            </>
          )}

          {tab === "mcp" && (
            <>
              <header className="skill-workbench-head">
                <div>
                  <code>tools/call</code>
                  <h3>JSON-RPC 2.0 · 与 UniAgent 同一套 MCP Server</h3>
                </div>
              </header>
              <div className="skill-mcp-embed">
                <McpBridgeDemo />
              </div>
            </>
          )}
        </div>

        <aside className="skill-workbench-aside">
          <section className="skill-forge-panel skill-forge-manifest">
            <header>
              <strong>SKILL.md</strong>
              <span>{tab === "router" ? "src/skills/skill-router/" : activeSkill?.skillPath ?? "MCP Bridge"}</span>
            </header>
            <pre className="skill-manifest-pre">
              {tab === "router" ? SKILL_ROUTER_DOC : activeSkill?.manifest ?? "// MCP tools/list + tools/call"}
            </pre>
          </section>
          {activeSkill && (
            <section className="skill-forge-panel">
              <header>
                <strong>Pipeline</strong>
                <span>MCP + 内部 compose 步骤</span>
              </header>
              <ul className="skill-tool-list">
                {activeSkill.steps.map((s) => (
                  <li key={s.id}>
                    <code>{s.tool}</code>
                    <span>{s.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
