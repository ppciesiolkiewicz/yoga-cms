import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../db/repo"
import { buildAnalysisContext } from "../build"
import type { AnalyzeInput } from "../../core/types"

const input: AnalyzeInput = {
  categories: [
    { name: "Home", extraInfo: "", prompt: "", model: "sonnet" },
    { name: "Pricing", extraInfo: "", prompt: "", model: "sonnet" },
  ],
  sites: [{ url: "https://a.test" }, { url: "https://b.test" }],
}

describe("buildAnalysisContext", () => {
  let dir: string
  let repo: Repo

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "build-"))
    repo = new Repo(dir)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("category scope aggregates per-site data keyed by siteId", async () => {
    const req = await repo.createRequest(input)
    const [siteA, siteB] = req.sites
    const ref = (siteId: string) => ({
      requestId: req.id,
      siteId,
      stage: "extract-pages-content",
      name: "pricing.json",
    })
    await repo.putJson(ref(siteA.id), { items: ["A"] })
    await repo.putJson(ref(siteB.id), { items: ["B"] })

    const ctx = await buildAnalysisContext(
      repo,
      { kind: "category", requestId: req.id, categoryId: "pricing" },
      { extractedContent: true },
    )

    expect(ctx.json).toEqual({
      sites: {
        [siteA.id]: { extractedContent: { items: ["A"] } },
        [siteB.id]: { extractedContent: { items: ["B"] } },
      },
    })
    expect(ctx.bytes).toBeGreaterThan(0)
  })

  it("category scope with explicit siteIds filters the aggregation", async () => {
    const req = await repo.createRequest(input)
    const [siteA, siteB] = req.sites
    const ref = (siteId: string) => ({
      requestId: req.id,
      siteId,
      stage: "extract-pages-content",
      name: "pricing.json",
    })
    await repo.putJson(ref(siteA.id), { items: ["A"] })
    await repo.putJson(ref(siteB.id), { items: ["B"] })

    const ctx = await buildAnalysisContext(
      repo,
      { kind: "category", requestId: req.id, categoryId: "pricing", siteIds: [siteA.id] },
      { extractedContent: true },
    )

    expect(Object.keys(ctx.json.sites as object)).toEqual([siteA.id])
  })

  it("category scope includes request input when tiers.input is set", async () => {
    const req = await repo.createRequest(input)
    const ctx = await buildAnalysisContext(
      repo,
      { kind: "category", requestId: req.id, categoryId: "home" },
      { input: true },
    )
    const json = ctx.json as { input?: unknown; sites: Record<string, unknown> }
    expect(json.input).toBeTruthy()
    expect(Object.keys(json.sites)).toHaveLength(2)
  })
})
