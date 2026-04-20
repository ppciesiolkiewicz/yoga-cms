import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../db/repo"
import { buildAnalysisContext } from "./build"
import type { AnalyzeInput } from "../core/types"

const input: AnalyzeInput = {
  displayName: "Test",
  categories: [
    { name: "Home", extraInfo: "", prompt: "", model: "sonnet" },
    { name: "Pricing", extraInfo: "", prompt: "", model: "sonnet" },
  ],
  sites: [{ url: "https://a.test" }, { url: "https://b.test" }],
}

describe("buildAnalysisContext", () => {
  let dir: string
  let repo: Repo
  let requestId: string
  let siteId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ac-"))
    repo = new Repo(dir)
    const req = await repo.createRequest(input)
    requestId = req.id
    siteId = req.sites[0].id
    await repo.putJson({ requestId, siteId, stage: "build-report", name: "build-report.json" }, { summary: "x" })
    await repo.putJson({ requestId, siteId, stage: "extract-pages-content", name: "home.json" }, { content: "home" })
    await repo.putJson({ requestId, siteId, stage: "extract-pages-content", name: "pricing.json" }, { content: "pricing" })
    await repo.putJson({ requestId, siteId, stage: "detect-tech", name: "home.json" }, { tech: ["react"] })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("category scope returns only that category slice", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "category", requestId, siteId, categoryId: "home" }, { extractedContent: true, tech: true })
    expect(ctx.json).toEqual({
      extractedContent: { content: "home" },
      tech: { tech: ["react"] },
    })
    expect(ctx.missing).toEqual([])
  })

  it("report tier at site scope returns build-report", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "site", requestId, siteId }, { report: true })
    expect(ctx.json).toEqual({ report: { summary: "x" } })
  })

  it("request scope aggregates across sites", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "request", requestId }, { report: true })
    expect(ctx.json).toMatchObject({ sites: { [siteId]: { report: { summary: "x" } } } })
  })

  it("missing artifacts reported", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "site", requestId, siteId }, { lighthouse: true })
    expect(ctx.json).toEqual({})
    expect(ctx.missing).toContain("lighthouse")
  })

  it("bytes matches JSON.stringify length", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "site", requestId, siteId }, { report: true })
    expect(ctx.bytes).toBe(Buffer.byteLength(JSON.stringify(ctx.json)))
  })
})
