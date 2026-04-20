import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../repo"
import type { AnalyzeInput } from "../../core/types"

const input: AnalyzeInput = {
  categories: [{ name: "Home", extraInfo: "", prompt: "", model: "sonnet" }],
  sites: [{ url: "https://a.test" }],
}

describe("Repo scoped chats", () => {
  let dir: string
  let repo: Repo
  let requestId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "chat-"))
    repo = new Repo(dir)
    const req = await repo.createRequest(input)
    requestId = req.id
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("create, list, get, append", async () => {
    const scope = { kind: "request" as const, requestId }
    const chat = await repo.createScopedChat(scope, { model: "claude-sonnet-4-6", tiers: { report: true }, title: "First" })
    expect(chat.id).toMatch(/^chat_/)

    await repo.appendScopedChatMessage(scope, chat.id, { role: "user", content: "hi", createdAt: new Date().toISOString() })
    await repo.appendScopedChatMessage(scope, chat.id, { role: "assistant", content: "hello", createdAt: new Date().toISOString() })

    const full = await repo.getScopedChat(scope, chat.id)
    expect(full.messages).toHaveLength(2)
    expect(full.messages[0].content).toBe("hi")

    const list = await repo.listScopedChats(scope)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(chat.id)
  })

  it("different scopes do not share chats", async () => {
    const s1 = { kind: "request" as const, requestId }
    const s2 = { kind: "site" as const, requestId, siteId: "site_x" }
    await repo.createScopedChat(s1, { model: "m", tiers: {}, title: "A" })
    expect(await repo.listScopedChats(s2)).toHaveLength(0)
  })
})
