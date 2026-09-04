import type { ReactNode } from "react";

/** 轻量 Markdown — assistant 回复渲染 */
export function AgentMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const listItems: ReactNode[] = [];
  const paragraphs: ReactNode[] = [];

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (trimmed.startsWith("- ")) {
      listItems.push(
        <li key={i}>{inlineFormat(trimmed.slice(2))}</li>,
      );
    } else {
      paragraphs.push(
        <p key={i}>{inlineFormat(trimmed)}</p>,
      );
    }
  });

  return (
    <div className="agent-markdown">
      {listItems.length > 0 && <ul>{listItems}</ul>}
      {paragraphs}
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
