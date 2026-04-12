import { describe, it, expect } from "vitest"
import { refToPath, requestDir, dbRoot } from "../paths"

describe("paths", () => {
  it("builds request-scoped artifact path (no site)", () => {
    const p = refToPath("/tmp/db", { requestId: "r1", stage: "meta", name: "summary.json" })
    expect(p).toBe("/tmp/db/requests/r1/meta/summary.json")
  })

  it("builds site-scoped artifact path", () => {
    const p = refToPath("/tmp/db", {
      requestId: "r1",
      siteId: "s1",
      stage: "fetch-home",
      name: "home.html",
    })
    expect(p).toBe("/tmp/db/requests/r1/sites/s1/fetch-home/home.html")
  })

  it("builds requestDir", () => {
    expect(requestDir("/tmp/db", "r1")).toBe("/tmp/db/requests/r1")
  })

  it("derives dbRoot from an absolute data dir", () => {
    expect(dbRoot("/abs/data")).toBe("/abs/data/db")
  })

  it("builds request-scoped artifact path with empty stage", () => {
    expect(refToPath("/tmp/db", { requestId: "r1", stage: "", name: "result.json" }))
      .toBe("/tmp/db/requests/r1/result.json")
  })
})
