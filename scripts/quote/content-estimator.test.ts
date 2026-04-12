import { describe, it, expect } from "vitest"
import { MockContentEstimator } from "./content-estimator"

describe("MockContentEstimator", () => {
  it("returns an estimate for each URL", async () => {
    const estimator = new MockContentEstimator()
    const urls = ["https://example.com/page1", "https://example.com/page2", "https://example.com/page3"]
    const results = await estimator.estimatePages(urls)

    expect(results).toHaveLength(3)
    for (let i = 0; i < urls.length; i++) {
      expect(results[i].url).toBe(urls[i])
      expect(results[i].charCount).toBeGreaterThanOrEqual(3000)
      expect(results[i].charCount).toBeLessThanOrEqual(8000)
    }
  })

  it("returns empty array for empty input", async () => {
    const estimator = new MockContentEstimator()
    const results = await estimator.estimatePages([])
    expect(results).toEqual([])
  })
})
