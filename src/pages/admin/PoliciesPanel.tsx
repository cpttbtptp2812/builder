import { useCallback, useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE ?? "http://localhost:8787";

function apiHeaders(token: string) {
  return { "Content-Type": "application/json", "x-admin-token": token };
}

type PolicyClause = {
  id: string;
  topic: string;
  status: string;
  text: string;
  slot: string | null;
  value: string | null;
  condition_text: string | null;
  sort_order: number;
  enabled: number;
};

type CapabilityRule = {
  id: string;
  name: string;
  cap: string;
  pattern: string;
  reason: string;
  priority: number;
  enabled: number;
};

type SubTab = "policies" | "capability";

export function PoliciesPanel({ token }: { token: string }) {
  const [sub, setSub] = useState<SubTab>("policies");
  const [clauses, setClauses] = useState<PolicyClause[]>([]);
  const [rules, setRules] = useState<CapabilityRule[]>([]);
  const [loading, setLoading] = useState(true);

  const [policyForm, setPolicyForm] = useState({
    id: "", topic: "general", status: "current", text: "", slot: "", value: "", condition_text: "",
  });
  const [ruleForm, setRuleForm] = useState({
    name: "", cap: "read", pattern: "", reason: "", priority: 50,
  });
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<string | null>(null);
  const [creatingPolicy, setCreatingPolicy] = useState(false);
  const [creatingRule, setCreatingRule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`${API}/api/admin/policies`, { headers: apiHeaders(token) }),
        fetch(`${API}/api/admin/capability-rules`, { headers: apiHeaders(token) }),
      ]);
      if (pRes.ok) {
        const p = await pRes.json() as { clauses: PolicyClause[] };
        setClauses(p.clauses);
      }
      if (rRes.ok) {
        const r = await rRes.json() as { rules: CapabilityRule[] };
        setRules(r.rules);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  async function savePolicy() {
    if (creatingPolicy) {
      await fetch(`${API}/api/admin/policies`, {
        method: "POST",
        headers: apiHeaders(token),
        body: JSON.stringify({ ...policyForm, id: policyForm.id || undefined }),
      });
    } else if (editingPolicy) {
      await fetch(`${API}/api/admin/policies/${editingPolicy}`, {
        method: "PUT",
        headers: apiHeaders(token),
        body: JSON.stringify(policyForm),
      });
    }
    setCreatingPolicy(false);
    setEditingPolicy(null);
    void load();
  }

  async function saveRule() {
    if (creatingRule) {
      await fetch(`${API}/api/admin/capability-rules`, {
        method: "POST",
        headers: apiHeaders(token),
        body: JSON.stringify(ruleForm),
      });
    } else if (editingRule) {
      await fetch(`${API}/api/admin/capability-rules/${editingRule}`, {
        method: "PUT",
        headers: apiHeaders(token),
        body: JSON.stringify(ruleForm),
      });
    }
    setCreatingRule(false);
    setEditingRule(null);
    void load();
  }

  return (
    <div className="adm-panel">
      <div className="adm-panel-head">
        <div>
          <h2>制度与权限</h2>
          <p>配置制度条款与能力规则：只读问答、改权限工单、拒绝回答的范围</p>
        </div>
      </div>

      <div className="adm-subtabs">
        <button type="button" className={`adm-subtab${sub === "policies" ? " on" : ""}`} onClick={() => setSub("policies")}>
          制度条款 ({clauses.length})
        </button>
        <button type="button" className={`adm-subtab${sub === "capability" ? " on" : ""}`} onClick={() => setSub("capability")}>
          能力规则 ({rules.length})
        </button>
      </div>

      {loading ? (
        <div className="adm-loading">加载中…</div>
      ) : sub === "policies" ? (
        <>
          <div className="adm-panel-head" style={{ marginTop: "0.5rem" }}>
            <p className="adm-ops-hint">制度问答只输出带编号原句；现行/废止冲突时自动熔断</p>
            <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => {
              setCreatingPolicy(true);
              setEditingPolicy(null);
              setPolicyForm({ id: "", topic: "general", status: "current", text: "", slot: "", value: "", condition_text: "" });
            }}>+ 新增条款</button>
          </div>

          {(creatingPolicy || editingPolicy) && (
            <div className="adm-form-card">
              <h3>{creatingPolicy ? "新增制度条款" : "编辑条款"}</h3>
              <div className="adm-config-grid">
                <div className="adm-form-row">
                  <label>条款编号</label>
                  <input className="adm-input" value={policyForm.id} onChange={(e) => setPolicyForm((f) => ({ ...f, id: e.target.value }))} placeholder="KB-休假-现行-1年" disabled={!!editingPolicy} />
                </div>
                <div className="adm-form-row">
                  <label>主题</label>
                  <select className="adm-input" value={policyForm.topic} onChange={(e) => setPolicyForm((f) => ({ ...f, topic: e.target.value }))}>
                    <option value="leave">休假</option>
                    <option value="overtime">加班</option>
                    <option value="vpn">VPN/权限</option>
                    <option value="reimburse">报销</option>
                    <option value="general">通用</option>
                  </select>
                </div>
                <div className="adm-form-row">
                  <label>状态</label>
                  <select className="adm-input" value={policyForm.status} onChange={(e) => setPolicyForm((f) => ({ ...f, status: e.target.value }))}>
                    <option value="current">现行</option>
                    <option value="abolished">已废止</option>
                  </select>
                </div>
                <div className="adm-form-row">
                  <label>Slot</label>
                  <input className="adm-input" value={policyForm.slot} onChange={(e) => setPolicyForm((f) => ({ ...f, slot: e.target.value }))} placeholder="leave.days" />
                </div>
                <div className="adm-form-row">
                  <label>取值</label>
                  <input className="adm-input" value={policyForm.value} onChange={(e) => setPolicyForm((f) => ({ ...f, value: e.target.value }))} placeholder="10" />
                </div>
              </div>
              <div className="adm-form-row">
                <label>条款原文 *</label>
                <textarea className="adm-textarea" rows={3} value={policyForm.text} onChange={(e) => setPolicyForm((f) => ({ ...f, text: e.target.value }))} />
              </div>
              <div className="adm-form-actions">
                <button type="button" className="adm-btn" onClick={() => { setCreatingPolicy(false); setEditingPolicy(null); }}>取消</button>
                <button type="button" className="adm-btn adm-btn--primary" disabled={!policyForm.text.trim()} onClick={() => void savePolicy()}>保存</button>
              </div>
            </div>
          )}

          <div className="adm-kb-list">
            {clauses.map((c) => (
              <div key={c.id} className={`adm-kb-item${c.enabled ? "" : " disabled"}`}>
                <div className="adm-kb-item-head">
                  <div>
                    <strong><code>{c.id}</code> · {c.status === "current" ? "现行" : "废止"}</strong>
                    <div className="adm-kb-meta">
                      <span>{c.topic}</span>
                      {c.slot ? <span>{c.slot} = {c.value}</span> : null}
                    </div>
                  </div>
                  <div className="adm-kb-actions">
                    <button type="button" className="adm-btn adm-btn--sm" onClick={() => {
                      setEditingPolicy(c.id);
                      setCreatingPolicy(false);
                      setPolicyForm({
                        id: c.id, topic: c.topic, status: c.status, text: c.text,
                        slot: c.slot ?? "", value: c.value ?? "", condition_text: c.condition_text ?? "",
                      });
                    }}>编辑</button>
                    <button type="button" className="adm-btn adm-btn--sm adm-btn--danger" onClick={async () => {
                      if (!confirm(`删除 ${c.id}？`)) return;
                      await fetch(`${API}/api/admin/policies/${c.id}`, { method: "DELETE", headers: apiHeaders(token) });
                      void load();
                    }}>删除</button>
                  </div>
                </div>
                <p className="adm-kb-body-preview">{c.text}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="adm-panel-head" style={{ marginTop: "0.5rem" }}>
            <p className="adm-ops-hint">问句先匹配能力规则：read 只读答、mutate 只起草工单、abstain 直接拒绝</p>
            <button type="button" className="adm-btn adm-btn--primary adm-btn--sm" onClick={() => {
              setCreatingRule(true);
              setEditingRule(null);
              setRuleForm({ name: "", cap: "read", pattern: "", reason: "", priority: 50 });
            }}>+ 新增规则</button>
          </div>

          {(creatingRule || editingRule) && (
            <div className="adm-form-card">
              <h3>{creatingRule ? "新增能力规则" : "编辑规则"}</h3>
              <div className="adm-config-grid">
                <div className="adm-form-row">
                  <label>规则名称 *</label>
                  <input className="adm-input" value={ruleForm.name} onChange={(e) => setRuleForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="adm-form-row">
                  <label>能力类型</label>
                  <select className="adm-input" value={ruleForm.cap} onChange={(e) => setRuleForm((f) => ({ ...f, cap: e.target.value }))}>
                    <option value="read">read · 只读问答</option>
                    <option value="mutate">mutate · 只起草工单</option>
                    <option value="abstain">abstain · 拒绝回答</option>
                  </select>
                </div>
                <div className="adm-form-row">
                  <label>优先级（越小越先匹配）</label>
                  <input className="adm-input" type="number" value={ruleForm.priority} onChange={(e) => setRuleForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="adm-form-row">
                <label>匹配正则 *</label>
                <input className="adm-input" value={ruleForm.pattern} onChange={(e) => setRuleForm((f) => ({ ...f, pattern: e.target.value }))} placeholder="年假|休假|请假" />
              </div>
              <div className="adm-form-row">
                <label>命中说明</label>
                <input className="adm-input" value={ruleForm.reason} onChange={(e) => setRuleForm((f) => ({ ...f, reason: e.target.value }))} />
              </div>
              <div className="adm-form-actions">
                <button type="button" className="adm-btn" onClick={() => { setCreatingRule(false); setEditingRule(null); }}>取消</button>
                <button type="button" className="adm-btn adm-btn--primary" disabled={!ruleForm.name || !ruleForm.pattern} onClick={() => void saveRule()}>保存</button>
              </div>
            </div>
          )}

          <div className="adm-kb-list">
            {rules.map((r) => (
              <div key={r.id} className={`adm-kb-item${r.enabled ? "" : " disabled"}`}>
                <div className="adm-kb-item-head">
                  <div>
                    <strong>{r.name}</strong>
                    <div className="adm-kb-meta">
                      <span className={`adm-cap-badge adm-cap-badge--${r.cap}`}>{r.cap}</span>
                      <span>优先级 {r.priority}</span>
                      <code>{r.pattern}</code>
                    </div>
                  </div>
                  <div className="adm-kb-actions">
                    <button type="button" className="adm-btn adm-btn--sm" onClick={() => {
                      setEditingRule(r.id);
                      setCreatingRule(false);
                      setRuleForm({ name: r.name, cap: r.cap, pattern: r.pattern, reason: r.reason, priority: r.priority });
                    }}>编辑</button>
                    <button type="button" className="adm-btn adm-btn--sm adm-btn--danger" onClick={async () => {
                      if (!confirm(`删除规则「${r.name}」？`)) return;
                      await fetch(`${API}/api/admin/capability-rules/${r.id}`, { method: "DELETE", headers: apiHeaders(token) });
                      void load();
                    }}>删除</button>
                  </div>
                </div>
                <p className="adm-kb-body-preview">{r.reason}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
