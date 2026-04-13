import * as cheerio from "cheerio"
import TurndownService from "turndown"
import type { ScrapeResult } from "./firecrawl-client"

type Browser = import("playwright").Browser
type Page = import("playwright").Page

let _browser: Browser | null = null
let _cleanupRegistered = false

async function getBrowser(): Promise<Browser> {
  if (!_browser) {
    const { chromium } = await import("playwright")
    _browser = await chromium.launch({ headless: true })
    if (!_cleanupRegistered) {
      _cleanupRegistered = true
      const cleanup = () => {
        _browser?.close().catch(() => {})
        _browser = null
      }
      process.on("exit", cleanup)
      process.once("SIGINT", cleanup)
      process.once("SIGTERM", cleanup)
    }
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
