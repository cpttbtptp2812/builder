import { useCallback, useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

function apiHeaders(token: string) {
  return { "Content-Type": "application/json", "x-admin-token": token };
}

type PlazaItem = {
  id: string;
  question: string;
  answer: string;
  author: string;
  tags: string[];
  likes: number;
  views: number;
  pinned: number;
  created_at: string;
};

export function PlazaAdminPanel({ token }: { token: string }) {
  const [items, setItems] = useState<PlazaItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<PlazaItem | null>(null);
  const [form, setForm] = useState({ question: "", answer: "", author: "" });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/plaza`, { headers: apiHeaders(token) });
      if (res.ok) {
        const data = await res.json() as { items: PlazaItem[]; total: number };
        setItems(data.items);
        setTotal(data.total);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function togglePin(item: PlazaItem) {
    await fetch(`${API}/api/feed/${item.id}/pin`, { method: "POST", headers: apiHeaders(token) });
    void load();
  }

  async function remove(item: PlazaItem) {
    if (!confirm(`删除「${item.question.slice(0, 30)}」？`)) return;
    await fetch(`${API}/api/feed/${item.id}`, { method: "DELETE" });
    void load();
  }

  async function saveEdit() {
    if (!editing) return;
    await fetch(`${API}/api/feed/${editing.id}`, {
      method: "PUT",
      headers: apiHeaders(token),
      body: JSON.stringify(form),
    });
    setEditing(null);
    void load();
  }

  async function create() {
    await fetch(`${API}/api/feed`, {
      method: "POST",
      headers: apiHeaders(token),
      body: JSON.stringify(form),
    });
    setCreating(false);
    setForm({ question: "", answer: "", author: "" });
    void load();
  }

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>知识广场</h2>
          <p>管理全员共享的问答，置顶优质内容，减少重复 AI 调用</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button type="button" className="adm-btn" onClick={() => void load()}>刷新</button>
          <button type="button" className="adm-btn adm-btn--primary" onClick={() => { setCreating(true); setEditing(null); setForm({ question: "", answer: "", author: "管理员" }); }}>
            + 发布问答
          </button>
        </div>
      </div>

      <div className="adm-plaza-stats">
        <span>共 <strong>{total}</strong> 条共享问答</span>
        <span>置顶条目优先展示 · 命中 ≥70% 时零 Token 返回</span>
      </div>

      {(creating || editing) && (
        <div className="adm-form-card">
          <h3>{creating ? "发布新问答" : `编辑：${editing?.question.slice(0, 24)}`}</h3>
          <div className="adm-form-row">
            <label>问题 *</label>
            <input className="adm-input" value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} />
          </div>
          <div className="adm-form-row">
            <label>回答 *</label>
            <textarea className="adm-textarea" rows={6} value={form.answer} onChange={(e) => setForm((f) => ({ ...f, answer: e.target.value }))} />
          </div>
          <div className="adm-form-row">
            <label>发布者</label>
            <input className="adm-input" value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
          </div>
          <div className="adm-form-actions">
            <button type="button" className="adm-btn" onClick={() => { setCreating(false); setEditing(null); }}>取消</button>
            <button
              type="button"
              className="adm-btn adm-btn--primary"
              disabled={!form.question.trim() || !form.answer.trim()}
              onClick={() => void (creating ? create() : saveEdit())}
            >
              保存
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="adm-loading">加载中…</div>
      ) : items.length === 0 ? (
        <div className="adm-empty-state"><p>广场暂无内容，点击「发布问答」添加第一条</p></div>
      ) : (
        <div className="adm-kb-list">
          {items.map((item) => (
            <div key={item.id} className={`adm-kb-item${item.pinned ? " pinned" : ""}`}>
              <div className="adm-kb-item-head">
                <div>
                  <strong>{item.pinned ? "📌 " : ""}{item.question}</strong>
                  <div className="adm-kb-meta">
                    <span>{item.author}</span>
                    <span>{item.likes} 赞 · {item.views} 浏览</span>
                    <span className="adm-kb-date">{new Date(item.created_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                <div className="adm-kb-actions">
                  <button type="button" className="adm-btn adm-btn--sm" onClick={() => void togglePin(item)}>
                    {item.pinned ? "取消置顶" : "置顶"}
                  </button>
                  <button type="button" className="adm-btn adm-btn--sm" onClick={() => {
                    setEditing(item);
                    setCreating(false);
                    setForm({ question: item.question, answer: item.answer, author: item.author });
                  }}>编辑</button>
                  <button type="button" className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => void remove(item)}>删除</button>
                </div>
              </div>
              <p className="adm-kb-body-preview">{item.answer.slice(0, 160)}{item.answer.length > 160 ? "…" : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
