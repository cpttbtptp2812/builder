import { useEffect, useMemo, useState } from "react";
import { AGENT_SKILLS, getSkill, runSkill, type SkillStep } from "../../lib/agentSkills";

export type OrchTab = "dsl" | "manage" | "pattern";
type Mode = "seq" | "par" | "branch";
type Job = { id: string; skillId: string; mode: Mode; status: "queued" | "running" | "done" | "fail" };

const MODE_HINT: Record<Mode, string> = {
  seq: "一步做完再下一步",
  par: "前两步同时发，最后汇总",
  branch: "探活成功才 snapshot，失败走重试",
};

export function FlowOrchestrator({ initialTab = "dsl" }: { initialTab?: OrchTab }) {
  const [tab, setTab] = useState<OrchTab>(initialTab);
  const [skillId, setSkillId] = useState(AGENT_SKILLS[0]!.id);
  const skill = getSkill(skillId) ?? AGENT_SKILLS[0]!;
  const [steps, setSteps] = useState<SkillStep[]>(skill.steps);
  const [mode, setMode] = useState<Mode>("seq");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cursor, setCursor] = useState(-1);
  const [active, setActive] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSteps((getSkill(skillId) ?? AGENT_SKILLS[0]!).steps);
    setCursor(-1);
    setActive([]);
  }, [skillId]);

  const order = useMemo(() => {
    if (mode === "par" && steps.length >= 3) {
      return { waves: [[steps[0]!, steps[1]!], steps.slice(2)] };
    }
    if (mode === "branch" && steps.length >= 2) {
      return { waves: [[steps[0]!], [steps[1]!], steps.slice(2)] };
    }
    return { waves: steps.map((s) => [s]) };
  }, [mode, steps]);

  function move(id: string, dir: -1 | 1) {
    setSteps((curr) => {
      const i = curr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= curr.length) return curr;
      const next = [...curr];
      const a = next[i]!;
      next[i] = next[j]!;
      next[j] = a;
      return next;
    });
  }

  function drop(id: string) {
    setSteps((curr) => (curr.length <= 1 ? curr : curr.filter((s) => s.id !== id)));
  }

  function addStep() {
    const n = steps.length + 1;
    setSteps((curr) => [...curr, { id: `extra-${n}`, label: "knowledge_search", tool: "knowledge_search", args: { query: skill.name, topK: 2 } }]);
  }

  async function run() {
    if (running) return;
    const job: Job = { id: `wf_${Date.now().toString(36)}`, skillId: skill.id, mode, status: "running" };
    setJobs((prev) => [job, ...prev]);
    setRunning(true);
    setLog([]);
    setCursor(-1);
    try {
      let waveIndex = 0;
      for (const wave of order.waves) {
        setActive(wave.map((s) => s.id));
        setCursor(waveIndex);
        await new Promise((r) => window.setTimeout(r, mode === "par" ? 280 : 160));
        waveIndex += 1;
      }
      const { trace } = await runSkill(skill, skill.description, (row) => {
        setLog((prev) => [...prev, `${row.ok ? "ok" : "fail"} ${row.tool} ${row.ms}ms`]);
      }, { snapshotRoot: document.body });
      const ok = trace.every((t) => t.ok);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: ok ? "done" : "fail" } : j)));
    } catch (err) {
      setLog((prev) => [...prev, err instanceof Error ? err.message : "run failed"]);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "fail" } : j)));
    } finally {
      setActive([]);
      setRunning(false);
    }
  }

  return (
    <div className="orch-lab">
      <nav className="orch-tabs" aria-label="流程编排">
        {([
          ["dsl", "流程定义"],
          ["manage", "流程管理"],
          ["pattern", "执行模式"],
        ] as const).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "on" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="orch-toolbar">
        <label>
          Skill
          <select value={skillId} onChange={(e) => setSkillId(e.target.value)}>
            {AGENT_SKILLS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          调度
          <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            <option value="seq">顺序 seq</option>
            <option value="par">并行 par</option>
            <option value="branch">分叉 branch</option>
          </select>
        </label>
        <button type="button" className="orch-run" onClick={() => void run()} disabled={running}>
          {running ? "执行中…" : "执行这条流程"}
        </button>
      </div>
      <p className="orch-hint">{MODE_HINT[mode]} · {skill.skillPath}</p>

      {tab === "dsl" && (
        <div className="orch-dsl">
          <dl className="agent-step-dl">
            <div>
              <dt>triggers</dt>
              <dd>{skill.triggers.join(" · ")}</dd>
            </div>
            <div>
              <dt>tools 白名单</dt>
              <dd>{skill.tools.join(" · ")}</dd>
            </div>
          </dl>
          <ol className="orch-steps">
            {steps.map((s, i) => (
              <li key={s.id} className={active.includes(s.id) ? "on" : ""}>
                <em>{i + 1}</em>
                <code>{s.tool}</code>
                <span>{s.label}</span>
                <div className="orch-step-ops">
                  <button type="button" onClick={() => move(s.id, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button type="button" onClick={() => move(s.id, 1)} disabled={i === steps.length - 1}>
                    ↓
                  </button>
                  <button type="button" onClick={() => drop(s.id)}>
                    删
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="orch-add" onClick={addStep}>
            + 加一步 knowledge_search
          </button>
        </div>
      )}

      {tab === "pattern" && (
        <div className="orch-graph" data-mode={mode}>
          {order.waves.map((wave, i) => (
            <div key={i} className="orch-wave">
              {wave.map((s) => (
                <div key={s.id} className={`orch-node${active.includes(s.id) || cursor === i ? " on" : ""}`}>
                  <code>{s.tool}</code>
                  <span>{s.label}</span>
                </div>
              ))}
              {i < order.waves.length - 1 && <em>{mode === "par" && i === 0 ? "∥" : "→"}</em>}
            </div>
          ))}
        </div>
      )}

      {tab === "manage" && (
        <table className="agent-step-table">
          <thead>
            <tr>
              <th>workflowId</th>
              <th>skill@pin</th>
              <th>mode</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={4}>还没有工单。点「执行这条流程」会入队并跑一遍。</td>
              </tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id} className={j.status === "done" ? "is-ok" : j.status === "fail" ? "is-fail" : ""}>
                <td>
                  <code>{j.id}</code>
                </td>
                <td>{j.skillId}@local</td>
                <td>{j.mode}</td>
                <td>{j.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {log.length > 0 && (
        <ol className="orch-log">
          {log.map((line, i) => (
            <li key={`${line}-${i}`}>{line}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
