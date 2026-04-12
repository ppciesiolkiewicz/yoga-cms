import { createHash } from "crypto"
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"
import { scrapeUrl } from "./firecrawl-client"

const SCRAPE_CONCURRENCY = 2

interface PageRecord {
  id: string
  url: string
  status: "ok" | "failed"
  error?: string
}

function pageId(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 10)
}

export async function fetchPages(repo: Repo, request: Request, site: Site): Promise<void> {
  const classifyBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json",
  })
  const classify = JSON.parse(classifyBuf.toString("utf8")) as {
    byCategory: Record<string, string[]>
  }

  const urls = new Set<string>()
  for (const list of Object.values(classify.byCategory)) {
    for (const u of list) urls.add(u)
  }

  const ordered = [...urls]
  const records: PageRecord[] = []
  let index = 0

  async function worker(): Promise<void> {
    while (index < ordered.length) {
      const url = ordered[index++]
      const id = pageId(url)
      const res = await scrapeUrl(url)
      if ("error" in res) {
        records.push({ id, url, status: "failed", error: res.error })
        continue
      }
      await repo.putArtifact(
        { requestId: request.id, siteId: site.id, stage: "fetch-pages", name: `${id}.md` },
        res.markdown ?? "",
      )
      records.push({ id, url, status: "ok" })
    }
  }

  await Promise.all(Array.from({ length: SCRAPE_CONCURRENCY }, worker))

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "fetch-pages", name: "index.json" },
    { pages: records },
  )
}
