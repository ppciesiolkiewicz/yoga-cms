import type { LighthouseScores } from "../types"

export async function runLighthouse(url: string): Promise<LighthouseScores> {
  try {
    console.log(`  Running Lighthouse: ${url}`)
    const lighthouse = (await import("lighthouse")).default
    const { chromium } = await import("playwright")

    const chromePath = chromium.executablePath()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const flags: any = {
      output: "json",
      onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
      chromePath,
      chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
    }
    const result = await lighthouse(url, flags)

    if (!result?.lhr?.categories) {
      console.warn("  ⚠ Lighthouse returned no categories")
      return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
    }

    const cats = result.lhr.categories
    return {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
      bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
    }
  } catch (error) {
    console.warn(`  ⚠ Lighthouse failed for ${url}: ${error}`)
    return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
  }
}
