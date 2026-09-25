import { useMemo, useState } from "react";
import { evalStore } from "../../../lib/evalops/client";
import { casesToCsv, dedupeCases, parseCases, SAMPLE_CSV, splitList, type ParseResult } from "../../../lib/evalops/dataset";
import type { SourceDoc } from "../../../lib/evalops/generate";
import { newId, type EvalCase, type EvalSuite } from "../../../lib/evalops/types";
import { listKnowledgeDocs } from "../../../lib/ownKnowledge";
import { listQueryLog } from "../../../lib/skillQueryLog";
import { OaBadge, OaBtn, OaCard, OaCheck, OaEmpty, OaField, OaInput, OaTextarea } from "../OaUi";

const ORIGIN_LABEL: Record<string, string> = {
  import: "导入",
  paste: "粘贴",
  log: "提问日志",
  generated: "自动出题",
  manual: "手动",
};

export function downloadText(name: string, text: string, type = "text/plain") {
  const blob = new Blob(["\ufeff" + text], { type: `${type};charset=utf-8` });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function toggleIn<T>(s: Set<T>, v: T): Set<T> {
  const next = new Set(s);
  if (next.has(v)) next.delete(v);
  else next.add(v);
  return next;
}

function readFiles(files: FileList | null): Promise<{ name: string; text: string }[]> {
  return Promise.all(Array.from(files ?? []).map(async (f) => ({ name: f.name.replace(/\.[^.]+$/, ""), text: await f.text() })));
}

export function EvalSuites({
  suites,
  onChanged,
  notify,
}: {
  suites: EvalSuite[];
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const [editing, setEditing] = useState<EvalSuite | null>(null);

  if (editing) {
    return (
      <SuiteEditor
        initial={editing}
        onCancel={() => setEditing(null)}
        onSaved={(s) => {
          setEditing(null);
          onChanged();
          notify(`已保存「${s.name}」· ${s.cases.length} 题`);
        }}
      />
    );
  }

  const blank = (): EvalSuite => ({ id: "", name: "", cases: [], createdAt: "", updatedAt: "" });

  return (
    <div className="eo-stack">
      <div className="eo-callout">
        <strong>测试集 = 一批固定的问题</strong>
        <span>
          每次改动都用同一批题去跑，才能看出变好还是变坏。题目可以只有问题；有参考答案、必须包含的关键词时，判得更准。
        </span>
      </div>
      <div className="eo-row-between">
        <span className="eo-muted">{suites.length ? `共 ${suites.length} 个测试集` : ""}</span>
        <OaBtn onClick={() => setEditing(blank())}>+ 新建测试集</OaBtn>
      </div>
      {!suites.length ? (
        <OaEmpty>还没有测试集。可以上传表格、粘贴问题、从提问日志导入，或者让系统从文档里出题。</OaEmpty>
      ) : (
        <div className="eo-grid">
          {suites.map((s) => {
            const withRef = s.cases.filter((c) => c.reference).length;
            return (
              <OaCard key={s.id} className="eo-target-card">
                <div className="eo-row-between">
                  <strong>{s.name}</strong>
                  <OaBadge tone="info">{s.cases.length} 题</OaBadge>
                </div>
                <p className="eo-muted">
                  {s.description || (withRef ? `${withRef} 题有参考答案` : "都没有参考答案，靠规则和裁判判断")}
                </p>
                <div className="eo-actions">
                  <OaBtn size="sm" variant="ghost" onClick={() => setEditing(s)}>
                    查看 / 编辑
                  </OaBtn>
                  <OaBtn size="sm" variant="ghost" onClick={() => downloadText(`${s.name}.csv`, casesToCsv(s.cases), "text/csv")}>
                    导出 CSV
                  </OaBtn>
                  <OaBtn
                    size="sm"
                    variant="danger"
                    onClick={async () => {
                      if (!window.confirm(`删除测试集「${s.name}」？`)) return;
                      await evalStore.deleteSuite(s.id);
                      onChanged();
                    }}
                  >
                    删除
                  </OaBtn>
                </div>
              </OaCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

type AddMode = "file" | "paste" | "log" | "gen" | "manual";

const ADD_MODES: { id: AddMode; label: string }[] = [
  { id: "file", label: "上传文件" },
  { id: "paste", label: "粘贴" },
  { id: "log", label: "从提问日志" },
  { id: "gen", label: "从文档出题" },
  { id: "manual", label: "手动加一题" },
];

function SuiteEditor({ initial, onCancel, onSaved }: { initial: EvalSuite; onCancel: () => void; onSaved: (s: EvalSuite) => void }) {
  const [name, setName] = useState(initial.name);
  const [desc, setDesc] = useState(initial.description ?? "");
  const [cases, setCases] = useState<EvalCase[]>(initial.cases);
  const [mode, setMode] = useState<AddMode | null>(initial.cases.length ? null : "file");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function addCases(list: EvalCase[]) {
    const before = cases.length;
    const next = dedupeCases([...cases, ...list]);
    setCases(next);
    setDirty(true);
    const added = next.length - before;
    const dup = list.length - added;
    setFlash(`加入 ${added} 题${dup > 0 ? `，${dup} 题重复已跳过` : ""}`);
    setTimeout(() => setFlash(null), 3000);
    if (added) setMode(null);
  }

  function patchCase(id: string, patch: Partial<EvalCase>) {
    setCases((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setDirty(true);
  }

  async function save() {
    if (!name.trim()) return setErr("给测试集起个名字，比如「报销制度 · 常见问题」");
    if (!cases.length) return setErr("至少加一道题");
    setSaving(true);
    setErr(null);
    try {
      const s = await evalStore.saveSuite({
        ...initial,
        id: initial.id || newId("suite"),
        name: name.trim(),
        description: desc.trim() || undefined,
        cases: cases.filter((c) => c.question.trim()),
      });
      onSaved(s);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? cases.filter((c) => (c.question + (c.reference ?? "")).toLowerCase().includes(q)) : cases;
  }, [cases, filter]);

  return (
    <OaCard className="eo-editor">
      <div className="eo-row-between">
        <h3>{initial.id ? `编辑「${initial.name}」` : "新建测试集"}</h3>
        <button
          type="button"
          className="eo-link"
          onClick={() => {
            if (dirty && !window.confirm("有未保存的修改，确定离开？")) return;
            onCancel();
          }}
        >
          ← 返回列表
        </button>
      </div>
      <div className="eo-cols">
        <OaField label="名称">
          <OaInput value={name} placeholder="如：报销制度 · 常见问题" onChange={(e) => (setName(e.target.value), setDirty(true))} />
        </OaField>
        <OaField label="说明（可选）">
          <OaInput value={desc} placeholder="如：客服高频 50 问，9 月整理" onChange={(e) => (setDesc(e.target.value), setDirty(true))} />
        </OaField>
      </div>

      <section className="eo-add">
        <div className="eo-row-between">
          <strong>添加题目</strong>
          {flash ? <span className="eo-flash">{flash}</span> : null}
        </div>
        <div className="eo-seg eo-seg--wrap">
          {ADD_MODES.map((m) => (
            <button key={m.id} type="button" className={mode === m.id ? "on" : ""} onClick={() => setMode(mode === m.id ? null : m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        {mode === "file" ? <AddFromFile onAdd={addCases} /> : null}
        {mode === "paste" ? <AddFromPaste onAdd={addCases} /> : null}
        {mode === "log" ? <AddFromLog existing={cases} onAdd={addCases} /> : null}
        {mode === "gen" ? <AddFromDocs onAdd={addCases} /> : null}
        {mode === "manual" ? <AddManual onAdd={addCases} /> : null}
      </section>

      <section className="eo-stack">
        <div className="eo-row-between">
          <strong>
            题目 <span className="eo-muted">({cases.length})</span>
          </strong>
          {cases.length > 6 ? (
            <OaInput className="eo-filter" value={filter} placeholder="筛选题目" onChange={(e) => setFilter(e.target.value)} />
          ) : null}
        </div>
        {!cases.length ? (
          <OaEmpty>还没有题目，用上面任意一种方式添加。</OaEmpty>
        ) : (
          <ul className="eo-cases">
            {shown.map((c, i) => (
              <li key={c.id} className={open === c.id ? "open" : ""}>
                <button type="button" className="eo-case-head" onClick={() => setOpen(open === c.id ? null : c.id)}>
                  <span className="eo-case-no">{i + 1}</span>
                  <span className="eo-case-q">{c.question || <em className="eo-muted">（空题目）</em>}</span>
                  <span className="eo-case-tags">
                    {c.reference ? <OaBadge tone="ok">有参考答案</OaBadge> : null}
                    {c.mustInclude?.length ? <OaBadge tone="info">含 {c.mustInclude.length} 个关键词</OaBadge> : null}
                    {c.origin ? <OaBadge>{ORIGIN_LABEL[c.origin] ?? c.origin}</OaBadge> : null}
                  </span>
                </button>
                {open === c.id ? <CaseEdit c={c} onPatch={(p) => patchCase(c.id, p)} onRemove={() => (setCases((cs) => cs.filter((x) => x.id !== c.id)), setDirty(true))} /> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {err ? <p className="eo-err">{err}</p> : null}
      <div className="eo-actions eo-sticky-actions">
        <OaBtn onClick={() => void save()} disabled={saving}>
          {saving ? "保存中…" : dirty || !initial.id ? "保存测试集" : "已保存"}
        </OaBtn>
        {cases.length ? (
          <OaBtn variant="ghost" onClick={() => downloadText(`${name || "测试集"}.csv`, casesToCsv(cases), "text/csv")}>
            导出 CSV
          </OaBtn>
        ) : null}
      </div>
    </OaCard>
  );
}

function CaseEdit({ c, onPatch, onRemove }: { c: EvalCase; onPatch: (p: Partial<EvalCase>) => void; onRemove: () => void }) {
  return (
    <div className="eo-case-edit">
      <OaField label="问题">
        <OaTextarea rows={2} value={c.question} onChange={(e) => onPatch({ question: e.target.value })} />
      </OaField>
      <OaField label="参考答案（可选）" hint="有了它，裁判会按「意思是否一致」来判">
        <OaTextarea rows={3} value={c.reference ?? ""} onChange={(e) => onPatch({ reference: e.target.value || undefined })} />
      </OaField>
      <div className="eo-cols">
        <OaField label="必须包含" hint="逗号分隔，缺一个就算不通过">
          <OaInput value={(c.mustInclude ?? []).join("，")} onChange={(e) => onPatch({ mustInclude: splitList(e.target.value) })} />
        </OaField>
        <OaField label="不能包含" hint="如竞品名、过期政策">
          <OaInput value={(c.mustNotInclude ?? []).join("，")} onChange={(e) => onPatch({ mustNotInclude: splitList(e.target.value) })} />
        </OaField>
        <OaField label="应引用的资料" hint="引用里要出现这个标题">
          <OaInput value={c.expectSource ?? ""} onChange={(e) => onPatch({ expectSource: e.target.value || undefined })} />
        </OaField>
      </div>
      <div className="eo-actions">
        <OaBtn size="sm" variant="danger" onClick={onRemove}>
          删除这题
        </OaBtn>
      </div>
    </div>
  );
}

function ParsedPreview({ parsed, onAdd, onReset }: { parsed: ParseResult; onAdd: (c: EvalCase[]) => void; onReset: () => void }) {
  return (
    <div className="eo-preview">
      <p className="eo-muted">
        识别为 <b>{parsed.format}</b>，共 {parsed.cases.length} 题
        {parsed.cases.filter((c) => c.reference).length ? `，其中 ${parsed.cases.filter((c) => c.reference).length} 题有参考答案` : ""}
      </p>
      {parsed.warnings.map((w) => (
        <p key={w} className="eo-warn">
          ⚠ {w}
        </p>
      ))}
      <ol className="eo-preview-list">
        {parsed.cases.slice(0, 5).map((c) => (
          <li key={c.id}>
            {c.question}
            {c.reference ? <span className="eo-muted"> → {c.reference.slice(0, 60)}</span> : null}
          </li>
        ))}
        {parsed.cases.length > 5 ? <li className="eo-muted">…还有 {parsed.cases.length - 5} 题</li> : null}
      </ol>
      <div className="eo-actions">
        <OaBtn size="sm" disabled={!parsed.cases.length} onClick={() => onAdd(parsed.cases)}>
          加入这 {parsed.cases.length} 题
        </OaBtn>
        <OaBtn size="sm" variant="ghost" onClick={onReset}>
          重新选择
        </OaBtn>
      </div>
    </div>
  );
}

function AddFromFile({ onAdd }: { onAdd: (c: EvalCase[]) => void }) {
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  if (parsed) return <ParsedPreview parsed={parsed} onAdd={onAdd} onReset={() => setParsed(null)} />;
  return (
    <div className="eo-drop">
      <label className="eo-drop-zone">
        <input
          type="file"
          accept=".csv,.tsv,.txt,.json,.jsonl"
          onChange={async (e) => {
            const [f] = await readFiles(e.target.files);
            if (f) setParsed(parseCases(f.text, "import"));
            e.target.value = "";
          }}
        />
        <strong>选择文件</strong>
        <span>CSV / TSV / JSON / JSONL / TXT。Excel 请先「另存为 CSV」。</span>
      </label>
      <p className="eo-muted">
        表头认中英文：问题 / question、参考答案 / reference、必须包含、不能包含、应引用。
        <button type="button" className="eo-link" onClick={() => downloadText("测试集模板.csv", SAMPLE_CSV, "text/csv")}>
          下载模板
        </button>
      </p>
    </div>
  );
}

function AddFromPaste({ onAdd }: { onAdd: (c: EvalCase[]) => void }) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  if (parsed) return <ParsedPreview parsed={parsed} onAdd={(c) => (onAdd(c), setText(""))} onReset={() => setParsed(null)} />;
  return (
    <div className="eo-stack">
      <OaTextarea
        rows={6}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"一行一个问题；要带参考答案就用 ||| 隔开，例如：\n年假有几天？ ||| 入职满一年 5 天\n报销多久到账？\n\n也可以直接从 Excel 复制带表头的几列粘进来。"}
      />
      <div className="eo-actions">
        <OaBtn size="sm" disabled={!text.trim()} onClick={() => setParsed(parseCases(text, "paste"))}>
          识别
        </OaBtn>
      </div>
    </div>
  );
}

function AddFromLog({ existing, onAdd }: { existing: EvalCase[]; onAdd: (c: EvalCase[]) => void }) {
  const rows = useMemo(() => {
    const seen = new Set(existing.map((c) => c.question.trim()));
    const out: { q: string; at: string; n: number }[] = [];
    const idx = new Map<string, number>();
    for (const e of listQueryLog()) {
      const q = e.q.trim();
      if (!q || seen.has(q)) continue;
      if (idx.has(q)) out[idx.get(q)!]!.n++;
      else {
        idx.set(q, out.length);
        out.push({ q, at: e.at, n: 1 });
      }
    }
    return out.slice(0, 200);
  }, [existing]);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(rows.slice(0, 20).map((r) => r.q)));

  if (!rows.length) {
    return <OaEmpty>提问日志里暂时没有新问题。用户在对话里提问后，这里会出现真实问题。</OaEmpty>;
  }
  const toggle = (q: string) => setPicked((s) => toggleIn(s, q));
  return (
    <div className="eo-stack">
      <div className="eo-row-between">
        <span className="eo-muted">真实用户问过的问题，最能反映线上情况。已勾选 {picked.size} 题。</span>
        <span className="eo-actions">
          <button type="button" className="eo-link" onClick={() => setPicked(new Set(rows.map((r) => r.q)))}>
            全选
          </button>
          <button type="button" className="eo-link" onClick={() => setPicked(new Set())}>
            清空
          </button>
        </span>
      </div>
      <ul className="eo-pick">
        {rows.map((r) => (
          <li key={r.q}>
            <OaCheck compact checked={picked.has(r.q)} onChange={() => toggle(r.q)} label={r.q} />
            {r.n > 1 ? <OaBadge>问过 {r.n} 次</OaBadge> : null}
          </li>
        ))}
      </ul>
      <div className="eo-actions">
        <OaBtn
          size="sm"
          disabled={!picked.size}
          onClick={() => onAdd(rows.filter((r) => picked.has(r.q)).map((r) => ({ id: newId("case"), question: r.q, origin: "log" as const })))}
        >
          加入 {picked.size} 题
        </OaBtn>
      </div>
    </div>
  );
}

function AddFromDocs({ onAdd }: { onAdd: (c: EvalCase[]) => void }) {
  const kbDocs = useMemo(() => listKnowledgeDocs(), []);
  const [src, setSrc] = useState<"kb" | "upload">("kb");
  const [kbPicked, setKbPicked] = useState<Set<string>>(() => new Set(kbDocs.map((d) => d.id)));
  const [uploads, setUploads] = useState<SourceDoc[]>([]);
  const [count, setCount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ cases: EvalCase[]; engine: "llm" | "heuristic"; warnings: string[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  const docs: SourceDoc[] = src === "kb" ? kbDocs.filter((d) => kbPicked.has(d.id)).map((d) => ({ title: d.title, body: d.body, prompts: d.prompts })) : uploads;

  async function run() {
    setBusy(true);
    setErr(null);
    setOut(null);
    try {
      const r = await evalStore.generate(docs, count);
      setOut(r);
      setPicked(new Set(r.cases.map((c) => c.id)));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (out) {
    const toggle = (id: string) => setPicked((s) => toggleIn(s, id));
    return (
      <div className="eo-stack">
        <p className="eo-muted">
          {out.engine === "llm" ? "由大模型出题，参考答案和关键词都取自原文。" : "没有配置模型，按文档结构粗略出题，部分题没有参考答案。配好模型后出题质量会好很多。"}
          建议逐题看一眼，去掉不合适的。
        </p>
        {out.warnings.map((w) => (
          <p key={w} className="eo-warn">
            ⚠ {w}
          </p>
        ))}
        <ul className="eo-pick eo-pick--gen">
          {out.cases.map((c) => (
            <li key={c.id}>
              <OaCheck compact checked={picked.has(c.id)} onChange={() => toggle(c.id)} label={c.question} />
              <div className="eo-gen-meta">
                {c.reference ? <p>参考：{c.reference}</p> : null}
                <p className="eo-muted">
                  {c.expectSource ? `出自《${c.expectSource}》` : ""}
                  {c.mustInclude?.length ? ` · 关键词：${c.mustInclude.join("、")}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <div className="eo-actions">
          <OaBtn size="sm" disabled={!picked.size} onClick={() => onAdd(out.cases.filter((c) => picked.has(c.id)))}>
            加入 {picked.size} 题
          </OaBtn>
          <OaBtn size="sm" variant="ghost" onClick={() => setOut(null)}>
            重新出题
          </OaBtn>
        </div>
      </div>
    );
  }

  return (
    <div className="eo-stack">
      <p className="eo-muted">从资料里自动出题，每题带参考答案和原文关键词。适合还没整理过问题清单的时候先起个头。</p>
      <div className="eo-seg">
        <button type="button" className={src === "kb" ? "on" : ""} onClick={() => setSrc("kb")}>
          本系统资料库（{kbDocs.length}）
        </button>
        <button type="button" className={src === "upload" ? "on" : ""} onClick={() => setSrc("upload")}>
          上传自己的文档
        </button>
      </div>
      {src === "kb" ? (
        kbDocs.length ? (
          <ul className="eo-pick">
            {kbDocs.map((d) => (
              <li key={d.id}>
                <OaCheck
                  compact
                  checked={kbPicked.has(d.id)}
                  onChange={() => setKbPicked((s) => toggleIn(s, d.id))}
                  label={d.title}
                />
                <span className="eo-muted">{d.body.length} 字</span>
              </li>
            ))}
          </ul>
        ) : (
          <OaEmpty>资料库是空的。</OaEmpty>
        )
      ) : (
        <div className="eo-drop">
          <label className="eo-drop-zone">
            <input
              type="file"
              multiple
              accept=".md,.txt,.markdown,.csv,.json"
              onChange={async (e) => {
                const files = await readFiles(e.target.files);
                setUploads((u) => [...u, ...files.map((f) => ({ title: f.name, body: f.text }))]);
                e.target.value = "";
              }}
            />
            <strong>选择文档（可多选）</strong>
            <span>Markdown / TXT。你的知识库在别的系统里时，导出几份核心文档放这里即可，不会存进本系统资料库。</span>
          </label>
          {uploads.length ? (
            <ul className="eo-pick">
              {uploads.map((d, i) => (
                <li key={i}>
                  <span>{d.title}</span>
                  <span className="eo-muted">{d.body.length} 字</span>
                  <button type="button" className="eo-x" aria-label="移除" onClick={() => setUploads((u) => u.filter((_, j) => j !== i))}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
      <div className="eo-test-row">
        <OaField label="出多少题" className="eo-w-sm">
          <OaInput type="number" min={1} max={60} value={count} onChange={(e) => setCount(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
        </OaField>
        <OaBtn disabled={busy || !docs.length} onClick={() => void run()}>
          {busy ? "出题中…（大约每 2 题几秒）" : `从 ${docs.length} 份文档出题`}
        </OaBtn>
      </div>
      {err ? <p className="eo-err">{err}</p> : null}
    </div>
  );
}

function AddManual({ onAdd }: { onAdd: (c: EvalCase[]) => void }) {
  const [q, setQ] = useState("");
  const [ref, setRef] = useState("");
  const [inc, setInc] = useState("");
  return (
    <div className="eo-stack">
      <OaField label="问题">
        <OaInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="如：出差住宿标准是多少？" />
      </OaField>
      <div className="eo-cols">
        <OaField label="参考答案（可选）">
          <OaInput value={ref} onChange={(e) => setRef(e.target.value)} />
        </OaField>
        <OaField label="必须包含（可选）" hint="逗号分隔">
          <OaInput value={inc} onChange={(e) => setInc(e.target.value)} />
        </OaField>
      </div>
      <div className="eo-actions">
        <OaBtn
          size="sm"
          disabled={!q.trim()}
          onClick={() => {
            onAdd([
              {
                id: newId("case"),
                question: q.trim(),
                reference: ref.trim() || undefined,
                mustInclude: inc.trim() ? splitList(inc) : undefined,
                origin: "manual",
              },
            ]);
            setQ("");
            setRef("");
            setInc("");
          }}
        >
          加入
        </OaBtn>
      </div>
    </div>
  );
}
