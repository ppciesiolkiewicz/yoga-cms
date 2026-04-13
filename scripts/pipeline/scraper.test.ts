import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./playwright-scraper", () => ({
  scrapeWithPlaywright: vi.fn(),
}))

vi.mock("./firecrawl-client", () => ({
  scrapeUrl: vi.fn(),
}))

import { scrape } from "./scraper"
import { scrapeWithPlaywright } from "./playwright-scraper"
import { scrapeUrl } from "./firecrawl-client"

const mockPlaywright = vi.mocked(scrapeWithPlaywright)
const mockFirecrawl = vi.mocked(scrapeUrl)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("scrape", () => {
  const okResult = { markdown: "# Hello", links: ["https://example.com"] }

  it("returns Playwright result when it succeeds", async () => {
    mockPlaywright.mockResolvedValue(okResult)
    const result = await scrape("https://example.com")
    expect(result).toEqual(okResult)
    expect(mockFirecrawl).not.toHaveBeenCalled()
  })

  it("falls back to Firecrawl when Playwright returns error", async () => {
    mockPlaywright.mockResolvedValue({ error: "timeout" })
    mockFirecrawl.mockResolvedValue(okResult)
    const result = await scrape("https://example.com")
    expect(result).toEqual(okResult)
    expect(mockFirecrawl).toHaveBeenCalledWith("https://example.com", {})
  })

  it("falls back to Firecrawl when Playwright throws", async () => {
    mockPlaywright.mockRejectedValue(new Error("browser crash"))
    mockFirecrawl.mockResolvedValue(okResult)
    const result = await scrape("https://example.com")
    expect(result).toEqual(okResult)
  })

  it("returns error when both scrapers fail", async () => {
    mockPlaywright.mockResolvedValue({ error: "timeout" })
    mockFirecrawl.mockResolvedValue({ error: "rate limited" })
    const result = await scrape("https://example.com")
    expect("error" in result).toBe(true)
  })

  it("returns error when Firecrawl fallback throws", async () => {
    mockPlaywright.mockResolvedValue({ error: "timeout" })
    mockFirecrawl.mockRejectedValue(new Error("network error"))
    const result = await scrape("https://example.com")
    expect("error" in result).toBe(true)
  })

  it("passes opts through to both scrapers", async () => {
    const opts = { includeRawHtml: true, onlyMainContent: false }
    mockPlaywright.mockResolvedValue({ error: "fail" })
    mockFirecrawl.mockResolvedValue(okResult)
    await scrape("https://example.com", opts)
    expect(mockPlaywright).toHaveBeenCalledWith("https://example.com", opts)
    expect(mockFirecrawl).toHaveBeenCalledWith("https://example.com", opts)
  })
})
