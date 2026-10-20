import { parseMarkdownTables, stripMarkdownTables } from "../../../lib/chatArtifacts";
import { StreamMarkdown } from "../../ownagent/StreamMarkdown";
import { ArtifactPanel } from "./ArtifactPanel";

function citeBits(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("来源：") && !trimmed.startsWith("来源:")) return null;
  return trimmed.replace(/^来源[:：]\s*/, "").split(/\s*[·|]\s*/).filter(Boolean);
}

/** 来源和表格工件仍按办事页处理，正文用 Streamdown。 */
export function AgentMarkdown({
  text,
  promoteTables = true,
  streaming = false,
}: {
  text: string;
  promoteTables?: boolean;
  streaming?: boolean;
}) {
  const tables = promoteTables ? parseMarkdownTables(text) : [];
  const body = promoteTables && tables.length ? stripMarkdownTables(text) : text;
  const cites: string[][] = [];
  const rest: string[] = [];
  for (const line of body.split("\n")) {
    const bits = citeBits(line);
    if (bits) cites.push(bits);
    else rest.push(line);
  }
  const markdown = rest.join("\n").trim();

  return (
    <div className="agent-markdown">
      {cites.map((bits, index) => (
        <div key={index} className="own-cites">
          <span className="own-cites-label">来源</span>
          {bits.map((bit) => (
            <span key={bit} className="own-cite-tag">
              {bit}
            </span>
          ))}
        </div>
      ))}
      {markdown ? <StreamMarkdown text={markdown} streaming={streaming} /> : null}
      {tables.length > 0 ? <ArtifactPanel artifacts={tables} /> : null}
    </div>
  );
}
