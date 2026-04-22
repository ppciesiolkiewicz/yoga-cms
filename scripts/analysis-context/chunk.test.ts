import { describe, it, expect } from "vitest"
import { chunkAnalysisContext } from "./chunk"
import type { AnalysisContext } from "./types"

const ctx = (json: Record<string, unknown>): AnalysisContext => ({
  scope: { requestId: "r", contextElements: [] },
  tiers: {},
  json,
  bytes: Buffer.byteLength(JSON.stringify(json)),
  missing: [],
})

describe("chunkAnalysisContext", () => {
  it("single chunk when under budget", () => {
    const chunks = chunkAnalysisContext(ctx({ a: 1, b: 2 }), 10_000)
    expect(chunks).toHaveLength(1)
    expect(JSON.parse(chunks[0])).toEqual({ a: 1, b: 2 })
  })
  it("splits at top-level keys when over budget", () => {
    const big = "x".repeat(200)
    const chunks = chunkAnalysisContext(ctx({ a: big, b: big, c: big }), 300)
    expect(chunks.length).toBeGreaterThan(1)
    const rejoined = chunks.reduce<Record<string, unknown>>((acc, c) => ({ ...acc, ...JSON.parse(c) }), {})
    expect(rejoined).toEqual({ a: big, b: big, c: big })
  })
  it("per-chunk size stays within budget when possible", () => {
    const big = "x".repeat(200)
    const chunks = chunkAnalysisContext(ctx({ a: big, b: big }), 300)
    for (const c of chunks) expect(Buffer.byteLength(c)).toBeLessThanOrEqual(400)
  })
  it("single oversized key goes in its own chunk", () => {
    const huge = "y".repeat(1000)
    const chunks = chunkAnalysisContext(ctx({ a: huge, b: "short" }), 300)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })
})
