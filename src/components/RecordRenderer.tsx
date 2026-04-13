"use client"

import { ScoreBadge } from "@/components/ui"

interface RecordRendererProps {
  record: Record<string, unknown>
}

const HEADER_FIELDS = new Set(["url", "pageName", "categoryId", "categoryName"])

function isUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

function isScoreField(key: string): boolean {
  return key.endsWith("Score") && key !== "score"
}

function labelFromKey(key: string): string {
  // "conversionScore" -> "Conversion", "pricingVisible" -> "Pricing Visible"
  const withoutScore = key.replace(/Score$/, "")
  return withoutScore
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

function ScoreRow({ record }: { record: Record<string, unknown> }) {
  const scores = Object.entries(record).filter(
    ([key, val]) => isScoreField(key) && typeof val === "number"
  )
  if (scores.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scores.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{labelFromKey(key)}</span>
          <ScoreBadge score={val as number} />
        </div>
      ))}
    </div>
  )
}

function BooleanField({ label, value }: { label: string; value: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={value ? "text-green-600" : "text-red-400"}>{value ? "\u2714" : "\u2716"}</span>
      <span className="text-gray-600">{label}</span>
    </span>
  )
}

function StringArrayBadges({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 8).map((item, i) => (
        <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
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

  // Number (non-score)
  if (typeof value === "number") {
    return (
      <div className="text-sm">
        <span className="font-medium text-gray-500">{label}:</span>{" "}
        <span className="text-gray-900">{value}</span>
      </div>
    )
  }

  // String
  if (typeof value === "string") {
    if (isUrl(value)) {
      return (
        <div className="text-sm">
          <span className="font-medium text-gray-500">{label}:</span>{" "}
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
            {value}
          </a>
        </div>
      )
    }
    return (
      <div className="text-sm">
        <span className="font-medium text-gray-500">{label}:</span>{" "}
        <span className="text-gray-900">{value}</span>
      </div>
    )
  }

  // Array of strings
  if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === "string")) {
    return (
      <div>
        <div className="mb-1 text-sm font-medium text-gray-500">{label}</div>
        <StringArrayBadges items={value as string[]} />
      </div>
    )
  }

  // Array of objects
  if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === "object" && v !== null)) {
    return (
      <div>
        <div className="mb-1 text-sm font-medium text-gray-500">{label}</div>
        <div className="space-y-1 pl-3 border-l-2 border-gray-100">
          {(value as Record<string, unknown>[]).map((item, i) => (
            <div key={i} className="text-xs text-gray-700">
              {Object.entries(item)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Nested object
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return (
      <div>
        <div className="mb-1 text-sm font-medium text-gray-500">{label}</div>
        <div className="space-y-0.5 pl-3 border-l-2 border-gray-100">
          {Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-gray-500">{labelFromKey(k)}:</span>{" "}
                <span className="text-gray-700">{String(v)}</span>
              </div>
            ))}
        </div>
      </div>
    )
  }

  return null
}

export function RecordRenderer({ record }: RecordRendererProps) {
  const summary = typeof record.summary === "string" ? record.summary : null

  // Collect remaining fields in order, excluding header fields, summary, and scores
  const remainingFields = Object.entries(record).filter(
    ([key]) => !HEADER_FIELDS.has(key) && key !== "summary" && !isScoreField(key)
  )

  // Separate booleans from other fields for compact rendering
  const booleanFields = remainingFields.filter(([, val]) => typeof val === "boolean")
  const otherFields = remainingFields.filter(([, val]) => typeof val !== "boolean")

  return (
    <div className="space-y-2">
      {summary && (
        <p className="text-sm text-gray-700">{summary}</p>
      )}

      <ScoreRow record={record} />

      {booleanFields.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {booleanFields.map(([key, val]) => (
            <BooleanField key={key} label={labelFromKey(key)} value={val as boolean} />
          ))}
        </div>
      )}

      {otherFields.map(([key, val]) => (
        <FieldValue key={key} fieldKey={key} value={val} />
      ))}
    </div>
  )
}
