# Firecrawl scraper restructure

**Date:** 2026-04-11
**Status:** Approved, ready for implementation plan

## Problem

Content assessment fails silently for ~20 of 39 studios. `data/index.json` shows `overallContentScore: 0` and the report summary reads "No pages available for assessment."

Root cause chain:

1. Failing studios are all marked `scrapeMode: "browser"` in `scripts/scraper/websites-data.ts` — Wix, Squarespace, and other JS-rendered SPAs.
2. Playwright renders the page, but `pipeline/fetch.ts#extractText` strips `nav/footer/iframe/script/style` then calls `$("body").text()`. On SPA shells this often returns near-empty text.
3. The 8k character cap in `extractText` plus the 6k slice in each `data-extract` call compounds the loss.
4. `content-assess` receives empty strings and returns the "No pages available" sentinel.
5. Nothing is cached. Every run re-fetches and re-pays Claude tokens, so iterating on the rubric is expensive.

## Goals

- Replace cheerio + Playwright HTML fetching with Firecrawl markdown scraping.
- Separate raw fetched content from derived reports so assessment and extraction can be re-run without hitting the network.
- Simplify `websites-data.ts` by auto-discovering drop-in, training, retreat, and contact URLs from homepage links, with manual overrides as an escape hatch.
- Stay within the 500-credit Firecrawl budget for a full pass.
- Keep the existing opinionated assessment rubric (progressive disclosure, red flags, conversion rules) powered by the Claude SDK.

## Non-goals

- Replacing the Claude-based assessment or extraction logic. Firecrawl's agent / extract endpoints are not opinionated enough for the rubric.
- Per-page Lighthouse scores. Homepage-only Lighthouse stays.
- Browser interaction via Firecrawl `/interact`. Not needed — URLs are known or discoverable.

## Architecture

The pipeline splits into two stages. Fetch owns the network and credits; analyze is fully offline and cheap to re-run.

```
Stage A: FETCH                 Stage B: ANALYZE
websites-data.ts               data/raw/<slug>/
       ↓                              ↓
   Firecrawl SDK              content-assess
       ↓                       data-extract
data/raw/<slug>/                      ↓
  *.md                         data/reports/<slug>.json
  pages.json                          ↓
  lighthouse.json              data/index.json
```

The `scrapeMode` field is removed from `websites-data.ts`. Firecrawl handles both static and JS-rendered pages uniformly.

## Data layout

```
data/
  raw/
    hum-studio/
      pages.json
      lighthouse.json
      home.md
      hum-classes.md
      pricing.md
      humtrainings.md
      yin-ytt.md
      retreats.md
      contact-us.md
    hot-yoga-barcelona/
      ...
  reports/
    hum-studio.json        # StudioReport (same shape as today)
    ...
  reports-v1/              # one-shot archive of old data/*.json
    hum-studio.json
    ...
  index.json               # studio index (unchanged)
```

Filenames are the last URL path segment, slugified, with collision suffixes if needed. The homepage is always `home.md`.

### pages.json

One file per studio. It is the run record — reproducible, auditable, and the source for the analyze stage.

```json
{
  "studioName": "Hum Studio",
  "website": "https://www.humstudio.com.au",
  "fetchedAt": "2026-04-11T12:00:00Z",
  "pages": [
    {
      "url": "https://www.humstudio.com.au/hum-classes",
      "file": "hum-classes.md",
      "category": "dropIn",
      "source": "homepage-links",
      "status": "ok",
      "fetchedAt": "2026-04-11T12:00:00Z",
      "bytes": 4821
    },
    {
      "url": "https://www.humstudio.com.au/pricing",
      "file": "pricing.md",
      "category": "dropIn",
      "source": "homepage-links",
      "status": "failed",
      "error": "HTTP 403"
    }
  ]
}
```

`source` is per-page and may be `"override" | "homepage-links" | "map:<query>"`. This reveals drift over time — if a studio starts showing `map` sources for categories that used to be `homepage-links`, the site navigation changed.

## Fetch stage

`pipeline/fetch.ts` is rewritten around the Firecrawl SDK.

```ts
import FirecrawlApp from "@mendable/firecrawl-js"

const fc = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY })

async function fetchStudio(entry: StudioEntry, opts: FetchOpts) {
  if (!opts.force && isFresh(slug, opts.maxAgeDays)) return loadRaw(slug)

  const home = await fc.scrapeUrl(entry.website, {
    formats: ["markdown", "links"],
    onlyMainContent: true,
    waitFor: 1500,
  })

  const urls = entry.overrides
    ?? await classifyLinks(home.links, entry.studioName)

  // Fallback: if any category is empty after classification, call
  // fc.mapUrl(entry.website, { search: "teacher training" }) for just
  // that category.

  const pages = await scrapeAll(dedupe(urls))
  const lighthouse = await runLighthouse(entry.website)

  writeRaw(slug, { home, pages, lighthouse, urls })
}
```

### URL discovery

The default path avoids Firecrawl `map` entirely. Credits are spent only on scrapes.

1. Scrape homepage — needed anyway for navigation extraction and tech detection. Returns markdown and the full link list in one call.
2. Classify homepage links with one Claude call. Given link labels and hrefs plus the studio name, classify each into `dropIn`, `training`, `retreat`, `contact`, or `other`. Cap at ~3 per category.
3. If any category is empty, call `fc.mapUrl(website, { search: "<category query>" })` as a fallback for only that category. Skippable with `--skip-map-fallback`.
4. Dedupe and scrape the resulting URL set.

### websites-data.ts shape

```ts
{
  studioName: "Hum Studio",
  city: "Melbourne",
  website: "https://www.humstudio.com.au",
  // overrides?: {
  //   dropIns: ["https://www.humstudio.com.au/hum-classes", "..."],
  //   trainings: ["..."],
  //   retreats: ["..."],
  //   contact: "...",
  // },
}
```

Every existing hand-curated URL list is moved into a commented-out `overrides` block. Overrides bypass classification entirely and are the escape hatch for studios where auto-discovery misfires. Flipping on `overrides` is a one-line edit and forces a deterministic URL set.

### Credit budget

Per studio, typical case:

- 1 homepage scrape
- 0 map calls (homepage links usually cover everything)
- 4–6 page scrapes

That is 5–7 credits per studio. For 39 studios, a full cold run is ~200–270 credits — half the 500 budget. Subsequent runs hit the raw cache and cost nothing unless `--force` or TTL expiry.

### Credit guard

Before the first fetch, call `fc.checkCredits()` (or the equivalent SDK check). If remaining credits are below a threshold (default 50), abort with a clear error and the remaining count.

### Error handling

- Per-URL scrape failure → `status: "failed"` with error in `pages.json`, other pages proceed, studio continues.
- Homepage scrape failure → studio is skipped, error logged, no raw written, analyze stage does not see the studio.
- Claude classify failure → fallback to a keyword heuristic over homepage links (`schedule`, `class`, `training`, `retreat`, `contact`).
- Firecrawl concurrency is 2 on the free tier. Scrape calls within a studio are bounded to that limit.

## Analyze stage

`pipeline/analyze.ts` is new and fully offline. It reads `data/raw/<slug>/` only and writes `data/reports/<slug>.json`.

```ts
async function analyzeStudio(slug: string): Promise<StudioReport> {
  const raw = loadRaw(slug)

  const byCategory = groupByCategory(raw.pages)
  const navigation = extractNavFromHomepage(raw.homepage.links)

  const tech = await detectTech(raw.website, raw.homepage.markdown)
  const lighthouse = raw.lighthouse   // cached from fetch

  const contentAssessment = await assessContent(
    studioName,
    byCategory.dropIn,
    byCategory.training,
    byCategory.retreat,
  )

  const [dropInClasses, trainings, retreats, contact] = await Promise.all([
    extractDropInClasses(byCategory.dropIn, studioName),
    extractTrainings(byCategory.training, studioName),
    extractRetreats(byCategory.retreat, studioName),
    extractContactInfo([...byCategory.contact, raw.homepage], studioName),
  ])

  return buildReport(...)
}
```

### Type changes

```ts
// types.ts
interface FetchedPage {
  url: string
  markdown: string
  category: "dropIn" | "training" | "retreat" | "contact" | "home"
}
```

The `html` and `text` fields are removed. Consumers in `content-assess.ts` and `data-extract.ts` now read `markdown`.

### Prompt updates

- Assessment prompt is unchanged. The rubric (progressive disclosure, red flags, conversion rules) stays exactly as it is. It receives much cleaner input, which is the whole point.
- Extraction prompts drop the `text.slice(0, 6000)` cruft. Per-page markdown cap is lifted to ~12k characters.

### Staleness rule

A report is stale when:

```
now - report.scrapedAt > --update-older-than-days N
  OR
raw.fetchedAt > report.scrapedAt
```

The second clause ensures a new fetch always triggers re-analysis even if the TTL has not expired.

## Commands

```
npm run scrape               # fetch stale + analyze stale, all studios
npm run scrape:fetch         # fetch stage only
npm run scrape:analyze       # analyze stage only
npm run scrape:studio "Hum"  # single studio, full pipeline
```

### Flags

All stages:

- `--studio <name>` — filter by studio name
- `--city <name>` — filter by city
- `--limit N` — cap number of studios
- `--update-older-than-days N` — TTL (default 999)
- `--force` — bypass cache

Fetch only:

- `--skip-map-fallback` — homepage links only, never call `fc.mapUrl`

## Migration

One-shot archive rather than in-place migration.

```
data/*.json         → data/reports-v1/*.json   (archive, kept for quality diff)
data/reports/       → populated fresh by the new pipeline
data/raw/           → populated fresh by the new pipeline
data/index.json     → regenerated
```

`scripts/archive-v1.mjs`:

- moves `data/*.json` → `data/reports-v1/*.json`, skipping `index.json`
- idempotent
- run manually once, then deleted

No backwards-compatibility code lives in the main pipeline. The new shapes are the only shapes.

The first full run after archiving burns ~200–270 credits to rebuild raw + reports from scratch. This is within budget.

## Testing

No unit test framework is present in the repo. Testing is a manual smoke plan run against a single studio first, then a small batch, then the full set.

1. **Migration** — run `scripts/archive-v1.mjs`, confirm `data/reports-v1/*.json` populated and no `data/*.json` left except `index.json`.
2. **Credit check** — `firecrawl --status` ≥ 50 credits before the run.
3. **Single-studio happy path** — `npm run scrape:studio "Hum Studio"`:
   - `data/raw/hum-studio/pages.json` exists with ≥ 3 pages, all `status: "ok"`.
   - `data/raw/hum-studio/*.md` files are non-empty.
   - `data/raw/hum-studio/lighthouse.json` populated.
   - `data/reports/hum-studio.json` has `contentAssessment.overallScore > 0` and non-empty `dropInClasses` / `trainings` / `retreats`.
4. **Previously-failing studio** — repeat for one of `hot-yoga-barcelona`, `sivananda-yoga-berlin`, `hum-studio`, `move-yoga`. Confirm assessment no longer returns "No pages available for assessment."
5. **Analyze-only re-run** — `npm run scrape:analyze --studio "Hum"` with raw present. Expect 0 Firecrawl calls (credit delta = 0) and a fresh report.
6. **Cache hit** — re-run `scrape:fetch --studio "Hum"`. Expect "cached, skipping" log and 0 credits consumed.
7. **Force refetch** — `scrape:fetch --studio "Hum" --force`. Expect credits to decrement.
8. **Override path** — uncomment an `overrides` block in `websites-data.ts`, re-run fetch for that studio. Expect `source: "override"` in the resulting `pages.json`.
9. **Full run** — `npm run scrape --limit 5`. Five studios scraped, index rebuilt, credit usage logged at start and end.
10. **Type check** — `tsc --noEmit` is clean.

### Acceptance

The 20 studios currently showing `overallContentScore: 0` in `data/index.json` have `overallContentScore > 0` after a full run. The quality diff is verifiable by comparing `data/reports-v1/` against `data/reports/`.
