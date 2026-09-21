import type { ReactNode } from "react";
import { parseMarkdownTables, stripMarkdownTables } from "../../../lib/chatArtifacts";
import { ArtifactPanel } from "./ArtifactPanel";

/** Markdown + 自动表格升级为工件 */
export function AgentMarkdown({ text, promoteTables = true }: { text: string; promoteTables?: boolean }) {
  const tables = promoteTables ? parseMarkdownTables(text) : [];
  const body = promoteTables && tables.length ? stripMarkdownTables(text) : text;
  const blocks = body.split(/\n{2,}/);

  return (
    <div className="agent-markdown">
      {blocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("来源：") || trimmed.startsWith("来源:")) {
          const bits = trimmed.replace(/^来源[:：]\s*/, "").split(/\s*[·|]\s*/).filter(Boolean);
          return (
            <div key={bi} className="own-cites">
              {bits.map((b, i) => (
                <span key={`${bi}-${i}-${b}`}>{b}</span>
              ))}
            </div>
          );
        }
        const lines = trimmed.split("\n");
        const items = lines.filter((l) => l.trim().startsWith("- "));
        if (items.length === lines.length && items.length > 0) {
          return (
            <ul key={bi}>
              {items.map((l, i) => (
                <li key={i}>{inlineFormat(l.trim().slice(2))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {inlineFormat(line)}
              </span>
            ))}
          </p>
        );
      })}
      {tables.length > 0 && <ArtifactPanel artifacts={tables} />}
    </div>
  );
}

function inlineFormat(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith("`") && p.endsWith("`")) return <code key={i}>{p.slice(1, -1)}</code>;
    return p;
  });
}
