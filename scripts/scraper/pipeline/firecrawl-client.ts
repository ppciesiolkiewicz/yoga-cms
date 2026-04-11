// scripts/scraper/pipeline/firecrawl-client.ts
import Firecrawl from "@mendable/firecrawl-js"

let _fc: Firecrawl | null = null

function getClient(): Firecrawl {
  if (!_fc) {
    const key = process.env.FIRECRAWL_API_KEY
    if (!key) throw new Error("FIRECRAWL_API_KEY is required for Firecrawl fetcher")
    _fc = new Firecrawl({ apiKey: key })
  }
  return _fc
}

export interface ScrapeResult {
  markdown: string
  html?: string
  rawHtml?: string
  links: string[]
}

export async function scrapeUrl(
  url: string,
  opts: { includeHtml?: boolean; includeRawHtml?: boolean; onlyMainContent?: boolean } = {},
): Promise<ScrapeResult | { error: string }> {
  const formats: Array<"markdown" | "html" | "rawHtml" | "links"> = ["markdown", "links"]
  if (opts.includeHtml) formats.push("html")
  if (opts.includeRawHtml) formats.push("rawHtml")
  try {
    const doc = await getClient().scrape(url, {
      formats,
      onlyMainContent: opts.onlyMainContent ?? true,
      waitFor: 1500,
    })
    return {
      markdown: doc.markdown ?? "",
      html: opts.includeHtml ? (doc.html ?? "") : undefined,
      rawHtml: opts.includeRawHtml ? (doc.rawHtml ?? "") : undefined,
      links: doc.links ?? [],
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
    const data = await getClient().map(website, { search, limit: 20 })
    return (data.links ?? []).map(l => l.url).filter((u): u is string => typeof u === "string")
  } catch {
    return []
  }
}

const CREDIT_FLOOR = 50

export async function ensureCredits(): Promise<{ ok: boolean; remaining: number }> {
  try {
    const usage = await getClient().getCreditUsage()
    const remaining = usage.remainingCredits ?? -1
    return { ok: remaining < 0 || remaining >= CREDIT_FLOOR, remaining }
  } catch {
    return { ok: true, remaining: -1 }
  }
}
