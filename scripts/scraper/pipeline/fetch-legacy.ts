// scripts/scraper/pipeline/fetch-legacy.ts
import * as cheerio from "cheerio"
import type { StudioEntry, PageCategory, RawPage } from "../types"
import { writeRawStudio } from "./raw-io"
import { runLighthouse } from "./lighthouse"

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    console.log(`  Fetching: ${url}`)
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
    if (!response.ok) {
      console.warn(`  ⚠ HTTP ${response.status} for ${url}`)
      return null
    }
    return await response.text()
  } catch (error) {
    console.warn(`  ⚠ Failed to fetch ${url}: ${error}`)
    return null
  }
}

async function fetchHtmlBrowser(url: string): Promise<string | null> {
  try {
    console.log(`  Fetching (browser): ${url}`)
    const { chromium } = await import("playwright")
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
      return await page.content()
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.warn(`  ⚠ Failed to fetch (browser) ${url}: ${error}`)
    return null
  }
}

function htmlToMarkdownLike(html: string): string {
  const $ = cheerio.load(html)
  $("script, style, iframe, noscript").remove()
  return $("body").text().replace(/\s+/g, " ").trim()
}

function extractHomepageLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html)
  const out = new Set<string>()
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    try {
      const u = new URL(href, baseUrl)
      if (u.hostname !== new URL(baseUrl).hostname) return
      out.add(u.href)
    } catch {
      // ignore
    }
  })
  return Array.from(out)
}

export async function fetchStudioLegacy(entry: StudioEntry): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n═══ fetch (legacy): ${entry.studioName} (${entry.city}) ═══`)

  if (!entry.overrides) {
    console.warn(`  ⚠ Skipping ${entry.studioName}: legacy fetcher requires overrides`)
    return
  }

  const homeHtml = await fetchHtml(entry.website)
  if (!homeHtml) throw new Error(`Legacy homepage fetch failed for ${entry.studioName}`)

  const targets: Array<{ url: string; category: PageCategory; source: RawPage["source"] }> = []
  const seen = new Set<string>([entry.website])
  const push = (url: string | undefined, category: PageCategory) => {
    if (!url || seen.has(url)) return
    seen.add(url)
    targets.push({ url, category, source: "override" })
  }
  for (const u of entry.overrides.dropIns ?? []) push(u, "dropIn")
  for (const u of entry.overrides.trainings ?? []) push(u, "training")
  for (const u of entry.overrides.retreats ?? []) push(u, "retreat")
  push(entry.overrides.contact, "contact")

  const pages: Array<{ url: string; markdown: string; category: PageCategory; source: RawPage["source"]; status: "ok" | "failed"; error?: string }> = []
  for (const target of targets) {
    // Legacy has no scrapeMode hint anymore; try fetch first, then browser fallback
    let html = await fetchHtml(target.url)
    if (!html) html = await fetchHtmlBrowser(target.url)
    if (!html) {
      pages.push({ url: target.url, category: target.category, source: target.source, markdown: "", status: "failed" as const, error: "fetch + browser both returned nothing" })
      continue
    }
    pages.push({ url: target.url, category: target.category, source: target.source, markdown: htmlToMarkdownLike(html), status: "ok" as const })
  }

  const lighthouse = await runLighthouse(entry.website)

  writeRawStudio({
    slug,
    studioName: entry.studioName,
    website: entry.website,
    homepage: {
      url: entry.website,
      markdown: htmlToMarkdownLike(homeHtml),
      html: homeHtml,
      links: extractHomepageLinks(homeHtml, entry.website),
    },
    pages,
    lighthouse,
  })

  const okCount = pages.filter(p => p.status === "ok").length
  console.log(`  ✓ Wrote data/raw/${slug}/ legacy (${okCount}/${pages.length} ok)`)
}
