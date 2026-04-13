import { describe, it, expect, vi } from "vitest"
import { finalizeOrder } from "./finalize-order"
import type { Request, Order, AIQuery } from "../core/types"
import type { PricingConfig } from "../quote/pricing"

const pricing: PricingConfig = {
  version: 1,
  currency: "USD",
  serviceFee: { perPage: 0.01 },
  firecrawl: { perScrape: 0.002 },
  ai: {
    classifyNav: { model: "claude-haiku-4-5", inputPer1kTokens: 0.001, outputPer1kTokens: 0.005, estimatedOutputTokens: 500 },
    extractPagesContent: {
      haiku: { inputPer1kTokens: 0.001, outputPer1kTokens: 0.005, estimatedOutputTokens: 1500 },
      sonnet: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, estimatedOutputTokens: 1500 },
      opus: { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075, estimatedOutputTokens: 1500 },
    },
  },
  lighthouse: { perRun: 0 },
  wappalyzer: { perRun: 0 },
  contentEstimator: { perPage: 0 },
}

const order: Order = {
  id: "ord_1",
  requestId: "r_1",
  createdAt: "2026-04-13T00:00:00Z",
  status: "approved",
  sites: [{
    siteId: "site_1",
    url: "https://example.com",
    pageCount: 2,
    estimatedTokens: 2500,
    lineItems: [
      { stage: "service-fee", description: "Service fee", unit: "per-page", quantity: 2, unitCost: 0.01, estimatedCost: 0.02 },
      { stage: "fetch-pages", description: "Firecrawl", unit: "per-page", quantity: 2, unitCost: 0.002, estimatedCost: 0.004 },
      { stage: "extract-pages-content", description: "Extract — home", unit: "per-category", quantity: 1, unitCost: 0.01, estimatedCost: 0.01 },
    ],
    subtotal: 0.044,
  }],
  totalEstimatedCost: 0.044,
  approvedAt: "2026-04-13T00:01:00Z",
}

const queries: AIQuery[] = [
  {
    id: "q_1", requestId: "r_1", siteId: "site_1", categoryId: "cat_1",
    stage: "extract-pages-content", model: "claude-sonnet-4-6",
    prompt: "c".repeat(4000), dataRefs: [], response: "d".repeat(3000),
    createdAt: "2026-04-13T00:03:00Z",
  },
]

const fetchPagesIndex = {
  pages: [
    { id: "abc123", url: "https://example.com", status: "ok" },
    { id: "def456", url: "https://example.com/classes", status: "ok" },
  ],
}

function makeMockRepo() {
  const stored: Record<string, unknown> = {}
  return {
    getJson: vi.fn().mockImplementation(async (ref: any) => {
      if (ref.stage === "order") return JSON.parse(JSON.stringify(order))
      if (ref.stage === "fetch-pages") return fetchPagesIndex
      throw new Error(`unexpected getJson: ${ref.stage}/${ref.name}`)
    }),
    putJson: vi.fn().mockImplementation(async (ref: any, data: unknown) => {
      stored[`${ref.stage}/${ref.name}`] = data
    }),
    getQueries: vi.fn().mockResolvedValue(queries),
    _stored: stored,
  }
}

describe("finalizeOrder", () => {
  it("updates order with actual costs and sets completed status", async () => {
    const repo = makeMockRepo()
    const request: Request = {
      id: "r_1", createdAt: "2026-04-13T00:00:00Z",
      categories: [{ id: "cat_1", name: "home", extraInfo: "Homepage", prompt: "p", model: "sonnet" as const }],
      sites: [{ id: "site_1", url: "https://example.com" }],
    }

    await finalizeOrder(repo as any, request, pricing)

    const storeCall = repo.putJson.mock.calls.find(
      ([ref]: [any]) => ref.stage === "order" && ref.name === "order.json"
    )
    expect(storeCall).toBeDefined()

    const updated = storeCall![1] as Order
    expect(updated.status).toBe("completed")
    expect(updated.completedAt).toBeDefined()
    expect(updated.totalActualCost).toBeTypeOf("number")
    expect(updated.totalActualCost).toBeGreaterThan(0)

    // AI line items should have actualCost filled
    const extractItem = updated.sites[0].lineItems.find(li => li.stage === "extract-pages-content")
    expect(extractItem?.actualCost).toBeTypeOf("number")
    expect(extractItem?.actualQuantity).toBeTypeOf("number")

    // Service fee actual = estimated (fixed rate)
    const feeItem = updated.sites[0].lineItems.find(li => li.stage === "service-fee")
    expect(feeItem?.actualCost).toBe(feeItem?.estimatedCost)
  })
})
