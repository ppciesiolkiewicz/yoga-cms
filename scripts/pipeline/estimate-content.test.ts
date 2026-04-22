import { describe, it, expect, vi } from "vitest"
import { estimateContent } from "./estimate-content"
import type { Request, Site, SiteEstimate } from "../core/types"

function makeMockRepo(classifyData: { byCategory: Record<string, string[]> }) {
  const stored: Record<string, unknown> = {}
  return {
    getJson: vi.fn().mockResolvedValue(classifyData),
    putJson: vi.fn().mockImplementation(async (ref, data) => {
      stored[`${ref.stage}/${ref.name}`] = data
    }),
    _stored: stored,
  }
}

const site: Site = { id: "site_1", url: "https://example.com" }
const request: Request = {
  id: "r_1",
  createdAt: "2026-04-13T00:00:00Z",
  categories: [
    { id: "cat_1", name: "home", extraInfo: "Homepage", prompt: "...", provider: "anthropic", model: "claude-sonnet-4-6" },
    { id: "cat_2", name: "classes", extraInfo: "Classes", prompt: "...", provider: "anthropic", model: "claude-sonnet-4-6" },
  ],
  sites: [site],
}

describe("estimateContent", () => {
  it("produces a SiteEstimate with deduplicated pages", async () => {
    const repo = makeMockRepo({
      byCategory: {
        cat_1: ["https://example.com"],
        cat_2: ["https://example.com/classes", "https://example.com"],
      },
    })

    await estimateContent(repo as any, request, site)

    expect(repo.putJson).toHaveBeenCalledOnce()
    const [ref, data] = repo.putJson.mock.calls[0]
    expect(ref.stage).toBe("estimate-content")
    expect(ref.name).toBe("estimates.json")

    const estimate = data as SiteEstimate
    expect(estimate.siteId).toBe("site_1")
    // 2 unique URLs: example.com and example.com/classes
    expect(estimate.pages).toHaveLength(2)
    for (const page of estimate.pages) {
      expect(page.charCount).toBeGreaterThan(0)
      expect(page.estimatedTokens).toBe(Math.ceil(page.charCount / 4))
    }
    expect(estimate.totalChars).toBe(estimate.pages.reduce((s, p) => s + p.charCount, 0))
    expect(estimate.totalEstimatedTokens).toBe(estimate.pages.reduce((s, p) => s + p.estimatedTokens, 0))
  })

  it("handles empty classification", async () => {
    const repo = makeMockRepo({ byCategory: { cat_1: [], cat_2: [] } })
    await estimateContent(repo as any, request, site)

    const [, data] = repo.putJson.mock.calls[0]
    const estimate = data as SiteEstimate
    expect(estimate.pages).toHaveLength(0)
    expect(estimate.totalChars).toBe(0)
  })
})
