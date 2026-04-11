import type { TechAssessment, Features, CostItem, DetectedTechnology } from "../types"

const COST_MAP: Record<string, { item: string; min: number; max: number }> = {
  "WordPress": { item: "WordPress hosting", min: 5, max: 50 },
  "Wix": { item: "Wix subscription", min: 17, max: 45 },
  "Squarespace": { item: "Squarespace subscription", min: 16, max: 65 },
  "Shopify": { item: "Shopify subscription", min: 29, max: 299 },
  "Divi": { item: "Divi theme license", min: 7, max: 10 },
  "Elementor": { item: "Elementor Pro", min: 5, max: 10 },
  "WooCommerce": { item: "WooCommerce hosting/plugins", min: 10, max: 50 },
  "Mindbody": { item: "Mindbody subscription", min: 129, max: 449 },
  "Momoyoga": { item: "Momoyoga subscription", min: 20, max: 45 },
  "Fitogram": { item: "Fitogram subscription", min: 0, max: 59 },
  "Acuity Scheduling": { item: "Acuity Scheduling", min: 16, max: 49 },
  "Mailchimp": { item: "Mailchimp", min: 0, max: 30 },
  "Google Analytics": { item: "Google Analytics", min: 0, max: 0 },
  "Tawk.to": { item: "Tawk.to chat", min: 0, max: 0 },
  "Intercom": { item: "Intercom", min: 39, max: 99 },
  "Cloudflare": { item: "Cloudflare", min: 0, max: 20 },
}

function estimateCosts(technologies: DetectedTechnology[]): {
  costBreakdown: CostItem[]
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
} {
  const costBreakdown: CostItem[] = []
  let totalMin = 0
  let totalMax = 0

  for (const tech of technologies) {
    const cost = COST_MAP[tech.name]
    if (cost) {
      costBreakdown.push({ item: cost.item, estimatedMonthlyCost: { min: cost.min, max: cost.max } })
      totalMin += cost.min
      totalMax += cost.max
    }
  }

  if (!costBreakdown.some(c => ["WordPress hosting", "Wix subscription", "Squarespace subscription", "Shopify subscription"].includes(c.item))) {
    costBreakdown.push({ item: "Web hosting (estimated)", estimatedMonthlyCost: { min: 5, max: 30 } })
    totalMin += 5
    totalMax += 30
  }

  costBreakdown.push({ item: "Domain registration", estimatedMonthlyCost: { min: 1, max: 2 } })
  totalMin += 1
  totalMax += 2

  return { costBreakdown, totalEstimatedMonthlyCost: { min: totalMin, max: totalMax, currency: "USD" } }
}

function detectPlatform(technologies: DetectedTechnology[]): string {
  const names = technologies.map(t => t.name)
  if (names.includes("WordPress")) return "WordPress"
  if (names.includes("Wix")) return "Wix"
  if (names.includes("Squarespace")) return "Squarespace"
  if (names.includes("Shopify")) return "Shopify"
  if (names.includes("Webflow")) return "Webflow"
  if (names.includes("Joomla")) return "Joomla"
  if (names.includes("Drupal")) return "Drupal"
  return "Custom / Unknown"
}

function detectFeatures(technologies: DetectedTechnology[], html: string): Features {
  const names = technologies.map(t => t.name)
  const categories = technologies.map(t => t.category)
  const htmlLower = html.toLowerCase()

  let onlineBooking: string | undefined
  if (names.includes("Mindbody")) onlineBooking = "Mindbody"
  else if (names.includes("Momoyoga") || htmlLower.includes("momoyoga")) onlineBooking = "Momoyoga"
  else if (names.includes("Fitogram") || htmlLower.includes("fitogram")) onlineBooking = "Fitogram"
  else if (names.includes("Acuity Scheduling")) onlineBooking = "Acuity Scheduling"
  else if (htmlLower.includes("fitssey")) onlineBooking = "Fitssey"
  else if (names.includes("Stripe") || htmlLower.includes("stripe")) onlineBooking = "Stripe (custom)"

  let chat: string | undefined
  if (names.includes("Tawk.to") || htmlLower.includes("embed.tawk.to") || htmlLower.includes("tawk.to/")) chat = "Tawk.to"
  else if (names.includes("Intercom") || htmlLower.includes("widget.intercom.io")) chat = "Intercom"
  else if (names.includes("Crisp") || htmlLower.includes("client.crisp.chat")) chat = "Crisp"
  else if (htmlLower.includes("widget.drift.com")) chat = "Drift"
  else if (htmlLower.includes("wa.me/") || htmlLower.includes("api.whatsapp.com")) chat = "WhatsApp"

  return {
    onlineBooking,
    onlineClasses: htmlLower.includes("livestream") || htmlLower.includes("online class") || htmlLower.includes("on-demand") || htmlLower.includes("zoom"),
    chat,
    ecommerce: categories.includes("Ecommerce") || htmlLower.includes("/shop") || htmlLower.includes("add to cart"),
    newsletter: htmlLower.includes("newsletter") || htmlLower.includes("mailchimp") || htmlLower.includes("subscribe"),
    blog: htmlLower.includes("/blog") || htmlLower.includes("blog-post"),
    multiLanguage: htmlLower.includes("hreflang") || htmlLower.includes("/en/") || htmlLower.includes("wpml") || htmlLower.includes("lang="),
    addOnServices: detectAddOnServices(htmlLower),
  }
}

function detectAddOnServices(htmlLower: string): string[] {
  const services: string[] = []
  if (htmlLower.includes("massage")) services.push("massage")
  if (htmlLower.includes("ayurveda")) services.push("ayurveda")
  if (htmlLower.includes("accommodation") || htmlLower.includes("room")) services.push("accommodation")
  if (htmlLower.includes("sound healing") || htmlLower.includes("sound bath")) services.push("sound healing")
  if (htmlLower.includes("reiki")) services.push("reiki")
  if (htmlLower.includes("acupuncture")) services.push("acupuncture")
  return services
}

export async function detectTech(
  url: string,
  html: string
): Promise<{ tech: Omit<TechAssessment, "lighthouse">; features: Features }> {
  let technologies: DetectedTechnology[] = []

  try {
    const wappalyze = (await import("simple-wappalyzer")).default
    const result = await wappalyze({ url, html, headers: {} })
    const techs = Array.isArray(result) ? result : result?.technologies ?? []
    technologies = techs.map((t: {
      name: string
      categories: { name: string }[]
      version?: string
      confidence?: number
      website?: string
      icon?: string
      description?: string | null
      slug?: string
      cpe?: string | null
    }) => {
      const categories = (t.categories ?? []).map(c => c.name).filter(Boolean)
      return {
        name: t.name,
        category: categories[0] ?? "Other",
        categories,
        version: t.version || undefined,
        confidence: typeof t.confidence === "number" ? t.confidence : undefined,
        website: t.website || undefined,
        icon: t.icon || undefined,
        description: t.description ?? undefined,
        slug: t.slug || undefined,
        cpe: t.cpe ?? undefined,
      }
    })
  } catch (error) {
    console.warn(`  ⚠ Wappalyzer failed for ${url}: ${error}`)
  }

  const platform = detectPlatform(technologies)
  const { costBreakdown, totalEstimatedMonthlyCost } = estimateCosts(technologies)
  const features = detectFeatures(technologies, html)

  return { tech: { platform, detectedTechnologies: technologies, costBreakdown, totalEstimatedMonthlyCost }, features }
}
