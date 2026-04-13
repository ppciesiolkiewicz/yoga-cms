# Playwright Scraper with Firecrawl Fallback

**Date:** 2026-04-13
**Goal:** Reduce Firecrawl API credit consumption by using Playwright as the primary local scraper, falling back to hosted Firecrawl when Playwright fails.

## Motivation

The pipeline currently uses hosted Firecrawl for all scraping (fetch-home, fetch-pages). Every page costs credits. For an MVP focused on cost reduction, a local Playwright scraper handles most sites for free, with Firecrawl as a reliable fallback for JS-heavy or anti-bot-protected pages.

Playwright is already a dependency (used for Lighthouse audits).

## Architecture

A new unified `scraper.ts` module provides a single `scrape()` function. Internally it runs a fallback chain:

```
Playwright (local, free) → Firecrawl (hosted API, costs credits)
```

Both backends return the existing `ScrapeResult` type from `firecrawl-client.ts`. Consumers (`fetch-home.ts`, `fetch-pages.ts`) import from `scraper.ts` instead of `firecrawl-client.ts` directly. They don't know which backend fulfilled the request.

## New Files

### `scripts/pipeline/playwright-scraper.ts`

- Launches headless Chromium via Playwright
- Navigates to URL with `waitUntil: "networkidle"`, 30s timeout
- Extracts `page.content()` as rawHtml
- Uses cheerio to extract links from rawHtml
- Uses `turndown` to convert rawHtml to markdown
- Returns `ScrapeResult { markdown, rawHtml?, html?, links }`
- Manages a single browser instance, reused across all calls within a pipeline run
- Closes browser on process exit

### `scripts/pipeline/scraper.ts`

- Exports `scrape(url, opts)` with the same signature as `firecrawl-client.scrapeUrl()`
- Tries `playwright-scraper.scrapeWithPlaywright()` first
- On any error, logs a warning and falls back to `firecrawl-client.scrapeUrl()`
- If both fail, returns `{ error: string }` (same contract as today)
- Logs which backend was used: `[playwright]` or `[firecrawl-fallback]`

## Modified Files

### `fetch-home.ts`

- Import `scrape` from `./scraper` instead of `scrapeUrl` from `./firecrawl-client`
- `ensureCredits()` call removed from the top — credit check is irrelevant when Playwright succeeds. If Firecrawl fallback is needed, `scraper.ts` does not gate on credits (the fallback should attempt regardless).
- `fetchResponseHeaders()` import stays (it uses native fetch, not Firecrawl)
- Everything else unchanged — still stores `home.html`, `home.md`, `home.headers.json`, `home.meta.json`

### `fetch-pages.ts`

- Import `scrape` from `./scraper` instead of `scrapeUrl` from `./firecrawl-client`
- No other changes — worker loop, concurrency, page records all stay the same

### `package.json`

- Add `turndown` dependency
- Add `@types/turndown` dev dependency

## Unchanged Files

- `firecrawl-client.ts` — untouched, becomes one backend behind the abstraction
- `detect-tech.ts` — reads `home.html` artifact; Playwright provides rawHtml just like Firecrawl
- All downstream stages — consume markdown artifacts, scraper-agnostic
- `parse-links.ts` — reads `home.meta.json` which still contains links array

## Error Handling

Fallback behavior in `scraper.scrape()`:

```
try playwright
  success → return result
  error → log warning, try firecrawl
    success → return result
    error → return { error: string }
```

Same error contract as today. `fetch-home` throws on error. `fetch-pages` records failed status. No retry logic — if both fail, it's a real failure.

## Playwright Configuration

- `waitUntil: "networkidle"` with 30s timeout
- Headless mode
- Single browser instance per pipeline run, reused across all `scrape()` calls
- `onlyMainContent` option: when true, turndown processes only the `<main>` or `<article>` element; falls back to `<body>` if neither exists
- Links extracted via cheerio from rawHtml (same approach as `parse-links.ts`)

## New Dependency

- `turndown` (~30KB) — HTML to markdown conversion, produces real markdown with headers, links, lists, bold/italic (vs the existing `htmlToMarkdownLike` which strips all structure to flat text)
- `@types/turndown` — TypeScript types (dev dependency)
