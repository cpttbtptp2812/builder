import { useMemo, useState } from "react";
import { retrieveRag, type RagRetrieveResult } from "../../lib/ragEngine";
import { listKnowledgePrompts } from "../../lib/ownKnowledge";
import { KnowledgeEditor } from "../fx/agent/KnowledgeEditor";

/** OwnAgent · 知识检索 + 可编辑知识库 */
export function RagPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RagRetrieveResult | null>(null);
  const [tab, setTab] = useState<"search" | "edit">("search");
  const [rev, setRev] = useState(0);

  const corpusInfo = useMemo(() => retrieveRag("__warmup__", 1), [rev]);
  const presets = useMemo(() => listKnowledgePrompts(6).map((p) => p.text), [rev]);

  function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setResult(retrieveRag(text, 5));
  }

  return (
    <div className="own-panel">
      <div className="ua-settings-tabs" style={{ marginBottom: "0.85rem" }}>
        <button type="button" className={tab === "search" ? "on" : ""} onClick={() => setTab("search")}>
          检索试跑
        </button>
        <button type="button" className={tab === "edit" ? "on" : ""} onClick={() => setTab("edit")}>
          编辑知识库
        </button>
      </div>

      {tab === "edit" ? (
        <KnowledgeEditor onChanged={() => setRev((n) => n + 1)} />
      ) : (
        <>
          <p className="own-panel-lead">
            问句来自已配置知识库。改内容请到「编辑知识库」，避免客户点到空结果。
          </p>

          <div className="agent-trace-input-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="例如：介绍一下 iMean 的架构"
              onKeyDown={(e) => {
                if (e.key === "Enter") run(query);
              }}
            />
            <button type="button" className="agent-trace-send" onClick={() => run(query)}>
              检索
            </button>
          </div>
          <div className="agent-trace-quick">
            {presets.map((p) => (
              <button key={p} type="button" onClick={() => run(p)}>
                {p}
              </button>
            ))}
          </div>

          <div className="own-stat-row">
            <div>
              <span>语料块</span>
              <strong>{corpusInfo.chunkCount}</strong>
            </div>
            <div>
              <span>本次耗时</span>
              <strong>{result ? `${result.latencyMs}ms` : "—"}</strong>
            </div>
            <div>
              <span>命中</span>
              <strong>{result ? result.hits.length : "—"}</strong>
            </div>
          </div>

          {!result ? (
            <p className="agent-trace-empty">点上面的示例问句试检索</p>
          ) : result.hits.length === 0 ? (
            <p className="agent-trace-empty">没有命中。请到「编辑知识库」补正文，或换已配置的示例问句。</p>
          ) : (
            <ol className="own-rag-list">
              {result.hits.map((h) => (
                <li key={h.chunkId}>
                  <div className="own-rag-head">
                    <strong>
                      {h.projectName} · {h.section}
                      {h.aspectKey ? `/${h.aspectKey}` : ""}
                    </strong>
                    <em>score {h.score.toFixed(2)}</em>
                  </div>
                  <p>
                    {h.text.slice(0, 220)}
                    {h.text.length > 220 ? "…" : ""}
                  </p>
                  <div className="own-rag-meta">
                    <code>{h.chunkId}</code>
                    {h.matchedTerms.length > 0 ? <span>命中词：{h.matchedTerms.join("、")}</span> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </div>
  );
}
