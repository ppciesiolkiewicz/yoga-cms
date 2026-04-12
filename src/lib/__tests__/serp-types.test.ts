import { describe, it, expect } from "vitest"
import type { SerperResponse } from "../serp-types"

describe("SerperResponse types", () => {
  it("accepts a minimal organic response", () => {
    const response: SerperResponse = {
      searchParameters: { q: "yoga studios", type: "search" },
      organic: [
        { title: "Best Yoga Studio", link: "https://example.com", snippet: "A great yoga studio", position: 1 },
      ],
    }
    expect(response.organic).toHaveLength(1)
    expect(response.organic![0].link).toBe("https://example.com")
  })

  it("accepts a full response with all optional sections", () => {
    const response: SerperResponse = {
      searchParameters: { q: "yoga", type: "search" },
      organic: [],
      knowledgeGraph: { title: "Yoga", type: "Practice", description: "Ancient practice", attributes: { origin: "India" } },
      peopleAlsoAsk: [{ question: "What is yoga?", snippet: "Yoga is...", link: "https://example.com" }],
      relatedSearches: [{ query: "yoga near me" }],
      topStories: [{ title: "Story", link: "https://news.com", source: "News", date: "2026-01-01" }],
      images: [{ title: "Yoga pose", imageUrl: "https://img.com/1.jpg", link: "https://example.com" }],
    }
    expect(response.knowledgeGraph?.title).toBe("Yoga")
    expect(response.peopleAlsoAsk).toHaveLength(1)
    expect(response.relatedSearches).toHaveLength(1)
  })
})
