import { lazy, Suspense, useMemo } from "react";
import "./stream-markdown.css";

const StreamdownBody = lazy(() => import("./StreamdownBody"));

/** Vercel Streamdown：流式 Markdown、Shiki 代码、公式、Mermaid、中文排版。 */
export function StreamMarkdown({ text, streaming = false }: { text: string; streaming?: boolean }) {
  const fallback = useMemo(
    () => (
      <div className="sd-md">
        <pre>{text}</pre>
      </div>
    ),
    [text],
  );
  return (
    <Suspense fallback={fallback}>
      <StreamdownBody text={text} streaming={streaming} />
    </Suspense>
  );
}
