import { newId } from "../db/repo"
import type { Repo } from "../db/repo"
import type { Request, SiteEstimate, Order, OrderLineItem, OrderSite } from "../core/types"
import type { PricingConfig } from "../quote/pricing"

function buildSiteLineItems(
  request: Request,
  estimate: SiteEstimate,
  pricing: PricingConfig,
): OrderLineItem[] {
  const items: OrderLineItem[] = []
  const pageCount = estimate.pages.length

  // Service fee
  items.push({
    stage: "service-fee",
    description: "Service fee",
    unit: "per-page",
    quantity: pageCount,
    unitCost: pricing.serviceFee.perPage,
    estimatedCost: pageCount * pricing.serviceFee.perPage,
  })

  // Firecrawl scraping
  items.push({
    stage: "fetch-pages",
    description: "Firecrawl page scraping",
    unit: "per-page",
    quantity: pageCount,
    unitCost: pricing.firecrawl.perScrape,
    estimatedCost: pageCount * pricing.firecrawl.perScrape,
  })

  // Content estimator
  if (pricing.contentEstimator.perPage > 0) {
    items.push({
      stage: "estimate-content",
      description: "Content estimation service",
      unit: "per-page",
      quantity: pageCount,
      unitCost: pricing.contentEstimator.perPage,
      estimatedCost: pageCount * pricing.contentEstimator.perPage,
    })
  }

  // AI stages — per category
  for (const cat of request.categories) {
    const inputTokens = estimate.totalEstimatedTokens

    // assess-pages
    const assessInput = inputTokens / 1000
    const assessOutput = pricing.ai.assessPages.estimatedOutputTokens / 1000
    const assessCost =
      assessInput * pricing.ai.assessPages.inputPer1kTokens +
      assessOutput * pricing.ai.assessPages.outputPer1kTokens
    items.push({
      stage: "assess-pages",
      description: `Assess pages — ${cat.name}`,
      unit: "per-category",
      quantity: 1,
      unitCost: assessCost,
      estimatedCost: assessCost,
    })

    // extract-pages-content
    const extractInput = inputTokens / 1000
    const extractOutput = pricing.ai.extractPagesContent.estimatedOutputTokens / 1000
    const extractCost =
      extractInput * pricing.ai.extractPagesContent.inputPer1kTokens +
      extractOutput * pricing.ai.extractPagesContent.outputPer1kTokens
    items.push({
      stage: "extract-pages-content",
      description: `Extract content — ${cat.name}`,
      unit: "per-category",
      quantity: 1,
      unitCost: extractCost,
      estimatedCost: extractCost,
    })

    // Optional: lighthouse
    if (cat.lighthouse && pricing.lighthouse.perRun > 0) {
      items.push({
        stage: "run-lighthouse",
        description: `Lighthouse audit — ${cat.name}`,
        unit: "per-category",
        quantity: 1,
        unitCost: pricing.lighthouse.perRun,
        estimatedCost: pricing.lighthouse.perRun,
      })
    } else if (cat.lighthouse) {
      items.push({
        stage: "run-lighthouse",
        description: `Lighthouse audit — ${cat.name}`,
        unit: "per-category",
        quantity: 1,
        unitCost: 0,
        estimatedCost: 0,
      })
    }

    // Optional: wappalyzer
    if (cat.wappalyzer && pricing.wappalyzer.perRun > 0) {
      items.push({
        stage: "detect-tech",
        description: `Tech detection — ${cat.name}`,
        unit: "per-category",
        quantity: 1,
        unitCost: pricing.wappalyzer.perRun,
        estimatedCost: pricing.wappalyzer.perRun,
      })
    }
  }

  return items
}

export async function generateQuote(
  repo: Repo,
  request: Request,
  pricing: PricingConfig,
): Promise<Order> {
  const orderSites: OrderSite[] = []

  for (const site of request.sites) {
    let estimate: SiteEstimate
    try {
      estimate = await repo.getJson<SiteEstimate>({
        requestId: request.id, siteId: site.id, stage: "estimate-content", name: "estimates.json",
      })
    } catch {
      // Site failed Phase 1 — skip
      continue
    }

    const lineItems = buildSiteLineItems(request, estimate, pricing)
    const subtotal = lineItems.reduce((s, li) => s + li.estimatedCost, 0)

    orderSites.push({
      siteId: site.id,
      url: site.url,
      pageCount: estimate.pages.length,
      estimatedTokens: estimate.totalEstimatedTokens,
      lineItems,
      subtotal,
    })
  }

  const order: Order = {
    id: newId("ord"),
    requestId: request.id,
    createdAt: new Date().toISOString(),
    status: "quoted",
    sites: orderSites,
    totalEstimatedCost: orderSites.reduce((s, os) => s + os.subtotal, 0),
  }

  await repo.putJson(
    { requestId: request.id, stage: "order", name: "order.json" },
    order,
  )

  return order
}

export function formatQuoteSummary(order: Order): string {
  const lines: string[] = []
  lines.push(`\n╔══════════════════════════════════════╗`)
  lines.push(`║           QUOTE SUMMARY              ║`)
  lines.push(`╚══════════════════════════════════════╝`)
  lines.push(`  Order:   ${order.id}`)
  lines.push(`  Request: ${order.requestId}`)
  lines.push(``)

  for (const site of order.sites) {
    lines.push(`  ── ${site.url} (${site.pageCount} pages, ~${site.estimatedTokens} tokens) ──`)
    for (const li of site.lineItems) {
      const cost = li.estimatedCost.toFixed(4)
      lines.push(`    ${li.description.padEnd(35)} $${cost}`)
    }
    lines.push(`    ${"Subtotal".padEnd(35)} $${site.subtotal.toFixed(4)}`)
    lines.push(``)
  }

  lines.push(`  ${"TOTAL ESTIMATED COST".padEnd(37)} $${order.totalEstimatedCost.toFixed(4)}`)
  lines.push(``)
  return lines.join("\n")
}
