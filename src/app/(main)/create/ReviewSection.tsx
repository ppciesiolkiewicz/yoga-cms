import type { AnalyzeInput } from "../../../../scripts/core/types"
import { Card } from "@/components/ui/Card"

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) {
    return <span className="text-foreground-faint">null</span>
  }

  if (typeof value === "boolean") {
    return <span className="text-warning">{String(value)}</span>
  }

  if (typeof value === "number") {
    return <span className="text-warning">{value}</span>
  }

  if (typeof value === "string") {
    return <span className="text-success">&quot;{value}&quot;</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-foreground-faint">[]</span>
    }
    return (
      <span>
        <span className="text-foreground-faint">[</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: 20 }}>
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 && <span className="text-foreground-faint">,</span>}
          </div>
        ))}
        <span className="text-foreground-faint">]</span>
      </span>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return <span className="text-foreground-faint">{"{}"}</span>
    }
    return (
      <span>
        <span className="text-foreground-faint">{"{"}</span>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: 20 }}>
            <span className="text-accent-fg">&quot;{key}&quot;</span>
            <span className="text-foreground-faint">: </span>
            <JsonValue value={val} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-foreground-faint">,</span>}
          </div>
        ))}
        <span className="text-foreground-faint">{"}"}</span>
      </span>
    )
  }

  return <span>{String(value)}</span>
}

export function ReviewSection({ input }: { input: AnalyzeInput }) {
  return (
    <section data-tour="create-review">
      <h2 className="mb-3 text-base font-semibold">Review</h2>
      <Card className="overflow-x-auto p-5 font-mono text-xs leading-relaxed">
        <JsonValue value={input} />
      </Card>
    </section>
  )
}
