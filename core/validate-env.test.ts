import { describe, it, expect, beforeEach } from "vitest"
import { requireApiKeysFor } from "./validate-env"

describe("requireApiKeysFor", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GROQ_API_KEY
  })

  it("does nothing when keys are present", () => {
    process.env.ANTHROPIC_API_KEY = "x"
    process.env.GROQ_API_KEY = "y"
    expect(() => requireApiKeysFor(["anthropic", "groq"])).not.toThrow()
  })

  it("throws listing all missing env vars", () => {
    expect(() => requireApiKeysFor(["anthropic", "groq"])).toThrow(
      /ANTHROPIC_API_KEY.*GROQ_API_KEY|GROQ_API_KEY.*ANTHROPIC_API_KEY/,
    )
  })

  it("only checks the given providers", () => {
    process.env.ANTHROPIC_API_KEY = "x"
    expect(() => requireApiKeysFor(["anthropic"])).not.toThrow()
  })

  it("deduplicates repeated providers", () => {
    expect(() => requireApiKeysFor(["anthropic", "anthropic"])).toThrow(/ANTHROPIC_API_KEY/)
  })
})
