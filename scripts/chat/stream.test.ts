import { describe, it, expect } from "vitest"
import { buildChatMessages } from "./stream"
import type { AnalysisContext } from "../analysis-context/types"

const ctx = (json: Record<string, unknown>): AnalysisContext => ({
  scope: { requestId: "r", contextElements: [] },
  tiers: {},
  json,
  bytes: Buffer.byteLength(JSON.stringify(json)),
  missing: [],
})

describe("buildChatMessages", () => {
  it("single chunk → one system message with inline context", () => {
    const { system, messages } = buildChatMessages({
      context: ctx({ a: 1 }),
      history: [],
      userMessage: "what is a?",
      maxBytes: 10_000,
    })
    expect(system).toContain("Analysis context")
    expect(system).toContain('"a":1')
    expect(messages).toEqual([{ role: "user", content: "what is a?" }])
  })

  it("multi-chunk → preamble system + interleaved user/assistant + final question", () => {
    const big = "x".repeat(400)
    const result = buildChatMessages({
      context: ctx({ a: big, b: big }),
      history: [],
      userMessage: "analyze",
      maxBytes: 500,
    })
    expect(result.system).toMatch(/delivered across \d+ consecutive messages/)
    expect(result.messages.filter(m => m.role === "assistant" && m.content === "ok").length).toBeGreaterThan(0)
    expect(result.messages.at(-1)).toEqual({ role: "user", content: "analyze" })
    const endOfContextMsg = result.messages.find(m => m.content === "END-OF-CONTEXT")
    expect(endOfContextMsg).toBeDefined()
  })

  it("prepends existing history after context, before new user message", () => {
    const { messages } = buildChatMessages({
      context: ctx({ a: 1 }),
      history: [{ role: "user", content: "earlier", createdAt: "" }, { role: "assistant", content: "reply", createdAt: "" }],
      userMessage: "next",
      maxBytes: 10_000,
    })
    expect(messages).toEqual([
      { role: "user", content: "earlier" },
      { role: "assistant", content: "reply" },
      { role: "user", content: "next" },
    ])
  })
})
