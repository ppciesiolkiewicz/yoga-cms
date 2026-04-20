import type { AnalysisContextScope, AnalysisContextTiers } from "./types"

export function encodeScope(s: AnalysisContextScope): string {
  if (s.kind === "request") return `req:${s.requestId}`
  if (s.kind === "site") return `site:${s.requestId}:${s.siteId}`
  return `cat:${s.requestId}:${s.siteId}:${s.categoryId}`
}

export function decodeScope(raw: string): AnalysisContextScope {
  const [kind, ...rest] = raw.split(":")
  if (kind === "req" && rest.length === 1) return { kind: "request", requestId: rest[0] }
  if (kind === "site" && rest.length === 2)
    return { kind: "site", requestId: rest[0], siteId: rest[1] }
  if (kind === "cat" && rest.length === 3)
    return { kind: "category", requestId: rest[0], siteId: rest[1], categoryId: rest[2] }
  throw new Error(`invalid scope: ${raw}`)
}

const TIER_CODES: Array<[keyof AnalysisContextTiers, string]> = [
  ["report", "r"],
  ["extractedContent", "c"],
  ["tech", "t"],
  ["lighthouse", "l"],
  ["rawPages", "pg"],
  ["input", "i"],
  ["progress", "pr"],
]

export function encodeTiers(t: AnalysisContextTiers): string {
  return TIER_CODES.filter(([k]) => t[k]).map(([, code]) => code).join(",")
}

export function decodeTiers(raw: string): AnalysisContextTiers {
  if (!raw) return {}
  const codes = new Set(raw.split(","))
  const out: AnalysisContextTiers = {}
  for (const [k, code] of TIER_CODES) if (codes.has(code)) out[k] = true
  return out
}

export function scopeKey(s: AnalysisContextScope): string {
  if (s.kind === "request") return "all"
  if (s.kind === "site") return `site-${s.siteId}`
  return `site-${s.siteId}-cat-${s.categoryId}`
}
