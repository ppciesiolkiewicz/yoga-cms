// scripts/scraper/migrate-raw.ts
// One-time migration for phase 1 raw shape:
// - strip `category` from pages.json records
// - remove homepage record from pages.json (homepage now lives in home.md/home.html/home.json)
// - generate home.json from existing home.html

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import * as cheerio from "cheerio"
import type { HomeJson, HomeLink } from "./types"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "../../data")
const RAW_DIR = join(DATA_DIR, "raw")

function labelFromPath(u: URL): string {
  const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean)
  if (parts.length === 0) return "home"
  return parts[parts.length - 1].replace(/[-_]/g, " ")
}

function extractLinks(html: string, baseUrl: string): HomeLink[] {
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
      seen.add(u.href)
      const text = $(el).text().replace(/\s+/g, " ").trim()
      out.push({ label: text || labelFromPath(u), href: u.href })
    } catch {
      // ignore
    }
  })
  return out
}

interface LegacyRawPage {
  status: "ok" | "failed"
  url: string
  file: string
  category?: string
  source: string
  fetchedAt: string
  bytes?: number
  error?: string
}

interface LegacyPagesJson {
  studioName: string
  website: string
  fetchedAt: string
  pages: LegacyRawPage[]
}

function migrateSlug(slug: string): { changed: boolean; notes: string[] } {
  const dir = join(RAW_DIR, slug)
  const pagesPath = join(dir, "pages.json")
  const homeHtmlPath = join(dir, "home.html")
  const homeJsonPath = join(dir, "home.json")
  const notes: string[] = []

  if (!existsSync(pagesPath)) {
    return { changed: false, notes: ["no pages.json, skipped"] }
  }

  const pagesJson = JSON.parse(readFileSync(pagesPath, "utf-8")) as LegacyPagesJson
  const website = pagesJson.website

  // Strip category and remove homepage record
  let hadHomepage = false
  let hadCategory = false
  const cleanPages: LegacyRawPage[] = []
  for (const p of pagesJson.pages) {
    if (p.category === "home") {
      hadHomepage = true
      continue
    }
    if (p.category !== undefined) {
      hadCategory = true
      const { category: _category, ...rest } = p
      cleanPages.push(rest as LegacyRawPage)
    } else {
      cleanPages.push(p)
    }
  }

  const cleanedJson: LegacyPagesJson = { ...pagesJson, pages: cleanPages }
  writeFileSync(pagesPath, JSON.stringify(cleanedJson, null, 2), "utf-8")
  if (hadCategory || hadHomepage) {
    notes.push(`stripped category (${pagesJson.pages.length - cleanPages.length} homepage records removed)`)
  }

  // Generate home.json if missing
  if (!existsSync(homeJsonPath)) {
    if (!existsSync(homeHtmlPath)) {
      notes.push("⚠ no home.html, cannot generate home.json")
      return { changed: true, notes }
    }
    const html = readFileSync(homeHtmlPath, "utf-8")
    const links = extractLinks(html, website)
    const homeJson: HomeJson = { url: website, links }
    writeFileSync(homeJsonPath, JSON.stringify(homeJson, null, 2), "utf-8")
    notes.push(`wrote home.json (${links.length} links)`)
  } else {
    notes.push("home.json already exists")
  }

  return { changed: true, notes }
}

function main() {
  if (!existsSync(RAW_DIR)) {
    console.error(`No raw dir at ${RAW_DIR}`)
    process.exit(1)
  }
  const slugs = readdirSync(RAW_DIR).filter(name => {
    const p = join(RAW_DIR, name)
    return existsSync(p) && statSync(p).isDirectory()
  })
  console.log(`Migrating ${slugs.length} studio(s) in ${RAW_DIR}`)
  for (const slug of slugs) {
    const result = migrateSlug(slug)
    const tag = result.changed ? "✓" : "·"
    console.log(`  ${tag} ${slug} — ${result.notes.join("; ")}`)
  }
  console.log("Done.")
}

main()
