import * as cheerio from "cheerio"
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"
import { scrape } from "./scraper"
import { fetchResponseHeaders } from "./firecrawl-client"

function htmlToMarkdownLike(html: string): string {
  const $ = cheerio.load(html)
  $("script, style, iframe, noscript").remove()
  return $("body").text().replace(/\s+/g, " ").trim()
}

export async function fetchHome(repo: Repo, request: Request, site: Site): Promise<void> {
  const [scraped, headers] = await Promise.all([
    scrape(site.url, { includeRawHtml: true, onlyMainContent: false }),
    fetchResponseHeaders(site.url),
  ])
  if ("error" in scraped) {
    throw new Error(`Homepage scrape failed for ${site.url}: ${scraped.error}`)
  }

  const html = scraped.rawHtml ?? scraped.html ?? ""
  const markdown = scraped.markdown ?? htmlToMarkdownLike(html)

  const ctx = { requestId: request.id, siteId: site.id, stage: "fetch-home" }
  await repo.putArtifact({ ...ctx, name: "home.html" }, html)
  await repo.putArtifact({ ...ctx, name: "home.md" }, markdown)
  await repo.putJson({ ...ctx, name: "home.headers.json" }, headers ?? {})
  await repo.putJson({ ...ctx, name: "home.meta.json" }, {
    url: site.url,
    links: scraped.links ?? [],
  })
}
