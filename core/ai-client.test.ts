import { describe, it, expect, vi, beforeEach } from "vitest"
import { getClient, AIClient, type CompleteRequest } from "./ai-client"

const anthropicCreate = vi.fn()
const anthropicStream = vi.fn()
vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = { create: anthropicCreate, stream: anthropicStream }
  }
  return { default: MockAnthropic }
})

const groqCreate = vi.fn()
vi.mock("groq-sdk", () => {
  class MockGroq {
    chat = { completions: { create: groqCreate } }
  }
  return { default: MockGroq }
})

beforeEach(() => {
  anthropicCreate.mockReset()
  anthropicStream.mockReset()
  groqCreate.mockReset()
  process.env.ANTHROPIC_API_KEY = "test-anthropic"
  process.env.GROQ_API_KEY = "test-groq"
})

describe("getClient", () => {
  it("returns an AIClient subclass for 'anthropic'", () => {
    const c = getClient("anthropic")
    expect(c).toBeInstanceOf(AIClient)
    expect(c.provider).toBe("anthropic")
  })

  it("returns an AIClient subclass for 'groq'", () => {
    const c = getClient("groq")
    expect(c).toBeInstanceOf(AIClient)
    expect(c.provider).toBe("groq")
  })

  it("caches the client per provider", () => {
    const a = getClient("anthropic")
    const b = getClient("anthropic")
    expect(a).toBe(b)
  })
})

describe("AnthropicClient.complete", () => {
  it("passes system and messages through unchanged", async () => {
    anthropicCreate.mockResolvedValueOnce({
      content: [{ type: "text", text: "hello" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    })
    const client = getClient("anthropic")
    const req: CompleteRequest = {
      model: "claude-sonnet-4-6",
      system: "you are helpful",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 1024,
    }
    const res = await client.complete(req)
    expect(anthropicCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: "you are helpful",
      messages: [{ role: "user", content: "hi" }],
    })
    expect(res.text).toBe("hello")
    expect(res.usage).toEqual({ inputTokens: 10, outputTokens: 5 })
  })
})

describe("GroqClient.complete", () => {
  it("prepends system as a 'system' role message and maps usage", async () => {
    groqCreate.mockResolvedValueOnce({
      choices: [{ message: { content: "world" } }],
      usage: { prompt_tokens: 20, completion_tokens: 7 },
    })
    const client = getClient("groq")
    const req: CompleteRequest = {
      model: "llama-3.1-8b-instant",
      system: "you are helpful",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 2048,
    }
    const res = await client.complete(req)
    expect(groqCreate).toHaveBeenCalledWith({
      model: "llama-3.1-8b-instant",
      max_tokens: 2048,
      messages: [
        { role: "system", content: "you are helpful" },
        { role: "user", content: "hi" },
      ],
    })
    expect(res.text).toBe("world")
    expect(res.usage).toEqual({ inputTokens: 20, outputTokens: 7 })
  })
})

describe("AnthropicClient.stream", () => {
  it("yields text deltas and a done event", async () => {
    async function* mockStream() {
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "he" } }
      yield { type: "content_block_delta", delta: { type: "text_delta", text: "llo" } }
    }
    anthropicStream.mockReturnValueOnce(mockStream())
    const client = getClient("anthropic")
    const events: unknown[] = []
    for await (const ev of client.stream({
      model: "claude-sonnet-4-6",
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    })) {
      events.push(ev)
    }
    expect(events).toEqual([
      { type: "text", delta: "he" },
      { type: "text", delta: "llo" },
      { type: "done" },
    ])
  })
})

describe("GroqClient.stream", () => {
  it("yields text deltas from OpenAI-shaped chunks and a done event", async () => {
    async function* mockStream() {
      yield { choices: [{ delta: { content: "foo" } }] }
      yield { choices: [{ delta: { content: "bar" } }] }
      yield { choices: [{ delta: {} }] }
    }
    groqCreate.mockResolvedValueOnce(mockStream())
    const client = getClient("groq")
    const events: unknown[] = []
    for await (const ev of client.stream({
      model: "llama-3.1-8b-instant",
      system: "s",
      messages: [{ role: "user", content: "hi" }],
      maxTokens: 100,
    })) {
      events.push(ev)
    }
    expect(events).toEqual([
      { type: "text", delta: "foo" },
      { type: "text", delta: "bar" },
      { type: "done" },
    ])
  })
})
