import { retrieveRag } from "../../../lib/ragEngine";
import { StepShell } from "./StepShell";

export function StepKb() {
  const rag = retrieveRag("AI Agent MCP RAG", 3);
  return (
    <StepShell id="kb">
      <p className="agent-step-sample">
        corpus = {rag.corpusSize} · chunks = {rag.chunkCount} · {rag.latencyMs}ms
      </p>
      <table className="agent-step-table">
        <thead>
          <tr>
            <th>chunkId</th>
            <th>score</th>
            <th>terms</th>
            <th>text</th>
          </tr>
        </thead>
        <tbody>
          {rag.hits.map((h) => (
            <tr key={h.chunkId}>
              <td>
                <code>{h.chunkId}</code>
              </td>
              <td>{h.score.toFixed(3)}</td>
              <td>{h.matchedTerms.join(", ")}</td>
              <td>{h.text.slice(0, 72)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StepShell>
  );
}
