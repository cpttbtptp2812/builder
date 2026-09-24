import { useEffect, useMemo, useRef, useState, type DragEvent, type RefObject } from "react";
import { runSkillAsync } from "../../lib/backendBridge";
import {
  explainDiscovery,
  ROUTER_EXAMPLES,
  SKILL_CATALOG,
  type AgentSkill,
  type SkillResult,
  type SkillTraceStep,
} from "../../lib/agentSkills";
import { hydrateSkill, parseSkillMarkdown, SAMPLE_SKILL_MD } from "../../lib/skillMarkdown";
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
  if (skill.id === "knowledge-lookup") return "检索 iMean 定位语料 chunkId";
  if (skill.id === "policy-desk") return "满一年年假几天";
  if (skill.id === "dom-probe") return "dom snapshot 元素定位 a11y";
  if (skill.id === "workflow-orchestrator") return "执行 workflow 自动化回放流程";
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
  const [skillId, setSkillId] = useState(SKILL_CATALOG[0]?.id ?? "site-analyzer");
  const [mode, setMode] = useState<"run" | "import">("run");
  const [copied, setCopied] = useState(false);
  const [importSeed, setImportSeed] = useState<string | null>(null);

  useEffect(() => {
    setImported(loadImportedSkills());
  }, []);

  const catalog = useMemo(() => [...SKILL_CATALOG, ...imported], [imported]);
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
      <header className="oa-page-head">
        <div className="oa-page-head-main">
          <h1>技能扩展</h1>
          <p>开发者工具：导入或调试自动化技能。客户请在「资料库」录入文档即可。</p>
        </div>
      </header>
      <div className="own-skill-platform">
        <aside className="own-skill-rail" aria-label="技能目录">
          <header className="own-skill-rail-head">
            <strong>技能</strong>
            <span>{catalog.length}</span>
          </header>
          <ul className="own-skill-index">
            {SKILL_CATALOG.map((s, i) => (
              <li key={s.id}>
                <button type="button" className={s.id === skill.id && mode === "run" ? "on" : ""} onClick={() => select(s.id)}>
                  <em>{String(i + 1).padStart(2, "0")}</em>
                  <span>
                    <strong>{s.name}</strong>
                    <small>{s.runnable ? `${s.steps.length} 步工具链` : "仅文档"}</small>
                  </span>
                </button>
              </li>
            ))}
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
  const [inspect, setInspect] = useState(false);

  useEffect(() => {
    setQuery(defaultQuery(skill));
    setTrace([]);
    setResult(null);
    setRuntime(null);
    setOpenId(null);
  }, [skill.id]);

  const route = useMemo(() => (query.trim() ? explainDiscovery(query) : []), [query]);
  const winner = route.find((r) => r.score > 0);

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
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <header className="own-skill-head">
        <div>
          <p className="own-skill-kicker">
            {isImported ? "已导入" : "内置"} · {skill.skillPath}
          </p>
          <h3>{skill.name}</h3>
          <p className="own-skill-desc">{skill.description}</p>
        </div>
        <span className={skill.runnable ? "own-skill-badge ok" : "own-skill-badge"}>{skill.runnable ? "可运行" : "仅文档"}</span>
      </header>

      {skill.steps.length > 0 ? (
        <ol className="own-skill-pipe" aria-label="这份技能会调的工具">
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
        <p className="own-skill-empty-stage">这份 SKILL.md 没有 steps，不能跑。打开下方原文对照，或从左侧导入一份带工具链的技能。</p>
      )}

      {skill.runnable ? (
        <div className="own-skill-composer">
          <label className="own-skill-composer-label" htmlFor="own-skill-query">
            对这条工具链说一句话，然后运行
          </label>
          <div className="agent-trace-input-row">
            <input
              id="own-skill-query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如：分析本站性能"
              onKeyDown={(e) => {
                if (e.key === "Enter") void run();
              }}
            />
            <button type="button" className="agent-trace-send" onClick={() => void run()} disabled={running}>
              {running ? "运行中" : "运行"}
            </button>
          </div>
          <p className="own-skill-route-peek">
            {query.trim() ? (
              winner ? (
                <>
                  路由会把这句话交给 <strong>{winner.skill.name}</strong>（{winner.score} 分）
                  {winner.skill.id !== skill.id ? " · 这里仍按你选中的这份手动跑" : ""}
                </>
              ) : (
                <>没有 trigger 命中，自动路由会停住；这里仍按 <strong>{skill.name}</strong> 手动跑。</>
              )
            ) : (
              <>工具链 {skill.plan.join(" → ") || "无 steps"}</>
            )}
          </p>
        </div>
      ) : null}

      {runtime ? (
        <p className="own-skill-hint">
          {runtime === "local" ? "浏览器内运行时" : "服务端"} · {trace.length} 步完成
        </p>
      ) : null}

      {trace.length > 0 ? (
        <ol className="skill-pipeline-trace">
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

      <div className="own-skill-filebar">
        <span>SKILL.md</span>
        <button type="button" onClick={onCopy}>{copied ? "已复制" : "复制原文"}</button>
        <button type="button" onClick={onExport}>导出这份</button>
        <button type="button" onClick={onExportAll}>导出全部 JSON</button>
        <details className="own-skill-inspect" open={inspect} onToggle={(e) => setInspect((e.target as HTMLDetailsElement).open)}>
          <summary>解析对照</summary>
        </details>
      </div>

      {inspect ? (
        <div className="own-skill-inspect-grid">
          <div>
            <h4>解析</h4>
            <IssueLine skill={skill} />
            <p className="own-skill-meta-line">
              triggers {skill.triggers.length} · tools {skill.tools.join(", ") || "—"}
            </p>
            <ol className="own-skill-steps compact">
              {skill.steps.length === 0 ? (
                <li>没有 steps</li>
              ) : (
                skill.steps.map((s) => (
                  <li key={s.id}>
                    <code>{s.id}</code>
                    <strong>{s.tool}</strong>
                    <span>{s.label}</span>
                  </li>
                ))
              )}
            </ol>
          </div>
          <div>
            <h4>原文</h4>
            <pre className="own-skill-md">{skill.manifest}</pre>
          </div>
        </div>
      ) : null}
    </>
  );
}

function IssueLine({ skill }: { skill: AgentSkill }) {
  const issues = skill.parsed.issues;
  if (issues.length === 0) return <p className="own-skill-ok">解析通过</p>;
  return (
    <ul className="own-skill-issues">
      {issues.map((iss, i) => (
        <li key={`${iss.message}-${i}`} className={iss.level}>
          {iss.level === "error" ? "错误" : "警告"} — {iss.message}
        </li>
      ))}
    </ul>
  );
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
  const previews = useMemo(
    () =>
      payload.files.map((file, i) => {
        const parsed = parseSkillMarkdown(file.raw);
        const skill = hydrateSkill(file.raw, { id: file.id || parsed.name || `preview-${i}`, skillPath: "import://preview" });
        return { file, parsed, skill };
      }),
    [payload.files],
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
