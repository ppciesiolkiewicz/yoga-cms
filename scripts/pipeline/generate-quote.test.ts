import { describe, it, expect, vi } from "vitest"
import { generateQuote } from "./generate-quote"
import type { Request, Site, SiteEstimate, Order } from "../core/types"
import type { PricingConfig } from "../quote/pricing"

const pricing: PricingConfig = {
  version: 1,
  currency: "USD",
  serviceFee: { perPage: 0.01 },
  firecrawl: { perScrape: 0.002 },
  ai: {
    classifyNav: { model: "claude-haiku-4-5", inputPer1kTokens: 0.001, outputPer1kTokens: 0.005, estimatedOutputTokens: 500 },
    assessPages: { model: "claude-sonnet-4-6", inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, estimatedOutputTokens: 1000 },
    extractPagesContent: { model: "claude-sonnet-4-6", inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, estimatedOutputTokens: 1500 },
  },
  lighthouse: { perRun: 0 },
  wappalyzer: { perRun: 0 },
  contentEstimator: { perPage: 0 },
}

const site: Site = { id: "site_1", url: "https://example.com" }
const request: Request = {
  id: "r_1",
  createdAt: "2026-04-13T00:00:00Z",
  categories: [
    { id: "cat_1", name: "home", extraInfo: "Homepage", prompt: "p", lighthouse: true },
    { id: "cat_2", name: "classes", extraInfo: "Classes", prompt: "p" },
  ],
  sites: [site],
}

const siteEstimate: SiteEstimate = {
  siteId: "site_1",
  pages: [
    { url: "https://example.com", charCount: 4000, estimatedTokens: 1000 },
    { url: "https://example.com/classes", charCount: 6000, estimatedTokens: 1500 },
  ],
  totalChars: 10000,
  totalEstimatedTokens: 2500,
}

const classifyQuery = {
  id: "q_1", requestId: "r_1", siteId: "site_1",
  stage: "classify-nav", model: "claude-haiku-4-5",
  prompt: "a".repeat(2000), dataRefs: [], response: "b".repeat(500),
  createdAt: "2026-04-13T00:00:00Z",
}

function makeMockRepo() {
  const stored: Record<string, unknown> = {}
  return {
    getJson: vi.fn().mockResolvedValue(siteEstimate),
    putJson: vi.fn().mockImplementation(async (ref, data) => {
      stored[`${ref.stage}/${ref.name}`] = data
    }),
    getQueries: vi.fn().mockResolvedValue([classifyQuery]),
    _stored: stored,
  }
}

describe("generateQuote", () => {
  it("creates an Order with quoted status and line items", async () => {
    const repo = makeMockRepo()
    const order = await generateQuote(repo as any, request, pricing)

    expect(order.requestId).toBe("r_1")
    expect(order.status).toBe("quoted")
    expect(order.sites).toHaveLength(1)

    const orderSite = order.sites[0]
    expect(orderSite.siteId).toBe("site_1")
    expect(orderSite.pageCount).toBe(2)
    expect(orderSite.lineItems.length).toBeGreaterThan(0)

    // Check sunk cost line items
    const fetchHome = orderSite.lineItems.find(li => li.stage === "fetch-home")
    expect(fetchHome).toBeDefined()
    expect(fetchHome!.estimatedCost).toBe(0.002)
    expect(fetchHome!.actualCost).toBe(0.002)

    const classifyNav = orderSite.lineItems.find(li => li.stage === "classify-nav")
    expect(classifyNav).toBeDefined()
    expect(classifyNav!.estimatedCost).toBeGreaterThan(0)
    expect(classifyNav!.actualCost).toBe(classifyNav!.estimatedCost)

    // Check service fee line item exists
    const serviceFee = orderSite.lineItems.find(li => li.stage === "service-fee")
    expect(serviceFee).toBeDefined()
    expect(serviceFee!.quantity).toBe(2)
    expect(serviceFee!.unitCost).toBe(0.01)
    expect(serviceFee!.estimatedCost).toBeCloseTo(0.02)

    // Check firecrawl line item
    const firecrawl = orderSite.lineItems.find(li => li.stage === "fetch-pages")
    expect(firecrawl).toBeDefined()
    expect(firecrawl!.quantity).toBe(2)

    // Check lighthouse line item exists (cat_1 has lighthouse: true)
    const lighthouse = orderSite.lineItems.find(li => li.stage === "run-lighthouse")
    expect(lighthouse).toBeDefined()

    // Total should be positive
    expect(orderSite.subtotal).toBeGreaterThan(0)
    expect(order.totalEstimatedCost).toBeGreaterThan(0)

    // Verify stored
    expect(repo.putJson).toHaveBeenCalled()
    const storeCall = repo.putJson.mock.calls.find(
      ([ref]: [any]) => ref.stage === "order" && ref.name === "order.json"
    )
    expect(storeCall).toBeDefined()
  })
})
