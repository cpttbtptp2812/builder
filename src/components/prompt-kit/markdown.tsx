import { cn } from "@/lib/utils"
import { marked } from "marked"
import { memo, useId, useMemo } from "react"
import ReactMarkdown, { Components } from "react-markdown"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import { CodeBlock, CodeBlockCode } from "./code-block"

export type MarkdownProps = {
  children: string
  id?: string
  className?: string
  components?: Partial<Components>
}

function parseMarkdownIntoBlocks(markdown: string): string[] {
  const tokens = marked.lexer(markdown)
  return tokens.map((token) => token.raw)
}

function extractLanguage(className?: string): string {
  if (!className) return "plaintext"
  const match = className.match(/language-(\w+)/)
  return match ? match[1] : "plaintext"
}

const INITIAL_COMPONENTS: Partial<Components> = {
  h1: ({ children }) => <h1 className="text-sm font-black text-slate-900 mt-3 mb-1.5">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xs font-bold text-slate-900 mt-2.5 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-bold text-slate-800 mt-2 mb-1 flex items-center gap-1.5">{children}</h3>,
  p: ({ children }) => <p className="text-xs leading-relaxed text-slate-700 my-1">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-4 my-1.5 space-y-0.5 text-xs text-slate-700">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-4 my-1.5 space-y-0.5 text-xs text-slate-700">{children}</ol>,
  li: ({ children }) => <li className="text-xs leading-relaxed text-slate-700">{children}</li>,
  table: ({ children }) => <div className="my-2 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full text-xs text-left border-collapse">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-slate-100 text-slate-700 font-bold">{children}</thead>,
  th: ({ children }) => <th className="p-2 border-b border-slate-200 font-bold text-slate-700">{children}</th>,
  td: ({ children }) => <td className="p-2 border-b border-slate-100 text-slate-600">{children}</td>,
  hr: () => <hr className="my-2.5 border-slate-200/80" />,
  blockquote: ({ children }) => <blockquote className="border-l-3 border-blue-400 pl-3 my-1.5 text-xs text-slate-600 bg-blue-50/40 py-1 rounded-r-lg">{children}</blockquote>,
  code: function CodeComponent({ className, children, ...props }) {
    const isInline =
      !props.node?.position?.start.line ||
      props.node?.position?.start.line === props.node?.position?.end.line

    if (isInline) {
      return (
        <span
          className={cn(
            "bg-slate-100 text-blue-700 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold border border-slate-200/80",
            className
          )}
          {...props}
        >
          {children}
        </span>
      )
    }

    const language = extractLanguage(className)

    return (
      <CodeBlock className={className}>
        <CodeBlockCode code={children as string} language={language} />
      </CodeBlock>
    )
  },
  pre: function PreComponent({ children }) {
    return <>{children}</>
  },
}

const MemoizedMarkdownBlock = memo(
  function MarkdownBlock({
    content,
    components = INITIAL_COMPONENTS,
  }: {
    content: string
    components?: Partial<Components>
  }) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    )
  },
  function propsAreEqual(prevProps, nextProps) {
    return prevProps.content === nextProps.content
  }
)

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock"

function MarkdownComponent({
  children,
  id,
  className,
  components = INITIAL_COMPONENTS,
}: MarkdownProps) {
  const generatedId = useId()
  const blockId = id ?? generatedId
  const blocks = useMemo(() => parseMarkdownIntoBlocks(children), [children])

  return (
    <div className={className}>
      {blocks.map((block, index) => (
        <MemoizedMarkdownBlock
          key={`${blockId}-block-${index}`}
          content={block}
          components={components}
        />
      ))}
    </div>
  )
}

const Markdown = memo(MarkdownComponent)
Markdown.displayName = "Markdown"

export { Markdown }
