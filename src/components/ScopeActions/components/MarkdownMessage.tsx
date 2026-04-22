"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

type Props = { content: string }

export function MarkdownMessage({ content }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-pre:my-2 prose-table:my-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: (props) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => (
            <th className="border-b border-border px-2 py-1 text-left font-semibold" {...props} />
          ),
          td: (props) => (
            <td className="border-b border-border/50 px-2 py-1 align-top" {...props} />
          ),
          code: ({ className, children, ...props }) => {
            const inline = !className
            if (inline) {
              return (
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          pre: (props) => (
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs" {...props} />
          ),
          a: (props) => (
            <a className="text-primary underline underline-offset-2" target="_blank" rel="noreferrer" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
