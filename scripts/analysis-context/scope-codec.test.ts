import { describe, it, expect } from "vitest"
import { encodeScope, decodeScope, encodeTiers, decodeTiers } from "./scope-codec"

describe("scope-codec", () => {
  it("round-trips request scope", () => {
    const s = { kind: "request" as const, requestId: "r_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips site scope", () => {
    const s = { kind: "site" as const, requestId: "r_1", siteId: "site_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips category scope", () => {
    const s = { kind: "category" as const, requestId: "r_1", siteId: "site_1", categoryId: "home" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("rejects malformed scope", () => {
    expect(() => decodeScope("bogus")).toThrow()
  })
  it("encodes tiers as letter mask", () => {
    expect(encodeTiers({ report: true, rawPages: true })).toBe("r,pg")
    expect(decodeTiers("r,pg")).toEqual({ report: true, rawPages: true })
  })
  it("empty tiers string → empty tiers", () => {
    expect(decodeTiers("")).toEqual({})
  })
})
