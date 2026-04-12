import { describe, it, expect } from "vitest"
import { buildBasePromptMessage } from "../base-prompt"

describe("buildBasePromptMessage", () => {
  it("includes category name and extraInfo", () => {
    const msg = buildBasePromptMessage("drop in", "recurring classes at the studio")
    expect(msg).toContain("drop in")
    expect(msg).toContain("recurring classes at the studio")
  })
})
