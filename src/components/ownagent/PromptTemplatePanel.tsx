import { useMemo, useState } from "react";
import {
  applyPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  PROMPT_CATEGORY_LABEL,
  savePromptTemplate,
  type PromptTemplate,
} from "../../lib/promptTemplates";

/** Prompt 模板管理 — 岗位 Prompt 工程落地 */
export function PromptTemplatePanel() {
  const [rev, setRev] = useState(0);
  const [draft, setDraft] = useState<PromptTemplate | null>(null);
  const [query, setQuery] = useState("");

  const templates = useMemo(() => listPromptTemplates(), [rev]);

  function refresh() {
    setRev((r) => r + 1);
  }

  function openNew() {
    setDraft({
      id: "",
      name: "",
      description: "",
      category: "agent",
      template: "请处理以下任务：\n\n{{query}}",
      updatedAt: new Date().toISOString(),
    });
    setQuery("");
  }

  function openEdit(t: PromptTemplate) {
    setDraft({ ...t });
    setQuery("");
  }

  function saveDraft() {
    if (!draft?.name.trim() || !draft.template.trim()) return;
    savePromptTemplate({
      id: draft.id || undefined,
      name: draft.name.trim(),
      description: draft.description.trim(),
      category: draft.category,
      template: draft.template,
    });
    setDraft(null);
    refresh();
  }

  function useInChat(t: PromptTemplate) {
    const text = applyPromptTemplate(t, query);
    sessionStorage.setItem("oa-pending-ask", text);
    window.dispatchEvent(new CustomEvent("ownagent:go", { detail: { view: "chat" } }));
  }

  return (
    <div className="oa-ui oa-page oa-prompt-panel">
      <header className="oa-panel-head">
        <div>
          <h1>Prompt 模板</h1>
          <p>开发者功能：管理场景化提示词，一键带入对话测试。</p>
        </div>
        <button type="button" className="oa-panel-primary" onClick={openNew}>
          新建模板
        </button>
      </header>

      <div className="oa-prompt-test">
        <label>
          测试变量 <code>{"{{query}}"}</code>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例如：检查首页是否可访问"
          />
        </label>
      </div>

      <div className="oa-prompt-grid">
        {templates.map((t) => (
          <article key={t.id} className="oa-prompt-card">
            <header>
              <span className={`oa-prompt-cat oa-prompt-cat--${t.category}`}>
                {PROMPT_CATEGORY_LABEL[t.category]}
              </span>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
            </header>
            <pre className="oa-prompt-preview">{applyPromptTemplate(t, query || "…")}</pre>
            <footer>
              <button type="button" className="oa-panel-primary sm" onClick={() => useInChat(t)}>
                带入对话
              </button>
              <button type="button" className="oa-panel-ghost sm" onClick={() => openEdit(t)}>
                编辑
              </button>
              {t.id.startsWith("pt-") && (
                <button
                  type="button"
                  className="oa-panel-ghost sm danger"
                  onClick={() => {
                    deletePromptTemplate(t.id);
                    refresh();
                  }}
                >
                  删除
                </button>
              )}
            </footer>
          </article>
        ))}
      </div>

      {draft && (
        <div className="oa-modal-backdrop" onClick={() => setDraft(null)}>
          <div className="oa-modal oa-prompt-editor" onClick={(e) => e.stopPropagation()}>
            <header>
              <strong>{draft.id ? "编辑模板" : "新建模板"}</strong>
              <button type="button" onClick={() => setDraft(null)} aria-label="关闭">
                ×
              </button>
            </header>
            <label>
              名称
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label>
              说明
              <input
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>
            <label>
              分类
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as PromptTemplate["category"] })
                }
              >
                <option value="rag">RAG</option>
                <option value="agent">Agent</option>
                <option value="tool">Tool Calling</option>
                <option value="eval">评测</option>
              </select>
            </label>
            <label>
              模板正文（可用 <code>{"{{query}}"}</code>）
              <textarea
                rows={8}
                value={draft.template}
                onChange={(e) => setDraft({ ...draft, template: e.target.value })}
              />
            </label>
            <footer>
              <button type="button" className="oa-panel-ghost" onClick={() => setDraft(null)}>
                取消
              </button>
              <button type="button" className="oa-panel-primary" onClick={saveDraft}>
                保存
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
