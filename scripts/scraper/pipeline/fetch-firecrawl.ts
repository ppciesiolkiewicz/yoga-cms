// scripts/scraper/pipeline/fetch-firecrawl.ts
import type { StudioEntry, PageCategory, RawPage } from "../types"
import { scrapeUrl, mapUrl, ensureCredits } from "./firecrawl-client"
import { classifyLinks, fromOverrides, type ClassifiedLinks } from "./classify-links"
import { writeRawStudio } from "./raw-io"
import { runLighthouse } from "./lighthouse"

const CONCURRENCY = 2

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function linksFromScrape(rawLinks: string[], homepageUrl: string): Array<{ label: string; href: string }> {
  const base = new URL(homepageUrl)
  const seen = new Set<string>()
  const out: Array<{ label: string; href: string }> = []
  for (const href of rawLinks) {
    try {
      const u = new URL(href, homepageUrl)
      if (u.hostname !== base.hostname) continue
      if (seen.has(u.href)) continue
      seen.add(u.href)
      const label = u.pathname.replace(/\/$/, "").split("/").pop() ?? u.href
      out.push({ label, href: u.href })
    } catch {
      // ignore invalid urls
    }
  }
  return out
}

async function scrapeAllBounded(
  urls: Array<{ url: string; category: PageCategory; source: RawPage["source"] }>,
): Promise<Array<{ url: string; markdown: string; category: PageCategory; source: RawPage["source"]; status: "ok" | "failed"; error?: string }>> {
  const results: Array<{ url: string; markdown: string; category: PageCategory; source: RawPage["source"]; status: "ok" | "failed"; error?: string }> = []
  let index = 0
  async function worker() {
    while (index < urls.length) {
      const my = urls[index++]
      const res = await scrapeUrl(my.url)
      if ("error" in res) {
        results.push({ url: my.url, category: my.category, source: my.source, markdown: "", status: "failed", error: res.error })
      } else {
        results.push({ url: my.url, category: my.category, source: my.source, markdown: res.markdown, status: "ok" as const })
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return results
}

export interface FetchOpts {
  force: boolean
  skipMapFallback: boolean
}

export async function fetchStudioFirecrawl(entry: StudioEntry, opts: FetchOpts): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n═══ fetch: ${entry.studioName} (${entry.city}) ═══`)

  const credits = await ensureCredits()
  if (!credits.ok) {
    throw new Error(`Firecrawl credits below floor (remaining=${credits.remaining}). Set SCRAPER_FETCHER=legacy or top up.`)
  }

  // Homepage: scrape markdown + rawHtml + links.
  // rawHtml preserves scripts and meta tags so tech-detect (wappalyzer)
  // can identify the CMS/platform. The standard html format is stripped
  // of scripts by Firecrawl regardless of onlyMainContent.
  console.log(`  Scraping homepage: ${entry.website}`)
  const home = await scrapeUrl(entry.website, { includeRawHtml: true, onlyMainContent: false })
  if ("error" in home) {
    throw new Error(`Homepage scrape failed for ${entry.studioName}: ${home.error}`)
  }

  // Classify: override > Claude > keyword fallback (inside classifyLinks)
  let classified: ClassifiedLinks
  let source: RawPage["source"]
  if (entry.overrides) {
    classified = fromOverrides(entry.overrides)
    source = "override"
  } else {
    const linkList = linksFromScrape(home.links, entry.website)
    classified = await classifyLinks(entry.studioName, entry.website, linkList)
    source = "homepage-links"
  }

  // Map fallback for empty categories
  if (!opts.skipMapFallback && !entry.overrides) {
    if (classified.trainings.length === 0) {
      const found = await mapUrl(entry.website, "teacher training")
      classified.trainings = found.slice(0, 2)
    }
    if (classified.retreats.length === 0) {
      const found = await mapUrl(entry.website, "retreat")
      classified.retreats = found.slice(0, 2)
    }
    if (classified.dropIns.length === 0) {
      const found = await mapUrl(entry.website, "class schedule")
      classified.dropIns = found.slice(0, 2)
    }
    if (!classified.contact) {
      const found = await mapUrl(entry.website, "contact")
      classified.contact = found[0] ?? null
    }
  }

  // Assemble URL list with per-URL source + category; dedupe
  const urlList: Array<{ url: string; category: PageCategory; source: RawPage["source"] }> = []
  const seen = new Set<string>([entry.website])
  const push = (url: string, category: PageCategory, s: RawPage["source"]) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    urlList.push({ url, category, source: s })
  }
  for (const u of classified.dropIns) push(u, "dropIn", source === "override" ? "override" : "homepage-links")
  for (const u of classified.trainings) push(u, "training", source === "override" ? "override" : "homepage-links")
  for (const u of classified.retreats) push(u, "retreat", source === "override" ? "override" : "homepage-links")
  if (classified.contact) push(classified.contact, "contact", source === "override" ? "override" : "homepage-links")

  console.log(`  Discovery: dropIns=${classified.dropIns.length} trainings=${classified.trainings.length} retreats=${classified.retreats.length} contact=${classified.contact ? "yes" : "no"}`)

  // Scrape all pages in parallel (bounded)
  const pages = await scrapeAllBounded(urlList)

  // Lighthouse on homepage (cached into raw)
  const lighthouse = await runLighthouse(entry.website)

  // Write raw
  writeRawStudio({
    slug,
    studioName: entry.studioName,
    website: entry.website,
    homepage: { url: entry.website, markdown: home.markdown, html: home.rawHtml ?? home.html ?? "", links: home.links },
    pages,
    lighthouse,
  })

  const okCount = pages.filter(p => p.status === "ok").length
  const failCount = pages.length - okCount
  console.log(`  ✓ Wrote data/raw/${slug}/ (${okCount} ok, ${failCount} failed)`)
}
