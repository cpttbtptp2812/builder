import { useMemo, useState } from "react";
import { retrieveRag } from "../../../lib/ragEngine";
import { StepShell } from "./StepShell";

const SAMPLES = ["AI Agent MCP RAG", "iMean 定位", "剑池 虚拟滚动"];

function termsOf(q: string) {
  return q.toLowerCase().match(/[\u4e00-\u9fff]{1,8}|[a-z0-9]{2,}/g) ?? [];
}

export function StepKb() {
  const [q, setQ] = useState(SAMPLES[0]!);
  const rag = useMemo(() => retrieveRag(q, 3), [q]);
  const terms = termsOf(q);

  return (
    <StepShell id="kb">
      <div className="agent-step-samples">
        {SAMPLES.map((s) => (
          <button key={s} type="button" className={q === s ? "on" : ""} onClick={() => setQ(s)}>
            {s}
          </button>
        ))}
      </div>
      <input className="agent-step-input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="知识检索输入" />
      <p className="agent-step-sample">
        问句切成 {terms.length} 词 · 语料 {rag.chunkCount} 段 · {rag.latencyMs}ms · pipeline {rag.pipeline.join(" → ")}
      </p>
      <ul className="agent-step-tokens">
        {terms.map((t) => (
          <li key={t} data-kind="cjk">
            {t}
          </li>
        ))}
      </ul>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>rank</th>
            <th>chunkId</th>
            <th>score</th>
            <th>命中词</th>
            <th>原文</th>
          </tr>
        </thead>
        <tbody>
          {rag.hits.map((h) => (
            <tr key={h.chunkId}>
              <td>{h.rank}</td>
              <td>
                <code>{h.chunkId}</code>
              </td>
              <td>{h.score.toFixed(3)}</td>
              <td>{h.matchedTerms.join(", ") || "—"}</td>
              <td>{h.text.slice(0, 72)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StepShell>
  );
}
