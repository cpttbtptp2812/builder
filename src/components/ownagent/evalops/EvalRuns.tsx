import { useEffect, useMemo, useState } from "react";
import { currentMode, evalStore } from "../../../lib/evalops/client";
import { pct } from "../../../lib/evalops/stats";
import {
  DEFAULT_RUN_OPTIONS,
  type CaseOutcome,
  type CaseResult,
  type EvalRun,
  type EvalSuite,
  type EvalTarget,
  type RunOptions,
  type SideSample,
} from "../../../lib/evalops/types";
import { OaBadge, OaBtn, OaCard, OaCheck, OaEmpty, OaField, OaInput, OaSelect } from "../OaUi";
import { downloadText } from "./EvalSuites";

export type JudgeInfo = { model: string; source: "browser" | "server" } | null;

const OUTCOME: Record<CaseOutcome, { label: string; tone: "ok" | "warn" | "danger" | "neutral" | "info" }> = {
  worse: { label: "变差", tone: "danger" },
  better: { label: "变好", tone: "ok" },
  same: { label: "持平", tone: "neutral" },
  fail: { label: "不通过", tone: "danger" },
  pass: { label: "通过", tone: "ok" },
  error: { label: "调用失败", tone: "warn" },
};

const STATUS: Record<EvalRun["status"], { label: string; tone: "ok" | "warn" | "danger" | "neutral" | "info" }> = {
  queued: { label: "排队中", tone: "neutral" },
  running: { label: "运行中", tone: "info" },
  done: { label: "已完成", tone: "ok" },
  failed: { label: "失败", tone: "danger" },
  cancelled: { label: "已停止", tone: "neutral" },
};

const VERDICT_TONE = { ship: "ok", risk: "warn", block: "danger" } as const;

function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

export function EvalRuns({
  runs,
  suites,
  targets,
  judge,
  openId,
  onOpen,
  onChanged,
  goTab,
  notify,
}: {
  runs: EvalRun[];
  suites: EvalSuite[];
  targets: EvalTarget[];
  judge: JudgeInfo;
  openId: string | null;
  onOpen: (id: string | null) => void;
  onChanged: () => void;
  goTab: (tab: "targets" | "suites") => void;
  notify: (msg: string) => void;
}) {
  if (openId) {
    return <RunReport id={openId} onBack={() => onOpen(null)} onChanged={onChanged} onOpen={onOpen} notify={notify} />;
  }
  return (
    <div className="eo-stack">
      <NewRunForm suites={suites} targets={targets} judge={judge} goTab={goTab} onStarted={(r) => (onChanged(), onOpen(r.id))} />
      <section className="eo-stack">
        <strong>历次实验</strong>
        {!runs.length ? (
          <OaEmpty>还没跑过实验。</OaEmpty>
        ) : (
          <ul className="eo-runs">
            {runs.map((r) => (
              <li key={r.id}>
                <button type="button" className="eo-run-row" onClick={() => onOpen(r.id)}>
                  <span className="eo-run-main">
                    <strong>{r.name}</strong>
                    <span className="eo-muted">
                      {r.suiteName} · {r.progress.total} 题 · {fmtTime(r.createdAt)}
                    </span>
                  </span>
                  <span className="eo-run-side">
                    {r.summary && r.status === "done" ? (
                      <>
                        {r.summary.compare ? (
                          <span className="eo-muted">
                            ↑{r.summary.better} ↓{r.summary.worse}
                          </span>
                        ) : (
                          <span className="eo-muted">通过 {pct(r.summary.aPassRate)}</span>
                        )}
                        <OaBadge tone={VERDICT_TONE[r.summary.verdict]}>{r.summary.verdictTitle}</OaBadge>
                      </>
                    ) : r.status === "running" || r.status === "queued" ? (
                      <>
                        <span className="eo-bar eo-bar--sm">
                          <i style={{ width: `${r.progress.total ? (r.progress.done / r.progress.total) * 100 : 0}%` }} />
                        </span>
                        <OaBadge tone="info">
                          {r.progress.done}/{r.progress.total}
                        </OaBadge>
                      </>
                    ) : (
                      <OaBadge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</OaBadge>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function NewRunForm({
  suites,
  targets,
  judge,
  goTab,
  onStarted,
}: {
  suites: EvalSuite[];
  targets: EvalTarget[];
  judge: JudgeInfo;
  goTab: (tab: "targets" | "suites") => void;
  onStarted: (r: EvalRun) => void;
}) {
  const [suiteId, setSuiteId] = useState("");
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [name, setName] = useState("");
  const [opt, setOpt] = useState<RunOptions>(DEFAULT_RUN_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!suites.some((s) => s.id === suiteId)) setSuiteId(suites[0]?.id ?? "");
  }, [suites, suiteId]);
  useEffect(() => {
    const byAge = targets.slice().sort((x, y) => x.createdAt.localeCompare(y.createdAt));
    if (!targets.some((t) => t.id === aId)) {
      setAId(byAge[0]?.id ?? "");
      if (!bId && byAge[1]) setBId(byAge[1].id);
    }
    if (bId && !targets.some((t) => t.id === bId)) setBId("");
  }, [targets, aId, bId]);

  const suite = suites.find((s) => s.id === suiteId);
  const useJudge = opt.useLlmJudge && Boolean(judge);
  const calls = (suite?.cases.length ?? 0) * opt.repeats * (bId ? 2 : 1);

  if (!targets.length || !suites.length) {
    return (
      <OaCard muted>
        <p className="eo-muted">
          开始评测前需要：
          {!targets.length ? (
            <button type="button" className="eo-link" onClick={() => goTab("targets")}>
              接入至少一个被测对象
            </button>
          ) : null}
          {!targets.length && !suites.length ? "，以及" : ""}
          {!suites.length ? (
            <button type="button" className="eo-link" onClick={() => goTab("suites")}>
              准备一个测试集
            </button>
          ) : null}
        </p>
      </OaCard>
    );
  }

  async function start() {
    if (!suite || !aId) return;
    if (bId && bId === aId) return setErr("A 和 B 选了同一个对象。要看稳定性，可以不选 B、把重复次数调到 3。");
    setBusy(true);
    setErr(null);
    try {
      const r = await evalStore.startRun({ name: name.trim() || undefined, suiteId, targetAId: aId, targetBId: bId || null, options: { ...opt, useLlmJudge: useJudge } });
      setName("");
      onStarted(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <OaCard className="eo-newrun">
      <div className="eo-row-between">
        <strong>新建实验</strong>
        <span className="eo-muted">用同一批题分别问 A 和 B，逐题比较</span>
      </div>
      <div className="eo-ab">
        <OaField label="测试集">
          <OaSelect value={suiteId} onChange={(e) => setSuiteId(e.target.value)}>
            {suites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}（{s.cases.length} 题）
              </option>
            ))}
          </OaSelect>
        </OaField>
        <OaField label="A · 基准（通常是线上版）">
          <OaSelect value={aId} onChange={(e) => setAId(e.target.value)}>
            {targets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </OaSelect>
        </OaField>
        <span className="eo-vs" aria-hidden>
          vs
        </span>
        <OaField label="B · 改动后">
          <OaSelect value={bId} onChange={(e) => setBId(e.target.value)}>
            <option value="">不对比，只给 A 打分</option>
            {targets.map((t) => (
              <option key={t.id} value={t.id} disabled={t.id === aId}>
                {t.name}
              </option>
            ))}
          </OaSelect>
        </OaField>
      </div>

      <div className="eo-judge-line">
        <OaCheck
          compact
          checked={useJudge}
          disabled={!judge}
          onChange={(v) => setOpt({ ...opt, useLlmJudge: v })}
          label={judge ? `用大模型当裁判（${judge.model}${judge.source === "server" ? " · 服务端配置" : ""}）` : "大模型裁判未配置"}
        />
        <span className="eo-muted">
          {judge
            ? useJudge
              ? bId
                ? "逐题判对错，并把 A、B 答案交换顺序各比一次，两次一致才算分出胜负"
                : "逐题判对错、有没有依据"
              : "只用规则：关键词、禁用词、引用、参考答案覆盖率"
            : "去「接入配置」填模型 Key 后可用；现在只用规则判断"}
        </span>
      </div>

      <details className="eo-details">
        <summary>更多设置（重复次数、上线门槛）</summary>
        <div className="eo-cols">
          <OaField label="每题重复" hint="答案不稳定时调到 3，按通过比例算" className="eo-w-md">
            <OaInput type="number" min={1} max={5} value={opt.repeats} onChange={(e) => setOpt({ ...opt, repeats: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })} />
          </OaField>
          <OaField label="同时调用" hint="接口有限流就调小" className="eo-w-md">
            <OaInput type="number" min={1} max={8} value={opt.concurrency} onChange={(e) => setOpt({ ...opt, concurrency: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })} />
          </OaField>
          <OaField label="最多允许变差几题" hint="超过就判「别上线」" className="eo-w-md">
            <OaInput type="number" min={0} value={opt.gate.maxWorse} onChange={(e) => setOpt({ ...opt, gate: { ...opt.gate, maxWorse: Math.max(0, Number(e.target.value) || 0) } })} />
          </OaField>
          <OaField label="通过率最多下降（%）" className="eo-w-md">
            <OaInput
              type="number"
              min={0}
              max={100}
              value={Math.round(opt.gate.maxPassDrop * 100)}
              onChange={(e) => setOpt({ ...opt, gate: { ...opt.gate, maxPassDrop: Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100 } })}
            />
          </OaField>
        </div>
        <OaField label="实验名称（可选）">
          <OaInput value={name} placeholder="如：换 bge-m3 向量模型" onChange={(e) => setName(e.target.value)} />
        </OaField>
      </details>

      {err ? <p className="eo-err">{err}</p> : null}
      <div className="eo-row-between">
        <span className="eo-muted">
          将调用被测对象约 {calls} 次{useJudge ? `，裁判约 ${(suite?.cases.length ?? 0) * (opt.repeats * (bId ? 2 : 1) + (bId ? 2 : 0))} 次` : ""}
        </span>
        <OaBtn onClick={() => void start()} disabled={busy || !suite?.cases.length}>
          {busy ? "启动中…" : "开始评测"}
        </OaBtn>
      </div>
    </OaCard>
  );
}

type Filter = "all" | CaseOutcome;

function RunReport({
  id,
  onBack,
  onChanged,
  onOpen,
  notify,
}: {
  id: string;
  onBack: () => void;
  onChanged: () => void;
  onOpen: (id: string) => void;
  notify: (msg: string) => void;
}) {
  const [run, setRun] = useState<EvalRun | null>(null);
  const [missing, setMissing] = useState(false);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      const r = await evalStore.getRun(id).catch(() => null);
      if (!alive) return;
      if (!r) return setMissing(true);
      setRun(r);
      if (r.status === "running" || r.status === "queued") timer = setTimeout(tick, 1200);
      else onChanged();
    };
    void tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const counts = useMemo(() => {
    const m: Partial<Record<CaseOutcome, number>> = {};
    for (const r of run?.results ?? []) m[r.outcome] = (m[r.outcome] ?? 0) + 1;
    return m;
  }, [run]);

  const order: CaseOutcome[] = ["worse", "fail", "error", "better", "same", "pass"];
  const activeFilter: Filter = filter ?? (counts.worse ? "worse" : counts.fail ? "fail" : "all");
  const shown = useMemo(() => {
    const list = (run?.results ?? []).slice().sort((x, y) => order.indexOf(x.outcome) - order.indexOf(y.outcome));
    return activeFilter === "all" ? list : list.filter((r) => r.outcome === activeFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, activeFilter]);

  if (missing) {
    return (
      <OaCard>
        <p>这个实验不存在或已删除。</p>
        <OaBtn variant="ghost" onClick={onBack}>
          返回
        </OaBtn>
      </OaCard>
    );
  }
  if (!run) return <p className="eo-muted">加载中…</p>;

  const s = run.summary;
  const compare = Boolean(run.targetB);
  const live = run.status === "running" || run.status === "queued";

  async function rerun() {
    if (!run) return;
    try {
      const r = await evalStore.startRun({ suiteId: run.suiteId, targetAId: run.targetA.id, targetBId: run.targetB?.id ?? null, options: run.options });
      onChanged();
      onOpen(r.id);
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="eo-stack">
      <div className="eo-row-between">
        <button type="button" className="eo-link" onClick={onBack}>
          ← 全部实验
        </button>
        <span className="eo-actions">
          {live ? (
            <OaBtn size="sm" variant="ghost" onClick={() => void evalStore.cancelRun(run.id)}>
              停止
            </OaBtn>
          ) : (
            <>
              <OaBtn size="sm" variant="ghost" onClick={() => void rerun()}>
                按同样设置再跑一次
              </OaBtn>
              {run.results.length ? (
                <OaBtn size="sm" variant="ghost" onClick={() => downloadText(`${run.name}-评测报告.md`, reportMarkdown(run), "text/markdown")}>
                  下载报告
                </OaBtn>
              ) : null}
            </>
          )}
          <OaBtn
            size="sm"
            variant="danger"
            onClick={async () => {
              if (!window.confirm("删除这次实验记录？")) return;
              await evalStore.deleteRun(run.id);
              onChanged();
              onBack();
            }}
          >
            删除
          </OaBtn>
        </span>
      </div>

      <header className="eo-report-head">
        <h3>{run.name}</h3>
        <p className="eo-muted">
          {run.suiteName} · {run.progress.total} 题
          {run.options.repeats > 1 ? ` × ${run.options.repeats} 次` : ""} · {run.judgeModel ? `裁判 ${run.judgeModel}` : "仅规则判断"} · {fmtTime(run.createdAt)}
        </p>
      </header>

      {live ? (
        <OaCard className="eo-progress">
          <div className="eo-row-between">
            <span>
              正在评测… {run.progress.done}/{run.progress.total}
            </span>
            <OaBadge tone="info">{STATUS[run.status].label}</OaBadge>
          </div>
          <span className="eo-bar">
            <i style={{ width: `${run.progress.total ? (run.progress.done / run.progress.total) * 100 : 0}%` }} />
          </span>
          <p className="eo-muted">
            {currentMode() === "server" ? "服务端在跑，可以关掉页面，回来再看结果。" : "在本浏览器里跑，刷新或关闭页面会中断。"}
          </p>
        </OaCard>
      ) : null}

      {run.status === "failed" ? <p className="eo-err">实验失败：{run.error}</p> : null}
      {run.status === "cancelled" ? <p className="eo-warn">实验已停止，下面是停止前跑完的 {run.results.length} 题。</p> : null}

      {s && !live ? (
        <>
          <div className={`eo-verdict is-${s.verdict}`}>
            <strong>{s.verdictTitle}</strong>
            <ul>
              {s.reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            {!run.judgeModel ? (
              <p className="eo-verdict-note">
                这次只做了规则检查（关键词、引用、参考答案的字面覆盖），没判断意思对不对。去「接入配置」填好模型后再跑，结论会可靠得多。
              </p>
            ) : null}
          </div>
          <div className="eo-stats">
            {compare ? (
              <>
                <Stat label={`A · ${run.targetA.name}`} value={pct(s.aPassRate)} hint={`通过率 · 区间 ${pct(s.aPassCi[0])}–${pct(s.aPassCi[1])}`} />
                <Stat
                  label={`B · ${run.targetB!.name}`}
                  value={pct(s.bPassRate)}
                  hint={`通过率 · 区间 ${pct(s.bPassCi[0])}–${pct(s.bPassCi[1])}`}
                  tone={s.bPassRate > s.aPassRate + 1e-9 ? "ok" : s.bPassRate < s.aPassRate - 1e-9 ? "bad" : undefined}
                />
                <Stat label="变好 / 变差 / 持平" value={`${s.better} / ${s.worse} / ${s.same}`} hint={s.errors ? `${s.errors} 题调用失败` : "逐题比较"} tone={s.worse ? "bad" : s.better ? "ok" : undefined} />
                <Stat label="结论可信度" value={pValueText(s.pValue)} hint={pValueHint(s.pValue, s.better + s.worse)} />
                <Stat label="响应耗时（中位数）" value={`${fmtMs(s.aLatencyP50)} → ${fmtMs(s.bLatencyP50)}`} hint={latencyHint(s.aLatencyP50, s.bLatencyP50)} />
              </>
            ) : (
              <>
                <Stat label={`通过率 · ${run.targetA.name}`} value={pct(s.aPassRate)} hint={`区间 ${pct(s.aPassCi[0])}–${pct(s.aPassCi[1])}`} tone={s.aPassRate >= 0.8 ? "ok" : "bad"} />
                <Stat label="通过 / 不通过" value={`${counts.pass ?? 0} / ${counts.fail ?? 0}`} hint={s.errors ? `${s.errors} 题调用失败` : undefined} />
                <Stat label="响应耗时（中位数）" value={fmtMs(s.aLatencyP50)} />
              </>
            )}
          </div>
        </>
      ) : null}

      {run.results.length ? (
        <section className="eo-stack">
          <div className="eo-filter-row" role="tablist">
            {order
              .filter((o) => counts[o])
              .map((o) => (
                <button key={o} type="button" role="tab" aria-selected={activeFilter === o} className={`${activeFilter === o ? "on" : ""} is-${OUTCOME[o].tone}`} onClick={() => setFilter(o)}>
                  {OUTCOME[o].label} {counts[o]}
                </button>
              ))}
            <button type="button" role="tab" aria-selected={activeFilter === "all"} className={activeFilter === "all" ? "on" : ""} onClick={() => setFilter("all")}>
              全部 {run.results.length}
            </button>
          </div>
          <ul className="eo-results">
            {shown.map((r) => (
              <li key={r.caseId} className={open === r.caseId ? "open" : ""}>
                <button type="button" className="eo-case-head" onClick={() => setOpen(open === r.caseId ? null : r.caseId)}>
                  <OaBadge tone={OUTCOME[r.outcome].tone}>{OUTCOME[r.outcome].label}</OaBadge>
                  <span className="eo-case-q">{r.question}</span>
                  <span className="eo-muted eo-case-why">{oneLineWhy(r, compare)}</span>
                </button>
                {open === r.caseId ? <CaseDetail r={r} run={run} /> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "bad" }) {
  return (
    <div className={`eo-stat${tone ? ` is-${tone}` : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

function pValueText(p: number | null) {
  if (p == null) return "—";
  if (p < 0.05) return "可信";
  if (p < 0.2) return "偏可信";
  return "可能是偶然";
}

function pValueHint(p: number | null, n: number) {
  if (p == null) return n ? "" : "两边没有胜负差异";
  return `p = ${p < 0.001 ? "<0.001" : p.toFixed(3)}${p >= 0.05 ? "，题目再多些更有把握" : ""}`;
}

function latencyHint(a: number, b: number) {
  if (!a || !b) return "";
  const d = (b - a) / a;
  if (Math.abs(d) < 0.1) return "基本持平";
  return d > 0 ? `慢了 ${Math.round(d * 100)}%` : `快了 ${Math.round(-d * 100)}%`;
}

function failedChecks(s?: SideSample) {
  return s?.grade.checks.filter((c) => !c.pass).map((c) => c.detail || c.label) ?? [];
}

function oneLineWhy(r: CaseResult, compare: boolean): string {
  const side = compare && (r.outcome === "worse" || r.outcome === "better") ? (r.outcome === "worse" ? r.b[0] : r.a[0]) : r.a[0];
  if (r.outcome === "error") return (r.a.find((x) => x.error) ?? r.b.find((x) => x.error))?.error?.slice(0, 60) ?? "";
  if (compare && r.pair?.consistent && r.pair.winner !== "tie" && r.aPassRate === r.bPassRate) return r.pair.reason.slice(0, 60);
  const bad = failedChecks(side);
  if (bad.length) return bad[0]!.slice(0, 60);
  return side?.grade.judge?.reason.slice(0, 60) ?? "";
}

function SideView({ title, samples }: { title: string; samples: SideSample[] }) {
  const s = samples[0];
  if (!s) return null;
  const passN = samples.filter((x) => x.grade.pass).length;
  return (
    <div className="eo-side">
      <div className="eo-row-between">
        <strong>{title}</strong>
        <span className="eo-actions">
          {samples.length > 1 ? <span className="eo-muted">{samples.length} 次中 {passN} 次通过</span> : null}
          <OaBadge tone={s.error ? "warn" : s.grade.pass ? "ok" : "danger"}>{s.error ? "失败" : s.grade.pass ? "通过" : "不通过"}</OaBadge>
          <span className="eo-muted">{fmtMs(s.latencyMs)}</span>
        </span>
      </div>
      {s.error ? <p className="eo-err">{s.error}</p> : <div className="eo-answer">{s.answer || <em className="eo-muted">（空回答）</em>}</div>}
      {s.grade.checks.length ? (
        <ul className="eo-checks">
          {s.grade.checks.map((c) => (
            <li key={c.id} className={c.pass ? "ok" : "bad"}>
              {c.pass ? "✓" : "✗"} {c.label}
              {c.detail ? <span className="eo-muted"> · {c.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {s.grade.judge ? (
        <p className="eo-judge">
          <b>裁判：</b>
          {s.grade.judge.verdict === "pass" ? "判对" : s.grade.judge.verdict === "fail" ? "判错" : "拿不准"} · {s.grade.judge.reason}
        </p>
      ) : null}
      {s.citations.length ? (
        <details className="eo-details">
          <summary>引用（{s.citations.length}）</summary>
          <ol>
            {s.citations.slice(0, 5).map((c, i) => (
              <li key={i}>{c.slice(0, 240)}</li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

function CaseDetail({ r, run }: { r: CaseResult; run: EvalRun }) {
  return (
    <div className="eo-detail">
      {r.reference ? (
        <p className="eo-ref">
          <b>参考答案：</b>
          {r.reference}
        </p>
      ) : null}
      {r.pair ? (
        <p className="eo-pair">
          <b>A/B 对比：</b>
          {r.pair.winner === "tie" ? (r.pair.consistent ? "两边差不多" : "交换顺序后裁判结论不一致，按平局算") : `${r.pair.winner} 更好`}
          {r.pair.reason ? ` · ${r.pair.reason}` : ""}
        </p>
      ) : null}
      <div className={run.targetB ? "eo-sides" : ""}>
        <SideView title={`A · ${run.targetA.name}`} samples={r.a} />
        {run.targetB ? <SideView title={`B · ${run.targetB.name}`} samples={r.b} /> : null}
      </div>
    </div>
  );
}

function reportMarkdown(run: EvalRun): string {
  const s = run.summary;
  const L: string[] = [`# ${run.name}`, "", `- 测试集：${run.suiteName}（${run.progress.total} 题）`, `- A：${run.targetA.name}`];
  if (run.targetB) L.push(`- B：${run.targetB.name}`);
  L.push(`- 裁判：${run.judgeModel ?? "仅规则"}`, `- 时间：${run.createdAt}`, "");
  if (s) {
    L.push(`## 结论：${s.verdictTitle}`, "", ...s.reasons.map((x) => `- ${x}`), "");
    if (s.compare) {
      L.push(
        `| 指标 | A | B |`,
        `| --- | --- | --- |`,
        `| 通过率 | ${pct(s.aPassRate)} | ${pct(s.bPassRate)} |`,
        `| 耗时中位数 | ${fmtMs(s.aLatencyP50)} | ${fmtMs(s.bLatencyP50)} |`,
        "",
        `变好 ${s.better} · 变差 ${s.worse} · 持平 ${s.same} · 失败 ${s.errors} · p=${s.pValue?.toFixed(3) ?? "—"}`,
        "",
      );
    } else {
      L.push(`通过率 ${pct(s.aPassRate)}（区间 ${pct(s.aPassCi[0])}–${pct(s.aPassCi[1])}）`, "");
    }
  }
  const pick = run.results.filter((r) => r.outcome === "worse" || r.outcome === "fail" || r.outcome === "error");
  if (pick.length) {
    L.push(`## 需要关注的题（${pick.length}）`, "");
    for (const r of pick) {
      L.push(`### [${OUTCOME[r.outcome].label}] ${r.question}`, "");
      if (r.reference) L.push(`> 参考：${r.reference}`, "");
      const side = (name: string, xs: SideSample[]) => {
        const x = xs[0];
        if (!x) return;
        L.push(`**${name}**：${x.error ? `调用失败：${x.error}` : x.answer.replace(/\n+/g, " ").slice(0, 400)}`, "");
        const bad = failedChecks(x);
        if (bad.length) L.push(`- 未通过：${bad.join("；")}`);
        if (x.grade.judge) L.push(`- 裁判：${x.grade.judge.reason}`);
        L.push("");
      };
      side(`A · ${run.targetA.name}`, r.a);
      if (run.targetB) side(`B · ${run.targetB.name}`, r.b);
      if (r.pair?.reason) L.push(`- A/B 对比：${r.pair.reason}`, "");
    }
  }
  return L.join("\n");
}
