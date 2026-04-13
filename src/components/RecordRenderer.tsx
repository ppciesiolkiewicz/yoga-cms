"use client"

import { ScoreBadge } from "@/components/ui"

interface RecordRendererProps {
  record: Record<string, unknown>
}

/** Fields rendered separately in the card header — skip in the body */
const HEADER_FIELDS = new Set(["url", "pageName", "categoryId", "categoryName"])

function isScoreField(key: string): boolean {
  return key.endsWith("Score")
}

function isProseField(key: string): boolean {
  return key === "summary" || key === "notes" || key === "description"
}

function isBooleanField(key: string, value: unknown): boolean {
  return typeof value === "boolean"
}

function isUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

function labelFromKey(key: string): string {
  const withoutScore = key.replace(/Score$/, "")
  return withoutScore
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

/* ── Sub-renderers ─────────────────────────────────────── */

function ScoreRow({ record }: { record: Record<string, unknown> }) {
  const scores = Object.entries(record).filter(
    ([key, val]) => isScoreField(key) && typeof val === "number"
  )
  if (scores.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scores.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-xs text-foreground-muted">{labelFromKey(key)}</span>
          <ScoreBadge score={val as number} />
        </div>
      ))}
    </div>
  )
}

function BooleanField({ label, value }: { label: string; value: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={value ? "text-success" : "text-error"}>{value ? "\u2714" : "\u2716"}</span>
      <span className="text-foreground-secondary">{label}</span>
    </span>
  )
}

function ProseField({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-0.5 text-xs font-medium text-foreground-muted">{label}</div>
      <p className="text-sm text-foreground-secondary">{text}</p>
    </div>
  )
}

function StringArrayBadges({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 8).map((item, i) => (
        <span key={i} className="rounded-full bg-accent-subtle px-2 py-0.5 text-xs text-accent-fg">
          {item}
        </span>
      ))}
    </div>
  )
}

function FieldValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (value === null || value === undefined) return null

  const label = labelFromKey(fieldKey)

  // Boolean
  if (typeof value === "boolean") {
    return <BooleanField label={label} value={value} />
  }

  // Number (non-score — scores rendered separately)
  if (typeof value === "number") {
    return (
      <div className="text-sm">
        <span className="font-medium text-foreground-muted">{label}:</span>{" "}
        <span className="text-foreground">{value}</span>
      </div>
    )
  }

  // String
  if (typeof value === "string") {
    if (isUrl(value)) {
      return (
        <div className="text-sm">
          <span className="font-medium text-foreground-muted">{label}:</span>{" "}
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline truncate">
            {value}
          </a>
        </div>
      )
    }
    return (
      <div className="text-sm">
        <span className="font-medium text-foreground-muted">{label}:</span>{" "}
        <span className="text-foreground">{value}</span>
      </div>
    )
  }

  // Array of strings → badges
  if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === "string")) {
    return (
      <div>
        <div className="mb-1 text-xs font-medium text-foreground-muted">{label}</div>
        <StringArrayBadges items={value as string[]} />
      </div>
    )
  }

  // Array of objects → compact rows
  if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === "object" && v !== null)) {
    return (
      <div>
        <div className="mb-1 text-xs font-medium text-foreground-muted">{label}</div>
        <div className="space-y-1 pl-3 border-l-2 border-border-subtle">
          {(value as Record<string, unknown>[]).map((item, i) => (
            <div key={i} className="text-xs text-foreground-secondary">
              {Object.entries(item)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${labelFromKey(k)}: ${v}`)
                .join(" · ")}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Nested object → indented key/value
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return (
      <div>
        <div className="mb-1 text-xs font-medium text-foreground-muted">{label}</div>
        <div className="space-y-0.5 pl-3 border-l-2 border-border-subtle">
          {Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-foreground-muted">{labelFromKey(k)}:</span>{" "}
                <span className="text-foreground-secondary">{String(v)}</span>
              </div>
            ))}
        </div>
      </div>
    )
  }

  return null
}

/* ── Main component ────────────────────────────────────── */

export function RecordRenderer({ record }: RecordRendererProps) {
  // Partition fields by type for structured layout
  const remaining = Object.entries(record).filter(
    ([key]) => !HEADER_FIELDS.has(key) && !isScoreField(key) && !isProseField(key)
  )

  const proseFields = Object.entries(record).filter(
    ([key, val]) => isProseField(key) && typeof val === "string" && val
  )
  const booleanFields = remaining.filter(([, val]) => isBooleanField("", val))
  const otherFields = remaining.filter(([, val]) => !isBooleanField("", val))

  return (
    <div className="space-y-2">
      {/* Summary / notes / description — prose first */}
      {proseFields.map(([key, val]) => (
        <ProseField key={key} label={labelFromKey(key)} text={val as string} />
      ))}

      {/* Score badges row */}
      <ScoreRow record={record} />

      {/* Boolean flags — compact row */}
      {booleanFields.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {booleanFields.map(([key, val]) => (
            <BooleanField key={key} label={labelFromKey(key)} value={val as boolean} />
          ))}
        </div>
      )}

      {/* Everything else */}
      {otherFields.map(([key, val]) => (
        <FieldValue key={key} fieldKey={key} value={val} />
      ))}
    </div>
  )
}
