// scripts/scraper/fetch.ts — fetch CLI
// Atomic: always runs homepage → discovery → pages.
// Writes raw artifacts to data/raw/<slug>/.

import { config } from "dotenv"
import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { studios } from "./websites-data"
import {
  fetchHomepageStage,
  fetchDiscoveryStage,
  fetchPagesStage,
} from "./pipeline/fetch-stages"
import {
  homepageExists,
  discoveryExists,
  pagesExists,
} from "./pipeline/raw-io"
import type { StudioEntry } from "./types"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, "../../.env") })

interface Args {
  studioFilter?: string
  cityFilter?: string
  limit?: number
  force: boolean
  skipMapFallback: boolean
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function filterStudios(args: Args): StudioEntry[] {
  let list = studios
  if (args.studioFilter) {
    list = list.filter(s => s.studioName.toLowerCase().includes(args.studioFilter!.toLowerCase()))
    if (list.length === 0) { console.error(`No studios matching "${args.studioFilter}"`); process.exit(1) }
  }
  if (args.cityFilter) {
    list = list.filter(s => s.city.toLowerCase().includes(args.cityFilter!.toLowerCase()))
    if (list.length === 0) { console.error(`No studios in city "${args.cityFilter}"`); process.exit(1) }
  }
  if (args.limit) list = list.slice(0, args.limit)
  return list
}

async function fetchStudio(entry: StudioEntry, args: Args): Promise<void> {
  const slug = slugify(entry.studioName)

  if (args.force || !homepageExists(slug)) {
    await fetchHomepageStage(entry)
  } else {
    console.log(`  · homepage cached for ${entry.studioName}`)
  }

  if (args.force || !discoveryExists(slug)) {
    await fetchDiscoveryStage(entry, { skipMapFallback: args.skipMapFallback })
  } else {
    console.log(`  · discovery cached for ${entry.studioName}`)
  }

  if (args.force || !pagesExists(slug)) {
    await fetchPagesStage(entry)
  } else {
    console.log(`  · pages cached for ${entry.studioName}`)
  }
}

const HELP_TEXT = `npm run fetch — download raw artifacts from studio websites

USAGE
  npm run fetch -- [options]

Fetch is atomic: runs homepage → discovery → pages in order. Each step is
cached on disk; re-running is cheap unless you pass --force.

PIPELINE
  homepage    Scrape the homepage via Firecrawl (markdown + raw HTML + link
              list). A separate raw fetch() captures response headers for
              wappalyzer.
              Writes: home.md, home.html, home.headers.json, home.json

  discovery   Build the candidate URL list. No classification here — that
              happens in analyze. Candidates come from:
                1. Homepage links (filtered for noise)
                2. Firecrawl /map results for configured search terms
                   (skip with --skip-map-fallback)
                3. Override URLs from websites-data.ts
              Deduped, capped at 25.
              Writes: discovery.json

  pages       Scrape each candidate in parallel via Firecrawl.
              Writes: pages.json, one .md file per OK candidate

OPTIONS
  --studio NAME          filter by studio name substring
  --city CITY            filter by city substring
  --limit N              take only the first N matching studios
  --force                re-fetch even if artifacts exist
  --skip-map-fallback    skip Firecrawl /map calls during discovery
  -h, --help             show this help

ARTIFACTS (data/raw/<slug>/)
  home.md, home.html, home.headers.json, home.json
  discovery.json
  pages.json, <page-slug>.md

REQUIRES
  FIRECRAWL_API_KEY      for Firecrawl (primary fetcher)
  SCRAPER_FETCHER=legacy optional fallback using raw fetch() + Playwright
                         (overrides-only)

EXAMPLES
  npm run fetch -- --studio "Arogya Yoga School"
  npm run fetch -- --city Rishikesh --limit 3
  npm run fetch -- --force --skip-map-fallback --studio "Arogya"
`

function printHelp(): void {
  process.stdout.write(HELP_TEXT)
}

function hasHelpFlag(raw: string[]): boolean {
  return raw.includes("--help") || raw.includes("-h")
}

export async function runFetch(argv: string[] = process.argv.slice(2)): Promise<void> {
  if (hasHelpFlag(argv)) {
    printHelp()
    return
  }
  const args = parseArgsFrom(argv)
  const list = filterStudios(args)
  console.log(`fetch — ${list.length} studio(s) in scope`)

  for (const entry of list) {
    try {
      await fetchStudio(entry, args)
    } catch (error) {
      console.error(`  ✗ fetch failed for ${entry.studioName}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

function parseArgsFrom(raw: string[]): Args {
  const out: Args = { force: false, skipMapFallback: false }
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]
    if (a === "--studio" && raw[i + 1]) { out.studioFilter = raw[++i] }
    else if (a === "--city" && raw[i + 1]) { out.cityFilter = raw[++i] }
    else if (a === "--limit" && raw[i + 1]) { out.limit = parseInt(raw[++i], 10) }
    else if (a === "--force") { out.force = true }
    else if (a === "--skip-map-fallback") { out.skipMapFallback = true }
  }
  return out
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("fetch.ts")
if (isDirectRun) {
  runFetch().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
