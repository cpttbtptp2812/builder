import { useEffect, useMemo, useRef, useState } from "react";
import { getTeamToken } from "../../lib/apiClient";
import { deskArgLabel } from "../../lib/deskArgLabels";
import type { RunEvent } from "../../lib/platformProtocol";
import { reduceRun, type RunNodeView, type RunView } from "../../lib/runReducer";
import { LAB_SKILLS, labFetch, labRunApi, requirementsOf, useLabSession, type LabSkillId, type RunApi } from "./labApi";

type Track = { runId: string; events: RunEvent[]; live: boolean };

/** fetch 读 SSE：EventSource 带不了团队令牌，而会话归属要按登录身份判 */
export function useRunStream(api: RunApi, runId: string | null): Track | null {
  const [track, setTrack] = useState<Track | null>(null);
  useEffect(() => {
    if (!runId) {
      setTrack(null);
      return;
    }
    setTrack({ runId, events: [], live: true });
    const ctrl = new AbortController();
    const push = (ev: RunEvent) =>
      setTrack((t) => (t && t.runId === runId && !t.events.some((x) => x.seq === ev.seq) ? { ...t, events: [...t.events, ev] } : t));
    const done = () => setTrack((t) => (t && t.runId === runId ? { ...t, live: false } : t));
    void (async () => {
      try {
        const token = getTeamToken();
        const res = await fetch(api.streamUrl(runId), { signal: ctrl.signal, headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok || !res.body) return done();
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done: end } = await reader.read();
          if (end) break;
          buf += dec.decode(value, { stream: true });
          let cut: number;
          while ((cut = buf.indexOf("\n\n")) >= 0) {
            const block = buf.slice(0, cut);
            buf = buf.slice(cut + 2);
            const type = block.match(/^event: ?(.*)$/m)?.[1]?.trim();
            const data = block
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).replace(/^ /, ""))
              .join("\n");
            if (type === "run-event" && data) push(JSON.parse(data) as RunEvent);
          }
        }
      } catch {
        /* aborted or network */
      }
      done();
    })();
    return () => ctrl.abort();
  }, [api, runId]);
  return track;
}

const resultKey = (n: RunNodeView) => JSON.stringify(n.result ?? null);

function detailOf(n: RunNodeView): string {
  if (n.status === "pending") return "";
  if (typeof n.result === "string") return n.result;
  const r = n.result as { detail?: string; error?: string; summary?: string; text?: string; message?: string } | null;
  return String(r?.detail ?? r?.error ?? r?.summary ?? r?.text ?? r?.message ?? (n.label !== n.name ? n.label : ""));
}

function gridOf(n: RunNodeView): { columns: string[]; rows: string[][] } | null {
  const g = (n.result as { grid?: { columns: string[]; rows: string[][] } } | null)?.grid;
  return g && Array.isArray(g.columns) ? g : null;
}

function Timeline({
  view,
  diff,
  selected,
  onSelect,
  label,
}: {
  view: RunView;
  diff?: Set<number>;
  selected: number | null;
  onSelect: (i: number) => void;
  label: string;
}) {
  const total = Math.max(1, view.nodes.reduce((s, n) => s + Math.max(n.ms ?? 0, 1), 0));
  const W = 1000;
  const minW = 14;
  const free = W - minW * view.nodes.length;
  let x = 0;
  const boxes = view.nodes.map((n) => {
    const w = minW + (free * Math.max(n.ms ?? 0, 1)) / total;
    const b = { n, x, w };
    x += w;
    return b;
  });
  return (
    <div className="pl-timeline">
      <div className="pl-timeline-head">
        <span>{label}</span>
        <em>
          {view.status === "running" ? "运行中" : view.status === "completed" ? "办完" : view.status === "failed" ? "失败" : "排队"}
          {view.totalMs != null ? ` · ${view.totalMs} ms` : ""}
          {view.fork ? ` · 从「${view.nodes[view.fork.index]?.name}」分叉` : ""}
          {view.resumes.length ? ` · 恢复 ${view.resumes.length} 次` : ""}
        </em>
      </div>
      <svg viewBox={`0 0 ${W} 54`} preserveAspectRatio="none" className="pl-timeline-svg" role="img" aria-label={`${label}时间轴`}>
        {boxes.map(({ n, x: bx, w }) => (
          <g key={n.index} onClick={() => onSelect(n.index)} className="pl-tick-g">
            <rect
              x={bx + 1}
              y={10}
              width={Math.max(2, w - 2)}
              height={30}
              rx={4}
              className={`pl-tick is-${n.status}${n.inherited ? " is-inherited" : ""}${diff?.has(n.index) ? " is-diff" : ""}${selected === n.index ? " is-sel" : ""}`}
            />
            {diff?.has(n.index) ? <circle cx={bx + w / 2} cy={5} r={3} className="pl-tick-dot" /> : null}
            <title>{`${n.index + 1}. ${n.name} · ${n.tool}${n.ms != null ? ` · ${n.ms} ms` : ""}${n.attempt > 1 ? ` · 第 ${n.attempt} 次尝试` : ""}`}</title>
          </g>
        ))}
      </svg>
      <div className="pl-timeline-labels">
        {view.nodes.map((n) => (
          <button key={n.index} type="button" className={selected === n.index ? "is-sel" : ""} onClick={() => onSelect(n.index)}>
            {n.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export type RunSummary = { runId: string; label: string; status: string };

/** 一次运行的时间轴：实时推流、拖回任意事件、在某一步改参数分叉并逐步对比 */
export type ForkAdopt = { stepId: string; stepLabel: string; args: Record<string, unknown> };

export function RunReplay({
  api,
  runId,
  onRunsChange,
  emptyHint,
  onAdoptFork,
  focusIndex,
}: {
  api: RunApi;
  runId: string | null;
  onRunsChange?: (runs: RunSummary[]) => void;
  emptyHint?: string;
  onAdoptFork?: (fork: ForkAdopt) => void;
  focusIndex?: number | null;
}) {
  const [forkId, setForkId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  useEffect(() => {
    setForkId(null);
    setScrub(null);
    setSelected(focusIndex ?? null);
    setError(null);
  }, [runId, focusIndex]);
  const main = useRunStream(api, runId);
  const fork = useRunStream(api, forkId);

  const lastSeq = main?.events.length ? main.events[main.events.length - 1]!.seq : 0;
  const seq = scrub ?? lastSeq;
  const view = useMemo(() => (main?.events.length ? reduceRun(main.events, seq) : null), [main, seq]);
  const full = useMemo(() => (main?.events.length ? reduceRun(main.events) : null), [main]);
  const forkView = useMemo(() => (fork?.events.length ? reduceRun(fork.events) : null), [fork]);
  const diff = useMemo(() => {
    if (!full || !forkView) return undefined;
    const s = new Set<number>();
    forkView.nodes.forEach((n, i) => {
      if (n.status !== "pending" && full.nodes[i] && resultKey(n) !== resultKey(full.nodes[i]!)) s.add(i);
    });
    return s;
  }, [full, forkView]);

  const lastRunsKey = useRef("");
  useEffect(() => {
    const runs = [full, forkView]
      .filter((v): v is RunView => !!v)
      .map((v) => {
        const name = LAB_SKILLS.find((s) => s.id === v.skillId)?.label ?? v.skillId;
        const at = v.createdAt ? new Date(v.createdAt).toLocaleTimeString() : "";
        return { runId: v.runId, label: `${name}${v.fork ? ` · 分叉（${v.nodes[v.fork.index]?.name ?? v.fork.stepId}）` : ""} · ${at}`, status: v.status };
      });
    const key = JSON.stringify(runs);
    if (key !== lastRunsKey.current) {
      lastRunsKey.current = key;
      onRunsChange?.(runs);
    }
  }, [full, forkView, onRunsChange]);

  const sel = selected != null ? full?.nodes[selected] ?? null : null;
  const editable = sel?.args ? Object.entries(sel.args).filter(([k, v]) => k !== "query" && ["string", "number", "boolean"].includes(typeof v)) : [];

  async function doFork() {
    if (!sel || !full) return;
    const args: Record<string, unknown> = {};
    for (const [k, v] of editable) {
      const raw = edits[`${sel.index}:${k}`];
      if (raw === undefined || raw === String(v)) continue;
      args[k] = typeof v === "number" ? Number(raw) : typeof v === "boolean" ? raw === "true" : raw;
    }
    if (!Object.keys(args).length) return setError("先改一个参数再分叉");
    setError(null);
    const r = await api.fork(full.runId, sel.stepId, args);
    if (!r.ok) return setError(r.error);
    setForkId(r.data.runId);
  }

  const shown = view && selected != null ? view.nodes[selected] : null;
  const forkNode = forkView && selected != null ? forkView.nodes[selected] : null;

  return (
    <>
      {error ? <p className="pl-error">{error}</p> : null}

      {view && full ? (
        <>
          <Timeline view={view} selected={selected} onSelect={setSelected} label="原运行" />
          <div className="pl-scrub">
            <input
              type="range"
              min={1}
              max={Math.max(1, lastSeq)}
              value={seq}
              onChange={(e) => setScrub(Number(e.target.value) >= lastSeq ? null : Number(e.target.value))}
              aria-label="回到某个事件"
            />
            <span>
              事件 {seq} / {lastSeq}
              {scrub != null ? " · 回放中" : main?.live ? " · 实时" : ""}
            </span>
          </div>
          {forkView ? <Timeline view={forkView} diff={diff} selected={selected} onSelect={setSelected} label="分叉" /> : null}
          {forkView && diff ? (
            <p className="pl-hint">
              {diff.size ? `分叉后有 ${diff.size} 步结果和原运行不同（圆点标出）。` : forkView.status === "completed" ? "分叉跑完，所有步骤结果与原运行一致——这个参数在这批材料上不起作用。" : "分叉运行中…"}
            </p>
          ) : null}
          {onAdoptFork && forkView?.fork && forkView.status === "completed" && diff?.size ? (
            <div className="pl-adopt">
              <span>
                想以后都这样办：把「{forkView.nodes[forkView.fork.index]?.name ?? forkView.fork.stepId}」的{" "}
                {Object.entries(forkView.fork.args)
                  .map(([k, v]) => `${deskArgLabel(k) ?? k} = ${String(v)}`)
                  .join("、")}{" "}
                写进技能草稿，过了发版检查再生效。
              </span>
              <button
                type="button"
                className="pl-btn pl-btn--primary"
                onClick={() =>
                  onAdoptFork({ stepId: forkView.fork!.stepId, stepLabel: forkView.nodes[forkView.fork!.index]?.name ?? forkView.fork!.stepId, args: forkView.fork!.args })
                }
              >
                写进技能草稿
              </button>
            </div>
          ) : null}

          {shown ? (
            <div className={`pl-node${forkNode ? " is-split" : ""}`}>
              <div className="pl-node-col">
                <h3>
                  {shown.index + 1}. {shown.name}
                  <small>
                    {shown.tool} · {shown.status === "pending" ? "这一刻还没开始" : shown.ms != null ? `${shown.ms} ms` : "进行中"}
                    {shown.gateway ? ` · ${shown.gateway.allowed ? shown.gateway.capability : "未授权"} · 限时 ${Math.round(shown.gateway.timeoutMs / 1000)} 秒` : ""}
                    {shown.attempt > 1 ? ` · 第 ${shown.attempt} 次尝试` : ""}
                    {shown.checkpoint ? ` · 检查点 ${shown.checkpoint.sha256.slice(0, 10)}…` : ""}
                  </small>
                </h3>
                {detailOf(shown) ? <p className="pl-node-detail">{detailOf(shown)}</p> : null}
                <GridPreview grid={gridOf(shown)} />
                {sel && editable.length && !main?.live ? (
                  <div className="pl-fork">
                    <strong>改这一步的参数，从这里分叉</strong>
                    <div className="pl-fork-grid">
                      {editable.map(([k, v]) => (
                        <label key={k} title={k}>
                          <span>{deskArgLabel(k) ?? k}</span>
                          <input
                            value={edits[`${sel.index}:${k}`] ?? String(v)}
                            onChange={(e) => setEdits((m) => ({ ...m, [`${sel.index}:${k}`]: e.target.value }))}
                          />
                        </label>
                      ))}
                    </div>
                    <button type="button" className="pl-btn" onClick={() => void doFork()} disabled={fork?.live}>
                      {fork?.live ? "分叉运行中…" : "分叉重跑"}
                    </button>
                  </div>
                ) : null}
              </div>
              {forkNode ? (
                <div className="pl-node-col is-fork">
                  <h3>
                    分叉
                    <small>{forkNode.inherited ? "继承自原运行" : forkNode.ms != null ? `${forkNode.ms} ms · 重新执行` : forkNode.status}</small>
                  </h3>
                  {detailOf(forkNode) ? <p className="pl-node-detail">{detailOf(forkNode)}</p> : null}
                  <GridPreview grid={gridOf(forkNode)} />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="pl-hint">点时间轴上的任意一步，看它当时的输入输出。</p>
          )}
        </>
      ) : runId ? (
        <p className="pl-hint">{main?.live ? "正在读取运行记录…" : "没有读到这次运行的事件。"}</p>
      ) : (
        <div className="pl-empty">
          <strong>还没有运行</strong>
          <span>{emptyHint ?? "每一步的耗时、参数、结果和检查点都会实时出现在时间轴上。"}</span>
        </div>
      )}
    </>
  );
}

export function MissionControl({ onRunsChange }: { onRunsChange?: (runs: RunSummary[]) => void }) {
  const lab = useLabSession();
  const [skill, setSkill] = useState<LabSkillId>("ledger-desk");
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const need = requirementsOf(skill);
  const missing = need.filter((r) => !lab.has(r.slot));

  async function start() {
    setError(null);
    if (!lab.sessionId || missing.length) return setError(`先导入：${missing.map((m) => m.label).join("、")}`);
    setBusy(true);
    const r = await labFetch<{ runId: string }>("/api/runs", { sessionId: lab.sessionId, skillId: skill });
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setRunId(r.data.runId);
  }

  return (
    <section className="pl-panel">
      <header className="pl-panel-head">
        <div>
          <h2>运行台</h2>
          <p>每一步都写进只追加的事件流。拖动时间轴回到任意时刻；在某一步改参数，从那里分叉重跑，左右对比。</p>
        </div>
        <div className="pl-actions">
          <div className="pl-seg">
            {LAB_SKILLS.map((s) => (
              <button key={s.id} type="button" className={skill === s.id ? "is-on" : ""} onClick={() => setSkill(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
          <button type="button" className="pl-btn pl-btn--primary" onClick={() => void start()} disabled={busy}>
            用导入的材料办一次
          </button>
        </div>
      </header>
      {missing.length ? <p className="pl-hint">这项技能需要：{need.map((r) => `${r.label}${lab.has(r.slot) ? " ✓" : ""}`).join("、")}。在上方「材料」里导入。</p> : null}
      {error ? <p className="pl-error">{error}</p> : null}
      <RunReplay api={labRunApi} runId={runId} onRunsChange={onRunsChange} emptyHint="导入材料后点「用导入的材料办一次」。每一步的耗时、参数、结果和检查点都会实时出现在时间轴上。" />
    </section>
  );
}

export function GridPreview({ grid, highlight }: { grid: { columns: string[]; rows: string[][] } | null; highlight?: { row: number; column: string } | null }) {
  if (!grid) return null;
  const hc = highlight ? grid.columns.indexOf(highlight.column) : -1;
  return (
    <div className="pl-grid-wrap">
      <table className="pl-grid">
        <thead>
          <tr>
            {grid.columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grid.rows.slice(0, 12).map((r, ri) => (
            <tr key={ri}>
              {grid.columns.map((_, ci) => (
                <td key={ci} className={highlight && highlight.row === ri + 1 && ci === hc ? "is-hit" : ""}>
                  {r[ci]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {grid.rows.length > 12 ? <small>共 {grid.rows.length} 行，只显示前 12 行</small> : null}
    </div>
  );
}
