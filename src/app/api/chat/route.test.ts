import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../../../scripts/db/repo"
import { resetRepoForTests } from "../../../lib/repo-server"

vi.mock("../../../../scripts/chat/stream", async () => {
  const actual = await vi.importActual<typeof import("../../../../scripts/chat/stream")>(
    "../../../../scripts/chat/stream"
  )
  return {
    ...actual,
    streamScopedChat: async function* () {
      yield { type: "token", text: "Hello " }
      yield { type: "token", text: "world" }
      yield { type: "done" }
    },
  }
})

// Import POST AFTER the mock is registered
import { POST } from "./route"

describe("POST /api/chat", () => {
  let dir: string
  let requestId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "api-chat-"))
    process.env.YOGA_DATA_DIR = dir
    process.env.ANTHROPIC_API_KEY = "test"
    resetRepoForTests()
    const repo = new Repo(dir)
    const req = await repo.createRequest({
      categories: [{ name: "Home", extraInfo: "", prompt: "", model: "sonnet" }],
      sites: [{ url: "https://a.test" }],
    })
    requestId = req.id
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.YOGA_DATA_DIR
    delete process.env.ANTHROPIC_API_KEY
  })

  it("creates chat, streams tokens, persists both messages", async () => {
    const body = {
      scope: { kind: "request", requestId },
      tiers: { report: true },
      model: "claude-sonnet-4-6",
      userMessage: "hi",
    }
    const res = await POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }))
    expect(res.status).toBe(200)
    const reader = res.body!.getReader()
    let out = ""
    const decoder = new TextDecoder()
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      out += decoder.decode(value)
    }
    expect(out).toContain("Hello ")
    expect(out).toContain("world")
    expect(out).toContain("chatId")

    const repo = new Repo(dir)
    const chats = await repo.listScopedChats({ kind: "request", requestId })
    expect(chats).toHaveLength(1)
    const full = await repo.getScopedChat({ kind: "request", requestId }, chats[0].id)
    expect(full.messages).toHaveLength(2)
    expect(full.messages[0].content).toBe("hi")
    expect(full.messages[1].content).toBe("Hello world")
  })

  it("rejects unsupported model", async () => {
    const res = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ scope: { kind: "request", requestId }, tiers: {}, model: "gpt-9000", userMessage: "hi" }),
    }))
    expect(res.status).toBe(400)
  })
})
