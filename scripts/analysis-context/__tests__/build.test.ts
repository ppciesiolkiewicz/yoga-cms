import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../db/repo"
import { buildAnalysisContext } from "../build"
import type { AnalyzeInput } from "../../core/types"

const input: AnalyzeInput = {
  categories: [
    { name: "Home", extraInfo: "", prompt: "", provider: "anthropic", model: "claude-sonnet-4-6" },
    { name: "Pricing", extraInfo: "", prompt: "", provider: "anthropic", model: "claude-sonnet-4-6" },
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

  it("produces site-then-category nested shape for a single pair", async () => {
    const req = await repo.createRequest(input)
    const [siteA] = req.sites
    await repo.putJson(
      { requestId: req.id, siteId: siteA.id, stage: "extract-pages-content", name: "pricing.json" },
      { items: ["A"] },
    )

    const ctx = await buildAnalysisContext(
      repo,
      {
        requestId: req.id,
        contextElements: [{ siteId: siteA.id, categoryId: "pricing" }],
      },
      { extractedContent: true },
    )

    expect(ctx.json).toEqual({
      sites: {
        [siteA.id]: { pricing: { extractedContent: { items: ["A"] } } },
      },
    })
    expect(ctx.bytes).toBeGreaterThan(0)
  })

  it("aggregates many pairs under the same site key", async () => {
    const req = await repo.createRequest(input)
    const [siteA] = req.sites
    await repo.putJson(
      { requestId: req.id, siteId: siteA.id, stage: "extract-pages-content", name: "home.json" },
      { items: ["H"] },
    )
    await repo.putJson(
      { requestId: req.id, siteId: siteA.id, stage: "extract-pages-content", name: "pricing.json" },
      { items: ["P"] },
    )

    const ctx = await buildAnalysisContext(
      repo,
      {
        requestId: req.id,
        contextElements: [
          { siteId: siteA.id, categoryId: "home" },
          { siteId: siteA.id, categoryId: "pricing" },
        ],
      },
      { extractedContent: true },
    )

    expect(ctx.json).toEqual({
      sites: {
        [siteA.id]: {
          home: { extractedContent: { items: ["H"] } },
          pricing: { extractedContent: { items: ["P"] } },
        },
      },
    })
  })

  it("empty contextElements yields empty sites map", async () => {
    const req = await repo.createRequest(input)
    const ctx = await buildAnalysisContext(repo, { requestId: req.id, contextElements: [] }, { report: true })
    expect(ctx.json).toEqual({ sites: {} })
    expect(ctx.missing).toEqual([])
  })

  it("includes request input when tiers.input is set", async () => {
    const req = await repo.createRequest(input)
    const ctx = await buildAnalysisContext(
      repo,
      {
        requestId: req.id,
        contextElements: [{ siteId: req.sites[0].id, categoryId: "home" }],
      },
      { input: true },
    )
    const json = ctx.json as { input?: unknown }
    expect(json.input).toBeTruthy()
  })
})
