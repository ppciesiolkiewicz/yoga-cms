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
  let mainStatus: number | null = null
  let mainResponseUrl: string | null = null
  const pending = new Map<string, { url: string; resourceType: string; startedAt: number }>()
  try {
    const browser = await getBrowser()
    page = await browser.newPage()

    page.on("request", (req) => {
      pending.set(req.url(), { url: req.url(), resourceType: req.resourceType(), startedAt: Date.now() })
    })
    page.on("requestfinished", (req) => pending.delete(req.url()))
    page.on("requestfailed", (req) => pending.delete(req.url()))
    page.on("response", (res) => {
      if (mainStatus === null && res.request().resourceType() === "document" && res.request().frame() === page?.mainFrame()) {
        mainStatus = res.status()
        mainResponseUrl = res.url()
      }
    })

    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 })
    if (response && mainStatus === null) {
      mainStatus = response.status()
      mainResponseUrl = response.url()
    }

    try {
      await page.waitForLoadState("networkidle", { timeout: 10_000 })
    } catch {
      // late assets still loading is fine — DOM is ready
    }

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
    const message = error instanceof Error ? error.message : String(error)
    const diag: string[] = []
    if (mainStatus !== null) diag.push(`status=${mainStatus}`)
    if (mainResponseUrl && mainResponseUrl !== url) diag.push(`finalUrl=${mainResponseUrl}`)
    if (page) {
      try {
        const currentUrl = page.url()
        if (currentUrl && currentUrl !== url && currentUrl !== mainResponseUrl) {
          diag.push(`pageUrl=${currentUrl}`)
        }
        const readyState = await page.evaluate(() => document.readyState).catch(() => null)
        if (readyState) diag.push(`readyState=${readyState}`)
        const title = await page.title().catch(() => "")
        if (title) diag.push(`title=${JSON.stringify(title.slice(0, 80))}`)
      } catch {
        // page may be closed already
      }
    }
    if (pending.size > 0) {
      diag.push(`pending=${pending.size}`)
      const sample = Array.from(pending.values())
        .sort((a, b) => a.startedAt - b.startedAt)
        .slice(0, 5)
        .map((r) => `${r.resourceType}:${r.url}`)
      diag.push(`pendingSample=${JSON.stringify(sample)}`)
    }
    const detail = diag.length ? ` [${diag.join(" ")}]` : ""
    return { error: `${message}${detail}` }
  } finally {
    await page?.close()
  }
}
