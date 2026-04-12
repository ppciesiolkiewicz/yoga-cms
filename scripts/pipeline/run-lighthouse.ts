import type { Repo } from "../db/repo"
import type { Request, Site, Category } from "../core/types"

interface LighthouseScores {
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

async function runLighthouse(url: string): Promise<LighthouseScores> {
  try {
    const chromeLauncher = await import("chrome-launcher")
    const { chromium } = await import("playwright")
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    })
    try {
      const lighthouse = (await import("lighthouse")).default
      const result = await lighthouse(url, {
        output: "json",
        onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
        port: chrome.port,
      })
      if (!result?.lhr?.categories) {
        return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
      }
      const cats = result.lhr.categories
      return {
        performance: Math.round((cats.performance?.score ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
        seo: Math.round((cats.seo?.score ?? 0) * 100),
        bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      }
    } finally {
      await chrome.kill()
    }
  } catch (err) {
    console.warn(`  ⚠ lighthouse failed for ${url}: ${err}`)
    return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
  }
}

export async function runLighthouseForCategory(repo: Repo, request: Request, site: Site, category: Category): Promise<void> {
  // Load category's classified URLs; use first as representative page
  const classify = await repo.getJson<{ byCategory: Record<string, string[]> }>({
    requestId: request.id, siteId: site.id, stage: "classify-nav", name: "classify-nav.json",
  })
  const urls = classify.byCategory[category.id] ?? []
  const targetUrl = urls[0] ?? site.url

  const scores = await runLighthouse(targetUrl)
  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "run-lighthouse", name: `${category.id}.json` },
    { url: targetUrl, ...scores },
  )
}
