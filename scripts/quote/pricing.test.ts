import { describe, it, expect } from "vitest"
import { loadPricingConfig, lookupModelPricing } from "./pricing"
import { join } from "path"

describe("loadPricingConfig", () => {
  it("loads and validates the default pricing.json", () => {
    const config = loadPricingConfig(join(__dirname, "pricing.json"))
    expect(config.version).toBe(2)
    expect(config.currency).toBe("USD")
    expect(config.serviceFee.perPage).toBe(0.01)
    expect(config.firecrawl.perScrape).toBeTypeOf("number")
    expect(config.models.anthropic["claude-sonnet-4-6"].inputPer1kTokens).toBeTypeOf("number")
    expect(config.models.groq["llama-3.1-8b-instant"].inputPer1kTokens).toBeTypeOf("number")
  })

  it("throws on missing file", () => {
    expect(() => loadPricingConfig("/nonexistent/path.json")).toThrow()
  })
})

describe("lookupModelPricing", () => {
  const config = loadPricingConfig(join(__dirname, "pricing.json"))

  it("returns pricing for a known provider+model", () => {
    const p = lookupModelPricing(config, "anthropic", "claude-sonnet-4-6")
    expect(p.inputPer1kTokens).toBe(0.003)
    expect(p.outputPer1kTokens).toBe(0.015)
  })

  it("throws for unknown model", () => {
    expect(() => lookupModelPricing(config, "anthropic", "gpt-5")).toThrow(/No pricing/)
  })
})
