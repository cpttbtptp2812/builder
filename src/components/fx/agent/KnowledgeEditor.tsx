import { useCallback, useEffect, useRef, useState } from "react";
import {
  deleteKnowledgeDoc,
  listKnowledgeDocs,
  listKnowledgePrompts,
  resetKnowledgeToSeed,
  saveKnowledgeDoc,
  type KnowledgeDoc,
} from "../../../lib/ownKnowledge";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

/* ─── helpers ────────────────────────────────────────────── */
function splitMarkdownSections(raw: string): { title: string; body: string }[] {
  const lines = raw.split("\n");
  const sections: { title: string; body: string }[] = [];
  let curTitle = "";
  let curLines: string[] = [];

  for (const line of lines) {
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (m) {
      if (curTitle || curLines.length) {
        sections.push({ title: curTitle || "未命名段落", body: curLines.join("\n").trim() });
      }
      curTitle = m[1].trim();
      curLines = [];
    } else {
      curLines.push(line);
    }
  }
  if (curTitle || curLines.length) {
    sections.push({ title: curTitle || "导入文档", body: curLines.join("\n").trim() });
  }
  return sections.filter(s => s.body.length > 10);
}

function generatePrompts(title: string, body: string): string[] {
  const keywords = title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, "").trim();
  if (!keywords) return [`关于${title}的介绍`];
  return [
    `${keywords}是什么`,
    `介绍一下${keywords}`,
  ].slice(0, 2);
}

/* ════════════════════════════════════════════════════════════
   KnowledgeEditor — 知识库管理
   ════════════════════════════════════════════════════════════ */
export function KnowledgeEditor({ onChanged }: { onChanged?: () => void }) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [editing, setEditing] = useState<KnowledgeDoc | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [promptsText, setPromptsText] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"none" | "file" | "url" | "paste" | "setup">("none");
  const [urlInput, setUrlInput] = useState("");
  const [pasteInput, setPasteInput] = useState("");
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<{ title: string; body: string }[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isFirstTime = docs.length === 0 || docs.every(d => d.id.startsWith("kb-imean") || d.id.startsWith("kb-ownagent") || d.id.startsWith("kb-skillforge") || d.id.startsWith("kb-jianchi"));

  function reload() {
    setDocs(listKnowledgeDocs());
    onChanged?.();
  }

  useEffect(() => { reload(); }, []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  /* ── Edit CRUD ─────────────────────────────────────────── */
  function startNew() {
    setImportMode("none");
    setImportPreview(null);
    setEditing({ id: "", title: "", body: "", prompts: [], updatedAt: 0 });
    setTitle("");
    setBody("");
    setPromptsText("");
  }

  function startEdit(doc: KnowledgeDoc) {
    setImportMode("none");
    setImportPreview(null);
    setEditing(doc);
    setTitle(doc.title);
    setBody(doc.body);
    setPromptsText(doc.prompts.join("\n"));
  }

  function save() {
    if (!title.trim() || !body.trim()) { flash("标题和正文不能为空"); return; }
    const prompts = promptsText.split(/\n|；|;/).map(s => s.trim()).filter(Boolean);
    if (!prompts.length) {
      const auto = generatePrompts(title, body);
      saveKnowledgeDoc({ id: editing?.id || undefined, title, body, prompts: auto });
    } else {
      saveKnowledgeDoc({ id: editing?.id || undefined, title, body, prompts });
    }
    setEditing(null);
    reload();
    flash("已保存 ✓");
  }

  function remove(id: string) {
    if (!window.confirm("删除这条知识？")) return;
    deleteKnowledgeDoc(id);
    if (editing?.id === id) setEditing(null);
    reload();
    flash("已删除");
  }

  function reset() {
    if (!window.confirm("恢复为默认知识库？会覆盖你改过的内容。")) return;
    resetKnowledgeToSeed();
    setEditing(null);
    reload();
    flash("已恢复默认");
  }

  /* ── File Import ───────────────────────────────────────── */
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const supported = fileArray.filter(f =>
      /\.(txt|md|markdown|csv|json|text)$/i.test(f.name) || f.type.startsWith("text/")
    );
    if (supported.length === 0) {
      flash("暂支持 .txt .md .csv 文本文件");
      return;
    }

    setImporting(true);
    const results: { title: string; body: string }[] = [];

    Promise.all(supported.map(file =>
      file.text().then(text => {
        const ext = file.name.split(".").pop()?.toLowerCase();
        if (ext === "md" || ext === "markdown") {
          const sections = splitMarkdownSections(text);
          if (sections.length > 1) {
            results.push(...sections);
          } else {
            results.push({ title: file.name.replace(/\.\w+$/, ""), body: text.trim() });
          }
        } else if (ext === "csv") {
          const lines = text.split("\n").filter(l => l.trim());
          if (lines.length > 1) {
            const header = lines[0];
            results.push({ title: file.name.replace(/\.\w+$/, ""), body: lines.join("\n") });
          }
        } else if (ext === "json") {
          try {
            const data = JSON.parse(text);
            if (Array.isArray(data)) {
              for (const item of data) {
                if (item.title && item.body) {
                  results.push({ title: item.title, body: item.body });
                } else if (item.question && item.answer) {
                  results.push({ title: item.question, body: item.answer });
                }
              }
            } else if (data.title && data.body) {
              results.push({ title: data.title, body: data.body });
            }
          } catch {
            results.push({ title: file.name.replace(/\.\w+$/, ""), body: text.trim() });
          }
        } else {
          results.push({ title: file.name.replace(/\.\w+$/, ""), body: text.trim() });
        }
      })
    )).then(() => {
      setImportPreview(results);
      setImporting(false);
      if (results.length === 0) flash("未解析到有效内容");
    });
  }, []);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }

  /* ── URL Import ────────────────────────────────────────── */
  async function importUrl() {
    const url = urlInput.trim();
    if (!url) return;
    setImporting(true);
    try {
      const res = await fetch(`${API}/api/admin/knowledge/import-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json() as { title: string; body: string; sections?: { title: string; body: string }[] };
      if (data.sections?.length) {
        setImportPreview(data.sections);
      } else {
        setImportPreview([{ title: data.title || url, body: data.body }]);
      }
    } catch {
      flash("无法抓取该网页，请确认后端已启动或 URL 可访问");
    } finally {
      setImporting(false);
    }
  }

  /* ── Paste Import ──────────────────────────────────────── */
  function parsePaste() {
    const text = pasteInput.trim();
    if (!text) return;
    const sections = splitMarkdownSections(text);
    if (sections.length > 0) {
      setImportPreview(sections);
    } else {
      setImportPreview([{ title: "粘贴导入", body: text }]);
    }
  }

  /* ── Batch save previewed items ────────────────────────── */
  function batchSave() {
    if (!importPreview?.length) return;
    let count = 0;
    for (const item of importPreview) {
      if (!item.body.trim()) continue;
      const prompts = generatePrompts(item.title, item.body);
      saveKnowledgeDoc({ title: item.title, body: item.body, prompts });
      count++;
    }
    setImportPreview(null);
    setImportMode("none");
    setPasteInput("");
    setUrlInput("");
    reload();
    flash(`成功导入 ${count} 篇知识 ✓`);
  }

  const samplePrompts = listKnowledgePrompts(8);

  /* ── First-Time Setup Wizard ───────────────────────────── */
  if (isFirstTime && importMode === "none" && !editing) {
    return (
      <div className="kb-setup">
        <div className="kb-setup-hero">
          <div className="kb-setup-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="6" y="4" width="28" height="32" rx="4" stroke="#6366f1" strokeWidth="2.5"/><path d="M13 12h14M13 18h14M13 24h8" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/><circle cx="30" cy="30" r="8" fill="#6366f1"/><path d="M27 30h6M30 27v6" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>
          </div>
          <h2>录入你的公司知识</h2>
          <p>把产品介绍、常见问题、使用说明等资料录入后，AI 就能基于这些内容为客户解答</p>
        </div>

        <div className="kb-setup-methods">
          <button type="button" className="kb-method-card" onClick={() => setImportMode("file")}>
            <span className="kb-method-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </span>
            <strong>上传文件</strong>
            <span>支持 .txt .md .csv .json</span>
            <em>拖拽或点击选择文件</em>
          </button>

          <button type="button" className="kb-method-card" onClick={() => setImportMode("url")}>
            <span className="kb-method-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M3 12h18M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9c-2.5-2.5-4-5.5-4-9s1.5-6.5 4-9z" stroke="currentColor" strokeWidth="1.5"/></svg>
            </span>
            <strong>从网页导入</strong>
            <span>粘贴链接自动抓取</span>
            <em>公司官网、帮助中心等</em>
          </button>

          <button type="button" className="kb-method-card" onClick={() => setImportMode("paste")}>
            <span className="kb-method-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="8" y="2" width="8" height="4" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" stroke="currentColor" strokeWidth="1.5"/><path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </span>
            <strong>粘贴文本</strong>
            <span>直接复制粘贴内容</span>
            <em>从文档或聊天记录复制</em>
          </button>

          <button type="button" className="kb-method-card" onClick={startNew}>
            <span className="kb-method-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </span>
            <strong>手动输入</strong>
            <span>逐条录入知识</span>
            <em>适合少量精确内容</em>
          </button>
        </div>

        <p className="kb-setup-hint">
          💡 建议先导入公司最常被问到的内容，后续可以随时补充
        </p>
      </div>
    );
  }

  /* ── Main Render ───────────────────────────────────────── */
  return (
    <div className="ua-kb">
      {/* ── Top Action Bar ── */}
      <header className="ua-kb-head">
        <div>
          <strong>知识库</strong>
          <em>已录入 {docs.length} 篇知识 · AI 会从中查找答案</em>
        </div>
        <div className="ua-kb-head-actions">
          <button type="button" className="primary" onClick={startNew}>手动新建</button>
          <button type="button" onClick={() => { setImportMode("file"); setImportPreview(null); }}>上传文件</button>
          <button type="button" onClick={() => { setImportMode("url"); setImportPreview(null); }}>网页导入</button>
          <button type="button" onClick={() => { setImportMode("paste"); setImportPreview(null); }}>粘贴导入</button>
          <button type="button" className="ghost" onClick={reset}>恢复默认</button>
        </div>
      </header>

      {toast && <p className="ua-kb-toast">{toast}</p>}

      {/* ── Import Panel ── */}
      {importMode === "file" && !importPreview && (
        <div
          className={`kb-import-zone${dragOver ? " dragover" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".txt,.md,.markdown,.csv,.json,.text" multiple hidden
            onChange={e => e.target.files && handleFiles(e.target.files)} />
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M18 6v18M11 13l7-7 7 7" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M6 24v4a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-4" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/></svg>
          <p><strong>拖拽文件到这里</strong>，或点击选择</p>
          <span>支持 .txt .md .csv .json，可多选</span>
          {importing && <span className="kb-import-loading">解析中…</span>}
        </div>
      )}

      {importMode === "url" && !importPreview && (
        <div className="kb-import-panel">
          <h4>从网页导入知识</h4>
          <p>输入网页 URL，系统会自动抓取页面内容并转为知识条目</p>
          <div className="kb-import-row">
            <input
              className="kb-import-input"
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              placeholder="https://your-company.com/about"
              onKeyDown={e => { if (e.key === "Enter") importUrl(); }}
            />
            <button type="button" className="primary" disabled={importing || !urlInput.trim()} onClick={importUrl}>
              {importing ? "抓取中…" : "抓取"}
            </button>
          </div>
          <div className="kb-url-tips">
            <span>适合导入：</span>
            <em>公司官网</em><em>帮助中心</em><em>产品文档</em><em>博客文章</em>
          </div>
        </div>
      )}

      {importMode === "paste" && !importPreview && (
        <div className="kb-import-panel">
          <h4>粘贴文本导入</h4>
          <p>把文档内容直接粘贴进来，支持 Markdown 格式（会自动按标题拆分多条）</p>
          <textarea
            className="kb-paste-area"
            rows={10}
            value={pasteInput}
            onChange={e => setPasteInput(e.target.value)}
            placeholder={"# 产品介绍\n我们的产品是...\n\n# 常见问题\n问：如何使用？\n答：..."}
          />
          <div className="kb-import-row" style={{ justifyContent: "flex-end" }}>
            <button type="button" onClick={() => { setImportMode("none"); setPasteInput(""); }}>取消</button>
            <button type="button" className="primary" disabled={!pasteInput.trim()} onClick={parsePaste}>
              解析内容
            </button>
          </div>
        </div>
      )}

      {/* ── Import Preview ── */}
      {importPreview && importPreview.length > 0 && (
        <div className="kb-preview">
          <div className="kb-preview-head">
            <h4>📋 预览：即将导入 {importPreview.length} 条知识</h4>
            <div>
              <button type="button" onClick={() => { setImportPreview(null); }}>重新选择</button>
              <button type="button" className="primary" onClick={batchSave}>全部导入</button>
            </div>
          </div>
          <div className="kb-preview-list">
            {importPreview.map((item, i) => (
              <div key={i} className="kb-preview-item">
                <div className="kb-preview-item-head">
                  <strong>{item.title}</strong>
                  <span>{item.body.length} 字</span>
                  <button type="button" className="danger" onClick={() => {
                    setImportPreview(prev => prev!.filter((_, j) => j !== i));
                  }}>移除</button>
                </div>
                <p>{item.body.slice(0, 150)}{item.body.length > 150 ? "…" : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Edit Form ── */}
      {editing && (
        <div className="ua-kb-editor">
          <label>
            标题
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="例如：公司产品介绍" />
          </label>
          <label>
            内容（AI 会从中检索答案）
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={8}
              placeholder="把产品说明、FAQ、帮助文档等内容写在这里…" />
          </label>
          <label>
            示例问句（每行一句，会显示在欢迎页供客户直接点击；不填则自动生成）
            <textarea value={promptsText} onChange={e => setPromptsText(e.target.value)} rows={3}
              placeholder={"你们的产品是做什么的？\n有哪些核心功能？\n如何联系客服？"} />
          </label>
          <div className="ua-kb-editor-actions">
            <button type="button" className="primary" onClick={save}>保存</button>
            <button type="button" onClick={() => setEditing(null)}>取消</button>
          </div>
        </div>
      )}

      {/* ── Doc List ── */}
      {!editing && (
        <>
          <ul className="ua-kb-list">
            {docs.map(d => (
              <li key={d.id}>
                <div>
                  <strong>{d.title}</strong>
                  <em>{d.prompts.length} 个示例问句 · {d.body.length} 字</em>
                  <p>{d.body.slice(0, 100)}{d.body.length > 100 ? "…" : ""}</p>
                </div>
                <div className="ua-kb-row-actions">
                  <button type="button" onClick={() => startEdit(d)}>编辑</button>
                  <button type="button" className="danger" onClick={() => remove(d.id)}>删除</button>
                </div>
              </li>
            ))}
          </ul>
          {samplePrompts.length > 0 && (
            <div className="ua-kb-samples">
              <header>当前欢迎页展示的问句</header>
              <ul>
                {samplePrompts.map((p, i) => (
                  <li key={`${p.docId}-${i}`}>
                    <strong>{p.text}</strong>
                    <em>{p.hint}</em>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
