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

  try {
    result = await scrapeUrl(url, opts)
  } catch (err) {
    console.error(`  ✗ [firecrawl-fallback] threw for ${url}: ${err instanceof Error ? err.message : err}`)
    return { error: String(err) }
  }

  if ("error" in result) {
    console.error(`  ✗ [firecrawl-fallback] also failed for ${url}: ${result.error}`)
  } else {
    console.log(`  ✓ [firecrawl-fallback] ${url}`)
  }

  return result
}

export type { ScrapeResult }
