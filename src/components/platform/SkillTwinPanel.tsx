import { useEffect, useMemo, useState } from "react";
import { deskArgLabel } from "../../lib/deskArgLabels";
import type { TwinCase, TwinReport } from "../../lib/skillTwinTypes";
import { MutationSuite } from "./MutationPanel";
import { labFetch } from "./labApi";
import "./platformLab.css";

function numericArgs(raw: string): { key: string; value: number }[] {
  const seen = new Set<string>();
  const out: { key: string; value: number }[] = [];
  for (const match of raw.matchAll(/^\s+([A-Za-z][A-Za-z0-9]*):\s+(-?\d+(?:\.\d+)?)\s*$/gm)) {
    const key = match[1]!;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, value: Number(match[2]) });
  }
  return out;
}

const OUTCOME: Record<TwinCase["before"]["kind"], string> = { done: "办完", stopped: "被拦下", failed: "出错" };

function toneOf(c: TwinCase): "same" | "changed" | "stopped" | "passed" {
  const stuck = (k: TwinCase["before"]["kind"]) => k !== "done";
  if (!stuck(c.before.kind) && stuck(c.after.kind)) return "stopped";
  if (stuck(c.before.kind) && !stuck(c.after.kind)) return "passed";
  return c.changed ? "changed" : "same";
}

const TONE_LABEL = { same: "结果不变", changed: "结果会变", stopped: "新被拦下", passed: "新放行" } as const;

const verLabel = (v: string) => (/^\d/.test(v) ? ` v${v}` : "");

function when(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? at : `${d.getMonth() + 1}-${String(d.getDate()).padStart(2, "0")} ${d.toLocaleTimeString().slice(0, 5)}`;
}

/** 改规则前的上线预演：在这项技能最近真实办过的单子上，用线上版和草稿版各跑一遍真实引擎 */
export function SkillTwinPanel({ skillId, online, draft, onDraft }: { skillId: string; online: string; draft: string; onDraft?: (raw: string) => void }) {
  const changed = online.trim() !== draft.trim();
  const [report, setReport] = useState<TwinReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<number | null>(null);
  const [tab, setTab] = useState<"twin" | "mutation" | "sweep">("twin");
  const args = useMemo(() => numericArgs(draft), [draft]);

  useEffect(() => {
    if (!changed) {
      setReport(null);
      setError(null);
      return;
    }
    let alive = true;
    const t = window.setTimeout(async () => {
      setBusy(true);
      setError(null);
      const r = await labFetch<TwinReport>("/api/lab/twin", { skillId, raw: draft, limit: 12 });
      if (!alive) return;
      setBusy(false);
      if (!r.ok) {
        setReport(null);
        return setError(r.error);
      }
      setReport(r.data);
      const first = r.data.cases.findIndex((c) => toneOf(c) !== "same");
      setPick(first >= 0 ? first : null);
    }, 700);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [skillId, draft, changed]);

  const sel = report && pick != null ? report.cases[pick] ?? null : null;
  const headline = useMemo(() => {
    if (!report) return "";
    const t = report.totals;
    if (!t.changed) return `草稿在最近 ${t.replayed} 单真实办理上，交付结果和线上版完全一样`;
    const parts = [`${t.changed} 单结果会变`];
    if (t.newlyStopped) parts.push(`${t.newlyStopped} 单会新被拦下`);
    if (t.newlyPassed) parts.push(`${t.newlyPassed} 单会新放行`);
    return `在最近 ${t.replayed} 单真实办理上重放：${parts.join("，")}`;
  }, [report]);

  return (
    <section className="pl-root pl-embed tw">
      <div className="pl-panel">
        <header className="tw-head">
          <div className="pl-seg">
            <button type="button" className={tab === "twin" ? "is-on" : ""} onClick={() => setTab("twin")}>
              上线预演
            </button>
            <button type="button" className={tab === "mutation" ? "is-on" : ""} onClick={() => setTab("mutation")}>
              检查集够不够严
            </button>
            <button type="button" className={tab === "sweep" ? "is-on" : ""} onClick={() => setTab("sweep")}>
              参数取舍
            </button>
          </div>
          {tab === "twin" && report ? (
            <span className="tw-meta">
              线上{verLabel(report.onlineVersion)} · {report.totals.replayed} 单 · {report.ms} ms
            </span>
          ) : null}
        </header>

        {tab === "sweep" ? (
          <Sweep
            draft={draft}
            args={args}
            busy={busy}
            report={changed ? report : null}
            onApply={(next) => onDraft?.(next)}
          />
        ) : tab === "mutation" ? (
          <>
            <p className="pl-note">把{changed ? "草稿" : "现用版"}故意改坏几十种方式（调阈值、删步骤、换顺序、换工具），每个坏版本都过一遍真实发版检查。漏过去的说明检查句不够，会补出能拦住它们的测试材料。</p>
            <MutationSuite key={changed ? draft : "online"} skillId={skillId} raw={changed ? draft : undefined} />
          </>
        ) : !changed ? (
          <p className="pl-note">改动草稿后，这里会自动把这项技能最近真实办过的单子（当时导入的材料快照）用草稿重跑一遍，告诉你哪几单的结论、拦截和交付表会变。</p>
        ) : busy ? (
          <p className="pl-note">正在历史办理上重放草稿…</p>
        ) : error ? (
          <p className="pl-error">{error}</p>
        ) : report ? (
          <>
            <h3 className={`tw-headline${report.totals.changed ? " is-diff" : " is-same"}`}>{headline}</h3>
            {report.totals.unfaithful ? (
              <p className="pl-error">
                有 {report.totals.unfaithful} 单用线上版重放和当时记录的结果不一致（
                {report.cases
                  .filter((c) => !c.faithful)
                  .flatMap((c) => c.unfaithfulSteps)
                  .slice(0, 4)
                  .join("、")}
                ），这几单的对比仅供参考。
              </p>
            ) : (
              <p className="pl-note">
                {(() => {
                  const n = report.cases.filter((c) => c.faithChecked).length;
                  const rest = report.cases.length - n;
                  return n
                    ? `其中 ${n} 单当时用的就是线上${verLabel(report.onlineVersion) || "版"}，线上版重放与当时记录的每一步结果逐一比对一致${rest ? `；另 ${rest} 单是旧版本办的，按当前线上版重算作对照` : ""}。`
                    : "这些单子是旧版本办的，对照基准是按当前线上版重算的结果。";
                })()}
              </p>
            )}
            <div className="tw-strip" role="list">
              {report.cases.map((c, i) => {
                const tone = toneOf(c);
                return (
                  <button
                    key={c.runId}
                    type="button"
                    role="listitem"
                    className={`tw-cell is-${tone}${pick === i ? " is-sel" : ""}${c.faithful ? "" : " is-unfaithful"}`}
                    title={`${when(c.at)} · ${TONE_LABEL[tone]}`}
                    onClick={() => setPick(i)}
                  >
                    <b>{c.materials[0]?.replace(/（.*$/, "") ?? "材料"}</b>
                    <small>
                      {when(c.at)} · {TONE_LABEL[tone]}
                    </small>
                  </button>
                );
              })}
            </div>
            {sel ? (
              <div className="tw-detail">
                <p className="tw-mats">材料：{sel.materials.join("、")}</p>
                <div className="tw-vs">
                  <div>
                    <small>线上版 · {OUTCOME[sel.before.kind]}</small>
                    <p>{sel.summaryBefore || sel.before.note || "—"}</p>
                  </div>
                  <span aria-hidden>→</span>
                  <div className={sel.changed ? "is-diff" : ""}>
                    <small>草稿 · {OUTCOME[sel.after.kind]}</small>
                    <p>{sel.summaryAfter || sel.after.note || "—"}</p>
                  </div>
                </div>
                {sel.grids.map((g) => (
                  <div key={g.name} className="tw-grid">
                    <strong>
                      {g.name}
                      <em>
                        {g.rowsBefore} → {g.rowsAfter} 行 · 改动 {Math.max(g.added, g.removed)} 行
                      </em>
                    </strong>
                    <div className="pl-grid-wrap">
                      <table className="pl-grid">
                        <thead>
                          <tr>
                            <th />
                            {g.columns.map((col) => (
                              <th key={col}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {g.sample.flatMap((s, k) => [
                            s.before ? (
                              <tr key={`${k}b`} className="tw-row-old">
                                <td>线上</td>
                                {g.columns.map((_, ci) => (
                                  <td key={ci}>{s.before![ci]}</td>
                                ))}
                              </tr>
                            ) : null,
                            s.after ? (
                              <tr key={`${k}a`} className="tw-row-new">
                                <td>草稿</td>
                                {g.columns.map((_, ci) => (
                                  <td key={ci} className={s.before && s.before[ci] !== s.after![ci] ? "is-hit" : ""}>
                                    {s.after![ci]}
                                  </td>
                                ))}
                              </tr>
                            ) : null,
                          ])}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
                {sel.steps.length ? (
                  <details className="tw-steps">
                    <summary>{sel.steps.length} 个步骤的输出不同</summary>
                    <ul>
                      {sel.steps.map((s) => (
                        <li key={s.stepId}>
                          <b>{s.label}</b>
                          <s>{s.before}</s>
                          <span>{s.after}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className="pl-note">点上面任意一单看细节。</p>
            )}
            {report.skipped.length ? <p className="pl-note">有 {report.skipped.length} 单没法重放：{report.skipped.map((s) => s.reason).join("；")}</p> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}

function patchNumericArgs(raw: string, args: { key: string; value: number }[], edits: Record<string, string>): string {
  let next = raw;
  for (const arg of args) {
    const typed = edits[arg.key]?.trim() ?? "";
    if (!typed || Number(typed) === arg.value || !Number.isFinite(Number(typed))) continue;
    const literal = String(arg.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`(${arg.key}:\\s*)${literal}(?!\\d)`, "g"), `$1${typed}`);
  }
  return next;
}

function Sweep({
  draft,
  args,
  busy,
  report,
  onApply,
}: {
  draft: string;
  args: { key: string; value: number }[];
  busy: boolean;
  report: TwinReport | null;
  onApply: (raw: string) => void;
}) {
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [base, setBase] = useState("");
  useEffect(() => {
    const signature = args.map((arg) => `${arg.key}:${arg.value}`).join("|");
    if (signature === base) return;
    setBase(signature);
    setEdits(Object.fromEntries(args.map((arg) => [arg.key, String(arg.value)])));
  }, [args, base]);
  if (!args.length) return <p className="pl-note">这份草稿里没有数字参数可以填。</p>;
  return (
    <>
      <p className="pl-note">下面每个数都可以改。改完会写进这份技能草稿，并用这项技能最近办过的单子重跑，看哪些单的结论会变。</p>
      <div className="pl-fork-grid">
        {args.map((arg) => (
          <label key={arg.key}>
            <span>{deskArgLabel(arg.key) ?? arg.key}</span>
            <input
              inputMode="decimal"
              value={edits[arg.key] ?? String(arg.value)}
              onChange={(e) => setEdits((cur) => ({ ...cur, [arg.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <p className="oa-toolbar-lead">
        <button
          type="button"
          className="oa-bar-btn"
          disabled={busy}
          onClick={() => {
            const next = patchNumericArgs(draft, args, edits);
            if (next === draft) return;
            onApply(next);
          }}
        >
          {busy ? "正在用历史材料重跑…" : "按我填的数重跑"}
        </button>
      </p>
      {report ? (
        <p className="pl-note">
          重跑了 {report.totals.replayed} 单，{report.totals.changed} 单的结论会变，用时 {report.ms} ms。
        </p>
      ) : null}
    </>
  );
}
