import type { Repo } from "../db/repo"
import type { Request, Site, Category } from "../core/types"

export async function loadCategoryPages(
  repo: Repo,
  request: Request,
  site: Site,
  category: Category,
): Promise<Array<{ url: string; markdown: string }>> {
  const classify = await repo.getJson<{ byCategory: Record<string, string[]> }>({
    requestId: request.id, siteId: site.id, stage: "classify-nav", name: "classify-nav.json",
  })
  const index = await repo.getJson<{ pages: Array<{ id: string; url: string; status: string }> }>({
    requestId: request.id, siteId: site.id, stage: "fetch-pages", name: "index.json",
  })
  const wantedUrls = new Set(classify.byCategory[category.id] ?? [])
  const out: Array<{ url: string; markdown: string }> = []
  for (const rec of index.pages) {
    if (rec.status !== "ok") continue
    if (!wantedUrls.has(rec.url)) continue
    const buf = await repo.getArtifact({
      requestId: request.id, siteId: site.id, stage: "fetch-pages", name: `${rec.id}.md`,
    })
    out.push({ url: rec.url, markdown: buf.toString("utf8") })
  }
  return out
}
