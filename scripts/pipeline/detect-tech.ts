import type { Repo } from "../db/repo"
import type { Request, Site, Category } from "../core/types"

const COST_MAP: Record<string, { item: string; min: number; max: number }> = {
  "WordPress": { item: "WordPress hosting", min: 5, max: 50 },
  "Wix": { item: "Wix subscription", min: 17, max: 45 },
  "Squarespace": { item: "Squarespace subscription", min: 16, max: 65 },
  "Shopify": { item: "Shopify subscription", min: 29, max: 299 },
  "Divi": { item: "Divi theme license", min: 7, max: 10 },
  "Elementor": { item: "Elementor Pro", min: 5, max: 10 },
  "WooCommerce": { item: "WooCommerce hosting/plugins", min: 10, max: 50 },
  "Mailchimp": { item: "Mailchimp", min: 0, max: 30 },
  "Google Analytics": { item: "Google Analytics", min: 0, max: 0 },
  "Cloudflare": { item: "Cloudflare", min: 0, max: 20 },
}

interface DetectedTechnology {
  name: string
  categories: string[]
  version?: string
  confidence?: number
}

interface RawDetection {
  name: string
  categories?: Array<{ id?: number; name?: string; slug?: string }>
  version?: string
  confidence?: number
}

async function runWappalyzer(
  url: string,
  html: string,
  headers: Record<string, string> | undefined,
): Promise<DetectedTechnology[]> {
  const wappalyzer = (await import("wappalyzer-core")).default
  const technologies = (await import("simple-wappalyzer/src/technologies.json", { with: { type: "json" } })).default
  const categories = (await import("simple-wappalyzer/src/categories.json", { with: { type: "json" } })).default
  wappalyzer.setTechnologies(technologies)
  wappalyzer.setCategories(categories)

  const { Window } = await import("happy-dom")
  const window = new Window({
    url,
    settings: {
      disableComputedStyleRendering: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
    },
  })
  try {
    window.document.documentElement.innerHTML = html

    const scriptSrc = Array.from(window.document.scripts)
      .map(s => s.src)
      .filter((s): s is string => typeof s === "string" && s.length > 0)

    const meta: Record<string, string[]> = {}
    for (const m of Array.from(window.document.querySelectorAll("meta"))) {
      const key = m.getAttribute("name") || m.getAttribute("property")
      const value = m.getAttribute("content")
      if (!key || !value) continue
      ;(meta[key.toLowerCase()] ??= []).push(value)
    }

    const normalized: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(headers ?? {})) {
      if (v == null) continue
      normalized[k.toLowerCase()] = [String(v)]
    }

    const detections = await wappalyzer.analyze({
      url, meta, headers: normalized, scriptSrc, cookies: [], html: window.document.documentElement.outerHTML,
    })
    const resolved = wappalyzer.resolve(detections) as RawDetection[]
    return resolved.map(t => ({
      name: t.name,
      categories: (t.categories ?? []).map(c => c?.name).filter((n): n is string => !!n),
      version: t.version || undefined,
      confidence: typeof t.confidence === "number" ? t.confidence : undefined,
    }))
  } finally {
    await window.happyDOM.close()
  }
}

function detectPlatform(technologies: DetectedTechnology[]): string {
  const names = technologies.map(t => t.name)
  if (names.includes("WordPress")) return "WordPress"
  if (names.includes("Wix")) return "Wix"
  if (names.includes("Squarespace")) return "Squarespace"
  if (names.includes("Shopify")) return "Shopify"
  if (names.includes("Webflow")) return "Webflow"
  return "Custom / Unknown"
}

function estimateCosts(technologies: DetectedTechnology[]): {
  costBreakdown: Array<{ item: string; min: number; max: number }>
  total: { min: number; max: number; currency: string }
} {
  const breakdown: Array<{ item: string; min: number; max: number }> = []
  let min = 0, max = 0
  for (const tech of technologies) {
    const cost = COST_MAP[tech.name]
    if (cost) {
      breakdown.push({ item: cost.item, min: cost.min, max: cost.max })
      min += cost.min
      max += cost.max
    }
  }
  breakdown.push({ item: "Domain registration", min: 1, max: 2 })
  min += 1; max += 2
  return { costBreakdown: breakdown, total: { min, max, currency: "USD" } }
}

/**
 * Per-category tech detection. Wappalyzer requires raw HTML which is only
 * available from the homepage (fetch-pages stores markdown only). For all
 * categories we use the homepage HTML as a representative proxy — the tech
 * stack is generally site-wide.
 */
export async function detectTechForCategory(repo: Repo, request: Request, site: Site, category: Category): Promise<void> {
  const htmlBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "fetch-home", name: "home.html",
  })
  const headers = await repo.getJson<Record<string, string>>({
    requestId: request.id, siteId: site.id, stage: "fetch-home", name: "home.headers.json",
  })

  let technologies: DetectedTechnology[] = []
  try {
    technologies = await runWappalyzer(site.url, htmlBuf.toString("utf8"), headers)
  } catch (err) {
    console.warn(`  ⚠ wappalyzer failed for ${site.url}: ${err}`)
  }

  const platform = detectPlatform(technologies)
  const { costBreakdown, total } = estimateCosts(technologies)

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "detect-tech", name: `${category.id}.json` },
    { platform, detectedTechnologies: technologies, costBreakdown, totalEstimatedMonthlyCost: total },
  )
}
