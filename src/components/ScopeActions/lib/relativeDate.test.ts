import { describe, it, expect } from "vitest"
import { relativeDate } from "./relativeDate"

describe("relativeDate", () => {
  const now = new Date("2026-04-20T12:00:00Z").getTime()

  it("returns 'just now' for deltas under a minute", () => {
    expect(relativeDate(new Date(now - 30 * 1000).toISOString(), now)).toBe("just now")
  })
  it("returns minutes for deltas under an hour", () => {
    expect(relativeDate(new Date(now - 14 * 60 * 1000).toISOString(), now)).toBe("14m ago")
  })
  it("returns hours for deltas under a day", () => {
    expect(relativeDate(new Date(now - 3 * 60 * 60 * 1000).toISOString(), now)).toBe("3h ago")
  })
  it("returns days for longer deltas", () => {
    expect(relativeDate(new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(), now)).toBe("2d ago")
  })
  it("handles invalid input by returning empty string", () => {
    expect(relativeDate("nope", now)).toBe("")
  })
})
