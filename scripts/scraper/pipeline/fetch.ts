import * as cheerio from "cheerio"
import type { ScrapableUrl, NavLink, FetchedPage } from "../types"

export async function fetchPageHtml(url: string): Promise<string | null> {
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

export async function fetchPageHtmlBrowser(url: string): Promise<string | null> {
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

export function extractText(html: string): string {
  const $ = cheerio.load(html)
  $("script, style, nav, footer, iframe, noscript").remove()
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000)
}

export function extractNavLinks(html: string, baseUrl: string): NavLink[] {
  const $ = cheerio.load(html)
  const links: NavLink[] = []
  const seen = new Set<string>()

  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href")
    const label = $(el).text().trim()
    if (!href || !label || label.length > 100) return

    let fullUrl: string
    try {
      fullUrl = new URL(href, baseUrl).href
    } catch {
      return
    }

    if (seen.has(fullUrl)) return
    seen.add(fullUrl)

    try {
      const base = new URL(baseUrl)
      const link = new URL(fullUrl)
      if (link.hostname !== base.hostname) return
    } catch {
      return
    }

    links.push({ label, href: fullUrl })
  })

  return links
}

export async function fetchStudioPages(
  homepageUrl: string,
  pages: ScrapableUrl[]
): Promise<{ navigation: NavLink[]; pages: FetchedPage[] }> {
  const homepageHtml = await fetchPageHtml(homepageUrl)
  const navigation = homepageHtml ? extractNavLinks(homepageHtml, homepageUrl) : []

  const fetched: FetchedPage[] = []
  for (const page of pages) {
    const html = page.scrapeMode === "browser"
      ? await fetchPageHtmlBrowser(page.url)
      : await fetchPageHtml(page.url)

    if (html) {
      fetched.push({ url: page.url, html, text: extractText(html) })
    }
  }

  return { navigation, pages: fetched }
}
