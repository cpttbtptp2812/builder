import { useEffect, useRef, useState } from "react";
import type { ShiftOptimizeReport, ShiftPlanMetrics } from "../../lib/shiftMilpTypes";
import { downloadText, labFetch, requirementsOf, useLabSession, type LabResult } from "./labApi";
import { gridToCsv } from "../../lib/productDataStore";

const METRICS: { key: keyof ShiftPlanMetrics; label: string; better: "low" | "high" }[] = [
  { key: "filled", label: "排上的班", better: "high" },
  { key: "unfilled", label: "空着的班", better: "low" },
  { key: "keyholderMisses", label: "缺钥匙人的班", better: "low" },
  { key: "violations", label: "违反用工规则", better: "low" },
  { key: "spread", label: "工时差（最多−最少）", better: "low" },
  { key: "cost", label: "人工成本", better: "low" },
];

function cmp(a: number | null | string | string[], b: number | null | string | string[], better: "low" | "high") {
  if (typeof a !== "number" || typeof b !== "number" || a === b) return "";
  return (better === "low" ? b < a : b > a) ? "is-better" : "is-worse";
}

export function ShiftOptimizerPanel() {
  const lab = useLabSession();
  const missing = requirementsOf("shift-desk").filter((r) => !lab.has(r.slot));
  const solve = () =>
    !lab.sessionId || missing.length
      ? Promise.resolve<LabResult<ShiftOptimizeReport>>({ ok: false, error: `先导入：${missing.map((m) => m.label).join("、")}` })
      : labFetch<ShiftOptimizeReport>("/api/lab/shift-optimize", { sessionId: lab.sessionId });

  return (
    <section className="pl-panel">
      <header className="pl-panel-head">
        <div>
          <h2>最优排班</h2>
          <p>把排班写成 0-1 整数规划交给 HiGHS：先尽量排满，再保证每班有钥匙人，再拉平工时、压成本，每一层都带最优性证明。排不满时求最少要放宽哪几条。</p>
        </div>
      </header>
      {missing.length ? <p className="pl-hint">需要导入：{requirementsOf("shift-desk").map((r) => `${r.label}${lab.has(r.slot) ? " ✓" : ""}`).join("、")}</p> : null}
      <ShiftOptimizer solve={solve} />
    </section>
  );
}

/** 对同一批材料求整数规划最优排班，并和技能原来的逐班贪心结果逐格对比 */
export function ShiftOptimizer({ solve, autoRun }: { solve: () => Promise<LabResult<ShiftOptimizeReport>>; autoRun?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ShiftOptimizeReport | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(true);
  const [showLp, setShowLp] = useState(false);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await solve();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setReport(r.data);
  }
  const started = useRef(false);
  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      void run();
    }
  });

  const m = report?.matrix;
  const people = m ? (onlyDiff ? m.people.filter((p) => m.days.some((d) => { const c = m.cells[`${p}|${d.day}`]; return c && c.greedy !== c.optimal; })) : m.people) : [];

  return (
    <>
      <div className="pl-actions">
        <button type="button" className="pl-btn pl-btn--primary" disabled={busy} onClick={() => void run()}>
          {busy ? "求解中…" : report ? "重新求解" : "求最优解"}
        </button>
      </div>
      {error ? <p className="pl-error">{error}</p> : null}
      {report ? (
        <>
          <div className="pl-solves">
            {report.stages.map((s, i) => (
              <div key={i} className={`pl-solve${s.proved ? " is-proved" : ""}`}>
                <small>第 {i + 1} 层</small>
                <b>{s.name}</b>
                <span>{s.objective ?? "—"}</span>
                <em>
                  {s.proved ? "已证最优" : s.status}
                  {s.gap != null && !s.proved ? ` · gap ${(s.gap * 100).toFixed(2)}%` : ""} · {s.ms} ms
                </em>
              </div>
            ))}
            <div className="pl-solve is-meta">
              <small>{report.solver.name} {report.solver.version}</small>
              <b>
                {report.solver.vars} 变量 · {report.solver.rows} 约束
              </b>
              <em>共 {report.solver.ms} ms</em>
            </div>
          </div>

          {report.greedy && report.optimal ? (
            <table className="pl-compare">
              <thead>
                <tr>
                  <th />
                  <th>原技能（逐班贪心）</th>
                  <th>整数规划最优解</th>
                </tr>
              </thead>
              <tbody>
                {METRICS.map((x) => (
                  <tr key={x.key}>
                    <th>{x.label}</th>
                    <td>{String(report.greedy![x.key] ?? "—")}</td>
                    <td className={cmp(report.greedy![x.key], report.optimal![x.key], x.better)}>{String(report.optimal![x.key] ?? "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}

          {m && m.people.length ? (
            <div className="pl-matrix-wrap">
              <div className="pl-matrix-head">
                <strong>两种解有 {report.changedCells} 个格子不同</strong>
                <label>
                  <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> 只看有变化的人
                </label>
              </div>
              <div className="pl-matrix" style={{ gridTemplateColumns: `8em repeat(${m.days.length}, minmax(6.5em, 1fr))` }}>
                <span />
                {m.days.map((d) => (
                  <span key={d.day} className="pl-matrix-day">
                    {d.label}
                  </span>
                ))}
                {people.map((p) => (
                  <Row key={p} person={p} days={m.days} cells={m.cells} />
                ))}
              </div>
            </div>
          ) : null}

          {report.relax ? (
            <div className={`pl-relax is-${report.relax.status}`}>
              <h3>
                {report.relax.status === "full" ? "全部班次都能排上" : report.relax.status === "relaxed" ? `最少放宽 ${report.relax.items.length} 处就能排满` : "怎么放宽都排不满"}
                {report.relax.proved ? <em>已证最少</em> : null}
              </h3>
              <p>{report.relax.note}</p>
              {report.relax.items.length ? (
                <ul>
                  {report.relax.items.map((it) => (
                    <li key={it.id}>
                      <b>{it.kind}</b> {it.label}
                      {it.enables.length ? <small>能补上：{it.enables.join("、")}</small> : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="pl-actions">
            {report.roster ? (
              <button type="button" className="pl-btn" onClick={() => downloadText("最优排班表.csv", gridToCsv(report.roster!.columns, report.roster!.rows), "text/csv;charset=utf-8")}>
                下载最优排班表
              </button>
            ) : null}
            <button type="button" className="pl-btn pl-btn--ghost" onClick={() => setShowLp((v) => !v)}>
              {showLp ? "收起模型" : "看 LP 模型"}
            </button>
          </div>
          {showLp ? <pre className="pl-code">{report.lp}</pre> : null}
        </>
      ) : null}
    </>
  );
}

function Row({ person, days, cells }: { person: string; days: { day: number; label: string }[]; cells: Record<string, { greedy: string; optimal: string }> }) {
  return (
    <>
      <span className="pl-matrix-person">{person}</span>
      {days.map((d) => {
        const c = cells[`${person}|${d.day}`];
        const changed = c && c.greedy !== c.optimal;
        return (
          <span key={d.day} className={`pl-cell${changed ? " is-changed" : ""}${c?.optimal ? " is-on" : ""}`} title={c ? `贪心：${c.greedy || "休"}\n最优：${c.optimal || "休"}` : "休"}>
            {changed && c.greedy ? <s>{c.greedy}</s> : null}
            {c?.optimal || (changed ? "休" : "")}
          </span>
        );
      })}
    </>
  );
}
