import { Streamdown } from "streamdown";
import { code } from "@streamdown/code";
import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import "katex/dist/katex.min.css";
import "streamdown/styles.css";
import "./stream-markdown.css";

const plugins = { code, cjk, math, mermaid };

/** Vercel Streamdown：流式 Markdown、Shiki 代码、公式、Mermaid、中文排版。 */
export function StreamMarkdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  return (
    <Streamdown
      className="sd-md"
      plugins={plugins}
      mode={streaming ? "streaming" : "static"}
      isAnimating={streaming}
      animated={streaming ? { sep: "char", stagger: 12 } : false}
      parseIncompleteMarkdown={streaming}
    >
      {text}
    </Streamdown>
  );
}
