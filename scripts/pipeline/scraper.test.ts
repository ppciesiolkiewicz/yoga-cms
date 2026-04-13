import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("./playwright-scraper", () => ({
  scrapeWithPlaywright: vi.fn(),
}))

import { scrape } from "./scraper"
import { scrapeWithPlaywright } from "./playwright-scraper"

const mockPlaywright = vi.mocked(scrapeWithPlaywright)

beforeEach(() => {
  vi.clearAllMocks()
})

describe("scrape", () => {
  const okResult = { markdown: "# Hello", links: ["https://example.com"] }

  it("returns Playwright result when it succeeds", async () => {
    mockPlaywright.mockResolvedValue(okResult)
    const result = await scrape("https://example.com")
    expect(result).toEqual(okResult)
  })

  it("returns error when Playwright returns error", async () => {
    mockPlaywright.mockResolvedValue({ error: "timeout" })
    const result = await scrape("https://example.com")
    expect("error" in result).toBe(true)
  })

  it("returns error when Playwright throws", async () => {
    mockPlaywright.mockRejectedValue(new Error("browser crash"))
    const result = await scrape("https://example.com")
    expect("error" in result).toBe(true)
  })

  it("passes opts through to Playwright", async () => {
    const opts = { includeRawHtml: true, onlyMainContent: false }
    mockPlaywright.mockResolvedValue(okResult)
    await scrape("https://example.com", opts)
    expect(mockPlaywright).toHaveBeenCalledWith("https://example.com", opts)
  })
})
