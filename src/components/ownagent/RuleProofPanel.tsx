import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/apiClient";
import { ledgerStepRules, type RuleCounterexample, type RuleProofReport, type RuleProofSide } from "../../lib/ledgerRuleModel";
import type { ParsedSkillDoc } from "../../lib/skillMarkdown";

type Lines = { leadAt: number; directorAt: number; financeReviewAt: number };

function escalationLines(doc: ParsedSkillDoc): Lines | null {
  const rule = ledgerStepRules(doc.steps).find((r) => r.tool === "__sheet_escalation__");
  return rule ? rule.recipe.escalation : null;
}

function yuan(v: number): string {
  return Number.isInteger(v) ? v.toLocaleString("zh-CN") : v.toLocaleString("zh-CN", { maximumFractionDigits: 4 });
}

function sideValue(side: RuleProofSide, field: RuleCounterexample["field"]): string {
  const v = side[field];
  if (typeof v === "boolean") return v ? "是" : "否";
  if (typeof v === "number") return `${yuan(v)} 元`;
  return v;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function AmountAxis({ cx, online, draft }: { cx: RuleCounterexample; online: Lines | null; draft: Lines | null }) {
  const range = cx.grossRange;
  if (!range) return null;
  const marks = [
    ...(online ? [{ v: online.leadAt, k: "负责人" }, { v: online.directorAt, k: "总监" }, { v: online.financeReviewAt, k: "财务复核" }].map((m) => ({ ...m, side: "现用" as const })) : []),
    ...(draft ? [{ v: draft.leadAt, k: "负责人" }, { v: draft.directorAt, k: "总监" }, { v: draft.financeReviewAt, k: "财务复核" }].map((m) => ({ ...m, side: "新版" as const })) : []),
  ];
  const top = Math.max(cx.row.gross, range.min ?? 0, range.max ?? 0, ...marks.map((m) => m.v), 1) * 1.2;
  const lo = Math.max(0, range.min ?? 0);
  const hi = range.max == null ? top : Math.min(range.max, top);
  const x = (v: number) => 12 + (Math.max(0, Math.min(v, top)) / top) * 476;
  const changed = (m: (typeof marks)[number]) =>
    marks.some((o) => o.k === m.k && o.side !== m.side && o.v !== m.v);
  const shown = marks.filter((m) => m.side === "现用" || changed(m)).sort((a, b) => a.v - b.v);
  const BASE = 58;
  const LABEL_GAP = 150;
  const lastX: Record<string, number[]> = { 现用: [], 新版: [] };
  const placed = shown.map((m) => {
    const px = x(m.v);
    const rows = lastX[m.side]!;
    let row = rows.findIndex((last) => px - last >= LABEL_GAP);
    if (row < 0) row = rows.length;
    rows[row] = px;
    const y = m.side === "现用" ? BASE - 14 - row * 16 : BASE + 26 + row * 16;
    return { ...m, px, y };
  });
  const height = Math.max(BASE + 34, ...placed.map((p) => p.y + 8));
  const top0 = Math.min(0, ...placed.map((p) => p.y - 14));
  return (
    <svg className="rp-axis" viewBox={`0 ${top0} 500 ${height - top0}`} role="img" aria-label="出现差异的金额区间">
      <line x1="12" x2="488" y1={BASE} y2={BASE} className="rp-axis-base" />
      <rect x={x(lo)} width={Math.max(2, x(hi) - x(lo))} y={BASE - 8} height="16" rx="3" className="rp-axis-band" />
      {placed.map((m, i) => (
        <g key={`${m.side}-${m.k}-${i}`} className={`rp-axis-mark rp-axis-mark--${m.side === "现用" ? "old" : "new"}`}>
          <line x1={m.px} x2={m.px} y1={m.side === "现用" ? m.y + 4 : BASE} y2={m.side === "现用" ? BASE : m.y - 14} />
          <text x={m.px} y={m.y} textAnchor="middle">
            {m.side === "新版" ? "新" : ""}{m.k} {yuan(m.v)}
          </text>
        </g>
      ))}
      <circle cx={x(cx.row.gross)} cy={BASE} r="6" className="rp-axis-dot" />
    </svg>
  );
}

export function RuleProofPanel({
  online,
  draft,
  onlineParsed,
  draftParsed,
}: {
  online: string;
  draft: string;
  onlineParsed: ParsedSkillDoc;
  draftParsed: ParsedSkillDoc;
}) {
  const applicable = useMemo(
    () => ledgerStepRules(onlineParsed.steps).length > 0 || ledgerStepRules(draftParsed.steps).length > 0,
    [onlineParsed, draftParsed],
  );
  const [report, setReport] = useState<RuleProofReport | null>(null);
  const [proving, setProving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSmt, setOpenSmt] = useState(false);

  useEffect(() => {
    if (!applicable || !draftParsed.ok) return;
    let alive = true;
    const t = window.setTimeout(async () => {
      setProving(true);
      setError(null);
      const res = await apiFetch<RuleProofReport & { error?: string }>("/rule-proof", {
        method: "POST",
        body: JSON.stringify({ baselineRaw: online, candidateRaw: draft }),
      });
      if (!alive) return;
      setProving(false);
      if (!res || res.error) {
        setError(res?.error ?? "证明器没有连上服务端");
        setReport(null);
        return;
      }
      setReport(res);
    }, 500);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [applicable, online, draft, draftParsed.ok]);

  const onlineLines = useMemo(() => escalationLines(onlineParsed), [onlineParsed]);
  const draftLines = useMemo(() => escalationLines(draftParsed), [draftParsed]);

  if (!applicable) return null;
  const changed = online.trim() !== draft.trim();
  const liveDead = report?.deadBranches.filter((d) => d.version !== "baseline") ?? [];
  const tone = !report
    ? "idle"
    : report.verdict === "different"
      ? "diff"
      : liveDead.length
        ? "dead"
        : report.verdict === "equivalent"
          ? "proved"
          : "partial";
  const selfTitle = liveDead.length
    ? `现用规则自检：发现 ${liveDead.length} 条永远不会生效的规则`
    : "现用规则自检：每个审批队列都有单据能进";

  return (
    <section className={`rp rp--${tone}`} aria-live="polite">
      <header className="rp-head">
        <span className="rp-kicker">规则证明</span>
        {report?.supported ? (
          <span className="rp-solver" title="用 Z3 求解器对所有可能的金额取值做穷尽证明">
            {report.solver.version} · {report.solver.queries} 次查询 · {report.solver.assertions} 条约束 · {report.solver.ms} ms
          </span>
        ) : null}
      </header>

      {proving ? (
        <div className="rp-status rp-status--busy">
          <span className="rp-spin" />
          <strong>正在证明{changed ? "两版规则是否等价" : "现用规则有没有永远进不去的队列"}…</strong>
        </div>
      ) : error ? (
        <div className="rp-status rp-status--error"><strong>没有证明结果</strong><span>{error}</span></div>
      ) : report && !report.supported ? (
        <div className="rp-status"><span>{report.reason}</span></div>
      ) : report ? (
        <div className="rp-status">
          <span className="rp-glyph">{tone === "proved" ? "∎" : tone === "diff" ? "≠" : tone === "dead" ? "!" : "◐"}</span>
          <div>
            <strong>{changed ? report.headline : selfTitle}</strong>
            <span>
              {changed
                ? `逐步比较 ${report.stepsCompared} 个规则步骤；金额、税额、发票额覆盖 ±1 亿元内精确到 1/${report.scale} 元的所有取值。`
                : `覆盖 ±1 亿元内精确到 1/${report.scale} 元的所有单据，检查每个审批队列是否真的有单据能进。`}
            </span>
          </div>
        </div>
      ) : null}

      {report?.supported && !proving ? (
        <>
          {report.counterexamples.map((cx) => (
            <div key={`${cx.field}-${cx.steps.join()}`} className="rp-cx">
              <div className="rp-cx-top">
                <strong>反例 · {cx.fieldLabel}会变</strong>
                <span className={cx.engineConfirmed ? "rp-ok" : "rp-warn"}>
                  {cx.engineConfirmed ? "真实引擎复跑已确认" : "引擎未复现"}
                </span>
              </div>
              <table className="rp-cx-table">
                <thead>
                  <tr><th>金额</th><th>税额</th><th>发票额</th><th>现用版</th><th>新版</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{yuan(cx.row.gross)}</td>
                    <td>{yuan(cx.row.tax)}</td>
                    <td>{cx.row.invoice == null ? "空" : yuan(cx.row.invoice)}</td>
                    <td>{sideValue(cx.baseline, cx.field)}</td>
                    <td className="rp-cx-new">{sideValue(cx.candidate, cx.field)}</td>
                  </tr>
                </tbody>
              </table>
              {cx.grossRange ? (
                <>
                  <AmountAxis cx={cx} online={onlineLines} draft={draftLines} />
                  <p className="rp-range">
                    出现差异的金额：最低 {cx.grossRange.min == null ? "不封底" : `${yuan(cx.grossRange.min)} 元`}，最高{" "}
                    {cx.grossRange.max == null ? "不封顶" : `${yuan(cx.grossRange.max)} 元`}
                  </p>
                </>
              ) : null}
              {!cx.engineConfirmed ? <p className="rp-evidence">{cx.engineNote}</p> : null}
              <p className="rp-steps">涉及步骤：{cx.steps.join("、")}</p>
            </div>
          ))}

          {report.deadBranches.map((d) => (
            <div key={`${d.version}-${d.target}`} className={`rp-dead rp-dead--${d.version}`}>
              <div className="rp-dead-top">
                <span className="rp-tag">
                  {!changed ? "现用版" : d.version === "both" ? "现用版和新版都有" : d.version === "baseline" ? "新版已修复" : "新版引入"}
                </span>
                <strong>
                  {d.version === "baseline" && changed
                    ? `现用版的「${d.target}」队列进不去，新版已能进入`
                    : `死规则：「${d.target}」队列任何单据都进不去`}
                </strong>
              </div>
              <p>{d.explanation}</p>
              <p className="rp-evidence">{d.engineEvidence}</p>
              <p className="rp-steps">涉及步骤：{d.steps.join("、")}</p>
            </div>
          ))}

          {report.structuralChanges.length || report.unmodeled.length ? (
            <ul className="rp-scope">
              {[...report.structuralChanges, ...report.unmodeled].map((s) => <li key={s}>不在证明范围：{s}</li>)}
            </ul>
          ) : null}

          <div className="rp-actions">
            {report.counterexamples.length ? (
              <button
                type="button"
                className="rp-btn"
                onClick={() =>
                  download(
                    "rule-counterexamples.csv",
                    ["部门,申请人,金额,税额,发票额", ...report.counterexamples.map((c) => c.csv.split("\n")[1])].join("\n"),
                    "text/csv;charset=utf-8",
                  )
                }
              >
                下载反例 CSV
              </button>
            ) : null}
            {report.smtlib ? (
              <>
                <button type="button" className="rp-btn" onClick={() => download("rule-proof.smt2", report.smtlib, "text/plain;charset=utf-8")}>
                  下载 SMT-LIB
                </button>
                <button type="button" className="rp-btn rp-btn--ghost" onClick={() => setOpenSmt((v) => !v)}>
                  {openSmt ? "收起求解器输入" : "看求解器输入"}
                </button>
              </>
            ) : null}
          </div>
          {openSmt ? <pre className="rp-smt">{report.smtlib.slice(0, 6000)}{report.smtlib.length > 6000 ? "\n; …完整内容请下载" : ""}</pre> : null}
        </>
      ) : null}
    </section>
  );
}
