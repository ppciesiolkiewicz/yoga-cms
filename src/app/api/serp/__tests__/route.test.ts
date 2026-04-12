import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "../route"

describe("POST /api/serp", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("returns 401 when SERPER_API_KEY is not set", async () => {
    vi.stubEnv("SERPER_API_KEY", "")
    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when query is missing", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("forwards query to Serper and returns raw response", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    const mockSerperResponse = {
      organic: [{ title: "Result", link: "https://example.com", snippet: "A result", position: 1 }],
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSerperResponse), { status: 200 })
    )
    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "yoga studios" }),
    })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toEqual(mockSerperResponse)
    expect(fetchSpy).toHaveBeenCalledWith("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": "test-key", "Content-Type": "application/json" },
      body: JSON.stringify({ q: "yoga studios" }),
    })
  })

  it("passes page parameter to Serper", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ organic: [] }), { status: 200 })
    )
    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "yoga", page: 2 }),
    })
    await POST(req)
    expect(fetchSpy).toHaveBeenCalledWith("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": "test-key", "Content-Type": "application/json" },
      body: JSON.stringify({ q: "yoga", page: 2 }),
    })
  })

  it("forwards Serper error status", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Rate limited" }), { status: 429 })
    )
    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "yoga" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })
})
