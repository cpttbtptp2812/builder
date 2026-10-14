import { useEffect, useRef, useState } from "react";
import { QUEUE_CODES, type CounterfactualReport, type LabRow, type RuleChange, type SynthExample, type SynthReport } from "../../lib/ledgerRuleModel";
import { downloadText, labFetch, useLabSession, type LabResult } from "./labApi";

type Draft = { gross: string; tax: string; invoice: string; expect: string; label: string };
const EMPTY: Draft = { gross: "", tax: "", invoice: "", expect: "", label: "" };

function Changes({ list }: { list: RuleChange[] }) {
  return (
    <ul className="pl-changes">
      {list.map((c) => (
        <li key={c.key}>
          <span>{c.label}</span>
          <s>{c.from}</s>
          <b>{c.to}</b>
        </li>
      ))}
    </ul>
  );
}

const rowText = (r: LabRow) => `${r.person}${r.dept ? `（${r.dept}）` : ""} · 金额 ${r.gross}${r.tax ? ` 税 ${r.tax}` : ""} · 发票 ${r.invoice ?? "缺"}`;

export function LedgerSolverPanel() {
  const lab = useLabSession();
  const [cf, setCf] = useState<CounterfactualReport | null>(null);
  const [cfBusy, setCfBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([{ ...EMPTY }]);
  const [synth, setSynth] = useState<SynthReport | null>(null);
  const [synthBusy, setSynthBusy] = useState(false);
  const hasLedger = lab.has("expense-ledger");

  async function runCf() {
    if (!lab.sessionId || !hasLedger) return setError("先在上方导入报销台账");
    setCfBusy(true);
    setError(null);
    const r = await labFetch<CounterfactualReport>("/api/lab/counterfactual", { sessionId: lab.sessionId, skillId: "ledger-desk" });
    setCfBusy(false);
    if (!r.ok) return setError(r.error);
    setCf(r.data);
  }

  function addRows(rows: LabRow[]) {
    setDrafts((d) => [
      ...d.filter((x) => x.gross || x.invoice),
      ...rows.map((r) => ({ gross: String(r.gross), tax: String(r.tax), invoice: r.invoice == null ? "" : String(r.invoice), expect: "", label: r.person })),
    ]);
  }

  async function runSynth() {
    const examples: SynthExample[] = [];
    for (const d of drafts) {
      if (!d.gross.trim()) continue;
      if (!d.expect) return setError(`例子「${d.label || d.gross}」还没选期望结果`);
      examples.push({
        gross: Number(d.gross),
        tax: Number(d.tax || 0),
        invoice: d.invoice.trim() === "" ? null : Number(d.invoice),
        expect: d.expect === "__blocked" ? { blocked: true } : { queue: d.expect, blocked: false },
        label: d.label || undefined,
      });
    }
    if (!examples.length) return setError("至少写一条例子：金额、发票、你希望它去哪个队列");
    setSynthBusy(true);
    setError(null);
    const r = await labFetch<SynthReport>("/api/lab/synthesize", { skillId: "ledger-desk", examples });
    setSynthBusy(false);
    if (!r.ok) return setError(r.error);
    setSynth(r.data);
  }

  const set = (i: number, k: keyof Draft, v: string) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  const synthCard = (
        <div className="pl-card">
          <div className="pl-card-head">
            <h3>按例子反推规则</h3>
            <button type="button" className="pl-btn pl-btn--primary" disabled={synthBusy} onClick={() => void runSynth()}>
              {synthBusy ? "求解中…" : "反推"}
            </button>
          </div>
          <div className="pl-examples">
            <div className="pl-ex-head">
              <span>备注</span>
              <span>金额</span>
              <span>税</span>
              <span>发票</span>
              <span>应该</span>
              <span />
            </div>
            {drafts.map((d, i) => (
              <div key={i} className="pl-ex-row">
                <input value={d.label} placeholder="可空" onChange={(e) => set(i, "label", e.target.value)} />
                <input value={d.gross} inputMode="decimal" onChange={(e) => set(i, "gross", e.target.value)} />
                <input value={d.tax} inputMode="decimal" onChange={(e) => set(i, "tax", e.target.value)} />
                <input value={d.invoice} inputMode="decimal" placeholder="缺票留空" onChange={(e) => set(i, "invoice", e.target.value)} />
                <select value={d.expect} onChange={(e) => set(i, "expect", e.target.value)}>
                  <option value="">选择</option>
                  {QUEUE_CODES.map((q) => (
                    <option key={q} value={q}>
                      去 {q}
                    </option>
                  ))}
                  <option value="__blocked">拦下</option>
                </select>
                <button type="button" className="pl-x" aria-label="删掉这条" onClick={() => setDrafts((all) => (all.length > 1 ? all.filter((_, j) => j !== i) : [{ ...EMPTY }]))}>
                  ×
                </button>
              </div>
            ))}
            <button type="button" className="pl-btn pl-btn--ghost" onClick={() => setDrafts((d) => [...d, { ...EMPTY }])}>
              + 加一条
            </button>
          </div>
          {synth ? (
            <div className="pl-sub">
              {synth.status === "sat" ? (
                <>
                  {synth.verified.every((v) => v.pass) ? (
                    <h4>找到一套规则，{synth.verified.length} 条例子全部经真实引擎复核通过</h4>
                  ) : (
                    <h4 className="is-bad">
                      求解器给出了一套规则，但真实引擎复核有 {synth.verified.filter((v) => !v.pass).length} 条不符，不能采用
                    </h4>
                  )}
                  {synth.changes.length ? <Changes list={synth.changes} /> : <p className="pl-note">现有规则已经满足所有例子。</p>}
                  {synth.impact ? <p className="pl-note">{synth.impact.headline}</p> : null}
                  <ul className="pl-verified">
                    {synth.verified.map((v, i) => (
                      <li key={i} className={v.pass ? "is-ok" : "is-bad"}>
                        {v.pass ? "✓" : "✗"} {v.example.label ?? v.example.gross} → {v.engineBlocked ? "拦下" : v.engineQueue}
                      </li>
                    ))}
                  </ul>
                  {synth.patchedRaw ? (
                    <button type="button" className="pl-btn pl-btn--ghost" onClick={() => downloadText("ledger-desk.synth.md", synth.patchedRaw!)}>
                      下载反推出的技能
                    </button>
                  ) : null}
                </>
              ) : synth.status === "unsat" ? (
                <>
                  <h4>这些例子互相矛盾，没有任何阈值能同时满足</h4>
                  <p className="pl-note">最小冲突集：{synth.conflict.map((c) => `第 ${c.index + 1} 条（${c.example.label ?? c.example.gross}）`).join("、")}</p>
                </>
              ) : (
                <h4>求解器没在时限内给出结论</h4>
              )}
              <p className="pl-note">
                {synth.solver.version} · {synth.solver.queries} 次查询 · {synth.solver.ms} ms
              </p>
            </div>
          ) : null}
        </div>
  );

  return (
    <section className="pl-panel">
      <header className="pl-panel-head">
        <div>
          <h2>规则求解</h2>
          <p>把报销技能的阈值当成 Z3 里的未知数。往前问：被拦下的单子，最少改哪条规则或哪个数字就能过；往后问：给几条「这笔该去哪」的例子，反推一套同时满足的规则。</p>
        </div>
      </header>
      {error ? <p className="pl-error">{error}</p> : null}

      <div className="pl-split">
        <div className="pl-card">
          <div className="pl-card-head">
            <h3>反事实：最少改什么能放行</h3>
            <button type="button" className="pl-btn pl-btn--primary" disabled={cfBusy || !hasLedger} onClick={() => void runCf()}>
              {cfBusy ? "求解中…" : hasLedger ? "对导入的台账求解" : "先导入报销台账"}
            </button>
          </div>
          {cf ? (
            <>
              <CounterfactualView cf={cf} />
              {cf.blockedRows.length ? (
                <button type="button" className="pl-btn pl-btn--ghost" onClick={() => addRows(cf.blockedRows)}>
                  把被拦的行放进右边当例子
                </button>
              ) : null}
            </>
          ) : (
            <p className="pl-note">需要上方导入的报销台账。</p>
          )}
        </div>
        {synthCard}
      </div>
    </section>
  );
}

/** 对已导入的报销台账求：最少改哪条规则 / 哪个数字，被拦的单子就能放行 */
export function Counterfactual({
  solve,
  autoRun,
  onAdoptRaw,
}: {
  solve: () => Promise<LabResult<CounterfactualReport>>;
  autoRun?: boolean;
  onAdoptRaw?: (raw: string, note: string) => void;
}) {
  const [cf, setCf] = useState<CounterfactualReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setError(null);
    const r = await solve();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setCf(r.data);
  }
  const started = useRef(false);
  useEffect(() => {
    if (autoRun && !started.current) {
      started.current = true;
      void run();
    }
  });
  return (
    <>
      {!cf ? (
        <div className="pl-actions">
          <button type="button" className="pl-btn pl-btn--primary" disabled={busy} onClick={() => void run()}>
            {busy ? "求解中…" : "求最少改动"}
          </button>
        </div>
      ) : null}
      {error ? <p className="pl-error">{error}</p> : null}
      {cf ? <CounterfactualView cf={cf} /> : busy ? <p className="pl-note">Z3 求解中…</p> : null}
      {cf?.global && onAdoptRaw ? (
        <div className="pl-adopt">
          <span>同意这个改动：写进技能草稿，过了发版检查（会在历史办理上预演影响）再生效。</span>
          <button
            type="button"
            className="pl-btn pl-btn--primary"
            onClick={() => onAdoptRaw(cf.global!.patchedRaw, cf.global!.changes.map((c) => `${c.label} ${c.from}→${c.to}`).join("、"))}
          >
            写进技能草稿
          </button>
        </div>
      ) : null}
    </>
  );
}

function CounterfactualView({ cf }: { cf: CounterfactualReport }) {
  return (
            <>
              <p className="pl-stat">
                <b>{cf.blockedRows.length}</b> / {cf.rows} 行被拦 · {cf.solver.version} · {cf.solver.queries} 次查询 · {cf.solver.ms} ms
              </p>
              {cf.global ? (
                <div className="pl-sub">
                  <h4>
                    放行全部被拦行的最小规则改动 {cf.global.provedMinimal ? <em className="is-ok">已证最小</em> : null}
                  </h4>
                  <Changes list={cf.global.changes} />
                  <p className="pl-note">{cf.global.minimalNote}</p>
                  <p className="pl-note">
                    引擎重跑：{cf.global.engine.before} → {cf.global.engine.after}
                    {cf.global.engine.queueShifts ? `；另有 ${cf.global.engine.queueShifts} 行换了审批队列` : ""}
                  </p>
                  <button type="button" className="pl-btn pl-btn--ghost" onClick={() => downloadText("ledger-desk.patched.md", cf.global!.patchedRaw)}>
                    下载改后的技能
                  </button>
                </div>
              ) : cf.blockedRows.length ? (
                <p className="pl-note">没有一组规则改动能同时放行所有被拦行，见下方逐行。</p>
              ) : (
                <p className="pl-note">这批台账没有被拦的行。</p>
              )}
              {cf.perRow.length ? (
                <ul className="pl-rowfix">
                  {cf.perRow.map((f) => (
                    <li key={f.row.index}>
                      <div>
                        <b>第 {f.row.index + 1} 行</b> {rowText(f.row)}
                        <small>{f.reason}</small>
                      </div>
                      {f.ruleFix ? (
                        <div>
                          <i>改规则</i>
                          <Changes list={f.ruleFix} />
                        </div>
                      ) : null}
                      {f.dataFix ? (
                        <div>
                          <i>或改数据</i> {f.dataFix.note}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {cf.unfixable.length ? <p className="pl-note">改规则也救不了：{cf.unfixable.map((u) => `第 ${u.row.index + 1} 行（${u.reason}）`).join("；")}</p> : null}
    </>
  );
}

