import type { Repo } from "../db/repo"
import type { Request, Site, SiteEstimate, PageEstimate } from "../core/types"
import { MockContentEstimator, type ContentEstimatorService } from "../quote/content-estimator"

const estimator: ContentEstimatorService = new MockContentEstimator()

export async function estimateContent(repo: Repo, request: Request, site: Site): Promise<void> {
  const classify = await repo.getJson<{ byCategory: Record<string, string[]> }>({
    requestId: request.id, siteId: site.id, stage: "classify-nav", name: "classify-nav.json",
  })

  const urls = new Set<string>()
  for (const list of Object.values(classify.byCategory)) {
    for (const u of list) urls.add(u)
  }

  const ordered = [...urls]
  const estimates = ordered.length > 0 ? await estimator.estimatePages(ordered) : []

  const pages: PageEstimate[] = estimates.map(e => ({
    url: e.url,
    charCount: e.charCount,
    estimatedTokens: Math.ceil(e.charCount / 4),
  }))

  const result: SiteEstimate = {
    siteId: site.id,
    pages,
    totalChars: pages.reduce((s, p) => s + p.charCount, 0),
    totalEstimatedTokens: pages.reduce((s, p) => s + p.estimatedTokens, 0),
  }

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "estimate-content", name: "estimates.json" },
    result,
  )
}
