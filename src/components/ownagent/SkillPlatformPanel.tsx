import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";
import { fetchSkillRunsAsync, runSkillAsync, type SkillRunRecord } from "../../lib/backendBridge";
import {
  explainDiscovery,
  getLiveCatalog,
  ROUTER_EXAMPLES,
  SKILL_CATALOG,
  type AgentSkill,
  type SkillResult,
  type SkillTraceStep,
} from "../../lib/agentSkills";
import {
  compileParsedOnly,
  hydrateSkill,
  parseSkillMarkdown,
  SAMPLE_SKILL_MD,
  type SkillManifest,
} from "../../lib/skillMarkdown";
import { effectLabel } from "../../lib/skillSemcompiler";
import { compileSummary, devIssueCount, diagLabel, flowEdgeText } from "./skillDevLabels";
import {
  diffTrace,
  loadSkillBaseline,
  proveSkill,
  saveSkillBaseline,
  type TraceDiff,
  type TraceEvalRow,
} from "../../lib/provingGround";
import { SKILL_CATALOG as BUILTIN_CATALOG } from "../../lib/agentSkills";
import { getAppliedSkill, getPublishedVersion, submitCompareDraft, SKILL_PUBLISH_EVENT } from "../../lib/skillCompareStore";
import {
  downloadText,
  installImportedMarkdown,
  loadImportedSkills,
  parseImportPayload,
  readImportedRecords,
  removeImportedSkill,
} from "../../lib/importedSkills";

function defaultQuery(skill: AgentSkill) {
  if (skill.skillPath.startsWith("imported://")) return skill.triggers.slice(0, 3).join(" ") || skill.name;
  if (skill.id === "release-inspector") return "帮我巡检 https://example.com 能否上线";
  if (skill.id === "knowledge-lookup") return "检索 iMean 定位语料 chunkId";
  if (skill.id === "policy-desk") return "满一年年假几天";
  if (skill.id === "dom-probe") return "分析页面 DOM 结构和可交互元素";
  if (skill.id === "workflow-orchestrator") return "执行 workflow 自动化回放流程";
  if (skill.id === "site-analyzer") return "分析本站性能和探活情况";
  const hit = ROUTER_EXAMPLES.find((e) => skill.triggers.some((t) => e.query.toLowerCase().includes(t.toLowerCase())));
  return hit?.query ?? skill.triggers.slice(0, 3).join(" ");
}

function takenIds(builtin: AgentSkill[], imported: AgentSkill[]) {
  return new Set([...builtin, ...imported].map((s) => s.id));
}

function stepTone(stepId: string, steps: AgentSkill["steps"], trace: SkillTraceStep[], running: boolean) {
  const hit = trace.find((t) => t.stepId === stepId);
  if (hit) return hit.ok ? "done" : "fail";
  if (!running) return "idle";
  const pending = steps.filter((s) => !trace.some((t) => t.stepId === s.id));
  return pending[0]?.id === stepId ? "active" : "idle";
}

function stepTitle(step: { tool: string; label: string }) {
  if (step.tool.startsWith("__")) return step.label.split(" · ")[0];
  return step.tool;
}

function stepCaption(step: { tool: string; label: string }) {
  const parts = step.label.split(" · ");
  if (parts.length > 1) return parts.slice(1).join(" · ");
  return step.tool.startsWith("__") ? "" : step.label;
}

/** OwnAgent · 技能工作台：工具链是重点，跑是主操作，导入先解析再入库 */
export function SkillPlatformPanel() {
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imported, setImported] = useState<AgentSkill[]>([]);
  const [liveTick, setLiveTick] = useState(0);
  const [skillId, setSkillId] = useState(SKILL_CATALOG[0]?.id ?? "site-analyzer");
  const [mode, setMode] = useState<"run" | "import">("run");
  const [copied, setCopied] = useState(false);
  const [importSeed, setImportSeed] = useState<string | null>(null);

  useEffect(() => {
    setImported(loadImportedSkills());
  }, []);

  useEffect(() => {
    const bump = () => setLiveTick((n) => n + 1);
    window.addEventListener(SKILL_PUBLISH_EVENT, bump);
    return () => window.removeEventListener(SKILL_PUBLISH_EVENT, bump);
  }, []);

  const liveBuiltin = useMemo(() => getLiveCatalog(), [liveTick]);
  const catalog = useMemo(() => [...liveBuiltin, ...imported], [liveBuiltin, imported]);
  const skill = catalog.find((s) => s.id === skillId) ?? catalog[0]!;
  const importedSet = useMemo(() => new Set(imported.map((s) => s.id)), [imported]);

  function select(id: string) {
    setSkillId(id);
    setMode("run");
  }

  function refreshImported(nextId?: string) {
    const next = loadImportedSkills();
    setImported(next);
    if (nextId) {
      setSkillId(nextId);
      setMode("run");
    }
  }

  function exportCurrent() {
    downloadText(`${skill.id}.SKILL.md`, skill.manifest);
  }

  function exportAll() {
    const bundle = {
      skills: [
        ...SKILL_CATALOG.map((s) => ({ id: s.id, raw: s.manifest, importedAt: "builtin" })),
        ...readImportedRecords(),
      ],
    };
    downloadText("ownagent-skills.json", JSON.stringify(bundle, null, 2), "application/json;charset=utf-8");
  }

  async function copyCurrent() {
    try {
      await navigator.clipboard.writeText(skill.manifest);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      downloadText(`${skill.id}.SKILL.md`, skill.manifest);
    }
  }

  function dropImported(id: string) {
    removeImportedSkill(id);
    const next = loadImportedSkills();
    setImported(next);
    if (skillId === id) setSkillId(SKILL_CATALOG[0]?.id ?? next[0]?.id ?? "site-analyzer");
  }

  return (
    <div className="oa-ui oa-page own-skill-forge" ref={rootRef}>
      <header className="oa-page-head own-skill-page-head">
        <div className="oa-page-head-main">
          <h1>技能编辑</h1>
          <p>改 Skill、试跑，满意后点「提交新版本」。</p>
        </div>
          <ol className="own-skill-steps-guide" aria-label="使用步骤">
          <li><strong>选技能</strong><span>左侧目录</span></li>
          <li><strong>试跑</strong><span>基于现用版</span></li>
          <li><strong>提交</strong><span>交给运维对比上线</span></li>
        </ol>
      </header>
      <div className="own-skill-platform">
        <aside className="own-skill-rail" aria-label="技能目录">
          <header className="own-skill-rail-head">
            <strong>技能</strong>
            <span>{catalog.length}</span>
          </header>
          <ul className="own-skill-index">
            {SKILL_CATALOG.map((s, i) => {
              const ver = getPublishedVersion(s.id);
              const onLive = Boolean(getAppliedSkill(s.id));
              return (
              <li key={s.id}>
                <button type="button" className={s.id === skill.id && mode === "run" ? "on" : ""} onClick={() => select(s.id)}>
                  <em>{String(i + 1).padStart(2, "0")}</em>
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {onLive ? `v${ver} 已上线` : `v${ver} 出厂`}
                      {s.runnable ? ` · ${s.steps.length} 步` : " · 仅文档"}
                      {!s.compileOk ? " · 待检查" : ""}
                    </small>
                  </span>
                </button>
              </li>
            );})}
          </ul>
          {imported.length > 0 ? (
            <>
              <header className="own-skill-rail-head">
                <strong>已导入</strong>
                <span>{imported.length}</span>
              </header>
              <ul className="own-skill-index">
                {imported.map((s) => (
                  <li key={s.id}>
                    <button type="button" className={s.id === skill.id && mode === "run" ? "on" : ""} onClick={() => select(s.id)}>
                      <em>IN</em>
                      <span>
                        <strong>{s.name}</strong>
                        <small>{s.runnable ? `${s.steps.length} 步` : "文档"}</small>
                      </span>
                    </button>
                    <button type="button" className="own-skill-x" onClick={() => dropImported(s.id)} aria-label={`移除 ${s.name}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <button type="button" className={mode === "import" ? "own-skill-import-btn on" : "own-skill-import-btn"} onClick={() => setMode("import")}>
            + 导入 SKILL.md
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".md,.markdown,.json,text/markdown,application/json"
            hidden
            multiple
            onChange={async (e) => {
              const files = e.target.files;
              e.target.value = "";
              if (!files?.length) return;
              const text = await filesToDraft(files);
              setImportSeed(text);
              setMode("import");
            }}
          />
        </aside>

        <div className="own-skill-stage">
          {mode === "import" ? (
            <ImportDock
              taken={takenIds(SKILL_CATALOG, imported)}
              fileRef={fileRef}
              seed={importSeed}
              onInstalled={(id) => {
                setImportSeed(null);
                refreshImported(id);
              }}
              onCancel={() => {
                setImportSeed(null);
                setMode("run");
              }}
            />
          ) : (
            <RunDock
              key={skill.id}
              skill={skill}
              rootRef={rootRef}
              copied={copied}
              isImported={importedSet.has(skill.id)}
              onExport={exportCurrent}
              onExportAll={exportAll}
              onCopy={() => void copyCurrent()}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function RunDock({
  skill,
  rootRef,
  copied,
  isImported,
  onExport,
  onExportAll,
  onCopy,
}: {
  skill: AgentSkill;
  rootRef: RefObject<HTMLDivElement | null>;
  copied: boolean;
  isImported: boolean;
  onExport: () => void;
  onExportAll: () => void;
  onCopy: () => void;
}) {
  const [query, setQuery] = useState(defaultQuery(skill));
  const [running, setRunning] = useState(false);
  const [runtime, setRuntime] = useState<"server" | "local" | null>(null);
  const [trace, setTrace] = useState<SkillTraceStep[]>([]);
  const [result, setResult] = useState<SkillResult | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [proveRow, setProveRow] = useState<TraceEvalRow | null>(null);
  const [proving, setProving] = useState(false);
  const [shadowDiff, setShadowDiff] = useState<TraceDiff | null>(null);
  const [hasBaseline, setHasBaseline] = useState(false);
  const [runHistory, setRunHistory] = useState<SkillRunRecord[]>([]);
  const [submitToast, setSubmitToast] = useState<string | null>(null);
  const issues = devIssueCount(skill);
  const liveVersion = getPublishedVersion(skill.id);
  const applied = getAppliedSkill(skill.id);

  function submitToCompare() {
    const draft = submitCompareDraft(skill.id, skill.manifest, skill.name, "开发者模式提交");
    setSubmitToast(`已提交 v${draft.version}，去「技能管理」发布`);
    window.setTimeout(() => setSubmitToast(null), 4000);
  }

  function goCompare() {
    window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "compare" } }));
  }

  useEffect(() => {
    setQuery(defaultQuery(skill));
    setTrace([]);
    setResult(null);
    setRuntime(null);
    setOpenId(null);
    setProveRow(null);
    setShadowDiff(null);
    setHasBaseline(Boolean(loadSkillBaseline(skill.id)?.length));
    void fetchSkillRunsAsync(skill.id, 5).then(setRunHistory);
  }, [skill.id]);

  const route = useMemo(() => (query.trim() ? explainDiscovery(query) : []), [query]);
  const winner = route.find((r) => r.score > 0);

  async function runProve() {
    setProving(true);
    setProveRow(null);
    try {
      setProveRow(await proveSkill(skill.id));
    } finally {
      setProving(false);
    }
  }

  async function run() {
    if (!skill.runnable) return;
    const text = query.trim();
    if (!text) return;
    setRunning(true);
    setTrace([]);
    setResult(null);
    try {
      const out = await runSkillAsync(skill, text, {
        snapshotRoot: rootRef.current ?? document.querySelector(".own-agent") ?? document.body,
        onStep: (step) =>
          setTrace((prev) => {
            const i = prev.findIndex((p) => p.stepId === step.stepId);
            if (i >= 0) {
              const next = [...prev];
              next[i] = step;
              return next;
            }
            return [...prev, step];
          }),
      });
      setTrace(out.trace);
      setResult(out.result);
      setRuntime(out.runtime);
      const baseline = loadSkillBaseline(skill.id);
      if (baseline?.length) setShadowDiff(diffTrace(baseline, out.trace));
      else setShadowDiff(null);
      void fetchSkillRunsAsync(skill.id, 5).then(setRunHistory);
    } finally {
      setRunning(false);
    }
  }

  function pinBaseline() {
    if (!trace.length) return;
    saveSkillBaseline(skill.id, trace);
    setHasBaseline(true);
    setShadowDiff(null);
  }

  return (
    <>
      <header className="own-skill-head own-skill-head--run">
        <div>
          <h3>{skill.name}</h3>
          <p className="own-skill-desc">{skill.description}</p>
        </div>
        <div className="own-skill-head-actions">
          <span className={applied ? "own-skill-badge ok" : "own-skill-badge"}>
            {applied ? `现用 v${liveVersion}` : `出厂 v${liveVersion}`}
          </span>
          <span className={skill.runnable ? "own-skill-badge ok" : "own-skill-badge"}>{skill.runnable ? "可试跑" : "仅文档"}</span>
          <button type="button" className="own-dev-submit-compare" onClick={submitToCompare} disabled={!skill.runnable}>
            提交新版本
          </button>
          <button type="button" className="own-dev-mode-trigger" onClick={() => setDevOpen(true)}>
            开发者检查
            {issues > 0 ? <em>{issues}</em> : null}
          </button>
        </div>
      </header>
      {submitToast ? <p className="own-skill-submit-toast">{submitToast} · <button type="button" className="own-skill-inline-btn" onClick={goCompare}>去对比</button></p> : null}

      {skill.steps.length > 0 ? (
        <ol className="own-skill-pipe" aria-label="执行顺序">
          {skill.steps.map((s, i) => (
            <li key={s.id} className={stepTone(s.id, skill.steps, trace, running)}>
              <em>{String(i + 1).padStart(2, "0")}</em>
              <span>
                <strong>{stepTitle(s)}</strong>
                {stepCaption(s) ? <small>{stepCaption(s)}</small> : null}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="own-skill-empty-stage">这份技能没有可执行步骤。请从左侧导入带 steps 的 SKILL.md，或在开发者检查里看原文。</p>
      )}

      {skill.runnable ? (
        <section className="own-skill-run-card">
          <div className="own-skill-run-card-head">
            <h4>试跑</h4>
            <p>用自然语言描述你要做的事，直接点运行即可（无需斜杠命令）。</p>
          </div>
          <textarea
            id="own-skill-query"
            className="own-skill-run-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：帮我巡检 https://example.com 能否上线"
            rows={2}
          />
          <div className="own-skill-run-actions">
            <button type="button" className="own-skill-run-primary" onClick={() => void run()} disabled={running || !query.trim()}>
              {running ? "运行中…" : "运行"}
            </button>
            {query.trim() && winner ? (
              <p className="own-skill-route-peek">
                若走自动路由，会交给 <strong>{winner.skill.name}</strong>
                {winner.skill.id !== skill.id ? "；此处仍按当前选中技能试跑" : ""}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {trace.length > 0 || result ? (
        <section className="own-skill-result-section">
          <header className="own-skill-result-head">
            <h4>运行结果</h4>
            {runtime ? <span>{runtime === "local" ? "浏览器" : "服务端"} · {trace.length} 步</span> : null}
          </header>
          {trace.length > 0 ? (
            <ol className="skill-pipeline-trace skill-pipeline-trace--compact">
              {trace.map((s, i) => (
                <li key={s.stepId} className={s.ok ? "ok" : "fail"}>
                  <button type="button" className="skill-pipeline-head" onClick={() => setOpenId(openId === s.stepId ? null : s.stepId)}>
                    <span className="skill-pipeline-idx">{String(i + 1).padStart(2, "0")}</span>
                    <code>{s.tool}</code>
                    <span className="skill-pipeline-label">{s.label}</span>
                    <span className="skill-pipeline-ms">{s.ms}ms</span>
                    <span className="skill-pipeline-chevron">{openId === s.stepId ? "▾" : "▸"}</span>
                  </button>
                  {openId === s.stepId && s.result != null ? (
                    <pre className="skill-pipeline-json">{JSON.stringify(s.result, null, 2)}</pre>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}
          <ResultBoard result={result} />
        </section>
      ) : null}

      {devOpen ? (
        <DeveloperModeSheet
          skill={skill}
          isImported={isImported}
          copied={copied}
          issues={issues}
          proveRow={proveRow}
          proving={proving}
          shadowDiff={shadowDiff}
          hasBaseline={hasBaseline}
          runHistory={runHistory}
          trace={trace}
          onClose={() => setDevOpen(false)}
          onProve={() => void runProve()}
          onPinBaseline={pinBaseline}
          onCopy={onCopy}
          onExport={onExport}
          onExportAll={onExportAll}
        />
      ) : null}
    </>
  );
}

function DeveloperModeSheet({
  skill,
  isImported,
  copied,
  issues,
  proveRow,
  proving,
  shadowDiff,
  hasBaseline,
  runHistory,
  trace,
  onClose,
  onProve,
  onPinBaseline,
  onCopy,
  onExport,
  onExportAll,
}: {
  skill: AgentSkill;
  isImported: boolean;
  copied: boolean;
  issues: number;
  proveRow: TraceEvalRow | null;
  proving: boolean;
  shadowDiff: TraceDiff | null;
  hasBaseline: boolean;
  runHistory: SkillRunRecord[];
  trace: SkillTraceStep[];
  onClose: () => void;
  onProve: () => void;
  onPinBaseline: () => void;
  onCopy: () => void;
  onExport: () => void;
  onExportAll: () => void;
}) {
  const ir = skill.ir;
  const errors = skill.diagnostics.filter((d) => d.level === "error");

  return (
    <div className="own-dev-sheet-backdrop" role="presentation" onClick={onClose}>
      <aside
        className="own-dev-sheet"
        role="dialog"
        aria-labelledby="own-dev-sheet-title"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="own-dev-sheet-head">
          <div>
            <p className="own-skill-kicker">{isImported ? "已导入" : "内置"}技能</p>
            <h2 id="own-dev-sheet-title">开发者检查</h2>
            <p className="own-dev-sheet-sub">改 SKILL.md 前先看这里：工具对不对、变量连没连上、触发词会不会抢。</p>
          </div>
          <button type="button" className="own-dev-sheet-close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>

        <div className="own-dev-sheet-body">
          <section className="own-dev-block">
            <header className="own-dev-block-head">
              <h3>静态检查</h3>
              <span className={skill.compileOk ? "own-skill-badge ok" : "own-skill-badge warn"}>{compileSummary(skill)}</span>
            </header>
            {skill.effectUpperBound ? (
              <p className="own-dev-meta">最高权限：{effectLabel(skill.effectUpperBound)}（只读 / 可写 / 需人工 等）</p>
            ) : null}
            <DiagnosticsList diagnostics={skill.diagnostics} />
          </section>

          {ir?.dataFlow.length ? (
            <section className="own-dev-block">
              <header className="own-dev-block-head">
                <h3>变量怎么传</h3>
                <span className="own-dev-block-hint">上一步产出 → 下一步读取</span>
              </header>
              <ul className="own-dev-flow-list">
                {ir.dataFlow.map((e, i) => (
                  <li key={`${e.from}-${e.stepId}-${i}`}>{flowEdgeText(e.from, e.stepId)}</li>
                ))}
              </ul>
            </section>
          ) : null}

          {ir?.triggerInterference.length ? (
            <section className="own-dev-block own-dev-block--warn">
              <header className="own-dev-block-head">
                <h3>触发词冲突</h3>
                <span className="own-dev-block-hint">用户说这些话时，可能进错技能</span>
              </header>
              <ul className="own-dev-interference-list">
                {ir.triggerInterference.map((t) => (
                  <li key={t.otherSkillId}>
                    与 <strong>{t.otherSkillId}</strong> 共用：{t.shared.join("、")}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="own-dev-block">
            <header className="own-dev-block-head">
              <h3>质量回归</h3>
              <span className="own-dev-block-hint">不连外网，测工具链顺序对不对</span>
            </header>
            <div className="own-dev-actions-row">
              <button type="button" className="own-skill-run-primary own-skill-run-primary--sm" onClick={onProve} disabled={proving || !skill.runOk}>
                {proving ? "检测中…" : "一键 Mock 回归"}
              </button>
              {trace.length > 0 ? (
                <button type="button" className="own-dev-secondary-btn" onClick={onPinBaseline}>
                  {hasBaseline ? "更新对比基线" : "保存为对比基线"}
                </button>
              ) : null}
            </div>
            {proveRow ? (
              <p className={`own-skill-prove-result ${proveRow.pass ? "ok" : "fail"}`}>
                {proveRow.pass ? "回归通过" : "回归失败"}：{proveRow.detail}
              </p>
            ) : null}
            {shadowDiff ? (
              <p className={`own-skill-prove-result ${shadowDiff.sameSkeleton ? "ok" : "fail"}`}>
                与基线对比：{shadowDiff.sameSkeleton ? "工具链未变" : shadowDiff.summary}
              </p>
            ) : hasBaseline ? (
              <p className="own-dev-meta">已保存基线，试跑后会自动对比。</p>
            ) : null}
            {runHistory.length > 0 ? (
              <details className="own-skill-runs own-skill-runs--in-sheet">
                <summary>服务端最近 {runHistory.length} 次运行</summary>
                <ul>
                  {runHistory.map((r) => (
                    <li key={r.id}>
                      <span>{r.createdAt.slice(0, 16).replace("T", " ")}</span>
                      <code>{r.ok ? "成功" : "失败"}</code>
                      <small>{r.query.slice(0, 40)}</small>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section className="own-dev-block">
            <header className="own-dev-block-head">
              <h3>SKILL 源码</h3>
              <div className="own-dev-source-actions">
                <button type="button" onClick={onCopy}>{copied ? "已复制" : "复制"}</button>
                <button type="button" onClick={onExport}>导出</button>
                <button type="button" onClick={onExportAll}>全部 JSON</button>
              </div>
            </header>
            <p className="own-dev-meta">
              {skill.triggers.length} 个触发词 · {skill.tools.length} 个工具 · {skill.steps.length} 步
            </p>
            <pre className="own-skill-md own-skill-md--sheet">{skill.manifest}</pre>
          </section>
        </div>

        <footer className="own-dev-sheet-foot">
          {errors.length
            ? `${errors.length} 个错误建议先修再上线`
            : issues > 0
              ? `${issues} 条提醒，可按需处理`
              : "静态检查无问题"}
        </footer>
      </aside>
    </div>
  );
}

function DiagnosticsList({ diagnostics }: { diagnostics: SkillManifest["diagnostics"] }) {
  const visible = diagnostics.filter((d) => d.level !== "info");
  if (visible.length === 0) return <p className="own-skill-ok">未发现错误或警告</p>;
  return (
    <ul className="own-skill-issues own-dev-diag-list">
      {visible.map((iss, i) => (
        <li key={`${iss.code}-${i}`} className={iss.level}>
          <span className="own-dev-diag-tag">{diagLabel(iss.code)}</span>
          {iss.stepId ? <span className="own-semcompiler-step">步骤 {iss.stepId}</span> : null}
          <p className="own-dev-diag-msg">{iss.message}</p>
          {iss.fixHint ? <small>{iss.fixHint}</small> : null}
        </li>
      ))}
    </ul>
  );
}

function IssueLine({ skill }: { skill: AgentSkill }) {
  return <DiagnosticsList diagnostics={skill.diagnostics.length ? skill.diagnostics : skill.parsed.issues.map((i) => ({
    code: "PARSE",
    level: i.level,
    message: i.message,
  }))} />;
}

function ResultBoard({ result }: { result: SkillResult | null }) {
  if (!result) return null;
  const d = result.dashboard ?? {};
  const knowledge = d.knowledge as { hits?: { title?: string; chunkId?: string; score?: number; excerpt?: string }[]; hitCount?: number } | undefined;
  const http = d.http as { status?: number; latencyMs?: number; ok?: boolean } | undefined;
  const policy = d.policy as { capability?: string; outcome?: string } | undefined;
  const domProbe = d.domProbe as { totalNodes?: number; interactive?: number; density?: number } | undefined;

  return (
    <div className="own-skill-result">
      {http ? (
        <div className="own-stat-row">
          <div>
            <span>HTTP</span>
            <strong>{http.status ?? "—"}</strong>
          </div>
          <div>
            <span>Latency</span>
            <strong>{http.latencyMs ?? "—"}ms</strong>
          </div>
          <div>
            <span>探活</span>
            <strong>{http.ok ? "OK" : "FAIL"}</strong>
          </div>
        </div>
      ) : null}
      {domProbe ? (
        <div className="own-stat-row">
          <div>
            <span>节点</span>
            <strong>{domProbe.totalNodes ?? "—"}</strong>
          </div>
          <div>
            <span>可交互</span>
            <strong>{domProbe.interactive ?? "—"}</strong>
          </div>
          <div>
            <span>密度</span>
            <strong>{domProbe.density ?? "—"}%</strong>
          </div>
        </div>
      ) : null}
      {policy ? (
        <p className="own-skill-hint">
          信封 {policy.capability} · 结果 {policy.outcome}
        </p>
      ) : null}
      {knowledge?.hits?.length ? (
        <ol className="own-rag-list">
          {knowledge.hits.map((h, i) => (
            <li key={h.chunkId ?? `${h.title}-${i}`}>
              <div className="own-rag-head">
                <strong>
                  {h.title} {h.chunkId ? `· ${h.chunkId}` : ""}
                </strong>
                <em>{h.score != null ? `score ${h.score}` : ""}</em>
              </div>
              {h.excerpt ? <p>{h.excerpt}</p> : null}
            </li>
          ))}
        </ol>
      ) : null}
      {result.markdown ? <pre className="own-skill-md own-skill-md--out">{result.markdown}</pre> : null}
    </div>
  );
}

async function filesToDraft(files: FileList | File[]) {
  const list = [...files];
  if (list.length === 1) return list[0].text();
  const skills: { id: string; raw: string; importedAt: string }[] = [];
  for (const file of list) {
    const text = await file.text();
    const parsed = parseImportPayload(text);
    if (!parsed.error && (file.name.endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("["))) {
      for (const item of parsed.files) {
        skills.push({ id: item.id || file.name, raw: item.raw, importedAt: new Date().toISOString() });
      }
    } else {
      skills.push({ id: file.name.replace(/\.(md|markdown|json)$/i, ""), raw: text, importedAt: new Date().toISOString() });
    }
  }
  return JSON.stringify({ skills }, null, 2);
}

function ImportDock({
  taken,
  fileRef,
  seed,
  onInstalled,
  onCancel,
}: {
  taken: Set<string>;
  fileRef: RefObject<HTMLInputElement | null>;
  seed: string | null;
  onInstalled: (id: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(seed ?? SAMPLE_SKILL_MD);
  const [note, setNote] = useState(seed ? "已从文件读入，先看右侧解析再装入" : "粘贴、拖入或选文件。右侧是实时解析。");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (seed) {
      setDraft(seed);
      setNote("已从文件读入，先看右侧解析再装入");
    }
  }, [seed]);

  const payload = useMemo(() => parseImportPayload(draft), [draft]);
  const peers = useMemo(
    () => BUILTIN_CATALOG.map((s) => ({ id: s.id, triggers: s.triggers })),
    [],
  );

  const previews = useMemo(
    () =>
      payload.files.map((file, i) => {
        const parsed = parseSkillMarkdown(file.raw);
        const id = file.id || parsed.name || `preview-${i}`;
        const core = hydrateSkill(file.raw, { id, skillPath: "import://preview" });
        const compiled = compileParsedOnly(parsed, id, peers, "browser");
        const skill: SkillManifest = {
          ...core,
          compile: compiled.compile,
          ir: compiled.compile.ir,
          diagnostics: compiled.diagnostics,
          compileOk: compiled.compile.compileOk,
          runOk: compiled.compile.runOk,
          effectUpperBound: compiled.compile.ir?.effectUpperBound,
          runnable: compiled.compile.runOk,
        };
        return { file, parsed, skill };
      }),
    [payload.files, peers],
  );

  function install() {
    if (payload.error || payload.files.length === 0) return;
    setBusy(true);
    try {
      let lastId = "";
      const used = new Set(taken);
      for (const file of payload.files) {
        const out = installImportedMarkdown(file.raw, used, file.id);
        used.add(out.record.id);
        lastId = out.record.id;
      }
      onInstalled(lastId);
    } finally {
      setBusy(false);
    }
  }

  async function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setOver(false);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    setDraft(await filesToDraft(files));
    setNote(`已拖入 ${files.length} 个文件，先看右侧解析`);
  }

  const runnableCount = previews.filter((p) => p.skill.runnable).length;
  const issueCount = previews.reduce((n, p) => n + p.parsed.issues.filter((i) => i.level === "error").length, 0);

  return (
    <div className="own-skill-import">
      <header className="own-skill-head">
        <div>
          <p className="own-skill-kicker">导入</p>
          <h3>先解析，再装进目录</h3>
          <p className="own-skill-desc">{note}</p>
        </div>
        <div className="own-skill-actions">
          <button type="button" onClick={() => fileRef.current?.click()}>
            选择文件
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(SAMPLE_SKILL_MD);
              setNote("已填入示例 SKILL.md");
            }}
          >
            填入示例
          </button>
          <button type="button" onClick={onCancel}>
            取消
          </button>
        </div>
      </header>

      <div className="own-skill-import-grid">
        <div
          className={over ? "own-skill-drop over" : "own-skill-drop"}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => void onDrop(e)}
        >
          <textarea
            className="own-skill-paste"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            rows={16}
            placeholder={"把 SKILL.md 粘贴到这里，或把 .md / .json 拖进来"}
          />
          <p className="own-skill-drop-hint">{over ? "松开即可读入" : "支持 .md 和导出的 JSON 技能包，可一次多个"}</p>
        </div>

        <aside className="own-skill-import-preview">
          {payload.error ? (
            <ul className="own-skill-issues">
              <li className="error">{payload.error}</li>
            </ul>
          ) : null}

          {previews.length === 0 && !payload.error ? <p className="own-skill-hint">右侧会显示 name / steps / triggers。</p> : null}

          {previews.map((row, i) => (
            <article key={`${row.skill.id}-${i}`} className="own-skill-preview-card">
              <header>
                <strong>{row.parsed.name || "未命名"}</strong>
                <span className={row.skill.runnable ? "own-skill-badge ok" : "own-skill-badge"}>
                  {row.skill.runnable ? "可运行" : "仅文档"}
                </span>
              </header>
              <IssueLine skill={row.skill} />
              <dl className="own-skill-fields">
                <div>
                  <dt>steps</dt>
                  <dd>{row.parsed.steps.length ? row.parsed.steps.map((s) => s.tool).join(" → ") : "无"}</dd>
                </div>
                <div>
                  <dt>triggers</dt>
                  <dd className="own-route-terms">
                    {row.parsed.triggers.length ? row.parsed.triggers.map((t) => <span key={t}>{t}</span>) : "—"}
                  </dd>
                </div>
              </dl>
            </article>
          ))}

          <button
            type="button"
            className="agent-trace-send own-skill-install"
            onClick={install}
            disabled={busy || Boolean(payload.error) || payload.files.length === 0}
          >
            {busy
              ? "装入中"
              : payload.files.length > 1
                ? `装入 ${payload.files.length} 份（${runnableCount} 可运行）`
                : issueCount
                  ? "解析有问题，仍装入为文档"
                  : "解析并装入目录"}
          </button>
        </aside>
      </div>
    </div>
  );
}
