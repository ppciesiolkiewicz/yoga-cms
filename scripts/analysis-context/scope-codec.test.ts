import { describe, it, expect } from "vitest"
import { encodeScope, decodeScope, encodeTiers, decodeTiers, scopeKey } from "./scope-codec"

describe("scope-codec", () => {
  it("round-trips request scope", () => {
    const s = { kind: "request" as const, requestId: "r_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips site scope", () => {
    const s = { kind: "site" as const, requestId: "r_1", siteId: "site_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips category scope without siteIds", () => {
    const s = { kind: "category" as const, requestId: "r_1", categoryId: "home" }
    expect(encodeScope(s)).toBe("cat:r_1:home")
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("rejects malformed scope", () => {
    expect(() => decodeScope("bogus")).toThrow()
  })
  it("rejects legacy 4-segment category scope", () => {
    expect(() => decodeScope("cat:r_1:site_1:home")).toThrow()
  })
  it("scopeKey for category drops siteId", () => {
    const s = { kind: "category" as const, requestId: "r_1", categoryId: "home" }
    expect(scopeKey(s)).toBe("cat-home")
  })
  it("encodes tiers as letter mask", () => {
    expect(encodeTiers({ report: true, rawPages: true })).toBe("r,pg")
    expect(decodeTiers("r,pg")).toEqual({ report: true, rawPages: true })
  })
  it("empty tiers string → empty tiers", () => {
    expect(decodeTiers("")).toEqual({})
  })
})
