import { describe, it, expect } from "vitest"
import { SUPPORTED_CHAT_MODELS, getChatModel, isSupportedModel } from "./models"

describe("SUPPORTED_CHAT_MODELS", () => {
  it("includes both Anthropic and Groq entries", () => {
    const providers = new Set(SUPPORTED_CHAT_MODELS.map(m => m.provider))
    expect(providers.has("anthropic")).toBe(true)
    expect(providers.has("groq")).toBe(true)
  })

  it("lookup by id returns provider", () => {
    expect(getChatModel("claude-sonnet-4-6")?.provider).toBe("anthropic")
    expect(getChatModel("llama-3.1-8b-instant")?.provider).toBe("groq")
  })

  it("isSupportedModel recognizes entries", () => {
    expect(isSupportedModel("claude-sonnet-4-6")).toBe(true)
    expect(isSupportedModel("gpt-5")).toBe(false)
  })
})
