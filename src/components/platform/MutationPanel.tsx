import { useState } from "react";
import { getTeamToken } from "../../lib/apiClient";
import type { SkillTraceCase } from "../../lib/provingGround";
import { LAB_SKILLS, labFetch, type LabSkillId } from "./labApi";

type Verdict = "PASS" | "WARN" | "BLOCK";
type Mutant = { id: string; kind: string; kindLabel: string; label: string; status: "killed" | "survived" | "equivalent"; gate: Verdict; reason: string; killedBySuggestion: string | null };
type MutationReport = {
  skillId: string;
  version: string;
  selfGate: Verdict;
  cases: { id: string; query: string; observed: number; stopAt: string | null }[];
  mutants: Mutant[];
  score: { killed: number; survived: number; equivalent: number; pct: number };
  byKind: { kind: string; label: string; killed: number; total: number }[];
  suggestions: { case: SkillTraceCase; why: string; csv: string | null; kills: string[] }[];
  after: { killed: number; total: number; pct: number } | null;
  ms: number;
};

const STATUS: Record<Mutant["status"], string> = { killed: "被门闩拦下", survived: "漏过了门闩", equivalent: "行为没变" };

export function MutationPanel() {
  const [skill, setSkill] = useState<LabSkillId>("ledger-desk");
  return (
    <section className="pl-panel">
      <header className="pl-panel-head">
        <div>
          <h2>变异测试</h2>
          <p>故意把技能改坏——调参数、删一步、换顺序、换工具——看发布门闩能不能拦住。漏过去的坏版本说明测试不够，再让求解器补出能拦住它们的测试材料。</p>
        </div>
        <div className="pl-actions">
          <div className="pl-seg">
            {LAB_SKILLS.map((s) => (
              <button key={s.id} type="button" className={skill === s.id ? "is-on" : ""} onClick={() => setSkill(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </header>
      <MutationSuite key={skill} skillId={skill} />
    </section>
  );
}

/** 对一份技能原文（不给就用线上版）跑变异测试；草稿还没发也能测检查集够不够严 */
export function MutationSuite({ skillId, raw }: { skillId: string; raw?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MutationReport | null>(null);
  const [adopted, setAdopted] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setAdopted(null);
    setReport(null);
    const r = await labFetch<MutationReport>("/api/lab/mutation", { skillId, ...(raw ? { raw } : {}) });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setReport(r.data);
  }

  async function adopt() {
    if (!report) return;
    const r = await labFetch<{ added: number; total: number }>("/api/lab/mutation/adopt", { skillId: report.skillId, cases: report.suggestions.map((s) => s.case) });
    if (!r.ok) return setError(r.error);
    setAdopted(`已把 ${r.data.added} 条测试加入发布门闩（现在共 ${r.data.total} 条）`);
  }

  const pct = report ? Math.round(report.score.pct) : 0;
  const afterPct = report?.after ? Math.round(report.after.pct) : null;

  return (
    <>
      <div className="pl-actions">
        <button type="button" className="pl-btn pl-btn--primary" disabled={busy} onClick={() => void run()}>
          {busy ? "逐个跑变异体…" : report ? "重新跑" : "跑变异测试"}
        </button>
      </div>
      {busy ? <p className="pl-hint">每个变异体都要过一遍真实门闩（真实执行对比），通常需要几十秒。</p> : null}
      {error ? <p className="pl-error">{error}</p> : null}
      {report ? (
        <>
          <div className="pl-score">
            <div className="pl-ring" style={{ ["--pct" as string]: `${pct}` }}>
              <b>{pct}%</b>
              <small>拦截率</small>
            </div>
            {afterPct != null ? (
              <div className="pl-ring is-after" style={{ ["--pct" as string]: `${afterPct}` }}>
                <b>{afterPct}%</b>
                <small>补测试后</small>
              </div>
            ) : null}
            <dl>
              <dt>拦下</dt>
              <dd>{report.score.killed}</dd>
              <dt>漏过</dt>
              <dd className={report.score.survived ? "is-bad" : ""}>{report.score.survived}</dd>
              <dt>等价</dt>
              <dd>{report.score.equivalent}</dd>
              <dt>原版自检</dt>
              <dd>{report.selfGate}</dd>
              <dt>耗时</dt>
              <dd>{(report.ms / 1000).toFixed(1)} s</dd>
            </dl>
            <div className="pl-bykind">
              {report.byKind.map((k) => (
                <div key={k.kind}>
                  <span>{k.label}</span>
                  <i style={{ width: `${k.total ? (k.killed / k.total) * 100 : 0}%` }} />
                  <em>
                    {k.killed}/{k.total}
                  </em>
                </div>
              ))}
            </div>
          </div>

          <ul className="pl-mutants">
            {report.mutants.map((m) => (
              <li key={m.id} className={`is-${m.status}`}>
                <span className="pl-mutant-kind">{m.kindLabel}</span>
                <span className="pl-mutant-label">{m.label}</span>
                <span className="pl-mutant-status">
                  {STATUS[m.status]}
                  {m.status === "survived" && m.killedBySuggestion ? " → 补测试后能拦" : ""}
                </span>
                {m.reason ? <small>{m.reason}</small> : null}
              </li>
            ))}
          </ul>

          {report.suggestions.length ? (
            <div className="pl-sub">
              <h4>补出的测试（{report.suggestions.length} 条）</h4>
              <ul className="pl-suggest">
                {report.suggestions.map((s) => (
                  <li key={s.case.id}>
                    <b>{s.case.query}</b>
                    <span>{s.why}</span>
                    <small>能拦住：{s.kills.length} 个变异体</small>
                  </li>
                ))}
              </ul>
              <button type="button" className="pl-btn" onClick={() => void adopt()} disabled={!getTeamToken()}>
                {getTeamToken() ? "加入发布门闩" : "需要团队发布权限才能加入门闩"}
              </button>
              {adopted ? <p className="pl-hint">{adopted}</p> : null}
            </div>
          ) : report.score.survived ? (
            <p className="pl-note">有变异体漏过，但求解器没能补出能区分它们的测试材料。</p>
          ) : null}
        </>
      ) : null}
    </>
  );
}
