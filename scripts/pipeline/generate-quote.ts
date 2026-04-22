import { newId } from "../db/repo"
import type { Repo } from "../db/repo"
import type { Request, SiteEstimate, Order, OrderLineItem, OrderSite, AIQuery } from "../core/types"
import type { PricingConfig } from "../quote/pricing"
import { lookupModelPricing } from "../quote/pricing"
import { SETTINGS } from "../../core/settings"

interface SunkCosts {
  fetchHomeCost: number
  classifyNavCost: number
  classifyNavTokens: number
}

function computeSunkCosts(queries: AIQuery[], pricing: PricingConfig): SunkCosts {
  // fetch-home = 1 firecrawl scrape
  const fetchHomeCost = pricing.firecrawl.perScrape

  // classify-nav = Haiku call, compute from actual query
  const classifyQuery = queries.find(q => q.stage === "classify-nav")
  let classifyNavCost = 0
  let classifyNavTokens = 0
  if (classifyQuery) {
    const inputTokens = classifyQuery.usage?.inputTokens ?? Math.ceil(classifyQuery.prompt.length / 4)
    const outputTokens = classifyQuery.usage?.outputTokens ?? Math.ceil(classifyQuery.response.length / 4)
    classifyNavTokens = inputTokens + outputTokens
    const classifyPricing = lookupModelPricing(
      pricing,
      SETTINGS.models.classifyNav.provider,
      SETTINGS.models.classifyNav.model,
    )
    classifyNavCost =
      (inputTokens / 1000) * classifyPricing.inputPer1kTokens +
      (outputTokens / 1000) * classifyPricing.outputPer1kTokens
  }

  return { fetchHomeCost, classifyNavCost, classifyNavTokens }
}

function buildSiteLineItems(
  request: Request,
  estimate: SiteEstimate,
  pricing: PricingConfig,
  sunk: SunkCosts,
): OrderLineItem[] {
  const items: OrderLineItem[] = []
  const pageCount = estimate.pages.length

  // Sunk costs (already incurred)
  items.push({
    stage: "fetch-home",
    description: "Homepage scrape (sunk)",
    unit: "per-site",
    quantity: 1,
    unitCost: sunk.fetchHomeCost,
    estimatedCost: sunk.fetchHomeCost,
    actualCost: sunk.fetchHomeCost,
    actualQuantity: 1,
  })

  items.push({
    stage: "classify-nav",
    description: "Navigation classification (sunk)",
    unit: "per-site",
    quantity: 1,
    unitCost: sunk.classifyNavCost,
    estimatedCost: sunk.classifyNavCost,
    actualCost: sunk.classifyNavCost,
    actualQuantity: sunk.classifyNavTokens,
  })

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

    // extract-pages-content — provider+model come from the category
    const extractPricing = lookupModelPricing(pricing, cat.provider, cat.model)
    const extractInput = inputTokens / 1000
    const extractOutput = SETTINGS.stageEstimates.extractPagesOutputTokens / 1000
    const extractCost =
      extractInput * extractPricing.inputPer1kTokens +
      extractOutput * extractPricing.outputPer1kTokens
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

    const queries = await repo.getQueries(request.id, site.id)
    const sunk = computeSunkCosts(queries, pricing)
    const lineItems = buildSiteLineItems(request, estimate, pricing, sunk)
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

  // Aggregate by cost category
  let scraping = 0
  let ai = 0
  let serviceFee = 0
  for (const site of order.sites) {
    for (const li of site.lineItems) {
      if (li.stage === "service-fee") serviceFee += li.estimatedCost
      else if (li.stage === "fetch-home" || li.stage === "fetch-pages" || li.stage === "estimate-content") scraping += li.estimatedCost
      else ai += li.estimatedCost
    }
  }

  lines.push(`  ──────────────────────────────────────`)
  lines.push(`    ${"Scraping".padEnd(35)} $${scraping.toFixed(4)}`)
  lines.push(`    ${"AI".padEnd(35)} $${ai.toFixed(4)}`)
  lines.push(`    ${"Service fee".padEnd(35)} $${serviceFee.toFixed(4)}`)
  lines.push(`  ──────────────────────────────────────`)
  lines.push(`  ${"TOTAL ESTIMATED COST".padEnd(37)} $${order.totalEstimatedCost.toFixed(4)}`)
  lines.push(``)
  return lines.join("\n")
}

export function formatOrderComparison(order: Order): string {
  const lines: string[] = []
  lines.push(`\n╔══════════════════════════════════════════════════════════╗`)
  lines.push(`║                  COST COMPARISON                        ║`)
  lines.push(`╚══════════════════════════════════════════════════════════╝`)
  lines.push(`  ${"".padEnd(35)} ${"Quoted".padStart(9)}  ${"Actual".padStart(9)}  ${"Diff".padStart(9)}`)
  lines.push(``)

  for (const site of order.sites) {
    lines.push(`  ── ${site.url} ──`)
    for (const li of site.lineItems) {
      const est = li.estimatedCost
      const act = li.actualCost ?? est
      const diff = act - est
      const sign = diff > 0 ? "+" : ""
      lines.push(`    ${li.description.padEnd(35)} $${est.toFixed(4)}  $${act.toFixed(4)}  ${sign}$${diff.toFixed(4)}`)
    }
    lines.push(``)
  }

  // Aggregated comparison
  let estScraping = 0, actScraping = 0
  let estAi = 0, actAi = 0
  let estFee = 0, actFee = 0
  for (const site of order.sites) {
    for (const li of site.lineItems) {
      const est = li.estimatedCost
      const act = li.actualCost ?? est
      if (li.stage === "service-fee") { estFee += est; actFee += act }
      else if (li.stage === "fetch-home" || li.stage === "fetch-pages" || li.stage === "estimate-content") { estScraping += est; actScraping += act }
      else { estAi += est; actAi += act }
    }
  }

  const fmtRow = (label: string, est: number, act: number) => {
    const diff = act - est
    const sign = diff > 0 ? "+" : ""
    return `    ${label.padEnd(35)} $${est.toFixed(4)}  $${act.toFixed(4)}  ${sign}$${diff.toFixed(4)}`
  }

  lines.push(`  ──────────────────────────────────────────────────────────`)
  lines.push(fmtRow("Scraping", estScraping, actScraping))
  lines.push(fmtRow("AI", estAi, actAi))
  lines.push(fmtRow("Service fee", estFee, actFee))
  lines.push(`  ──────────────────────────────────────────────────────────`)

  const totalEst = order.totalEstimatedCost
  const totalAct = order.totalActualCost ?? totalEst
  const totalDiff = totalAct - totalEst
  const totalSign = totalDiff > 0 ? "+" : ""
  lines.push(`  ${"TOTAL".padEnd(37)} $${totalEst.toFixed(4)}  $${totalAct.toFixed(4)}  ${totalSign}$${totalDiff.toFixed(4)}`)
  lines.push(``)
  return lines.join("\n")
}
