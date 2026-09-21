import { useEffect, useState } from "react";
import {
  deleteKnowledgeDoc,
  listKnowledgeDocs,
  listKnowledgePrompts,
  resetKnowledgeToSeed,
  saveKnowledgeDoc,
  type KnowledgeDoc,
} from "../../../lib/ownKnowledge";

/** 知识库配置 — 增删改条目与示例问句 */
export function KnowledgeEditor({ onChanged }: { onChanged?: () => void }) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [editing, setEditing] = useState<KnowledgeDoc | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [promptsText, setPromptsText] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    setDocs(listKnowledgeDocs());
    onChanged?.();
  }

  useEffect(() => {
    reload();
  }, []);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1600);
  }

  function startNew() {
    setEditing({ id: "", title: "", body: "", prompts: [], updatedAt: 0 });
    setTitle("");
    setBody("");
    setPromptsText("");
  }

  function startEdit(doc: KnowledgeDoc) {
    setEditing(doc);
    setTitle(doc.title);
    setBody(doc.body);
    setPromptsText(doc.prompts.join("\n"));
  }

  function save() {
    if (!title.trim() || !body.trim()) {
      flash("标题和正文不能为空");
      return;
    }
    const prompts = promptsText
      .split(/\n|；|;/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!prompts.length) {
      flash("至少写一句示例问句，欢迎页才会展示");
      return;
    }
    saveKnowledgeDoc({
      id: editing?.id || undefined,
      title,
      body,
      prompts,
    });
    setEditing(null);
    reload();
    flash("已保存，检索与欢迎问句已更新");
  }

  function remove(id: string) {
    if (!window.confirm("删除这条知识？相关示例问句也会消失。")) return;
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

  const samplePrompts = listKnowledgePrompts(8);

  return (
    <div className="ua-kb">
      <header className="ua-kb-head">
        <div>
          <strong>知识库</strong>
          <em>正文可检索；示例问句会出现在欢迎页，避免点到空结果</em>
        </div>
        <div className="ua-kb-head-actions">
          <button type="button" onClick={startNew}>
            新建
          </button>
          <button type="button" className="ghost" onClick={reset}>
            恢复默认
          </button>
        </div>
      </header>

      {toast && <p className="ua-kb-toast">{toast}</p>}

      {editing ? (
        <div className="ua-kb-editor">
          <label>
            标题
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：iMean 架构" />
          </label>
          <label>
            正文（检索语料）
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="写入客户可以问到的事实…"
            />
          </label>
          <label>
            示例问句（每行一句，欢迎页只展示这些）
            <textarea
              value={promptsText}
              onChange={(e) => setPromptsText(e.target.value)}
              rows={3}
              placeholder={"介绍一下 iMean 的架构\niMean 元素定位怎么做的"}
            />
          </label>
          <div className="ua-kb-editor-actions">
            <button type="button" className="primary" onClick={save}>
              保存
            </button>
            <button type="button" onClick={() => setEditing(null)}>
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <ul className="ua-kb-list">
            {docs.map((d) => (
              <li key={d.id}>
                <div>
                  <strong>{d.title}</strong>
                  <em>{d.prompts.length} 个示例问句 · {d.body.length} 字</em>
                  <p>{d.body.slice(0, 100)}{d.body.length > 100 ? "…" : ""}</p>
                </div>
                <div className="ua-kb-row-actions">
                  <button type="button" onClick={() => startEdit(d)}>
                    编辑
                  </button>
                  <button type="button" className="danger" onClick={() => remove(d.id)}>
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {samplePrompts.length > 0 && (
            <div className="ua-kb-samples">
              <header>当前会展示的问句</header>
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
