import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../../../scripts/db/repo"
import { resetRepoForTests } from "../../../lib/repo-server"
import { POST } from "./route"

describe("POST /api/compose", () => {
  let dir: string
  let requestId: string
  let siteId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "compose-"))
    process.env.YOGA_DATA_DIR = dir
    resetRepoForTests()
    const repo = new Repo(dir)
    const req = await repo.createRequest({
      categories: [{ name: "Home", extraInfo: "", prompt: "", provider: "anthropic", model: "claude-sonnet-4-6" }],
      sites: [{ url: "https://a.test" }],
    })
    requestId = req.id
    siteId = req.sites[0].id
    await repo.putJson(
      { requestId, siteId, stage: "extract-pages-content", name: "home.json" },
      { items: ["X"] },
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.YOGA_DATA_DIR
  })

  it("returns the context for a pair", async () => {
    const res = await POST(
      new Request("http://localhost/api/compose", {
        method: "POST",
        body: JSON.stringify({
          scope: { requestId, contextElements: [{ siteId, categoryId: "home" }] },
          tiers: { extractedContent: true },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.json.sites[siteId].home.extractedContent).toEqual({ items: ["X"] })
  })

  it("rejects missing requestId", async () => {
    const res = await POST(
      new Request("http://localhost/api/compose", {
        method: "POST",
        body: JSON.stringify({ scope: { contextElements: [] }, tiers: {} }),
      }),
    )
    expect(res.status).toBe(400)
  })
})
