import { describe, it, expect } from "vitest"
import { SETTINGS } from "./settings"

describe("SETTINGS", () => {
  it("defaults classify-nav to a Groq small model", () => {
    expect(SETTINGS.models.classifyNav.provider).toBe("groq")
    expect(SETTINGS.models.classifyNav.model).toBe("llama-3.1-8b-instant")
  })

  it("defaults extract-pages to Anthropic sonnet", () => {
    expect(SETTINGS.models.extractPages.provider).toBe("anthropic")
    expect(SETTINGS.models.extractPages.model).toBe("claude-sonnet-4-6")
  })

  it("defaults base-prompt generation to Anthropic sonnet", () => {
    expect(SETTINGS.models.basePromptGen).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    })
  })

  it("defaults chat to Anthropic sonnet", () => {
    expect(SETTINGS.models.chatDefault).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    })
  })

  it("declares provider env var names", () => {
    expect(SETTINGS.providers.anthropic.apiKeyEnv).toBe("ANTHROPIC_API_KEY")
    expect(SETTINGS.providers.groq.apiKeyEnv).toBe("GROQ_API_KEY")
  })

  it("provides stage estimates for quote generation", () => {
    expect(SETTINGS.stageEstimates.classifyNavOutputTokens).toBeTypeOf("number")
    expect(SETTINGS.stageEstimates.extractPagesOutputTokens).toBeTypeOf("number")
  })
})
