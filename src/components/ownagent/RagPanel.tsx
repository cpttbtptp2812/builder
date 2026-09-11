import { useMemo, useState } from "react";
import { retrieveRag, type RagRetrieveResult } from "../../lib/ragEngine";

const PRESETS = ["iMean 架构设计", "PostMessage 跨窗口调度", "元素定位成功率", "SSE 流式续传"];

/** OwnAgent · 知识检索 — 真实 RAG 分块召回 */
export function RagPanel() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RagRetrieveResult | null>(null);

  const corpusInfo = useMemo(() => retrieveRag("__warmup__", 1), []);

  function run(q: string) {
    const text = q.trim();
    if (!text) return;
    setQuery(text);
    setResult(retrieveRag(text, 5));
  }

  return (
    <div className="own-panel">
      <p className="own-panel-lead">
        问一个问题，看知识库<strong>召回了哪些片段、为什么</strong>。语料由项目文档分块生成，
        打分 = 关键词重叠 + 项目直匹配 + 段落加权，每条带 chunkId 可溯源。
      </p>

      <div className="agent-trace-input-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例如：iMean 的元素定位怎么做的"
          onKeyDown={(e) => {
            if (e.key === "Enter") run(query);
          }}
        />
        <button type="button" className="agent-trace-send" onClick={() => run(query)}>
          检索
        </button>
      </div>
      <div className="agent-trace-quick">
        {PRESETS.map((p) => (
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
          <span>项目数</span>
          <strong>{corpusInfo.corpusSize}</strong>
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
        <p className="agent-trace-empty">输入问题或点上面的示例</p>
      ) : result.hits.length === 0 ? (
        <p className="agent-trace-empty">没有命中，换个关键词（如项目名、技术词）</p>
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
              <p>{h.text.slice(0, 220)}{h.text.length > 220 ? "…" : ""}</p>
              <div className="own-rag-meta">
                <code>{h.chunkId}</code>
                {h.matchedTerms.length > 0 ? <span>命中词：{h.matchedTerms.join("、")}</span> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
