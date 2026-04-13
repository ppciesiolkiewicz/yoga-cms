import type { Repo } from "../db/repo"
import type { Request, Site, CategoryProgress } from "../core/types"

export async function buildReportStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const ctx = { requestId: request.id, siteId: site.id }

  const safe = async <T>(stage: string, name: string): Promise<T | null> => {
    const ref = { ...ctx, stage, name }
    if (!(await repo.artifactExists(ref))) return null
    return await repo.getJson<T>(ref)
  }

  const classify = await safe<unknown>("classify-nav", "classify-nav.json")
  const nav = await safe<unknown>("parse-links", "nav-links.json")
  const progress = await safe<Record<string, CategoryProgress>>("", "progress.json")

  // Collect per-category artifacts
  const techByCategory: Record<string, unknown> = {}
  const lighthouseByCategory: Record<string, unknown> = {}
  const extractByCategory: Record<string, unknown> = {}

  for (const cat of request.categories) {
    const tech = await safe<unknown>("detect-tech", `${cat.id}.json`)
    if (tech) techByCategory[cat.id] = tech

    const lh = await safe<unknown>("run-lighthouse", `${cat.id}.json`)
    if (lh) lighthouseByCategory[cat.id] = lh

    const extract = await safe<unknown>("extract-pages-content", `${cat.id}.json`)
    if (extract) extractByCategory[cat.id] = extract
  }

  const siteReport = {
    siteId: site.id,
    url: site.url,
    meta: site.meta ?? {},
    scrapedAt: new Date().toISOString(),
    navigation: nav,
    classification: classify,
    tech: techByCategory,
    lighthouse: lighthouseByCategory,
    extract: extractByCategory,
    progress,
  }

  await repo.putJson({ ...ctx, stage: "build-report", name: "build-report.json" }, siteReport)
}
