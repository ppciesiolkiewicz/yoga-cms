# Firecrawl Scraper Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace cheerio + Playwright fetching with Firecrawl-driven scraping, split the scraper into cacheable fetch and offline analyze stages, and auto-discover category URLs from homepage links.

**Architecture:** A two-stage pipeline. Stage A ("fetch") talks to Firecrawl and writes raw markdown + HTML + lighthouse per studio into `data/raw/<slug>/`. Stage B ("analyze") reads only from `data/raw/`, runs existing Claude-powered assessment/extraction, and writes `data/reports/<slug>.json`. The legacy cheerio + Playwright path is preserved as an opt-in fallback via `SCRAPER_FETCHER=legacy` for credit-exhausted runs.

**Tech Stack:** TypeScript, tsx, `@mendable/firecrawl-js`, `@anthropic-ai/sdk`, `simple-wappalyzer`, `playwright` (lighthouse only), `lighthouse`, `cheerio` (legacy path only).

**Spec:** [docs/superpowers/specs/2026-04-11-firecrawl-scraper-restructure-design.md](../specs/2026-04-11-firecrawl-scraper-restructure-design.md)

**Verification model:** This repo has no unit-test framework. Per-task verification uses `npx tsc --noEmit` (type check) plus targeted smoke runs on a single studio. Each task ends with a commit.

---

## File Structure

### Files to create

- `scripts/scraper/pipeline/firecrawl-client.ts` — Firecrawl SDK wrapper, credit check, typed `scrapeUrl` + `mapUrl` helpers.
- `scripts/scraper/pipeline/raw-io.ts` — read/write `data/raw/<slug>/` (pages.json, markdown files, html, lighthouse).
- `scripts/scraper/pipeline/classify-links.ts` — Claude call that classifies homepage links into categories.
- `scripts/scraper/pipeline/fetch-firecrawl.ts` — Firecrawl fetch orchestrator per studio.
- `scripts/scraper/pipeline/fetch-legacy.ts` — extracted legacy cheerio + Playwright path, writes into `data/raw/` in the same shape.
- `scripts/scraper/pipeline/analyze.ts` — offline analyze stage orchestrator.
- `scripts/archive-v1.mjs` — one-shot archive script that moves `data/*.json` → `data/reports-v1/*.json`.

### Files to modify

- `scripts/scraper/types.ts` — `FetchedPage` now has `markdown` instead of `html`/`text`, add `RawStudio`, `RawPage`, `PagesJson`, extend `StudioEntry` with optional `overrides`.
- `scripts/scraper/pipeline/fetch.ts` — shrink to a thin dispatcher that reads `SCRAPER_FETCHER` env var and calls `fetchStudioFirecrawl` or `fetchStudioLegacy`. Expose a single `fetchStudio(entry, opts)` and `loadRawStudio(slug)` API.
- `scripts/scraper/pipeline/content-assess.ts` — consume `FetchedPage.markdown`, raise per-page cap to 12k.
- `scripts/scraper/pipeline/data-extract.ts` — consume `FetchedPage.markdown`, raise slice cap to 12k, drop `text` reference.
- `scripts/scraper/scrape.ts` — orchestrate `fetch` then `analyze`, add `--force`, `--skip-map-fallback`, and staleness rule that compares raw fetchedAt to report scrapedAt.
- `scripts/scraper/websites-data.ts` — remove `scrapeMode`, simplify studios to `{ studioName, city, website, overrides? }`, put current hand-curated URL lists into commented-out `overrides` blocks.
- `package.json` — add `@mendable/firecrawl-js`, add `scrape:fetch` and `scrape:analyze` scripts.
- `.gitignore` — ensure `.firecrawl/` is ignored; keep `data/` tracked.

### Files unchanged

- `scripts/scraper/pipeline/tech-detect.ts` — still takes raw HTML. The fetch stage saves `home.html` alongside `home.md` so this module does not change.
- `scripts/scraper/pipeline/lighthouse.ts` — unchanged; invoked by fetch stage, result cached to `data/raw/<slug>/lighthouse.json`.

---

## Task 1: Add Firecrawl SDK and verify setup

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Install Firecrawl SDK**

Run:
```bash
npm install @mendable/firecrawl-js
```
Expected: package added to `dependencies`, lockfile updated, no peer warnings blocking install.

- [ ] **Step 2: Verify FIRECRAWL_API_KEY is present**

Run:
```bash
grep -q '^FIRECRAWL_API_KEY=' .env && echo OK || echo MISSING
```
Expected: `OK`. If missing, copy from `.env.example` and set a real value before proceeding.

- [ ] **Step 3: Ensure .gitignore ignores local firecrawl CLI cache**

Run:
```bash
grep -q '^\.firecrawl/$' .gitignore || echo '.firecrawl/' >> .gitignore
```
Expected: exit 0; `.firecrawl/` present in `.gitignore`.

- [ ] **Step 4: Smoke test the SDK**

Create a scratch file `scripts/scraper/_sdk-smoke.ts`:
```ts
import "dotenv/config"
import FirecrawlApp from "@mendable/firecrawl-js"

const fc = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! })
const res = await fc.scrapeUrl("https://firecrawl.dev", {
  formats: ["markdown"],
  onlyMainContent: true,
})
if (!res.success) {
  console.error("FAIL:", res.error)
  process.exit(1)
}
console.log("OK, markdown bytes:", (res.markdown ?? "").length)
```

Run:
```bash
npx tsx scripts/scraper/_sdk-smoke.ts
```
Expected: `OK, markdown bytes: <nonzero>`. If `FAIL`, stop and fix auth/key before proceeding.

- [ ] **Step 5: Delete the smoke file**

Run:
```bash
rm scripts/scraper/_sdk-smoke.ts
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: add @mendable/firecrawl-js dependency"
```

---

## Task 2: Archive existing data to reports-v1

**Files:**
- Create: `scripts/archive-v1.mjs`

- [ ] **Step 1: Write the archive script**

```js
// scripts/archive-v1.mjs
import { readdirSync, existsSync, mkdirSync, renameSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, "..", "data")
const DEST = join(DATA, "reports-v1")

if (!existsSync(DATA)) {
  console.error("data/ directory not found")
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })

let moved = 0
for (const file of readdirSync(DATA)) {
  if (!file.endsWith(".json")) continue
  if (file === "index.json") continue
  const src = join(DATA, file)
  const dst = join(DEST, file)
  if (existsSync(dst)) {
    console.log(`skip ${file} (already in reports-v1/)`)
    continue
  }
  renameSync(src, dst)
  moved++
  console.log(`moved ${file}`)
}

console.log(`done: ${moved} file(s) archived to data/reports-v1/`)
```

- [ ] **Step 2: Run the archive**

Run:
```bash
node scripts/archive-v1.mjs
```
Expected: `done: 38 file(s) archived to data/reports-v1/` (or however many studios exist minus index.json).

- [ ] **Step 3: Verify layout**

Run:
```bash
ls data/*.json
ls data/reports-v1/ | wc -l
```
Expected: `data/*.json` lists only `data/index.json`; `data/reports-v1/` has all studio files.

- [ ] **Step 4: Commit**

```bash
git add scripts/archive-v1.mjs data/reports-v1/ data/
git commit -m "chore: archive existing studio reports to data/reports-v1"
```

Note: the archive script stays in the repo. It's idempotent, small, and documents the migration. It is not deleted.

---

## Task 3: Update type definitions

**Files:**
- Modify: `scripts/scraper/types.ts`

- [ ] **Step 1: Replace FetchedPage and add new types**

Open `scripts/scraper/types.ts` and replace the existing `FetchedPage` interface and `StudioEntry` / `ScrapableUrl` section. The final file should contain:

```ts
export interface StudioOverrides {
  dropIns?: string[]
  trainings?: string[]
  retreats?: string[]
  contact?: string
}

export interface SearchRanking {
  query: string
  position: number
  isTopResult: boolean
}

export interface StudioEntry {
  studioName: string
  city: string
  website: string
  searchRanking?: SearchRanking
  overrides?: StudioOverrides
}

// ── Raw fetch output ────────────────────────────────────────

export type PageCategory = "home" | "dropIn" | "training" | "retreat" | "contact"
export type DiscoverySource = "override" | "homepage-links" | `map:${string}`

export interface RawPage {
  url: string
  file: string
  category: PageCategory
  source: DiscoverySource
  status: "ok" | "failed"
  fetchedAt: string
  bytes?: number
  error?: string
}

export interface PagesJson {
  studioName: string
  website: string
  fetchedAt: string
  pages: RawPage[]
}

export interface FetchedPage {
  url: string
  markdown: string
  category: PageCategory
}

export interface RawStudio {
  slug: string
  studioName: string
  website: string
  fetchedAt: string
  pages: FetchedPage[]
  homepage: {
    url: string
    markdown: string
    html: string
    links: string[]
  }
  lighthouse: LighthouseScores
}

export interface NavLink {
  label: string
  href: string
}

// ── Existing types (unchanged) ──────────────────────────────
// (keep DetectedTechnology, CostItem, LighthouseScores, TechAssessment,
// Features, ProgressiveDisclosure, TrainingPageAssessment,
// RetreatPageAssessment, ContentAssessment, ContactInfo, DropInClass,
// Training, Retreat, StudioReport, StudioIndexEntry, StudioIndex)
```

Keep every other type in the file exactly as it is today. Delete:
- the old `FetchedPage` definition
- the old `StudioEntry` (the one with `dropIns`/`trainings`/`retreats`/`contact: ScrapableUrl`)
- `ScrapableUrl` and `ScrapeMode` (no longer referenced after this refactor)

Do NOT touch `StudioReport`, `ContentAssessment`, `LighthouseScores`, or any of the downstream report/index types.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: errors in files that reference the old `FetchedPage.html`/`.text` and the old `StudioEntry` fields. This is expected — the next tasks fix them. Note the error count, you should see it decrease as you progress.

Do NOT fix those errors here — they are addressed in later tasks, one module at a time.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/types.ts
git commit -m "refactor(types): add RawStudio/PagesJson, markdown FetchedPage, StudioOverrides"
```

---

## Task 4: Firecrawl client wrapper

**Files:**
- Create: `scripts/scraper/pipeline/firecrawl-client.ts`

- [ ] **Step 1: Write the client module**

```ts
// scripts/scraper/pipeline/firecrawl-client.ts
import FirecrawlApp from "@mendable/firecrawl-js"

let _fc: FirecrawlApp | null = null

function getClient(): FirecrawlApp {
  if (!_fc) {
    const key = process.env.FIRECRAWL_API_KEY
    if (!key) throw new Error("FIRECRAWL_API_KEY is required for Firecrawl fetcher")
    _fc = new FirecrawlApp({ apiKey: key })
  }
  return _fc
}

export interface ScrapeResult {
  markdown: string
  html?: string
  links: string[]
}

export async function scrapeUrl(
  url: string,
  opts: { includeHtml?: boolean } = {},
): Promise<ScrapeResult | { error: string }> {
  const formats: ("markdown" | "html" | "links")[] = ["markdown", "links"]
  if (opts.includeHtml) formats.push("html")
  try {
    const res = await getClient().scrapeUrl(url, {
      formats,
      onlyMainContent: true,
      waitFor: 1500,
    })
    if (!res.success) return { error: (res as { error?: string }).error ?? "unknown firecrawl error" }
    return {
      markdown: res.markdown ?? "",
      html: opts.includeHtml ? (res.html ?? "") : undefined,
      links: res.links ?? [],
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

export async function mapUrl(
  website: string,
  search: string,
): Promise<string[]> {
  try {
    const res = await getClient().mapUrl(website, { search, limit: 20 })
    if (!res.success) return []
    return (res.links ?? []).map(l => (typeof l === "string" ? l : l.url)).filter(Boolean)
  } catch {
    return []
  }
}

const CREDIT_FLOOR = 50

export async function ensureCredits(): Promise<{ ok: boolean; remaining: number }> {
  try {
    const res = await (getClient() as unknown as {
      checkCredits?: () => Promise<{ remainingCredits?: number }>
    }).checkCredits?.()
    const remaining = res?.remainingCredits ?? -1
    return { ok: remaining < 0 || remaining >= CREDIT_FLOOR, remaining }
  } catch {
    return { ok: true, remaining: -1 }
  }
}
```

Note on the credit check: the Firecrawl JS SDK exposes `checkCredits` on some versions and not others. The code above falls back to treating an unknown result as "ok" rather than blocking the pipeline. The pre-run smoke test in Task 1 confirms auth works; credits are visible via `firecrawl --status` if the guard is inconclusive.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit scripts/scraper/pipeline/firecrawl-client.ts
```
Expected: no new errors in this file. (Other files still error from Task 3; that's fine.)

- [ ] **Step 3: Smoke test**

Create `scripts/scraper/_client-smoke.ts`:
```ts
import "dotenv/config"
import { scrapeUrl, ensureCredits } from "./pipeline/firecrawl-client"

const credits = await ensureCredits()
console.log("credits:", credits)

const res = await scrapeUrl("https://firecrawl.dev", { includeHtml: true })
if ("error" in res) {
  console.error("FAIL:", res.error)
  process.exit(1)
}
console.log("markdown bytes:", res.markdown.length, "html bytes:", res.html?.length, "links:", res.links.length)
```

Run:
```bash
npx tsx scripts/scraper/_client-smoke.ts
```
Expected: `credits:` line, then three nonzero counts.

- [ ] **Step 4: Delete the smoke file**

```bash
rm scripts/scraper/_client-smoke.ts
```

- [ ] **Step 5: Commit**

```bash
git add scripts/scraper/pipeline/firecrawl-client.ts
git commit -m "feat(scraper): firecrawl client wrapper with credit guard"
```

---

## Task 5: Raw I/O module

**Files:**
- Create: `scripts/scraper/pipeline/raw-io.ts`

- [ ] **Step 1: Write the raw-io module**

```ts
// scripts/scraper/pipeline/raw-io.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { PagesJson, RawPage, RawStudio, FetchedPage, LighthouseScores, PageCategory } from "../types"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "../../../data")
const RAW_DIR = join(DATA_DIR, "raw")

export function rawDir(slug: string): string {
  return join(RAW_DIR, slug)
}

export function slugFromPath(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.replace(/\/$/, "").split("/").pop() ?? ""
    if (!last || last === "") return "home"
    return last.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"
  } catch {
    return "page"
  }
}

export function resolveUniqueFile(existing: Set<string>, base: string, ext: string): string {
  let candidate = `${base}.${ext}`
  let i = 2
  while (existing.has(candidate)) {
    candidate = `${base}-${i}.${ext}`
    i++
  }
  existing.add(candidate)
  return candidate
}

export interface WriteRawInput {
  slug: string
  studioName: string
  website: string
  homepage: { url: string; markdown: string; html: string; links: string[] }
  pages: Array<{
    url: string
    markdown: string
    category: PageCategory
    source: RawPage["source"]
    status: "ok" | "failed"
    error?: string
  }>
  lighthouse: LighthouseScores
}

export function writeRawStudio(input: WriteRawInput): void {
  const dir = rawDir(input.slug)
  mkdirSync(dir, { recursive: true })

  writeFileSync(join(dir, "home.md"), input.homepage.markdown, "utf-8")
  writeFileSync(join(dir, "home.html"), input.homepage.html, "utf-8")
  writeFileSync(join(dir, "lighthouse.json"), JSON.stringify(input.lighthouse, null, 2), "utf-8")

  const usedFiles = new Set<string>(["home.md", "home.html", "lighthouse.json", "pages.json"])
  const rawPages: RawPage[] = []

  // homepage is always a page record too, so analyze can pass it to contact extraction
  rawPages.push({
    url: input.homepage.url,
    file: "home.md",
    category: "home",
    source: "homepage-links",
    status: "ok",
    fetchedAt: new Date().toISOString(),
    bytes: Buffer.byteLength(input.homepage.markdown, "utf-8"),
  })

  for (const page of input.pages) {
    const file = resolveUniqueFile(usedFiles, slugFromPath(page.url), "md")
    if (page.status === "ok") {
      writeFileSync(join(dir, file), page.markdown, "utf-8")
    }
    rawPages.push({
      url: page.url,
      file,
      category: page.category,
      source: page.source,
      status: page.status,
      fetchedAt: new Date().toISOString(),
      bytes: page.status === "ok" ? Buffer.byteLength(page.markdown, "utf-8") : undefined,
      error: page.error,
    })
  }

  const pagesJson: PagesJson = {
    studioName: input.studioName,
    website: input.website,
    fetchedAt: new Date().toISOString(),
    pages: rawPages,
  }
  writeFileSync(join(dir, "pages.json"), JSON.stringify(pagesJson, null, 2), "utf-8")
}

export function rawExists(slug: string): boolean {
  return existsSync(join(rawDir(slug), "pages.json"))
}

export function rawFetchedAt(slug: string): Date | null {
  try {
    const raw = JSON.parse(readFileSync(join(rawDir(slug), "pages.json"), "utf-8")) as PagesJson
    return new Date(raw.fetchedAt)
  } catch {
    return null
  }
}

export function loadRawStudio(slug: string): RawStudio {
  const dir = rawDir(slug)
  const pagesJson = JSON.parse(readFileSync(join(dir, "pages.json"), "utf-8")) as PagesJson
  const lighthouse = JSON.parse(readFileSync(join(dir, "lighthouse.json"), "utf-8")) as LighthouseScores

  const homepageRecord = pagesJson.pages.find(p => p.category === "home")
  if (!homepageRecord) throw new Error(`No home page in raw for ${slug}`)

  const homepageMarkdown = readFileSync(join(dir, homepageRecord.file), "utf-8")
  const homepageHtml = readFileSync(join(dir, "home.html"), "utf-8")

  const pages: FetchedPage[] = []
  for (const record of pagesJson.pages) {
    if (record.status !== "ok") continue
    if (record.category === "home") continue
    const markdown = readFileSync(join(dir, record.file), "utf-8")
    pages.push({ url: record.url, markdown, category: record.category })
  }

  return {
    slug,
    studioName: pagesJson.studioName,
    website: pagesJson.website,
    fetchedAt: pagesJson.fetchedAt,
    pages,
    homepage: {
      url: homepageRecord.url,
      markdown: homepageMarkdown,
      html: homepageHtml,
      links: [], // not needed by analyze; only fetch classifier uses this
    },
    lighthouse,
  }
}

export function listRawSlugs(): string[] {
  if (!existsSync(RAW_DIR)) return []
  return readdirSync(RAW_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}
```

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: errors continue in `fetch.ts`, `scrape.ts`, `content-assess.ts`, `data-extract.ts` (they still reference the old shapes). `raw-io.ts` should not add new errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/raw-io.ts
git commit -m "feat(scraper): raw-io module for data/raw/<slug> layout"
```

---

## Task 6: Link classifier

**Files:**
- Create: `scripts/scraper/pipeline/classify-links.ts`

- [ ] **Step 1: Write the classifier module**

```ts
// scripts/scraper/pipeline/classify-links.ts
import Anthropic from "@anthropic-ai/sdk"
import type { StudioOverrides } from "../types"

let _anthropic: Anthropic | null = null
function getClient() {
  if (!_anthropic) _anthropic = new Anthropic()
  return _anthropic
}

const SYSTEM = `You classify links from a yoga studio website homepage into exactly these buckets:
- dropIns: schedule, classes, prices, timetable
- trainings: teacher trainings (TTC, 200hr, 300hr, YTT, etc.)
- retreats: retreats, workshops over multiple days away from the studio
- contact: contact, about-us-with-contact, location
- other: everything else (home, blog, shop, gallery, philosophy, about generic, etc.)

Return ONLY a JSON object: { "dropIns": ["url"], "trainings": ["url"], "retreats": ["url"], "contact": "url" | null, "other": ["url"] }.
Cap dropIns, trainings, retreats at 3 URLs each. contact is a single URL or null. Prefer the most informative page when you have to choose. Use the labels as primary signal, URLs as fallback.`

export interface ClassifiedLinks {
  dropIns: string[]
  trainings: string[]
  retreats: string[]
  contact: string | null
}

export async function classifyLinks(
  studioName: string,
  website: string,
  links: Array<{ label: string; href: string }>,
): Promise<ClassifiedLinks> {
  if (links.length === 0) {
    return { dropIns: [], trainings: [], retreats: [], contact: null }
  }

  const userMessage = `Studio: "${studioName}" (${website})

Homepage links:
${links.map(l => `- "${l.label}" -> ${l.href}`).join("\n")}

Classify into JSON as instructed.`

  try {
    const response = await getClient().messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: userMessage }],
    })
    let text = response.content[0].type === "text" ? response.content[0].text : ""
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
    const parsed = JSON.parse(text) as ClassifiedLinks & { other?: unknown }
    return {
      dropIns: Array.isArray(parsed.dropIns) ? parsed.dropIns.slice(0, 3) : [],
      trainings: Array.isArray(parsed.trainings) ? parsed.trainings.slice(0, 3) : [],
      retreats: Array.isArray(parsed.retreats) ? parsed.retreats.slice(0, 3) : [],
      contact: typeof parsed.contact === "string" ? parsed.contact : null,
    }
  } catch {
    return classifyByKeyword(links)
  }
}

function classifyByKeyword(links: Array<{ label: string; href: string }>): ClassifiedLinks {
  const out: ClassifiedLinks = { dropIns: [], trainings: [], retreats: [], contact: null }
  const seen = new Set<string>()
  const push = (arr: string[], href: string, cap: number) => {
    if (seen.has(href) || arr.length >= cap) return
    arr.push(href)
    seen.add(href)
  }
  for (const { label, href } of links) {
    const hay = `${label} ${href}`.toLowerCase()
    if (!out.contact && /contact|reach|email|location/.test(hay)) out.contact = href
    else if (/training|ytt|ttc|200[-\s]?hour|300[-\s]?hour|teacher/.test(hay)) push(out.trainings, href, 3)
    else if (/retreat|workshop/.test(hay)) push(out.retreats, href, 3)
    else if (/schedule|class(es)?|timetable|price|drop[-\s]?in/.test(hay)) push(out.dropIns, href, 3)
  }
  return out
}

export function fromOverrides(overrides: StudioOverrides): ClassifiedLinks {
  return {
    dropIns: overrides.dropIns ?? [],
    trainings: overrides.trainings ?? [],
    retreats: overrides.retreats ?? [],
    contact: overrides.contact ?? null,
  }
}
```

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors from `classify-links.ts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/classify-links.ts
git commit -m "feat(scraper): classify-links module (Claude + keyword fallback)"
```

---

## Task 7: Firecrawl fetch orchestrator

**Files:**
- Create: `scripts/scraper/pipeline/fetch-firecrawl.ts`

- [ ] **Step 1: Write the orchestrator**

```ts
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
        results.push({ ...my, markdown: "", status: "failed", error: res.error })
      } else {
        results.push({ ...my, markdown: res.markdown, status: "ok" })
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

  // Homepage: scrape markdown + html + links
  console.log(`  Scraping homepage: ${entry.website}`)
  const home = await scrapeUrl(entry.website, { includeHtml: true })
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
    homepage: { url: entry.website, markdown: home.markdown, html: home.html ?? "", links: home.links },
    pages,
    lighthouse,
  })

  const okCount = pages.filter(p => p.status === "ok").length
  const failCount = pages.length - okCount
  console.log(`  ✓ Wrote data/raw/${slug}/ (${okCount} ok, ${failCount} failed)`)
}
```

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors in `fetch-firecrawl.ts`. Existing errors in `scrape.ts`, `content-assess.ts`, `data-extract.ts`, old `fetch.ts` still there.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/fetch-firecrawl.ts
git commit -m "feat(scraper): fetch-firecrawl orchestrator with classify + map fallback"
```

---

## Task 8: Legacy fetcher module

**Files:**
- Create: `scripts/scraper/pipeline/fetch-legacy.ts`

- [ ] **Step 1: Write the legacy module**

```ts
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
      pages.push({ ...target, markdown: "", status: "failed", error: "fetch + browser both returned nothing" })
      continue
    }
    pages.push({ ...target, markdown: htmlToMarkdownLike(html), status: "ok" })
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
```

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors in `fetch-legacy.ts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/fetch-legacy.ts
git commit -m "feat(scraper): legacy fetcher (cheerio + playwright) writing into raw/"
```

---

## Task 9: Rewrite fetch.ts as dispatcher

**Files:**
- Modify: `scripts/scraper/pipeline/fetch.ts`

- [ ] **Step 1: Replace the file contents**

Open `scripts/scraper/pipeline/fetch.ts` and replace the ENTIRE file with:

```ts
// scripts/scraper/pipeline/fetch.ts
import type { StudioEntry } from "../types"
import { fetchStudioFirecrawl, type FetchOpts } from "./fetch-firecrawl"
import { fetchStudioLegacy } from "./fetch-legacy"
import { rawExists, rawFetchedAt } from "./raw-io"

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export interface FetchStudioOpts {
  force: boolean
  maxAgeDays: number
  skipMapFallback: boolean
}

export function isRawFresh(slug: string, maxAgeDays: number): boolean {
  if (!rawExists(slug)) return false
  const at = rawFetchedAt(slug)
  if (!at) return false
  const ageMs = Date.now() - at.getTime()
  return ageMs < maxAgeDays * 24 * 60 * 60 * 1000
}

export async function fetchStudio(entry: StudioEntry, opts: FetchStudioOpts): Promise<void> {
  const slug = slugify(entry.studioName)

  if (!opts.force && isRawFresh(slug, opts.maxAgeDays)) {
    console.log(`\n═══ fetch: ${entry.studioName} — cached, skipping ═══`)
    return
  }

  const fetcher = process.env.SCRAPER_FETCHER === "legacy" ? "legacy" : "firecrawl"
  if (fetcher === "legacy") {
    await fetchStudioLegacy(entry)
    return
  }

  const fcOpts: FetchOpts = { force: opts.force, skipMapFallback: opts.skipMapFallback }
  await fetchStudioFirecrawl(entry, fcOpts)
}

export { loadRawStudio, listRawSlugs } from "./raw-io"
```

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: errors remaining in `scrape.ts`, `content-assess.ts`, `data-extract.ts`, `websites-data.ts` (old shapes). No new errors introduced by this task.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/fetch.ts
git commit -m "refactor(scraper): fetch.ts becomes fetcher dispatcher + staleness check"
```

---

## Task 10: Update content-assess for markdown

**Files:**
- Modify: `scripts/scraper/pipeline/content-assess.ts`

- [ ] **Step 1: Swap .text for .markdown and raise cap**

Open `scripts/scraper/pipeline/content-assess.ts`. Find this line inside `assessContent`:

```ts
  const pagesDescription = allPages
    .map(p => `[${p.type.toUpperCase()}] ${p.url}\n${p.text.slice(0, 3000)}`)
    .join("\n\n---\n\n")
```

Replace with:

```ts
  const pagesDescription = allPages
    .map(p => `[${p.type.toUpperCase()}] ${p.url}\n${p.markdown.slice(0, 12000)}`)
    .join("\n\n---\n\n")
```

No other changes in this file. The system prompt, rubric, and return shape all stay exactly as they are.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: errors in `content-assess.ts` gone. Errors in `data-extract.ts`, `scrape.ts`, `websites-data.ts` still remain.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/content-assess.ts
git commit -m "refactor(scraper): content-assess reads markdown field (12k cap)"
```

---

## Task 11: Update data-extract for markdown

**Files:**
- Modify: `scripts/scraper/pipeline/data-extract.ts`

- [ ] **Step 1: Swap .text references to .markdown and raise caps**

Open `scripts/scraper/pipeline/data-extract.ts` and make these four replacements:

In `extractDropInClasses`:
```ts
    const text = pages.map(p => p.text).join("\n\n---\n\n")
```
becomes
```ts
    const text = pages.map(p => p.markdown).join("\n\n---\n\n")
```
and:
```ts
      `Extract drop-in classes from "${studioName}":\n\n${text.slice(0, 6000)}`
```
becomes
```ts
      `Extract drop-in classes from "${studioName}":\n\n${text.slice(0, 12000)}`
```

In `extractTrainings`:
```ts
    const text = pages.map(p => `URL: ${p.url}\n${p.text}`).join("\n\n---\n\n")
```
becomes
```ts
    const text = pages.map(p => `URL: ${p.url}\n${p.markdown}`).join("\n\n---\n\n")
```
and change the `text.slice(0, 6000)` to `text.slice(0, 12000)` in the user prompt.

In `extractRetreats`: same pattern — swap `p.text` to `p.markdown`, raise slice to `12000`.

In `extractContactInfo`:
```ts
    const text = pages.map(p => p.text).join("\n\n---\n\n")
```
becomes
```ts
    const text = pages.map(p => p.markdown).join("\n\n---\n\n")
```
and change `text.slice(0, 4000)` to `text.slice(0, 8000)`.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: errors in `data-extract.ts` gone. Remaining errors only in `scrape.ts` and `websites-data.ts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/data-extract.ts
git commit -m "refactor(scraper): data-extract reads markdown field (12k/8k caps)"
```

---

## Task 12: Analyze stage

**Files:**
- Create: `scripts/scraper/pipeline/analyze.ts`

- [ ] **Step 1: Write the analyze module**

```ts
// scripts/scraper/pipeline/analyze.ts
import type { StudioReport, StudioEntry, FetchedPage, NavLink } from "../types"
import { loadRawStudio } from "./raw-io"
import { detectTech } from "./tech-detect"
import { assessContent } from "./content-assess"
import {
  extractDropInClasses,
  extractTrainings,
  extractRetreats,
  extractContactInfo,
} from "./data-extract"

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function extractNavFromHtml(html: string, baseUrl: string): NavLink[] {
  // Minimal re-implementation to avoid a cheerio dependency in analyze.
  const navRegex = /<(nav|header)[^>]*>([\s\S]*?)<\/\1>/gi
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const base = (() => { try { return new URL(baseUrl) } catch { return null } })()
  const seen = new Set<string>()
  const out: NavLink[] = []
  let navMatch: RegExpExecArray | null
  while ((navMatch = navRegex.exec(html))) {
    const block = navMatch[2]
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = linkRegex.exec(block))) {
      const href = linkMatch[1]
      const label = linkMatch[2].replace(/<[^>]+>/g, "").trim()
      if (!label || label.length > 100) continue
      let full: URL
      try { full = new URL(href, baseUrl) } catch { continue }
      if (base && full.hostname !== base.hostname) continue
      if (seen.has(full.href)) continue
      seen.add(full.href)
      out.push({ label, href: full.href })
    }
  }
  return out
}

export async function analyzeStudio(entry: StudioEntry): Promise<StudioReport> {
  const slug = slugify(entry.studioName)
  console.log(`\n─── analyze: ${entry.studioName} ───`)
  const raw = loadRawStudio(slug)

  const dropInPages: FetchedPage[] = raw.pages.filter(p => p.category === "dropIn")
  const trainingPages: FetchedPage[] = raw.pages.filter(p => p.category === "training")
  const retreatPages: FetchedPage[] = raw.pages.filter(p => p.category === "retreat")
  const contactPages: FetchedPage[] = raw.pages.filter(p => p.category === "contact")

  const navigation = extractNavFromHtml(raw.homepage.html, raw.website)

  const { tech, features } = await detectTech(raw.website, raw.homepage.html)
  const lighthouse = raw.lighthouse

  const contentAssessment = await assessContent(
    entry.studioName,
    dropInPages,
    trainingPages,
    retreatPages,
  )

  const homepageAsContact: FetchedPage = {
    url: raw.homepage.url,
    markdown: raw.homepage.markdown,
    category: "home",
  }

  const [dropInClasses, trainings, retreats, contact] = await Promise.all([
    extractDropInClasses(dropInPages, entry.studioName),
    extractTrainings(trainingPages, entry.studioName),
    extractRetreats(retreatPages, entry.studioName),
    extractContactInfo([...contactPages, homepageAsContact], entry.studioName),
  ])

  const contactPageUrl = contactPages[0]?.url
  if (contactPageUrl) contact.contactPageUrl = contactPageUrl

  return {
    slug,
    studioName: entry.studioName,
    city: entry.city,
    website: entry.website,
    searchRanking: entry.searchRanking,
    scrapedAt: new Date().toISOString(),
    navigation,
    tech: { ...tech, lighthouse },
    features,
    contentAssessment,
    contact,
    dropInClasses,
    trainings,
    retreats,
  }
}
```

**Note on `content-assess` signature:** this module already takes `FetchedPage[]` split by type. After Task 10 it reads `p.markdown`. No change needed here to its arguments.

**Note on `FetchedPage` shape:** `category` in the runtime object for page passed to assess must be one of `dropIn|training|retreat` (mapped via `type` in `assessContent`). Since `assessContent` internally spreads `...p` and adds its own `type`, this continues to work.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: no new errors from `analyze.ts`. Errors remain only in `scrape.ts` and `websites-data.ts`.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/analyze.ts
git commit -m "feat(scraper): analyze stage reads raw + runs existing Claude pipeline"
```

---

## Task 13: Update websites-data.ts

**Files:**
- Modify: `scripts/scraper/websites-data.ts`

- [ ] **Step 1: Rewrite each studio entry**

For every studio in `scripts/scraper/websites-data.ts`, transform from the old shape:
```ts
{
  studioName: "Arogya Yoga School",
  city: "Rishikesh",
  website: "https://www.arogyayogaschool.com",
  dropIns: [
    { url: "https://www.arogyayogaschool.com/drop-in-yoga-class-in-rishikesh.php" },
  ],
  trainings: [
    { url: "https://www.arogyayogaschool.com/50-hour-yin-yoga-teacher-training-in-rishikesh.php" },
    { url: "https://www.arogyayogaschool.com/200-hour-yin-yoga-teacher-training-in-rishikesh.php" },
    { url: "https://www.arogyayogaschool.com/200-hour-yoga-teacher-training-course-in-india.php" },
  ],
  retreats: [
    { url: "https://www.arogyayogaschool.com/yoga-retreats-in-rishikesh-india.php" },
  ],
  contact: { url: "https://www.arogyayogaschool.com/contact.php" },
}
```

…to the new shape with commented overrides:
```ts
{
  studioName: "Arogya Yoga School",
  city: "Rishikesh",
  website: "https://www.arogyayogaschool.com",
  // overrides: {
  //   dropIns: ["https://www.arogyayogaschool.com/drop-in-yoga-class-in-rishikesh.php"],
  //   trainings: [
  //     "https://www.arogyayogaschool.com/50-hour-yin-yoga-teacher-training-in-rishikesh.php",
  //     "https://www.arogyayogaschool.com/200-hour-yin-yoga-teacher-training-in-rishikesh.php",
  //     "https://www.arogyayogaschool.com/200-hour-yoga-teacher-training-course-in-india.php",
  //   ],
  //   retreats: ["https://www.arogyayogaschool.com/yoga-retreats-in-rishikesh-india.php"],
  //   contact: "https://www.arogyayogaschool.com/contact.php",
  // },
},
```

Rules:
- Drop `scrapeMode` entirely. Nowhere in the new file.
- Drop the object-with-url wrapper. `overrides.dropIns` is `string[]`.
- Empty arrays become omitted fields in the comment (don't add `// dropIns: [],`).
- Keep all section comments (`// ── Rishikesh, India ──`) exactly as-is.
- Keep `studioName`, `city`, `website`, `searchRanking` (if present) on the live object.

This is mechanical but touches every studio. Work through the file top to bottom.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: errors in `websites-data.ts` gone. Only `scrape.ts` errors remain.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/websites-data.ts
git commit -m "refactor(scraper): websites-data uses simple entries + commented overrides"
```

---

## Task 14: Update scrape.ts orchestrator

**Files:**
- Modify: `scripts/scraper/scrape.ts`

- [ ] **Step 1: Replace the whole file**

Replace `scripts/scraper/scrape.ts` with:

```ts
import { config } from "dotenv"
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { studios } from "./websites-data"
import { fetchStudio } from "./pipeline/fetch"
import { analyzeStudio } from "./pipeline/analyze"
import { rawExists, rawFetchedAt } from "./pipeline/raw-io"
import type { StudioEntry, StudioReport, StudioIndex } from "./types"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, "../../.env") })

const DATA_DIR = join(__dirname, "../../data")
const REPORTS_DIR = join(DATA_DIR, "reports")

type Stage = "all" | "fetch" | "analyze"

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

interface Args {
  stage: Stage
  studioFilter?: string
  cityFilter?: string
  maxAgeDays: number
  limit?: number
  force: boolean
  skipMapFallback: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const out: Args = {
    stage: "all",
    maxAgeDays: 999,
    force: false,
    skipMapFallback: false,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--stage" && args[i + 1]) { out.stage = args[++i] as Stage }
    else if (a === "--studio" && args[i + 1]) { out.studioFilter = args[++i] }
    else if (a === "--city" && args[i + 1]) { out.cityFilter = args[++i] }
    else if (a === "--update-older-than-days" && args[i + 1]) { out.maxAgeDays = parseInt(args[++i], 10) }
    else if (a === "--limit" && args[i + 1]) { out.limit = parseInt(args[++i], 10) }
    else if (a === "--force") { out.force = true }
    else if (a === "--skip-map-fallback") { out.skipMapFallback = true }
  }
  return out
}

function reportPath(slug: string): string {
  return join(REPORTS_DIR, `${slug}.json`)
}

function readReport(slug: string): StudioReport | null {
  try { return JSON.parse(readFileSync(reportPath(slug), "utf-8")) as StudioReport } catch { return null }
}

function isReportFresh(slug: string, maxAgeDays: number): boolean {
  const report = readReport(slug)
  if (!report) return false
  const ageMs = Date.now() - new Date(report.scrapedAt).getTime()
  if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) return false
  const rawAt = rawFetchedAt(slug)
  if (rawAt && rawAt.getTime() > new Date(report.scrapedAt).getTime()) return false
  return true
}

function writeReport(report: StudioReport) {
  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(reportPath(report.slug), JSON.stringify(report, null, 2), "utf-8")
  console.log(`  ✓ Wrote data/reports/${report.slug}.json`)
}

function writeIndex(reports: StudioReport[]) {
  const index: StudioIndex = {
    generatedAt: new Date().toISOString(),
    studios: reports.map(r => ({
      slug: r.slug,
      studioName: r.studioName,
      city: r.city,
      platform: r.tech.platform,
      overallContentScore: r.contentAssessment.overallScore,
      estimatedMonthlyCost: r.tech.totalEstimatedMonthlyCost,
      lighthousePerformance: r.tech.lighthouse.performance,
      pageCount: r.navigation.length,
    })),
  }
  writeFileSync(join(DATA_DIR, "index.json"), JSON.stringify(index, null, 2), "utf-8")
  console.log(`\n✓ Wrote index with ${reports.length} studios`)
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

async function doFetch(list: StudioEntry[], args: Args): Promise<void> {
  for (const entry of list) {
    try {
      await fetchStudio(entry, { force: args.force, maxAgeDays: args.maxAgeDays, skipMapFallback: args.skipMapFallback })
    } catch (error) {
      console.error(`  ✗ Fetch failed for ${entry.studioName}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

async function doAnalyze(list: StudioEntry[], args: Args): Promise<StudioReport[]> {
  const reports: StudioReport[] = []
  for (const entry of list) {
    const slug = slugify(entry.studioName)

    if (!rawExists(slug)) {
      console.warn(`  ⚠ No raw for ${entry.studioName} — run fetch first`)
      continue
    }

    if (!args.force && isReportFresh(slug, args.maxAgeDays)) {
      console.log(`─── analyze: ${entry.studioName} — fresh, skipping ───`)
      const existing = readReport(slug)
      if (existing) reports.push(existing)
      continue
    }

    try {
      const report = await analyzeStudio(entry)
      writeReport(report)
      reports.push(report)
    } catch (error) {
      console.error(`  ✗ Analyze failed for ${entry.studioName}: ${error instanceof Error ? error.message : error}`)
    }
  }
  return reports
}

function loadAllReports(): StudioReport[] {
  if (!existsSync(REPORTS_DIR)) return []
  const reports: StudioReport[] = []
  for (const file of readdirSync(REPORTS_DIR)) {
    if (!file.endsWith(".json")) continue
    try { reports.push(JSON.parse(readFileSync(join(REPORTS_DIR, file), "utf-8"))) } catch {}
  }
  return reports
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required")
    process.exit(1)
  }
  const args = parseArgs()
  const list = filterStudios(args)
  console.log(`Stage: ${args.stage} — ${list.length} studio(s) in scope`)

  if (args.stage === "fetch" || args.stage === "all") {
    await doFetch(list, args)
  }

  if (args.stage === "analyze" || args.stage === "all") {
    const produced = await doAnalyze(list, args)
    // Rebuild index from all reports (produced + untouched), deduped by slug
    const all = new Map<string, StudioReport>()
    for (const r of loadAllReports()) all.set(r.slug, r)
    for (const r of produced) all.set(r.slug, r)
    writeIndex(Array.from(all.values()))
  }
}

main()
```

Note: the old `scrape.ts` loaded existing reports from `data/*.json` to avoid wiping them on partial runs. The new orchestrator reads from `data/reports/*.json` instead. The archive step (Task 2) already moved the old files aside.

- [ ] **Step 2: Type check**

Run:
```bash
npx tsc --noEmit
```
Expected: **zero errors**. If anything remains, fix it in the referenced module — do not move on.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/scrape.ts
git commit -m "feat(scraper): scrape.ts orchestrates fetch + analyze stages with staleness"
```

---

## Task 15: Add npm scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the two new scripts**

Open `package.json` and update the `scripts` section:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "scrape": "tsx scripts/scraper/scrape.ts",
    "scrape:studio": "tsx scripts/scraper/scrape.ts --studio",
    "scrape:fetch": "tsx scripts/scraper/scrape.ts --stage fetch",
    "scrape:analyze": "tsx scripts/scraper/scrape.ts --stage analyze"
  },
```

- [ ] **Step 2: Smoke the CLI parses**

Run:
```bash
npm run scrape:fetch -- --studio "NONEXISTENT" 2>&1 | head -5
```
Expected: `No studios matching "NONEXISTENT"` (the arg parser resolved `--stage fetch` and `--studio` both).

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add scrape:fetch and scrape:analyze npm scripts"
```

---

## Task 16: Single-studio smoke test (happy path)

**Files:**
- None (run-only)

- [ ] **Step 1: Pick a known-working studio**

Use `Arogya Yoga School` — the original pipeline worked for it (`overallContentScore > 0` in `data/reports-v1/`), so any regression is on us.

- [ ] **Step 2: Check Firecrawl credits**

Run:
```bash
firecrawl --status 2>&1 | grep Credits
```
Expected: ≥ 50 credits. If not, pause and top up.

- [ ] **Step 3: Fetch one studio**

Run:
```bash
npm run scrape:fetch -- --studio "Arogya Yoga School" --force
```
Expected output contains:
- `═══ fetch: Arogya Yoga School`
- `Scraping homepage: https://www.arogyayogaschool.com`
- `Discovery: dropIns=… trainings=… retreats=… contact=…`
- `✓ Wrote data/raw/arogya-yoga-school/ (N ok, 0 failed)` (or a small number failed)

- [ ] **Step 4: Inspect raw layout**

Run:
```bash
ls data/raw/arogya-yoga-school/
```
Expected: `home.html`, `home.md`, `lighthouse.json`, `pages.json`, plus one `.md` file per ok page.

Run:
```bash
jq '{fetchedAt, pages: [.pages[] | {url, file, category, source, status}]}' data/raw/arogya-yoga-school/pages.json
```
Expected: array includes a `"home"` category record, and at least one record in each of `dropIn`, `training`, `retreat`, `contact`.

- [ ] **Step 5: Analyze the same studio**

Run:
```bash
npm run scrape:analyze -- --studio "Arogya Yoga School" --force
```
Expected output: `analyze: Arogya Yoga School` and `✓ Wrote data/reports/arogya-yoga-school.json`.

- [ ] **Step 6: Inspect report**

Run:
```bash
jq '{score: .contentAssessment.overallScore, summary: .contentAssessment.summary, dropIns: (.dropInClasses|length), trainings: (.trainings|length), retreats: (.retreats|length), contact: .contact}' data/reports/arogya-yoga-school.json
```
Expected: `score > 0`, non-empty summary (not "No pages available…"), non-zero counts for at least one of dropIns/trainings/retreats, populated contact.

If the score is 0 or the summary says "No pages available", **stop**. The fetch or raw-io layer is dropping data. Inspect:
```bash
wc -c data/raw/arogya-yoga-school/*.md
```
All .md files should be >500 bytes. If home.md is near-zero, Firecrawl returned an empty markdown — try `--force` once more; if still empty, the `onlyMainContent: true` flag may be over-stripping on that site. In that case re-run with `onlyMainContent: false` as a temporary diagnostic (don't commit the change) to see what's going on.

- [ ] **Step 7: Commit any untracked report**

```bash
git add data/raw/arogya-yoga-school/ data/reports/arogya-yoga-school.json
git commit -m "test(scraper): smoke fixture for Arogya Yoga School happy path"
```

---

## Task 17: Previously-failing studio smoke test

**Files:**
- None (run-only)

- [ ] **Step 1: Pick one that used to fail**

`Hot Yoga Barcelona` — previously `overallContentScore: 0` with "No pages available for assessment."

- [ ] **Step 2: Fetch**

Run:
```bash
npm run scrape:fetch -- --studio "Hot Yoga Barcelona" --force
```
Expected: homepage scrape succeeds, discovery returns non-zero counts, raw written.

- [ ] **Step 3: Analyze**

Run:
```bash
npm run scrape:analyze -- --studio "Hot Yoga Barcelona" --force
```

- [ ] **Step 4: Check the report**

Run:
```bash
jq '{score: .contentAssessment.overallScore, summary: .contentAssessment.summary}' data/reports/hot-yoga-barcelona.json
```
Expected: `score > 0`, summary is substantive, not the failure sentinel.

Compare against the old version:
```bash
jq '{score: .contentAssessment.overallScore, summary: .contentAssessment.summary}' data/reports-v1/hot-yoga-barcelona.json
```

- [ ] **Step 5: Commit**

```bash
git add data/raw/hot-yoga-barcelona/ data/reports/hot-yoga-barcelona.json
git commit -m "test(scraper): smoke fixture for Hot Yoga Barcelona previously-failing case"
```

---

## Task 18: Cache, force, and override verification

**Files:**
- None (run-only)

- [ ] **Step 1: Cache hit (no force)**

Run:
```bash
npm run scrape:fetch -- --studio "Arogya Yoga School"
```
Expected: `═══ fetch: Arogya Yoga School — cached, skipping ═══`. No Firecrawl credits consumed.

- [ ] **Step 2: Analyze-only re-run is free of network**

Note the credit count:
```bash
firecrawl --status 2>&1 | grep Credits
```

Run:
```bash
npm run scrape:analyze -- --studio "Arogya Yoga School" --force
```

Re-check credits — delta should be 0.
```bash
firecrawl --status 2>&1 | grep Credits
```

- [ ] **Step 3: Override path**

In `scripts/scraper/websites-data.ts`, pick Arogya's entry and uncomment the `overrides` block (remove `//`). Save.

Run:
```bash
npm run scrape:fetch -- --studio "Arogya Yoga School" --force
```
Inspect:
```bash
jq '.pages[] | select(.category != "home") | .source' data/raw/arogya-yoga-school/pages.json
```
Expected: every non-home record shows `"override"` (no `homepage-links`, no `map:*`).

- [ ] **Step 4: Re-comment the overrides**

Revert the edit in `websites-data.ts` so the file matches its committed state. Run `git diff scripts/scraper/websites-data.ts` — should be empty.

- [ ] **Step 5: Legacy fetcher**

Temporarily uncomment the Arogya `overrides` again (legacy requires them). Run:
```bash
SCRAPER_FETCHER=legacy npm run scrape:fetch -- --studio "Arogya Yoga School" --force
```
Expected: `═══ fetch (legacy): Arogya Yoga School`, then `✓ Wrote data/raw/arogya-yoga-school/ legacy (N/N ok)`. Credit delta in `firecrawl --status` should be 0.

Re-comment the overrides and verify `git diff scripts/scraper/websites-data.ts` is empty.

- [ ] **Step 6: Commit (nothing to commit)**

This task makes no source changes. Just verify `git status` is clean except for data files produced by re-runs, which are intentional.

---

## Task 19: Batch run (5 studios)

**Files:**
- None (run-only)

- [ ] **Step 1: Note credit baseline**

```bash
firecrawl --status 2>&1 | grep Credits
```
Record the number.

- [ ] **Step 2: Run five**

```bash
npm run scrape -- --limit 5 --force
```
Expected: 5 studios fetch + analyze successfully, index rebuilt.

- [ ] **Step 3: Check credit usage**

```bash
firecrawl --status 2>&1 | grep Credits
```
Expected delta: roughly 25–35 credits (5 studios × 5–7 credits each). If substantially higher, investigate per-studio credit blowouts before Task 20.

- [ ] **Step 4: Verify index**

```bash
jq '.studios | map(.overallContentScore) | {zero: map(select(. == 0)) | length, nonzero: map(select(. > 0)) | length}' data/index.json
```
Expected: the 5 scraped studios all have nonzero scores (or the zero count is no higher than previous — credit for sites that are legitimately sparse).

- [ ] **Step 5: Commit**

```bash
git add data/raw/ data/reports/ data/index.json
git commit -m "test(scraper): batch smoke run over 5 studios"
```

---

## Task 20: Full run + acceptance

**Files:**
- None (run-only)

- [ ] **Step 1: Credit check**

```bash
firecrawl --status 2>&1 | grep Credits
```
Expected: ≥ 300 credits remaining (leaves headroom for the ~200–270 credit full run).

- [ ] **Step 2: Full run**

```bash
npm run scrape -- --force
```
Expected: all studios processed, errors logged per-studio but not fatal to the run, final "Wrote index with N studios" line where N matches the number of entries in `websites-data.ts`.

- [ ] **Step 3: Verify acceptance**

Acceptance criterion (from spec): studios that previously had `overallContentScore: 0` now have `> 0`.

Run:
```bash
jq -r '.studios[] | "\(.overallContentScore)\t\(.slug)"' data/reports-v1/... 2>/dev/null | sort -n | head -20
```
(Since reports-v1 is per-studio JSONs, not an index, compute the old zero list from the archive directly):
```bash
for f in data/reports-v1/*.json; do
  score=$(jq '.contentAssessment.overallScore' "$f")
  if [ "$score" = "0" ]; then basename "$f" .json; fi
done > /tmp/old-zeros.txt
wc -l /tmp/old-zeros.txt
```

Then for each of those slugs, check the new report:
```bash
while read slug; do
  new=$(jq '.contentAssessment.overallScore' "data/reports/${slug}.json" 2>/dev/null)
  echo "$slug: $new"
done < /tmp/old-zeros.txt
```
Expected: every line shows a score `> 0`. If any still show `0`, investigate that studio specifically.

- [ ] **Step 4: Final type check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 5: Commit the data snapshot**

```bash
git add data/raw/ data/reports/ data/index.json
git commit -m "data: full firecrawl-backed scrape pass"
```

- [ ] **Step 6: Tag the pre-firecrawl commit**

Find the commit just before Task 3 (first real refactor):
```bash
git log --oneline | head -25
```
Identify the commit SHA immediately before the types change.

```bash
git tag pre-firecrawl <that-sha>
```
This gives a clean rollback point: `git reset --hard pre-firecrawl` if the new pipeline regresses. **Do not push the tag unless asked.**

---

## Rollback

If the new pipeline produces worse results than `data/reports-v1/` on a significant number of studios:

1. `git reset --hard pre-firecrawl` to restore the old scraper code.
2. Delete `data/raw/` and `data/reports/`.
3. Move files back from `data/reports-v1/` to `data/`.
4. Open an issue describing which studios regressed and why.

The legacy fetcher (Task 8, `fetch-legacy.ts`) is an in-pipeline fallback, not a full rollback. It still uses the new types, raw layout, and analyze stage. It is only useful for running the new pipeline without burning Firecrawl credits.
