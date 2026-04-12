import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"

export async function reportStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const ctx = { requestId: request.id, siteId: site.id }

  const safe = async <T>(stage: string, name: string): Promise<T | null> => {
    const ref = { ...ctx, stage, name }
    if (!(await repo.artifactExists(ref))) return null
    return await repo.getJson<T>(ref)
  }

  const tech = await safe<unknown>("tech", "tech.json")
  const lighthouse = await safe<unknown>("lighthouse", "lighthouse.json")
  const content = await safe<unknown>("content", "content.json")
  const extract = await safe<unknown>("extract", "extract.json")
  const classify = await safe<unknown>("classify", "classify.json")
  const nav = await safe<unknown>("extract-nav", "nav-links.json")

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

  await repo.putJson({ ...ctx, stage: "report", name: "report.json" }, siteReport)
}
