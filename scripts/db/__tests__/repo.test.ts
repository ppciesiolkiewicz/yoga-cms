import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../repo"
import type { AnalyzeInput } from "../../core/types"

function sampleInput(): AnalyzeInput {
  return {
    displayName: "Test run",
    categories: [
      { name: "menu", extraInfo: "food menus", prompt: "describe menus", model: "sonnet" },
      { name: "hours", extraInfo: "opening hours", prompt: "describe hours", model: "sonnet" },
    ],
    sites: [{ url: "https://example.com", meta: { city: "Testville" } }],
  }
}

describe("Repo", () => {
  let tmp: string
  let repo: Repo

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repo-"))
    repo = new Repo(tmp)
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it("createRequest assigns ids and persists request.json", async () => {
    const req = await repo.createRequest(sampleInput())
    expect(req.id).toMatch(/\S/)
    expect(req.createdAt).toMatch(/T/)
    expect(req.categories).toHaveLength(2)
    expect(req.categories[0].id).toMatch(/\S/)
    expect(req.sites).toHaveLength(1)
    expect(req.sites[0].id).toMatch(/\S/)

    const loaded = await repo.getRequest(req.id)
    expect(loaded).toEqual({ ...req, status: "pending" })
  })

  it("createRequest updates index.json", async () => {
    const a = await repo.createRequest(sampleInput())
    const b = await repo.createRequest(sampleInput())
    const list = await repo.listRequests()
    const ids = list.map(e => e.id).sort()
    expect(ids).toEqual([a.id, b.id].sort())
    expect(list[0].siteCount).toBe(1)
    expect(list[0].categoryCount).toBe(2)
  })

  it("putArtifact/getArtifact round-trip buffer content", async () => {
    const req = await repo.createRequest(sampleInput())
    const siteId = req.sites[0].id
    const ref = { requestId: req.id, siteId, stage: "fetch-home", name: "home.html" }
    await repo.putArtifact(ref, "<html>hi</html>")
    expect(await repo.artifactExists(ref)).toBe(true)
    const buf = await repo.getArtifact(ref)
    expect(buf.toString("utf8")).toBe("<html>hi</html>")
  })

  it("putJson/getJson round-trip typed objects", async () => {
    const req = await repo.createRequest(sampleInput())
    const siteId = req.sites[0].id
    const ref = { requestId: req.id, siteId, stage: "detect-tech", name: "detect-tech.json" }
    await repo.putJson(ref, { platform: "WordPress", count: 3 })
    const back = await repo.getJson<{ platform: string; count: number }>(ref)
    expect(back).toEqual({ platform: "WordPress", count: 3 })
  })

  it("artifactExists returns false for missing refs", async () => {
    const req = await repo.createRequest(sampleInput())
    expect(await repo.artifactExists({
      requestId: req.id,
      siteId: req.sites[0].id,
      stage: "assess-pages",
      name: "assess-pages.json",
    })).toBe(false)
  })

  it("consolidateRequest aggregates per-category artifacts into result.json", async () => {
    const req = await repo.createRequest(sampleInput())
    const siteId = req.sites[0].id
    const catId = req.categories[0].id

    // Per-category artifacts use <categoryId>.json
    await repo.putJson({ requestId: req.id, siteId, stage: "detect-tech", name: `${catId}.json` }, { platform: "WordPress" })
    // Single-file stage
    await repo.putJson(
      { requestId: req.id, siteId, stage: "classify-nav", name: "classify-nav.json" },
      { byCategory: {} },
    )

    await repo.consolidateRequest(req.id)

    const result = await repo.getJson<{
      request: { id: string }
      sites: Array<{ siteId: string; artifacts: Record<string, unknown>; queries: unknown[] }>
    }>({ requestId: req.id, stage: "", name: "result.json" })

    expect(result.request.id).toBe(req.id)
    expect(result.sites).toHaveLength(1)
    expect(result.sites[0].siteId).toBe(siteId)
    // Per-category stages are keyed by categoryId
    const tech = result.sites[0].artifacts["detect-tech"] as Record<string, unknown>
    expect(tech[catId]).toEqual({ platform: "WordPress" })
    // Single-file stage
    expect(result.sites[0].artifacts["classify-nav"]).toEqual({ byCategory: {} })
    expect(result.sites[0].queries).toEqual([])
  })
})
