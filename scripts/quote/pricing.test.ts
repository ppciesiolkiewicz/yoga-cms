import { describe, it, expect } from "vitest"
import { loadPricingConfig } from "./pricing"
import { join } from "path"

describe("loadPricingConfig", () => {
  it("loads and validates the default pricing.json", () => {
    const config = loadPricingConfig(join(__dirname, "pricing.json"))
    expect(config.version).toBe(1)
    expect(config.currency).toBe("USD")
    expect(config.serviceFee.perPage).toBe(0.01)
    expect(config.firecrawl.perScrape).toBeTypeOf("number")
    expect(config.ai.classifyNav.model).toBe("claude-haiku-4-5")
    expect(config.ai.extractPagesContent.sonnet.estimatedOutputTokens).toBeTypeOf("number")
  })

  it("throws on missing file", () => {
    expect(() => loadPricingConfig("/nonexistent/path.json")).toThrow()
  })
})
