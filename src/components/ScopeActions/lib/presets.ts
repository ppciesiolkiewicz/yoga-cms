import type { Request } from "../../../../scripts/core/types"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"

export type Preset = {
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
}

function pairs(request: Request, filter?: { siteId?: string; categoryId?: string }): AnalysisContextScope["contextElements"] {
  const out: AnalysisContextScope["contextElements"] = []
  for (const s of request.sites) {
    if (filter?.siteId && s.id !== filter.siteId) continue
    for (const c of request.categories) {
      if (filter?.categoryId && c.id !== filter.categoryId) continue
      out.push({ siteId: s.id, categoryId: c.id })
    }
  }
  return out
}

export function requestPreset(request: Request, tiers: AnalysisContextTiers = { report: true }): Preset {
  return {
    scope: { requestId: request.id, contextElements: pairs(request) },
    tiers,
  }
}

export function sitePreset(request: Request, siteId: string, tiers: AnalysisContextTiers = { report: true }): Preset {
  return {
    scope: { requestId: request.id, contextElements: pairs(request, { siteId }) },
    tiers,
  }
}

export function categoryPreset(request: Request, categoryId: string, tiers: AnalysisContextTiers = { extractedContent: true }): Preset {
  return {
    scope: { requestId: request.id, contextElements: pairs(request, { categoryId }) },
    tiers,
  }
}
