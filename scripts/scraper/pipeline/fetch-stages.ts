// scripts/scraper/pipeline/fetch-stages.ts
// Fetch pipeline stages: homepage, discovery, pages.
// Each stage reads prior artifacts, writes its own.

import * as cheerio from "cheerio"
import type {
  StudioEntry,
  HomeLink,
  DiscoveryCandidate,
  DiscoveryJson,
  RawPage,
} from "../types"
import { scrapeUrl, mapUrl, ensureCredits, fetchResponseHeaders } from "./firecrawl-client"
import {
  writeHomepage,
  readHomepage,
  writeDiscovery,
  readDiscovery,
  writePages,
  HomepageArtifacts,
} from "./raw-io"

const CANDIDATE_CAP = 25
const SCRAPE_CONCURRENCY = 2

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function isLegacy(): boolean {
  return process.env.SCRAPER_FETCHER === "legacy"
}

// ── Link extraction helpers ──

const NOISE_PATH_PATTERNS = [
  /^\/?privacy/i,
  /^\/?terms/i,
  /^\/?cookie/i,
  /^\/?impressum/i,
  /^\/?legal/i,
  /^\/?login/i,
  /^\/?register/i,
  /^\/?account/i,
  /^\/?cart/i,
  /^\/?checkout/i,
  /^\/?wp-admin/i,
  /^\/?feed/i,
  /\.(pdf|zip|jpg|jpeg|png|gif|svg|webp|ico)$/i,
]

function labelFromPath(u: URL): string {
  const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean)
  if (parts.length === 0) return "home"
  return parts[parts.length - 1].replace(/[-_]/g, " ")
}

function isNoise(u: URL): boolean {
  return NOISE_PATH_PATTERNS.some(p => p.test(u.pathname))
}

function linksFromFirecrawl(rawLinks: string[], homepageUrl: string): HomeLink[] {
  const base = new URL(homepageUrl)
  const seen = new Set<string>()
  const out: HomeLink[] = []
  for (const href of rawLinks) {
    try {
      const u = new URL(href, homepageUrl)
      if (u.hostname !== base.hostname) continue
      if (u.href === base.href) continue
      if (isNoise(u)) continue
      const normalized = `${u.origin}${u.pathname}`.replace(/\/$/, "")
      if (seen.has(normalized)) continue
      seen.add(normalized)
      out.push({ label: labelFromPath(u), href: u.href })
    } catch {
      // ignore
    }
  }
  return out
}

function linksFromHtml(html: string, baseUrl: string): HomeLink[] {
  const $ = cheerio.load(html)
  const base = new URL(baseUrl)
  const seen = new Set<string>([baseUrl])
  const out: HomeLink[] = []
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    try {
      const u = new URL(href, baseUrl)
      if (u.hostname !== base.hostname) return
      if (seen.has(u.href)) return
      if (isNoise(u)) return
      seen.add(u.href)
      const text = $(el).text().replace(/\s+/g, " ").trim()
      out.push({ label: text || labelFromPath(u), href: u.href })
    } catch {
      // ignore
    }
  })
  return out
}

// ── Legacy (raw fetch) helpers ──

async function fetchHtmlWithHeaders(url: string): Promise<{ html: string; headers: Record<string, string> } | null> {
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
    const headers: Record<string, string> = {}
    response.headers.forEach((value, key) => { headers[key] = value })
    const html = await response.text()
    return { html, headers }
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

// ── Stage: homepage ──

export async function fetchHomepageStage(entry: StudioEntry): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n═══ fetch:homepage — ${entry.studioName} ═══`)

  let artifacts: HomepageArtifacts

  if (isLegacy()) {
    const home = await fetchHtmlWithHeaders(entry.website)
    if (!home) throw new Error(`Legacy homepage fetch failed for ${entry.studioName}`)
    artifacts = {
      url: entry.website,
      markdown: htmlToMarkdownLike(home.html),
      html: home.html,
      links: linksFromHtml(home.html, entry.website),
      headers: home.headers,
    }
  } else {
    const credits = await ensureCredits()
    if (!credits.ok) {
      throw new Error(`Firecrawl credits below floor (remaining=${credits.remaining}). Set SCRAPER_FETCHER=legacy or top up.`)
    }
    console.log(`  Scraping homepage: ${entry.website}`)
    const [home, headers] = await Promise.all([
      scrapeUrl(entry.website, { includeRawHtml: true, onlyMainContent: false }),
      fetchResponseHeaders(entry.website),
    ])
    if ("error" in home) {
      throw new Error(`Homepage scrape failed for ${entry.studioName}: ${home.error}`)
    }
    artifacts = {
      url: entry.website,
      markdown: home.markdown,
      html: home.rawHtml ?? home.html ?? "",
      links: linksFromFirecrawl(home.links, entry.website),
      headers,
    }
  }

  writeHomepage(slug, artifacts)
  console.log(`  ✓ Wrote home.md, home.html, home.headers.json, home.json (${artifacts.links.length} links)`)
}

// ── Stage: discovery ──

export interface DiscoveryOpts {
  skipMapFallback: boolean
}

export async function fetchDiscoveryStage(entry: StudioEntry, opts: DiscoveryOpts): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n═══ fetch:discovery — ${entry.studioName} ═══`)

  const home = readHomepage(slug)
  if (!home) throw new Error(`No homepage artifacts for ${entry.studioName} — run fetch:homepage first`)

  const candidates: DiscoveryCandidate[] = []
  const seen = new Set<string>([entry.website])

  const push = (url: string, label: string, source: RawPage["source"]) => {
    if (!url || seen.has(url)) return
    try {
      const u = new URL(url, entry.website)
      if (seen.has(u.href)) return
      seen.add(u.href)
      candidates.push({ url: u.href, label, source })
    } catch {
      // ignore
    }
  }

  for (const link of home.links) push(link.href, link.label, "homepage-links")

  if (!opts.skipMapFallback && !isLegacy()) {
    const terms: Array<[string, RawPage["source"]]> = [
      ["teacher training", "map:teacher-training"],
      ["retreat", "map:retreat"],
      ["class schedule", "map:class-schedule"],
      ["contact", "map:contact"],
    ]
    for (const [term, source] of terms) {
      const found = await mapUrl(entry.website, term)
      for (const url of found.slice(0, 2)) {
        push(url, term.replace(/\s+/g, "-"), source)
      }
    }
  }

  if (entry.overrides) {
    const all = [
      ...(entry.overrides.dropIns ?? []),
      ...(entry.overrides.trainings ?? []),
      ...(entry.overrides.retreats ?? []),
      ...(entry.overrides.contact ? [entry.overrides.contact] : []),
    ]
    for (const url of all) {
      try {
        const u = new URL(url, entry.website)
        push(u.href, labelFromPath(u), "override")
      } catch {
        // ignore
      }
    }
  }

  const capped = candidates.slice(0, CANDIDATE_CAP)
  const discovery: DiscoveryJson = {
    studioName: entry.studioName,
    website: entry.website,
    generatedAt: new Date().toISOString(),
    candidates: capped,
  }
  writeDiscovery(slug, discovery)
  console.log(`  ✓ Wrote discovery.json (${capped.length} candidates, home=${home.links.length})`)
}

// ── Stage: pages ──

async function scrapeAllFirecrawl(
  candidates: DiscoveryCandidate[],
): Promise<Array<{ url: string; markdown: string; source: RawPage["source"]; status: "ok" | "failed"; error?: string }>> {
  const results: Array<{ url: string; markdown: string; source: RawPage["source"]; status: "ok" | "failed"; error?: string }> = []
  let index = 0
  async function worker() {
    while (index < candidates.length) {
      const my = candidates[index++]
      const res = await scrapeUrl(my.url)
      if ("error" in res) {
        results.push({ url: my.url, source: my.source, markdown: "", status: "failed", error: res.error })
      } else {
        results.push({ url: my.url, source: my.source, markdown: res.markdown, status: "ok" })
      }
    }
  }
  await Promise.all(Array.from({ length: SCRAPE_CONCURRENCY }, worker))
  return results
}

async function scrapeAllLegacy(
  candidates: DiscoveryCandidate[],
): Promise<Array<{ url: string; markdown: string; source: RawPage["source"]; status: "ok" | "failed"; error?: string }>> {
  const out: Array<{ url: string; markdown: string; source: RawPage["source"]; status: "ok" | "failed"; error?: string }> = []
  for (const c of candidates) {
    const res = await fetchHtmlWithHeaders(c.url)
    let html: string | null = res?.html ?? null
    if (!html) html = await fetchHtmlBrowser(c.url)
    if (!html) {
      out.push({ url: c.url, source: c.source, markdown: "", status: "failed", error: "fetch + browser both returned nothing" })
      continue
    }
    out.push({ url: c.url, source: c.source, markdown: htmlToMarkdownLike(html), status: "ok" })
  }
  return out
}

export async function fetchPagesStage(entry: StudioEntry): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n═══ fetch:pages — ${entry.studioName} ═══`)

  const discovery = readDiscovery(slug)
  if (!discovery) throw new Error(`No discovery.json for ${entry.studioName} — run fetch:discovery first`)

  const pages = isLegacy()
    ? await scrapeAllLegacy(discovery.candidates)
    : await scrapeAllFirecrawl(discovery.candidates)

  writePages({
    slug,
    studioName: entry.studioName,
    website: entry.website,
    pages,
  })

  const okCount = pages.filter(p => p.status === "ok").length
  const failCount = pages.length - okCount
  console.log(`  ✓ Wrote pages.json (${okCount} ok, ${failCount} failed)`)
}
