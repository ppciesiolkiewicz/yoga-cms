import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../../../scripts/db/repo"
import { encodeScope, encodeTiers } from "../../../../scripts/analysis-context/scope-codec"
import { GET } from "./route"

describe("GET /api/compose", () => {
  let dir: string
  let requestId: string
  let siteId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "api-compose-"))
    process.env.YOGA_DATA_DIR = dir
    const repo = new Repo(dir)
    const req = await repo.createRequest({
      categories: [{ name: "Home", extraInfo: "", prompt: "", model: "sonnet" }],
      sites: [{ url: "https://a.test" }],
    })
    requestId = req.id
    siteId = req.sites[0].id
    await repo.putJson(
      { requestId, siteId, stage: "build-report", name: "build-report.json" },
      { summary: "ok" },
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.YOGA_DATA_DIR
  })

  it("returns composed JSON", async () => {
    const scope = encodeScope({ kind: "site", requestId, siteId })
    const tiers = encodeTiers({ report: true })
    const req = new Request(`http://localhost/api/compose?scope=${scope}&tiers=${tiers}`)
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.json).toEqual({ report: { summary: "ok" } })
    expect(body.bytes).toBeGreaterThan(0)
  })

  it("400 on malformed scope", async () => {
    const req = new Request("http://localhost/api/compose?scope=bad&tiers=r")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
