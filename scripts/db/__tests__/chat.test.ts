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

describe("Repo chats", () => {
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

  it("creates a chat with a UUID id and a scope snapshot", async () => {
    const scope = { requestId, contextElements: [{ siteId: "site_a", categoryId: "home" }] }
    const chat = await repo.createChat(requestId, {
      scope,
      model: "claude-sonnet-4-6",
      tiers: { report: true },
      title: "First",
    })
    expect(chat.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(chat.scope).toEqual(scope)
  })

  it("list/get/append round-trip", async () => {
    const scope = { requestId, contextElements: [] }
    const chat = await repo.createChat(requestId, { scope, model: "m", tiers: {}, title: "A" })

    await repo.appendChatMessage(requestId, chat.id, {
      role: "user", content: "hi", createdAt: new Date().toISOString(),
    })
    await repo.appendChatMessage(requestId, chat.id, {
      role: "assistant", content: "hello", createdAt: new Date().toISOString(),
    })

    const full = await repo.getChat(requestId, chat.id)
    expect(full.messages).toHaveLength(2)
    expect(full.messages[0].content).toBe("hi")

    const list = await repo.listChats(requestId)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(chat.id)
  })

  it("chats from different requests are isolated", async () => {
    const other = await repo.createRequest(input)
    await repo.createChat(requestId, {
      scope: { requestId, contextElements: [] }, model: "m", tiers: {}, title: "A",
    })
    expect(await repo.listChats(other.id)).toHaveLength(0)
  })
})
