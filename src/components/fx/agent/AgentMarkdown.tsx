import type { ReactNode } from "react";
import { parseMarkdownTables, stripMarkdownTables } from "../../../lib/chatArtifacts";
import { ArtifactPanel } from "./ArtifactPanel";

/** Markdown + 自动表格升级为工件，支持标题/引用/列表/代码块/高亮 */
export function AgentMarkdown({ text, promoteTables = true }: { text: string; promoteTables?: boolean }) {
  const tables = promoteTables ? parseMarkdownTables(text) : [];
  const body = promoteTables && tables.length ? stripMarkdownTables(text) : text;
  const rawBlocks = body.split(/\n{2,}/);

  return (
    <div className="agent-markdown">
      {rawBlocks.map((block, bi) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        // 来源引证行
        if (trimmed.startsWith("来源：") || trimmed.startsWith("来源:")) {
          const bits = trimmed.replace(/^来源[:：]\s*/, "").split(/\s*[·|]\s*/).filter(Boolean);
          return (
            <div key={bi} className="own-cites">
              <span className="own-cites-label">来源</span>
              {bits.map((b, i) => (
                <span key={`${bi}-${i}-${b}`} className="own-cite-tag">{b}</span>
              ))}
            </div>
          );
        }

        // 代码块 ```lang ... ```
        if (trimmed.startsWith("```")) {
          const codeLines = trimmed.split("\n");
          const firstLine = codeLines[0] || "";
          const lang = firstLine.replace(/^```/, "").trim();
          const codeContent = codeLines.slice(1, codeLines[codeLines.length - 1]?.startsWith("```") ? -1 : undefined).join("\n");
          return (
            <div key={bi} className="agent-md-code-wrap">
              {lang && <div className="agent-md-code-header"><span>{lang}</span></div>}
              <pre className="agent-md-pre">
                <code>{codeContent}</code>
              </pre>
            </div>
          );
        }

        const lines = trimmed.split("\n");

        // 单行标题
        if (lines.length === 1) {
          if (trimmed.startsWith("### ")) {
            return <h3 key={bi} className="agent-md-h3">{inlineFormat(trimmed.slice(4))}</h3>;
          }
          if (trimmed.startsWith("## ")) {
            return <h2 key={bi} className="agent-md-h2">{inlineFormat(trimmed.slice(3))}</h2>;
          }
          if (trimmed.startsWith("# ")) {
            return <h2 key={bi} className="agent-md-h1">{inlineFormat(trimmed.slice(2))}</h2>;
          }
          if (trimmed.startsWith("#### ")) {
            return <h4 key={bi} className="agent-md-h4">{inlineFormat(trimmed.slice(5))}</h4>;
          }
        }

        // 引用块 >
        const quoteLines = lines.filter((l) => l.trim().startsWith(">"));
        if (quoteLines.length === lines.length && quoteLines.length > 0) {
          return (
            <blockquote key={bi} className="agent-md-quote">
              {quoteLines.map((l, i) => (
                <p key={i}>{inlineFormat(l.trim().replace(/^>\s*/, ""))}</p>
              ))}
            </blockquote>
          );
        }

        // 无序列表 - 或 *
        const unorderItems = lines.filter((l) => /^[*-]\s+/.test(l.trim()));
        if (unorderItems.length === lines.length && unorderItems.length > 0) {
          return (
            <ul key={bi} className="agent-md-ul">
              {unorderItems.map((l, i) => (
                <li key={i}>{inlineFormat(l.trim().replace(/^[*-]\s+/, ""))}</li>
              ))}
            </ul>
          );
        }

        // 有序列表 1. 2.
        const orderItems = lines.filter((l) => /^\d+\.\s+/.test(l.trim()));
        if (orderItems.length === lines.length && orderItems.length > 0) {
          return (
            <ol key={bi} className="agent-md-ol">
              {orderItems.map((l, i) => (
                <li key={i}>{inlineFormat(l.trim().replace(/^\d+\.\s+/, ""))}</li>
              ))}
            </ol>
          );
        }

        return (
          <p key={bi} className="agent-md-p">
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
  // 正则拆分加粗、行内代码、链接
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return <strong key={i} className="agent-md-strong">{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return <code key={i} className="agent-md-inline-code">{p.slice(1, -1)}</code>;
    }
    const linkMatch = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return (
        <a key={i} href={linkMatch[2]} target="_blank" rel="noreferrer" className="agent-md-link">
          {linkMatch[1]}
        </a>
      );
    }
    return p;
  });
}
