import type { AnalysisContextScope } from "../../../../scripts/analysis-context/types"

export function scopeDescription(s: AnalysisContextScope): string {
  if (s.kind === "request") return "the entire analysis (all sites and all categories)"
  if (s.kind === "site") return "this site (all of its categories)"
  return "this category on this site"
}

export function scopeShortLabel(s: AnalysisContextScope): string {
  if (s.kind === "request") return "analysis"
  if (s.kind === "site") return "site"
  return "category"
}
