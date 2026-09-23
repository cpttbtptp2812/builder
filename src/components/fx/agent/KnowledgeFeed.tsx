import { useCallback, useEffect, useRef, useState } from "react";
import {
  deletePlaza,
  exportPlaza,
  importPlaza,
  listPlaza,
  publishPlaza,
  updatePlaza,
  type PlazaItem,
} from "../../../lib/plazaFeed";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN");
}

function avatarInitial(name: string): string {
  return (name[0] || "?").toUpperCase();
}

/** 知识广场完整页 — 共享、编辑、导入导出 */
export function KnowledgeFeed({
  onAskNew,
}: {
  onAskNew: (q?: string) => void;
}) {
  const [items, setItems] = useState<PlazaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [likedIds, setLikedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("oa-liked") || "[]")); }
    catch { return new Set(); }
  });
  const [showPublish, setShowPublish] = useState(false);
  const [publishForm, setPublishForm] = useState({ question: "", answer: "", author: "" });
  const [publishing, setPublishing] = useState(false);
  const [editing, setEditing] = useState<PlazaItem | null>(null);
  const [editForm, setEditForm] = useState({ question: "", answer: "", author: "" });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  const loadFeed = useCallback(async (q?: string) => {
    setLoading(true);
    const data = await listPlaza(q ?? "", 80);
    setItems(data.items);
    setTotal(data.total);
    setLoading(false);
  }, []);

  useEffect(() => { void loadFeed(""); }, [loadFeed]);

  function onSearchChange(val: string) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => void loadFeed(val), 350);
  }

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function like(id: string) {
    if (likedIds.has(id)) return;
    const next = new Set(likedIds);
    next.add(id);
    setLikedIds(next);
    localStorage.setItem("oa-liked", JSON.stringify([...next]));
    setItems(prev => prev.map(it => it.id === id ? { ...it, likes: it.likes + 1 } : it));
    try {
      await fetch(`${import.meta.env.VITE_API_BASE ?? "http://localhost:8787"}/api/feed/${id}/like`, { method: "POST" });
    } catch { /* ok */ }
  }

  async function publish() {
    if (!publishForm.question.trim() || !publishForm.answer.trim()) return;
    setPublishing(true);
    try {
      await publishPlaza({
        question: publishForm.question,
        answer: publishForm.answer,
        author: publishForm.author || "匿名用户",
      });
      setPublishForm({ question: "", answer: "", author: "" });
      setShowPublish(false);
      flash("已发布，所有人都能看到");
      void loadFeed(search);
    } catch {
      flash("发布失败，请确认后端已启动");
    }
    setPublishing(false);
  }

  function startEdit(item: PlazaItem) {
    setEditing(item);
    setEditForm({ question: item.question, answer: item.answer, author: item.author });
    setShowPublish(false);
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      await updatePlaza(editing.id, editForm);
      setEditing(null);
      flash("已保存修改");
      void loadFeed(search);
    } catch {
      flash("保存失败");
    }
    setSaving(false);
  }

  async function remove(item: PlazaItem) {
    if (!confirm(`删除「${item.question.slice(0, 24)}」？删除后其他人将看不到。`)) return;
    try {
      await deletePlaza(item.id);
      flash("已删除");
      void loadFeed(search);
    } catch {
      flash("删除失败");
    }
  }

  async function doExport() {
    const rows = await exportPlaza();
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), items: rows }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `知识广场-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash(`已导出 ${rows.length} 条`);
  }

  async function doImport(file: File) {
    try {
      const raw = JSON.parse(await file.text()) as { items?: PlazaItem[] } | PlazaItem[];
      const list = Array.isArray(raw) ? raw : raw.items ?? [];
      const payload = list
        .filter(it => it.question?.trim() && it.answer?.trim())
        .map(it => ({ question: it.question, answer: it.answer, author: it.author, tags: it.tags }));
      if (!payload.length) { flash("文件里没有有效问答"); return; }
      const result = await importPlaza(payload);
      flash(`成功导入 ${result.count} 条`);
      void loadFeed(search);
    } catch {
      flash("导入失败，请使用导出的 JSON 格式");
    }
  }

  return (
    <div className="kf-page">
      <div className="kf-page-hero">
        <div>
          <h1>知识广场</h1>
          <p>别人问过的问题，直接看答案。先搜广场，找不到再问 AI，能省下重复消耗。</p>
        </div>
        <div className="kf-page-stats">
          <strong>{total}</strong>
          <span>条共享问答</span>
        </div>
      </div>

      <div className="kf-toolbar">
        <div className="kf-search">
          <svg className="kf-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="先在这里搜：产品怎么用、价格、部署……"
            className="kf-search-input"
          />
          {search && (
            <button type="button" className="kf-search-clear" onClick={() => { setSearch(""); void loadFeed(""); }}>✕</button>
          )}
        </div>
        <div className="kf-toolbar-actions">
          <button type="button" className="kf-btn kf-btn--publish" onClick={() => { setShowPublish(!showPublish); setEditing(null); }}>
            + 发布问答
          </button>
          <button type="button" className="kf-btn" onClick={doExport}>导出</button>
          <button type="button" className="kf-btn" onClick={() => fileRef.current?.click()}>导入</button>
          <input ref={fileRef} type="file" accept=".json" hidden onChange={e => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = "";
          }} />
          <button type="button" className="kf-btn kf-btn--ask" onClick={() => onAskNew(search || undefined)}>
            找不到再问 AI
          </button>
        </div>
      </div>

      {toast && <p className="kf-toast">{toast}</p>}

      {showPublish && (
        <div className="kf-publish">
          <div className="kf-publish-header">
            <strong>发布一条共享问答</strong>
            <span>发布后所有同事都能搜到，不用再问一遍 AI</span>
          </div>
          <input className="kf-publish-input" value={publishForm.question}
            onChange={e => setPublishForm(f => ({ ...f, question: e.target.value }))}
            placeholder="问题：例如「产品支持哪些功能？」" />
          <textarea className="kf-publish-textarea" rows={5} value={publishForm.answer}
            onChange={e => setPublishForm(f => ({ ...f, answer: e.target.value }))}
            placeholder="回答：可以是整理好的说明，也可以从对话里发布过来" />
          <div className="kf-publish-footer">
            <input className="kf-publish-author" value={publishForm.author}
              onChange={e => setPublishForm(f => ({ ...f, author: e.target.value }))}
              placeholder="你的名字（选填）" />
            <div className="kf-publish-actions">
              <button type="button" className="kf-btn" onClick={() => setShowPublish(false)}>取消</button>
              <button type="button" className="kf-btn kf-btn--publish"
                disabled={publishing || !publishForm.question.trim() || !publishForm.answer.trim()}
                onClick={() => void publish()}>
                {publishing ? "发布中…" : "发布给所有人"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="kf-publish">
          <div className="kf-publish-header">
            <strong>编辑这条问答</strong>
            <span>改完立刻对所有人生效</span>
          </div>
          <input className="kf-publish-input" value={editForm.question}
            onChange={e => setEditForm(f => ({ ...f, question: e.target.value }))} />
          <textarea className="kf-publish-textarea" rows={6} value={editForm.answer}
            onChange={e => setEditForm(f => ({ ...f, answer: e.target.value }))} />
          <div className="kf-publish-footer">
            <input className="kf-publish-author" value={editForm.author}
              onChange={e => setEditForm(f => ({ ...f, author: e.target.value }))} placeholder="署名" />
            <div className="kf-publish-actions">
              <button type="button" className="kf-btn" onClick={() => setEditing(null)}>取消</button>
              <button type="button" className="kf-btn kf-btn--publish" disabled={saving} onClick={() => void saveEdit()}>
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="kf-loading">
          <div className="kf-loading-dot" /><div className="kf-loading-dot" /><div className="kf-loading-dot" />
        </div>
      ) : items.length === 0 ? (
        <div className="kf-empty">
          <div className="kf-empty-icon">📭</div>
          <h3>{search ? "广场里还没有这条" : "广场还是空的"}</h3>
          <p>{search ? "可以换个词再搜，或把这个问题交给 AI，答完再发布回来。" : "先问 AI，再在回答下方点「发布到广场」，同事下次就不用重复问。"}</p>
          <button type="button" className="kf-btn kf-btn--ask" onClick={() => onAskNew(search || undefined)}>
            去问 AI
          </button>
        </div>
      ) : (
        <div className="kf-list">
          {items.map(item => {
            const expanded = expandedIds.has(item.id) || item.answer.length <= 160;
            const liked = likedIds.has(item.id);
            const isLong = item.answer.length > 160;
            return (
              <article key={item.id} className={`kf-card${item.pinned ? " kf-card--pinned" : ""}`}>
                <div className="kf-card-head">
                  <div className="kf-avatar" style={{ background: item.avatar_color }}>
                    {avatarInitial(item.author)}
                  </div>
                  <div className="kf-card-meta">
                    <strong>{item.author}</strong>
                    <span>{timeAgo(item.created_at)}{item.updated_at && item.updated_at !== item.created_at ? " · 已编辑" : ""}</span>
                  </div>
                  {item.pinned ? <span className="kf-pin-badge">📌 置顶</span> : null}
                </div>

                <div className="kf-card-question">
                  <span className="kf-q-badge">Q</span>
                  {item.question}
                </div>

                <div className="kf-card-answer">
                  {expanded ? item.answer : item.answer.slice(0, 160) + "…"}
                </div>
                {isLong && (
                  <button type="button" className="kf-expand" onClick={() => toggleExpand(item.id)}>
                    {expanded ? "收起 ▲" : "展开全文 ▼"}
                  </button>
                )}

                {item.tags.length > 0 && (
                  <div className="kf-card-tags">
                    {item.tags.map((t, i) => <span key={i} className="kf-tag">#{t}</span>)}
                  </div>
                )}

                <div className="kf-card-actions">
                  <button type="button" className={`kf-action${liked ? " kf-action--liked" : ""}`} onClick={() => void like(item.id)}>
                    {liked ? "❤️" : "🤍"} {item.likes || ""}
                  </button>
                  <span className="kf-action kf-action--views">👁 {item.views || 0}</span>
                  <button type="button" className="kf-action" onClick={() => startEdit(item)}>编辑</button>
                  <button type="button" className="kf-action" onClick={() => void remove(item)}>删除</button>
                  <button type="button" className="kf-action kf-action--reask" onClick={() => onAskNew(item.question)}>
                    还要补充？问 AI
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
