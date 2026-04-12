import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"

export async function buildReportStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const ctx = { requestId: request.id, siteId: site.id }

  const safe = async <T>(stage: string, name: string): Promise<T | null> => {
    const ref = { ...ctx, stage, name }
    if (!(await repo.artifactExists(ref))) return null
    return await repo.getJson<T>(ref)
  }

  const tech = await safe<unknown>("detect-tech", "detect-tech.json")
  const lighthouse = await safe<unknown>("run-lighthouse", "run-lighthouse.json")
  const content = await safe<unknown>("assess-pages", "assess-pages.json")
  const extract = await safe<unknown>("extract-pages-content", "extract-pages-content.json")
  const classify = await safe<unknown>("classify-nav", "classify-nav.json")
  const nav = await safe<unknown>("parse-links", "nav-links.json")

  const siteReport = {
    siteId: site.id,
    url: site.url,
    meta: site.meta ?? {},
    scrapedAt: new Date().toISOString(),
    navigation: nav,
    classification: classify,
    tech,
    lighthouse,
    content,
    extract,
  }

  await repo.putJson({ ...ctx, stage: "build-report", name: "build-report.json" }, siteReport)
}
