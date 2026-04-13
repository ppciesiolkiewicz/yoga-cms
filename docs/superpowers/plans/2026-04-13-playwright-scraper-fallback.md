# Playwright Scraper with Firecrawl Fallback — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright as the primary local scraper with automatic fallback to hosted Firecrawl, reducing API credit consumption to near-zero for most sites.

**Architecture:** A new `scraper.ts` facade tries Playwright first, falls back to Firecrawl on failure. A new `playwright-scraper.ts` manages a reusable browser instance and converts HTML→markdown via turndown. Consumers (`fetch-home.ts`, `fetch-pages.ts`) swap one import.

**Tech Stack:** Playwright (already installed), turndown (new), cheerio (already installed), vitest (test runner)

**Spec:** `docs/superpowers/specs/2026-04-13-playwright-scraper-fallback-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `scripts/pipeline/playwright-scraper.ts` | Create | Playwright browser management, HTML→markdown via turndown, link extraction via cheerio |
| `scripts/pipeline/scraper.ts` | Create | Unified `scrape()` facade with Playwright→Firecrawl fallback chain |
| `scripts/pipeline/playwright-scraper.test.ts` | Create | Unit tests for HTML→markdown conversion and link extraction |
| `scripts/pipeline/scraper.test.ts` | Create | Unit tests for fallback logic |
| `scripts/pipeline/fetch-home.ts` | Modify | Swap import from `firecrawl-client` to `scraper` |
| `scripts/pipeline/fetch-pages.ts` | Modify | Swap import from `firecrawl-client` to `scraper` |
| `package.json` | Modify | Add `turndown`, `@types/turndown` |

---

### Task 1: Install turndown dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install turndown and types**

```bash
npm install turndown && npm install -D @types/turndown
```

- [ ] **Step 2: Verify installation**

```bash
npm ls turndown
```

Expected: `turndown@x.x.x` listed under dependencies.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add turndown dependency for HTML-to-markdown conversion"
```

---

### Task 2: Create playwright-scraper.ts with tests

**Files:**
- Create: `scripts/pipeline/playwright-scraper.ts`
- Create: `scripts/pipeline/playwright-scraper.test.ts`

- [ ] **Step 1: Write failing tests for htmlToMarkdown and extractLinks helpers**

Create `scripts/pipeline/playwright-scraper.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { htmlToMarkdown, extractLinks } from "./playwright-scraper"

describe("htmlToMarkdown", () => {
  it("converts headings and paragraphs to markdown", () => {
    const html = "<html><body><h1>Title</h1><p>Hello <strong>world</strong></p></body></html>"
    const md = htmlToMarkdown(html, false)
    expect(md).toContain("# Title")
    expect(md).toContain("**world**")
  })

  it("strips script and style tags", () => {
    const html = "<html><body><script>alert(1)</script><style>.x{}</style><p>Keep me</p></body></html>"
    const md = htmlToMarkdown(html, false)
    expect(md).not.toContain("alert")
    expect(md).not.toContain(".x{}")
    expect(md).toContain("Keep me")
  })

  it("extracts only main content when onlyMainContent is true", () => {
    const html = `<html><body>
      <nav>Navigation</nav>
      <main><h1>Main Content</h1><p>Body text</p></main>
      <footer>Footer</footer>
    </body></html>`
    const md = htmlToMarkdown(html, true)
    expect(md).toContain("Main Content")
    expect(md).not.toContain("Navigation")
    expect(md).not.toContain("Footer")
  })

  it("falls back to body when no main/article element and onlyMainContent is true", () => {
    const html = "<html><body><h1>Title</h1><p>Text</p></body></html>"
    const md = htmlToMarkdown(html, true)
    expect(md).toContain("Title")
  })
})

describe("extractLinks", () => {
  it("extracts absolute href values", () => {
    const html = `<html><body>
      <a href="https://example.com/about">About</a>
      <a href="https://example.com/contact">Contact</a>
    </body></html>`
    const links = extractLinks(html)
    expect(links).toEqual(["https://example.com/about", "https://example.com/contact"])
  })

  it("skips fragment-only and javascript: links", () => {
    const html = `<html><body>
      <a href="#section">Jump</a>
      <a href="javascript:void(0)">Click</a>
      <a href="https://example.com">Real</a>
    </body></html>`
    const links = extractLinks(html)
    expect(links).toEqual(["https://example.com"])
  })

  it("deduplicates links", () => {
    const html = `<html><body>
      <a href="https://example.com">One</a>
      <a href="https://example.com">Two</a>
    </body></html>`
    const links = extractLinks(html)
    expect(links).toEqual(["https://example.com"])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run scripts/pipeline/playwright-scraper.test.ts
```

Expected: FAIL — module `./playwright-scraper` has no exports `htmlToMarkdown`, `extractLinks`.

- [ ] **Step 3: Implement playwright-scraper.ts**

Create `scripts/pipeline/playwright-scraper.ts`:

```typescript
import * as cheerio from "cheerio"
import TurndownService from "turndown"
import type { ScrapeResult } from "./firecrawl-client"

type Browser = import("playwright").Browser
type Page = import("playwright").Page

let _browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    const { chromium } = await import("playwright")
    _browser = await chromium.launch({ headless: true })
    const cleanup = () => {
      _browser?.close().catch(() => {})
      _browser = null
    }
    process.on("exit", cleanup)
    process.on("SIGINT", cleanup)
    process.on("SIGTERM", cleanup)
  }
  return _browser
}

export async function closeBrowser(): Promise<void> {
  if (_browser) {
    await _browser.close()
    _browser = null
  }
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
})
turndown.remove(["script", "style", "noscript", "iframe"])

export function htmlToMarkdown(html: string, onlyMainContent: boolean): string {
  if (onlyMainContent) {
    const $ = cheerio.load(html)
    const main = $("main").html() ?? $("article").html() ?? $("body").html() ?? html
    return turndown.turndown(main).trim()
  }
  return turndown.turndown(html).trim()
}

export function extractLinks(html: string): string[] {
  const $ = cheerio.load(html)
  const seen = new Set<string>()
  const links: string[] = []
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    if (href.startsWith("#") || href.startsWith("javascript:")) return
    if (!seen.has(href)) {
      seen.add(href)
      links.push(href)
    }
  })
  return links
}

export async function scrapeWithPlaywright(
  url: string,
  opts: { includeHtml?: boolean; includeRawHtml?: boolean; onlyMainContent?: boolean } = {},
): Promise<ScrapeResult | { error: string }> {
  let page: Page | null = null
  try {
    const browser = await getBrowser()
    page = await browser.newPage()
    await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 })
    const rawHtml = await page.content()
    const markdown = htmlToMarkdown(rawHtml, opts.onlyMainContent ?? true)
    const links = extractLinks(rawHtml)
    return {
      markdown,
      html: opts.includeHtml ? rawHtml : undefined,
      rawHtml: opts.includeRawHtml ? rawHtml : undefined,
      links,
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  } finally {
    await page?.close()
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run scripts/pipeline/playwright-scraper.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline/playwright-scraper.ts scripts/pipeline/playwright-scraper.test.ts
git commit -m "feat: add Playwright scraper with HTML-to-markdown via turndown"
```

---

### Task 3: Create scraper.ts facade with tests

**Files:**
- Create: `scripts/pipeline/scraper.ts`
- Create: `scripts/pipeline/scraper.test.ts`

- [ ] **Step 1: Write failing tests for scraper fallback logic**

Create `scripts/pipeline/scraper.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./playwright-scraper", () => ({
  scrapeWithPlaywright: vi.fn(),
}))

vi.mock("./firecrawl-client", () => ({
  scrapeUrl: vi.fn(),
}))

import { scrape } from "./scraper"
import { scrapeWithPlaywright } from "./playwright-scraper"
import { scrapeUrl } from "./firecrawl-client"

const mockPlaywright = vi.mocked(scrapeWithPlaywright)
const mockFirecrawl = vi.mocked(scrapeUrl)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("scrape", () => {
  const okResult = { markdown: "# Hello", links: ["https://example.com"] }

  it("returns Playwright result when it succeeds", async () => {
    mockPlaywright.mockResolvedValue(okResult)
    const result = await scrape("https://example.com")
    expect(result).toEqual(okResult)
    expect(mockFirecrawl).not.toHaveBeenCalled()
  })

  it("falls back to Firecrawl when Playwright returns error", async () => {
    mockPlaywright.mockResolvedValue({ error: "timeout" })
    mockFirecrawl.mockResolvedValue(okResult)
    const result = await scrape("https://example.com")
    expect(result).toEqual(okResult)
    expect(mockFirecrawl).toHaveBeenCalledWith("https://example.com", {})
  })

  it("falls back to Firecrawl when Playwright throws", async () => {
    mockPlaywright.mockRejectedValue(new Error("browser crash"))
    mockFirecrawl.mockResolvedValue(okResult)
    const result = await scrape("https://example.com")
    expect(result).toEqual(okResult)
  })

  it("returns error when both scrapers fail", async () => {
    mockPlaywright.mockResolvedValue({ error: "timeout" })
    mockFirecrawl.mockResolvedValue({ error: "rate limited" })
    const result = await scrape("https://example.com")
    expect("error" in result).toBe(true)
  })

  it("passes opts through to both scrapers", async () => {
    const opts = { includeRawHtml: true, onlyMainContent: false }
    mockPlaywright.mockResolvedValue({ error: "fail" })
    mockFirecrawl.mockResolvedValue(okResult)
    await scrape("https://example.com", opts)
    expect(mockPlaywright).toHaveBeenCalledWith("https://example.com", opts)
    expect(mockFirecrawl).toHaveBeenCalledWith("https://example.com", opts)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run scripts/pipeline/scraper.test.ts
```

Expected: FAIL — module `./scraper` has no export `scrape`.

- [ ] **Step 3: Implement scraper.ts**

Create `scripts/pipeline/scraper.ts`:

```typescript
import type { ScrapeResult } from "./firecrawl-client"
import { scrapeWithPlaywright } from "./playwright-scraper"
import { scrapeUrl } from "./firecrawl-client"

type ScrapeOpts = { includeHtml?: boolean; includeRawHtml?: boolean; onlyMainContent?: boolean }

export async function scrape(
  url: string,
  opts: ScrapeOpts = {},
): Promise<ScrapeResult | { error: string }> {
  let result: ScrapeResult | { error: string }

  try {
    result = await scrapeWithPlaywright(url, opts)
  } catch (err) {
    console.warn(`  ⚠ [playwright] threw for ${url}: ${err instanceof Error ? err.message : err}`)
    result = { error: String(err) }
  }

  if (!("error" in result)) {
    console.log(`  ✓ [playwright] ${url}`)
    return result
  }

  console.warn(`  ⚠ [playwright] failed for ${url}: ${result.error} — falling back to Firecrawl`)
  result = await scrapeUrl(url, opts)

  if ("error" in result) {
    console.error(`  ✗ [firecrawl-fallback] also failed for ${url}: ${result.error}`)
  } else {
    console.log(`  ✓ [firecrawl-fallback] ${url}`)
  }

  return result
}

export type { ScrapeResult }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run scripts/pipeline/scraper.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline/scraper.ts scripts/pipeline/scraper.test.ts
git commit -m "feat: add scraper facade with Playwright-first, Firecrawl-fallback chain"
```

---

### Task 4: Wire fetch-home.ts to use scraper facade

**Files:**
- Modify: `scripts/pipeline/fetch-home.ts`

- [ ] **Step 1: Update imports and remove ensureCredits call**

In `scripts/pipeline/fetch-home.ts`, replace the imports and update the function body:

Replace:
```typescript
import { scrapeUrl, ensureCredits, fetchResponseHeaders } from "./firecrawl-client"
```
With:
```typescript
import { scrape } from "./scraper"
import { fetchResponseHeaders } from "./firecrawl-client"
```

Replace the body of `fetchHome` (lines 13–35):
```typescript
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
```

- [ ] **Step 2: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all existing tests to check for regressions**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/pipeline/fetch-home.ts
git commit -m "feat: wire fetch-home to scraper facade (Playwright-first)"
```

---

### Task 5: Wire fetch-pages.ts to use scraper facade

**Files:**
- Modify: `scripts/pipeline/fetch-pages.ts`

- [ ] **Step 1: Update import**

In `scripts/pipeline/fetch-pages.ts`, replace:
```typescript
import { scrapeUrl } from "./firecrawl-client"
```
With:
```typescript
import { scrape } from "./scraper"
```

And replace the `scrapeUrl` call on line 40:
```typescript
      const res = await scrapeUrl(url)
```
With:
```typescript
      const res = await scrape(url)
```

- [ ] **Step 2: Verify the project compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/pipeline/fetch-pages.ts
git commit -m "feat: wire fetch-pages to scraper facade (Playwright-first)"
```

---

### Task 6: Smoke test with a real site

- [ ] **Step 1: Run the pipeline against a small input**

Pick a small input file and run fetch-home + parse-links to verify Playwright scrapes successfully:

```bash
npm run analyze -- --input data/inputs/locksmiths.json --stages fetch-home,parse-links
```

Expected: Console output shows `✓ [playwright]` for scraped URLs. Artifacts written to `data/db/`.

- [ ] **Step 2: Verify artifacts**

Check that `home.html` contains real HTML and `home.md` contains proper markdown (headings, links, not just flat text):

```bash
head -20 data/db/requests/*/sites/*/fetch-home/home.md
```

Expected: Markdown with `#` headings, `[link text](url)` links, `**bold**` formatting.

- [ ] **Step 3: Commit the plan as done**

```bash
git add docs/superpowers/specs/2026-04-13-playwright-scraper-fallback-design.md docs/superpowers/plans/2026-04-13-playwright-scraper-fallback.md
git commit -m "docs: add playwright scraper fallback design spec and implementation plan"
```
