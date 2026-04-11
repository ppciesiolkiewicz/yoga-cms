import type { TechAssessment, Features, CostItem, DetectedTechnology } from "../types"

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
  "Tawk.to": { item: "Tawk.to chat", min: 0, max: 0 },
  "Intercom": { item: "Intercom", min: 39, max: 99 },
  "Cloudflare": { item: "Cloudflare", min: 0, max: 20 },
}

interface BookingPlatform {
  name: string
  tokens: string[]
  cost: { min: number; max: number }
}

// Order matters: more specific / niche platforms first, generic last.
const BOOKING_PLATFORMS: BookingPlatform[] = [
  { name: "Mindbody", tokens: ["mindbodyonline.com", "clients.mindbodyonline", "healcode", "mindbody"], cost: { min: 129, max: 449 } },
  { name: "Momoyoga", tokens: ["momoyoga.com", "momoyoga"], cost: { min: 20, max: 45 } },
  { name: "Fitogram", tokens: ["fitogram.pro", "fitogram"], cost: { min: 0, max: 59 } },
  { name: "Acuity Scheduling", tokens: ["acuityscheduling.com", "squarespacescheduling.com"], cost: { min: 16, max: 49 } },
  { name: "Fitssey", tokens: ["app.fitssey.com", "fitssey"], cost: { min: 0, max: 29 } },
  { name: "Glofox", tokens: ["app.glofox.com", "glofox"], cost: { min: 110, max: 400 } },
  { name: "WellnessLiving", tokens: ["wellnessliving.com"], cost: { min: 99, max: 349 } },
  { name: "Arketa", tokens: ["arketa.co", "ourarketa.com"], cost: { min: 70, max: 200 } },
  { name: "Vagaro", tokens: ["vagaro.com"], cost: { min: 30, max: 90 } },
  { name: "bsport", tokens: ["bsport.io", "app.bsport"], cost: { min: 60, max: 200 } },
  { name: "Eversports", tokens: ["eversports.com", "eversports.de", "eversports.nl"], cost: { min: 50, max: 200 } },
  { name: "TeamUp", tokens: ["goteamup.com"], cost: { min: 49, max: 139 } },
  { name: "Zen Planner", tokens: ["zenplanner.com"], cost: { min: 117, max: 227 } },
  { name: "Virtuagym", tokens: ["virtuagym.com"], cost: { min: 50, max: 200 } },
  { name: "Punchpass", tokens: ["punchpass.com", "punchpass.net"], cost: { min: 65, max: 125 } },
  { name: "Pike13", tokens: ["pike13.com"], cost: { min: 129, max: 199 } },
  { name: "Walla", tokens: ["hellowalla.com", "walla.app"], cost: { min: 150, max: 400 } },
  { name: "OfferingTree", tokens: ["offeringtree.com"], cost: { min: 20, max: 100 } },
  { name: "WodGuru", tokens: ["wod.guru", "wodguru"], cost: { min: 30, max: 150 } },
  { name: "Booksy", tokens: ["booksy.com"], cost: { min: 30, max: 80 } },
  { name: "SimplyBook.me", tokens: ["simplybook.me", "simplybook.it"], cost: { min: 10, max: 80 } },
  { name: "Calendly", tokens: ["calendly.com"], cost: { min: 0, max: 20 } },
  { name: "Square Appointments", tokens: ["squareup.com/appointments", "square-appointments"], cost: { min: 0, max: 69 } },
  { name: "Amelia", tokens: ["wpamelia", "ameliabooking"], cost: { min: 0, max: 20 } },
  { name: "Bookly", tokens: ["bookly-form", "bookly-calendar", "bookly-app", "/bookly/"], cost: { min: 0, max: 10 } },
]

function findBookingPlatform(technologies: DetectedTechnology[], htmlLower: string): BookingPlatform | undefined {
  const names = new Set(technologies.map(t => t.name))
  for (const p of BOOKING_PLATFORMS) {
    if (names.has(p.name) || p.tokens.some(t => htmlLower.includes(t))) return p
  }
  return undefined
}

function estimateCosts(technologies: DetectedTechnology[], bookingPlatform?: BookingPlatform): {
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

  if (bookingPlatform) {
    costBreakdown.push({
      item: `${bookingPlatform.name} subscription`,
      estimatedMonthlyCost: { min: bookingPlatform.cost.min, max: bookingPlatform.cost.max },
    })
    totalMin += bookingPlatform.cost.min
    totalMax += bookingPlatform.cost.max
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

function detectFeatures(technologies: DetectedTechnology[], html: string, bookingPlatform?: BookingPlatform): Features {
  const names = technologies.map(t => t.name)
  const categories = technologies.flatMap(t => t.categories)
  const htmlLower = html.toLowerCase()

  let onlineBooking: string | undefined = bookingPlatform?.name
  if (!onlineBooking && (names.includes("Stripe") || htmlLower.includes("stripe"))) {
    onlineBooking = "Stripe (custom)"
  }

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

// ── wappalyzer-core driver ─────────────────────────────────────────────────

let wappalyzerReady = false
async function initWappalyzer() {
  if (wappalyzerReady) return
  const wappalyzer = (await import("wappalyzer-core")).default
  const technologies = (await import("simple-wappalyzer/src/technologies.json", { with: { type: "json" } })).default
  const categories = (await import("simple-wappalyzer/src/categories.json", { with: { type: "json" } })).default
  wappalyzer.setTechnologies(technologies)
  wappalyzer.setCategories(categories)
  wappalyzerReady = true
}

function normalizeHeaders(headers: Record<string, string> | undefined): Record<string, string[]> {
  if (!headers) return {}
  const out: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(headers)) {
    if (v == null) continue
    out[k.toLowerCase()] = [String(v)]
  }
  return out
}

function parseSetCookies(setCookie: string | string[] | undefined): Array<{ name: string; value?: string }> {
  if (!setCookie) return []
  const arr = Array.isArray(setCookie) ? setCookie : [setCookie]
  const cookies: Array<{ name: string; value?: string }> = []
  for (const raw of arr) {
    const first = raw.split(";")[0]
    const eq = first.indexOf("=")
    if (eq === -1) continue
    cookies.push({ name: first.slice(0, eq).trim(), value: first.slice(eq + 1).trim() })
  }
  return cookies
}

interface RawDetection {
  name: string
  categories?: Array<{ id?: number; name?: string; slug?: string }>
  version?: string
  confidence?: number
  website?: string
  icon?: string
  description?: string | null
  slug?: string
  cpe?: string | null
}

async function runWappalyzer(
  url: string,
  html: string,
  headers: Record<string, string> | undefined,
): Promise<DetectedTechnology[]> {
  await initWappalyzer()
  const wappalyzer = (await import("wappalyzer-core")).default
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
      const k = key.toLowerCase()
      ;(meta[k] ??= []).push(value)
    }

    const normalized = normalizeHeaders(headers)
    const setCookieRaw = normalized["set-cookie"]?.[0]
    const cookies = parseSetCookies(setCookieRaw)

    const detections = await wappalyzer.analyze({
      url,
      meta,
      headers: normalized,
      scriptSrc,
      cookies,
      html: window.document.documentElement.outerHTML,
    })

    const resolved = wappalyzer.resolve(detections) as RawDetection[]
    return resolved.map(t => {
      const cats = (t.categories ?? []).map(c => c?.name).filter((n): n is string => !!n)
      return {
        name: t.name,
        category: cats[0] ?? "Other",
        categories: cats,
        version: t.version || undefined,
        confidence: typeof t.confidence === "number" ? t.confidence : undefined,
        website: t.website || undefined,
        icon: t.icon || undefined,
        description: t.description ?? undefined,
        slug: t.slug || undefined,
        cpe: t.cpe ?? undefined,
      }
    })
  } finally {
    await window.happyDOM.close()
  }
}

export async function detectTech(
  url: string,
  html: string,
  headers?: Record<string, string>,
): Promise<{ tech: Omit<TechAssessment, "lighthouse">; features: Features }> {
  let technologies: DetectedTechnology[] = []
  try {
    technologies = await runWappalyzer(url, html, headers)
  } catch (error) {
    console.warn(`  ⚠ Wappalyzer failed for ${url}: ${error}`)
  }

  const platform = detectPlatform(technologies)
  const htmlLower = html.toLowerCase()
  const bookingPlatform = findBookingPlatform(technologies, htmlLower)
  const { costBreakdown, totalEstimatedMonthlyCost } = estimateCosts(technologies, bookingPlatform)
  const features = detectFeatures(technologies, html, bookingPlatform)

  return { tech: { platform, detectedTechnologies: technologies, costBreakdown, totalEstimatedMonthlyCost }, features }
}
