/**
 * AdminPage — OwnAgent 管理后台
 * 路由: /admin
 *
 * 功能:
 *   - 登录鉴权
 *   - 知识库 CRUD（增删改查）
 *   - LLM & 应用配置
 *   - 使用分析看板
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { OperationsPanel } from "./admin/OperationsPanel";
import { PlazaAdminPanel } from "./admin/PlazaAdminPanel";
import { PoliciesPanel } from "./admin/PoliciesPanel";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

/* ─── helpers ────────────────────────────────────────────── */
function apiHeaders(token: string) {
  return { "Content-Type": "application/json", "x-admin-token": token };
}

async function apiFetch<T>(token: string, path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...apiHeaders(token), ...(opts.headers as Record<string, string> ?? {}) },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/* ─── types ─────────────────────────────────────────────── */
type KbDoc = {
  id: string;
  title: string;
  body: string;
  prompts: string[];
  tags: string[];
  enabled: boolean;
  updated_at: string;
};

type Analytics = {
  total: number;
  today: number;
  avgLatency: number;
  avgGround: number;
  kbCount: number;
  plazaCount: number;
  plazaHits: number;
  aiCalls: number;
  plazaHitRate: number;
  tokenSavedEst: number;
  topQueries: { query: string; c: number }[];
  dailyTrend: { day: string; c: number; plaza?: number; ai?: number }[];
};

type AppConfig = Record<string, string>;

type Tab = "knowledge" | "plaza" | "operations" | "policies" | "config" | "analytics" | "system";

/* ════════════════════════════════════════════════════════════
   Login Screen
   ════════════════════════════════════════════════════════════ */
function LoginScreen({ onLogin }: { onLogin: (token: string) => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const data = await res.json() as { ok: boolean; token?: string; error?: string };
      if (data.ok && data.token) {
        localStorage.setItem("oa-admin-token", data.token);
        onLogin(data.token);
      } else {
        setError(data.error ?? "登录失败");
      }
    } catch {
      setError("无法连接到服务器，请确认后端已启动");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-logo">
          <span>OA</span>
        </div>
        <h1>OwnAgent 管理后台</h1>
        <p>请输入管理员密码</p>
        <form onSubmit={submit}>
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="admin password"
            autoFocus
            className="adm-input"
          />
          {error && <p className="adm-error">{error}</p>}
          <button type="submit" disabled={loading || !pw} className="adm-btn adm-btn--primary adm-btn--full">
            {loading ? "验证中…" : "登录"}
          </button>
        </form>
        <p className="adm-login-hint">默认密码: admin123（正式部署请在 .env 修改 ADMIN_PASSWORD）</p>
        <p className="adm-login-demo">
          GitHub Pages 为<strong>演示部署</strong>，管理后台需连接后端。
          本地完整体验：<code>npm run dev:full</code> 或 <code>docker compose up -d</code>
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Knowledge Management
   ════════════════════════════════════════════════════════════ */
function KnowledgePanel({ token }: { token: string }) {
  const [docs, setDocs] = useState<KbDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<KbDoc | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", prompts: "", tags: "" });

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ docs: KbDoc[] }>(token, "/api/admin/knowledge");
      setDocs(data.docs);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function startCreate() {
    setForm({ title: "", body: "", prompts: "", tags: "" });
    setCreating(true);
    setEditing(null);
  }

  function startEdit(doc: KbDoc) {
    setForm({
      title: doc.title,
      body: doc.body,
      prompts: doc.prompts.join("\n"),
      tags: doc.tags.join(", "),
    });
    setEditing(doc);
    setCreating(false);
  }

  async function save() {
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      prompts: form.prompts.split("\n").map(s => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map(s => s.trim()).filter(Boolean),
    };
    try {
      if (creating) {
        await apiFetch(token, "/api/admin/knowledge", { method: "POST", body: JSON.stringify(payload) });
      } else if (editing) {
        await apiFetch(token, `/api/admin/knowledge/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      setCreating(false);
      setEditing(null);
      await load();
    } finally { setSaving(false); }
  }

  async function toggleEnabled(doc: KbDoc) {
    await apiFetch(token, `/api/admin/knowledge/${doc.id}`, {
      method: "PUT",
      body: JSON.stringify({ enabled: !doc.enabled }),
    });
    await load();
  }

  async function del(doc: KbDoc) {
    if (!confirm(`确定删除「${doc.title}」？此操作不可恢复。`)) return;
    await apiFetch(token, `/api/admin/knowledge/${doc.id}`, { method: "DELETE" });
    await load();
  }

  const showForm = creating || editing !== null;

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>知识库管理</h2>
          <p>管理 AI 回答所依赖的知识文档，支持增删改查</p>
        </div>
        <button className="adm-btn adm-btn--primary" onClick={startCreate}>
          + 新建文档
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="adm-form-card">
          <h3>{creating ? "新建知识文档" : `编辑：${editing?.title}`}</h3>
          <div className="adm-form-row">
            <label>文档标题 *</label>
            <input className="adm-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="例：产品功能介绍" />
          </div>
          <div className="adm-form-row">
            <label>知识内容 *</label>
            <textarea className="adm-textarea" rows={8} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="输入详细的知识内容，AI 会基于此内容回答问题…" />
          </div>
          <div className="adm-form-row">
            <label>预设问题（每行一条，用户可直接点击提问）</label>
            <textarea className="adm-textarea" rows={3} value={form.prompts} onChange={e => setForm(f => ({ ...f, prompts: e.target.value }))} placeholder={"这个产品是做什么的？\n有哪些核心功能？"} />
          </div>
          <div className="adm-form-row">
            <label>标签（逗号分隔）</label>
            <input className="adm-input" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="产品, 功能, 介绍" />
          </div>
          <div className="adm-form-actions">
            <button className="adm-btn" onClick={() => { setCreating(false); setEditing(null); }}>取消</button>
            <button className="adm-btn adm-btn--primary" disabled={saving || !form.title || !form.body} onClick={save}>
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="adm-loading">加载中…</div>
      ) : docs.length === 0 ? (
        <div className="adm-empty-state">
          <p>暂无知识文档</p>
          <p>点击「新建文档」添加第一篇知识，AI 将根据这些内容回答客户问题。</p>
        </div>
      ) : (
        <div className="adm-kb-list">
          {docs.map(doc => (
            <div key={doc.id} className={`adm-kb-item${doc.enabled ? "" : " disabled"}`}>
              <div className="adm-kb-item-head">
                <div>
                  <strong>{doc.title}</strong>
                  <div className="adm-kb-meta">
                    {doc.prompts.length > 0 && <span>{doc.prompts.length} 个预设问题</span>}
                    {doc.tags.length > 0 && doc.tags.map(t => <span key={t} className="adm-tag">{t}</span>)}
                    <span className="adm-kb-date">{new Date(doc.updated_at).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                <div className="adm-kb-actions">
                  <button
                    className={`adm-toggle${doc.enabled ? " on" : ""}`}
                    onClick={() => toggleEnabled(doc)}
                    title={doc.enabled ? "点击停用" : "点击启用"}
                  />
                  <button className="adm-btn adm-btn--sm" onClick={() => startEdit(doc)}>编辑</button>
                  <button className="adm-btn adm-btn--sm adm-btn--danger" onClick={() => del(doc)}>删除</button>
                </div>
              </div>
              <p className="adm-kb-body-preview">{doc.body.slice(0, 120)}{doc.body.length > 120 ? "…" : ""}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Configuration Panel
   ════════════════════════════════════════════════════════════ */
function ConfigPanel({ token }: { token: string }) {
  const [cfg, setCfg] = useState<AppConfig>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<AppConfig>(token, "/api/admin/config").then(setCfg).catch(() => {});
  }, [token]);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      // Don't send masked key
      const payload = { ...cfg };
      if (payload.llm_api_key?.includes("***")) delete payload.llm_api_key;
      await apiFetch(token, "/api/admin/config", { method: "POST", body: JSON.stringify(payload) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  async function testLLM() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`${API}/api/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: "你好，请用一句话介绍自己。" }] }),
      });
      if (res.ok) setTestResult("✅ LLM 连接正常");
      else setTestResult(`❌ 错误: ${res.status}`);
    } catch (e) {
      setTestResult(`❌ 连接失败: ${e}`);
    } finally { setTesting(false); }
  }

  function set(key: string, val: string) { setCfg(c => ({ ...c, [key]: val })); }

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>应用配置</h2>
          <p>配置 LLM 接口、应用外观和基本信息</p>
        </div>
        <button className="adm-btn adm-btn--primary" disabled={saving} onClick={save}>
          {saving ? "保存中…" : saved ? "✅ 已保存" : "保存配置"}
        </button>
      </div>

      {/* LLM Config */}
      <div className="adm-section">
        <h3 className="adm-section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          LLM 配置
        </h3>
        <div className="adm-config-grid">
          <div className="adm-form-row">
            <label>API Key</label>
            <input className="adm-input" type="password" value={cfg.llm_api_key ?? ""} onChange={e => set("llm_api_key", e.target.value)} placeholder="sk-..." />
          </div>
          <div className="adm-form-row">
            <label>API Base URL</label>
            <input className="adm-input" value={cfg.llm_base_url ?? ""} onChange={e => set("llm_base_url", e.target.value)} placeholder="https://api.deepseek.com/v1" />
          </div>
          <div className="adm-form-row">
            <label>模型名称</label>
            <input className="adm-input" value={cfg.llm_model ?? ""} onChange={e => set("llm_model", e.target.value)} placeholder="deepseek-chat" />
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "0.75rem" }}>
          <button className="adm-btn" disabled={testing} onClick={testLLM}>
            {testing ? "测试中…" : "测试连接"}
          </button>
          {testResult && <span className={`adm-test-result${testResult.startsWith("✅") ? " ok" : " err"}`}>{testResult}</span>}
        </div>
      </div>

      {/* App Branding */}
      <div className="adm-section">
        <h3 className="adm-section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          品牌与外观
        </h3>
        <div className="adm-config-grid">
          <div className="adm-form-row">
            <label>应用名称</label>
            <input className="adm-input" value={cfg.app_name ?? ""} onChange={e => set("app_name", e.target.value)} placeholder="OwnAgent" />
          </div>
          <div className="adm-form-row">
            <label>欢迎语</label>
            <input className="adm-input" value={cfg.welcome_message ?? ""} onChange={e => set("welcome_message", e.target.value)} placeholder="您好，有什么可以帮助您的？" />
          </div>
          <div className="adm-form-row">
            <label>主题色</label>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <input type="color" value={cfg.theme_color ?? "#6366f1"} onChange={e => set("theme_color", e.target.value)} />
              <input className="adm-input" style={{ flex: 1 }} value={cfg.theme_color ?? ""} onChange={e => set("theme_color", e.target.value)} placeholder="#6366f1" />
            </div>
          </div>
          <div className="adm-form-row">
            <label>应用简介</label>
            <textarea className="adm-textarea" rows={2} value={cfg.app_description ?? ""} onChange={e => set("app_description", e.target.value)} placeholder="企业级 AI 知识助手" />
          </div>
        </div>
      </div>

      {/* Plaza workflow */}
      <div className="adm-section">
        <h3 className="adm-section-title">广场与工作流</h3>
        <div className="adm-config-grid">
          <div className="adm-form-row">
            <label>广场优先匹配阈值（%）</label>
            <input className="adm-input" type="number" min={40} max={100} value={cfg.plaza_match_threshold ?? "70"} onChange={e => set("plaza_match_threshold", e.target.value)} />
          </div>
          <div className="adm-form-row">
            <label>低置信度告警阈值（%）</label>
            <input className="adm-input" type="number" min={20} max={90} value={cfg.low_confidence_threshold ?? "65"} onChange={e => set("low_confidence_threshold", e.target.value)} />
          </div>
          <div className="adm-form-row">
            <label>启用「先搜广场」</label>
            <select className="adm-input" value={cfg.plaza_first_enabled ?? "true"} onChange={e => set("plaza_first_enabled", e.target.value)}>
              <option value="true">是</option>
              <option value="false">否</option>
            </select>
          </div>
          <div className="adm-form-row">
            <label>允许匿名发布到广场</label>
            <select className="adm-input" value={cfg.allow_anonymous_publish ?? "true"} onChange={e => set("allow_anonymous_publish", e.target.value)}>
              <option value="true">是</option>
              <option value="false">否（仅管理员）</option>
            </select>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="adm-section">
        <h3 className="adm-section-title">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1.5l-5.5 3v4c0 3.5 3 6 5.5 7 2.5-1 5.5-3.5 5.5-7v-4L8 1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
          安全设置
        </h3>
        <div className="adm-form-row">
          <label>管理员密码</label>
          <input className="adm-input" type="password" value={cfg.admin_password ?? ""} onChange={e => set("admin_password", e.target.value)} placeholder="修改后需重新登录" />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Analytics Panel
   ════════════════════════════════════════════════════════════ */
function AnalyticsPanel({ token }: { token: string }) {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    apiFetch<Analytics>(token, "/api/admin/analytics").then(setData).catch(() => {});
  }, [token]);

  if (!data) return <div className="adm-loading">加载分析数据…</div>;

  const maxTrend = Math.max(...data.dailyTrend.map(d => d.c), 1);

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>使用分析</h2>
          <p>客户使用情况、热门问题、每日趋势</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="adm-kpi-grid">
        {[
          { label: "累计问答", value: data.total.toLocaleString(), sub: `今日 ${data.today}`, icon: "💬" },
          { label: "广场命中", value: `${data.plazaHitRate ?? 0}%`, sub: `${data.plazaHits ?? 0} 次零 Token`, icon: "🌐" },
          { label: "预估节省", value: `≈${((data.tokenSavedEst ?? 0) / 1000).toFixed(1)}k`, sub: "Token 估算", icon: "💰" },
          { label: "知识覆盖", value: `${data.avgGround}%`, sub: "平均置信度", icon: "🎯" },
          { label: "知识文档", value: data.kbCount.toString(), sub: `${data.plazaCount ?? 0} 条广场`, icon: "📚" },
          { label: "AI 调用", value: (data.aiCalls ?? 0).toLocaleString(), sub: `平均 ${(data.avgLatency / 1000).toFixed(1)}s`, icon: "⚡" },
        ].map(k => (
          <div key={k.label} className="adm-kpi-card">
            <span className="adm-kpi-icon">{k.icon}</span>
            <span className="adm-kpi-val">{k.value}</span>
            <span className="adm-kpi-label">{k.label}</span>
            <span className="adm-kpi-sub">{k.sub}</span>
          </div>
        ))}
      </div>

      <div className="adm-analytics-row">
        {/* Daily trend */}
        <div className="adm-chart-card">
          <h3>过去 14 天问答量</h3>
          <div className="adm-bar-chart">
            {[...data.dailyTrend].reverse().map(d => (
              <div key={d.day} className="adm-bar-col">
                <div className="adm-bar-fill" style={{ height: `${(d.c / maxTrend) * 100}%` }} title={`${d.day}: ${d.c} 次`} />
                <span className="adm-bar-label">{d.day.slice(5)}</span>
              </div>
            ))}
            {data.dailyTrend.length === 0 && <p className="adm-empty-hint">暂无数据</p>}
          </div>
        </div>

        {/* Top queries */}
        <div className="adm-chart-card">
          <h3>热门问题 Top 10</h3>
          <div className="adm-top-queries">
            {data.topQueries.length === 0 && <p className="adm-empty-hint">暂无数据</p>}
            {data.topQueries.map((q, i) => (
              <div key={i} className="adm-query-row">
                <span className="adm-query-rank">{i + 1}</span>
                <span className="adm-query-text">{q.query}</span>
                <span className="adm-query-count">{q.c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   System Panel
   ════════════════════════════════════════════════════════════ */
function SystemPanel({ token }: { token: string }) {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${API}/api/health`, { headers: apiHeaders(token) })
      .then(r => r.json())
      .then(d => setHealth(d as Record<string, unknown>))
      .catch(() => {});
  }, [token]);

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div><h2>系统状态</h2><p>服务健康检查与版本信息</p></div>
      </div>
      <div className="adm-section">
        <h3 className="adm-section-title">后端服务</h3>
        {health ? (
          <div className="adm-sys-info">
            {Object.entries(health).map(([k, v]) => (
              <div key={k} className="adm-sys-row">
                <span className="adm-sys-key">{k}</span>
                <span className="adm-sys-val">{String(v)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="adm-empty-hint">无法连接到后端，请确认 API 服务已启动</p>
        )}
      </div>
      <div className="adm-section">
        <h3 className="adm-section-title">快速部署指南</h3>
        <div className="adm-deploy-steps">
          {[
            { n: "1", t: "克隆代码", d: "git clone [repo] && cd [project]" },
            { n: "2", t: "配置环境", d: "cp .env.example .env  →  填写 API Key" },
            { n: "3", t: "启动服务", d: "docker compose up -d" },
            { n: "4", t: "访问后台", d: "http://localhost:3000/admin" },
          ].map(s => (
            <div key={s.n} className="adm-deploy-step">
              <span className="adm-deploy-num">{s.n}</span>
              <div>
                <strong>{s.t}</strong>
                <code>{s.d}</code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Main Admin Shell
   ════════════════════════════════════════════════════════════ */
export function AdminPage() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("oa-admin-token"));
  const [tab, setTab] = useState<Tab>("operations");

  function logout() {
    localStorage.removeItem("oa-admin-token");
    setToken(null);
  }

  if (!token) return <LoginScreen onLogin={setToken} />;

  const NAV: { id: Tab; label: string; icon: string }[] = [
    { id: "operations", label: "知识运营", icon: "📋" },
    { id: "knowledge",  label: "知识库",   icon: "📚" },
    { id: "plaza",      label: "知识广场", icon: "🌐" },
    { id: "policies",   label: "制度权限", icon: "🛡️" },
    { id: "analytics",  label: "数据分析", icon: "📊" },
    { id: "config",     label: "应用配置", icon: "⚙️" },
    { id: "system",     label: "系统",     icon: "🔧" },
  ];

  return (
    <div className="adm-shell">
      {/* Sidebar */}
      <aside className="adm-sidebar">
        <div className="adm-sidebar-brand">
          <span className="adm-sidebar-logo">OA</span>
          <div>
            <strong>OwnAgent</strong>
            <span>管理后台</span>
          </div>
        </div>
        <nav className="adm-sidebar-nav">
          {NAV.map(n => (
            <button
              key={n.id}
              type="button"
              className={`adm-nav-item${tab === n.id ? " on" : ""}`}
              onClick={() => setTab(n.id)}
            >
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="adm-sidebar-footer">
          <a href="/" className="adm-nav-item">← 返回前台</a>
          <button type="button" className="adm-nav-item adm-nav-logout" onClick={logout}>退出登录</button>
        </div>
      </aside>

      {/* Main */}
      <main className="adm-main">
        {tab === "operations" && (
          <OperationsPanel
            token={token}
            onGoKnowledge={() => setTab("knowledge")}
            onGoPlaza={() => setTab("plaza")}
          />
        )}
        {tab === "knowledge"  && <KnowledgePanel  token={token} />}
        {tab === "plaza"      && <PlazaAdminPanel  token={token} />}
        {tab === "policies"   && <PoliciesPanel    token={token} />}
        {tab === "config"     && <ConfigPanel     token={token} />}
        {tab === "analytics"  && <AnalyticsPanel  token={token} />}
        {tab === "system"     && <SystemPanel     token={token} />}
      </main>
    </div>
  );
}
