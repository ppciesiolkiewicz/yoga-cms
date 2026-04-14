# Scope Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Copy and Chat buttons at category, site, and request scopes in the report UI, backed by a shared analysis-context module and persisted per-scope chats.

**Architecture:** A new `scripts/analysis-context.ts` module turns `(scope, tiers)` into a JSON payload by reading through `Repo`. Two API routes expose it: `GET /api/compose` (copy + live modal preview) and `POST /api/chat` (streaming Claude chat). A single `ScopeActions` component is inserted at four locations and renders two dropdown buttons.

**Tech Stack:** Next.js 16 App Router, React 19, Anthropic SDK (`@anthropic-ai/sdk` 0.81), shadcn/ui (Dialog, Select, Dropdown, Sheet), Tailwind, Vitest.

**Spec:** [docs/superpowers/specs/2026-04-14-scope-actions-design.md](../specs/2026-04-14-scope-actions-design.md)

---

## Task 1: Scope & tier types + serialization

**Files:**
- Create: `scripts/analysis-context/types.ts`
- Create: `scripts/analysis-context/scope-codec.ts`
- Test: `scripts/analysis-context/scope-codec.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/analysis-context/scope-codec.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { encodeScope, decodeScope, encodeTiers, decodeTiers } from "./scope-codec"

describe("scope-codec", () => {
  it("round-trips request scope", () => {
    const s = { kind: "request" as const, requestId: "r_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips site scope", () => {
    const s = { kind: "site" as const, requestId: "r_1", siteId: "site_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips category scope", () => {
    const s = { kind: "category" as const, requestId: "r_1", siteId: "site_1", categoryId: "home" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("rejects malformed scope", () => {
    expect(() => decodeScope("bogus")).toThrow()
  })
  it("encodes tiers as letter mask", () => {
    expect(encodeTiers({ report: true, rawPages: true })).toBe("r,pg")
    expect(decodeTiers("r,pg")).toEqual({ report: true, rawPages: true })
  })
  it("empty tiers string → empty tiers", () => {
    expect(decodeTiers("")).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/analysis-context/scope-codec.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement types**

Create `scripts/analysis-context/types.ts`:

```ts
export type AnalysisContextScope =
  | { kind: "request"; requestId: string }
  | { kind: "site"; requestId: string; siteId: string }
  | { kind: "category"; requestId: string; siteId: string; categoryId: string }

export type AnalysisContextTiers = {
  report?: boolean
  extractedContent?: boolean
  tech?: boolean
  lighthouse?: boolean
  rawPages?: boolean
  input?: boolean
  progress?: boolean
}

export type AnalysisContext = {
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
  json: Record<string, unknown>
  bytes: number
  missing: string[]
}

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  createdAt: string
  truncated?: boolean
}

export type ChatMeta = {
  id: string
  createdAt: string
  title: string
  model: string
  tiers: AnalysisContextTiers
}

export type ChatRecord = ChatMeta & { messages: ChatMessage[] }
```

- [ ] **Step 4: Implement scope-codec**

Create `scripts/analysis-context/scope-codec.ts`:

```ts
import type { AnalysisContextScope, AnalysisContextTiers } from "./types"

export function encodeScope(s: AnalysisContextScope): string {
  if (s.kind === "request") return `req:${s.requestId}`
  if (s.kind === "site") return `site:${s.requestId}:${s.siteId}`
  return `cat:${s.requestId}:${s.siteId}:${s.categoryId}`
}

export function decodeScope(raw: string): AnalysisContextScope {
  const [kind, ...rest] = raw.split(":")
  if (kind === "req" && rest.length === 1) return { kind: "request", requestId: rest[0] }
  if (kind === "site" && rest.length === 2)
    return { kind: "site", requestId: rest[0], siteId: rest[1] }
  if (kind === "cat" && rest.length === 3)
    return { kind: "category", requestId: rest[0], siteId: rest[1], categoryId: rest[2] }
  throw new Error(`invalid scope: ${raw}`)
}

const TIER_CODES: Array<[keyof AnalysisContextTiers, string]> = [
  ["report", "r"],
  ["extractedContent", "c"],
  ["tech", "t"],
  ["lighthouse", "l"],
  ["rawPages", "pg"],
  ["input", "i"],
  ["progress", "pr"],
]

export function encodeTiers(t: AnalysisContextTiers): string {
  return TIER_CODES.filter(([k]) => t[k]).map(([, code]) => code).join(",")
}

export function decodeTiers(raw: string): AnalysisContextTiers {
  if (!raw) return {}
  const codes = new Set(raw.split(","))
  const out: AnalysisContextTiers = {}
  for (const [k, code] of TIER_CODES) if (codes.has(code)) out[k] = true
  return out
}

export function scopeKey(s: AnalysisContextScope): string {
  if (s.kind === "request") return "all"
  if (s.kind === "site") return `site-${s.siteId}`
  return `site-${s.siteId}-cat-${s.categoryId}`
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run scripts/analysis-context/scope-codec.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/analysis-context/
git commit -m "feat(analysis-context): add scope + tier types and codec"
```

---

## Task 2: `buildAnalysisContext` — core assembly

**Files:**
- Create: `scripts/analysis-context/build.ts`
- Create: `scripts/analysis-context/build.test.ts`

- [ ] **Step 1: Write failing tests**

Create `scripts/analysis-context/build.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../db/repo"
import { buildAnalysisContext } from "./build"
import type { AnalyzeInput } from "../core/types"

const input: AnalyzeInput = {
  displayName: "Test",
  categories: [
    { name: "Home", extraInfo: "", prompt: "", model: "sonnet" },
    { name: "Pricing", extraInfo: "", prompt: "", model: "sonnet" },
  ],
  sites: [{ url: "https://a.test" }, { url: "https://b.test" }],
}

describe("buildAnalysisContext", () => {
  let dir: string
  let repo: Repo
  let requestId: string
  let siteId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "ac-"))
    repo = new Repo(dir)
    const req = await repo.createRequest(input)
    requestId = req.id
    siteId = req.sites[0].id
    await repo.putJson({ requestId, siteId, stage: "build-report", name: "build-report.json" }, { summary: "x" })
    await repo.putJson({ requestId, siteId, stage: "extract-pages-content", name: "home.json" }, { content: "home" })
    await repo.putJson({ requestId, siteId, stage: "extract-pages-content", name: "pricing.json" }, { content: "pricing" })
    await repo.putJson({ requestId, siteId, stage: "detect-tech", name: "home.json" }, { tech: ["react"] })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("category scope returns only that category slice", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "category", requestId, siteId, categoryId: "home" }, { extractedContent: true, tech: true })
    expect(ctx.json).toEqual({
      extractedContent: { content: "home" },
      tech: { tech: ["react"] },
    })
    expect(ctx.missing).toEqual([])
  })

  it("report tier at site scope returns build-report", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "site", requestId, siteId }, { report: true })
    expect(ctx.json).toEqual({ report: { summary: "x" } })
  })

  it("request scope aggregates across sites", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "request", requestId }, { report: true })
    expect(ctx.json).toHaveProperty(`sites.${siteId}.report`)
  })

  it("missing artifacts reported", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "site", requestId, siteId }, { lighthouse: true })
    expect(ctx.json).toEqual({})
    expect(ctx.missing).toContain("lighthouse")
  })

  it("bytes matches JSON.stringify length", async () => {
    const ctx = await buildAnalysisContext(repo, { kind: "site", requestId, siteId }, { report: true })
    expect(ctx.bytes).toBe(Buffer.byteLength(JSON.stringify(ctx.json)))
  })
})
```

Add `import { afterEach } from "vitest"` at top.

- [ ] **Step 2: Run test — expect fail**

Run: `npx vitest run scripts/analysis-context/build.test.ts`
Expected: FAIL — `buildAnalysisContext` not found.

- [ ] **Step 3: Implement**

Create `scripts/analysis-context/build.ts`:

```ts
import type { Repo } from "../db/repo"
import type { Request } from "../core/types"
import type { AnalysisContext, AnalysisContextScope, AnalysisContextTiers } from "./types"
import { join } from "path"
import { requestDir } from "../db/paths"

type TierKey = keyof AnalysisContextTiers

export async function buildAnalysisContext(
  repo: Repo,
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers
): Promise<AnalysisContext> {
  const missing: string[] = []
  let json: Record<string, unknown> = {}

  if (scope.kind === "category") {
    json = await forCategory(repo, scope.requestId, scope.siteId, scope.categoryId, tiers, missing)
  } else if (scope.kind === "site") {
    json = await forSite(repo, scope.requestId, scope.siteId, tiers, missing)
  } else {
    const req = await repo.getRequest(scope.requestId)
    const sites: Record<string, unknown> = {}
    for (const s of req.sites) {
      sites[s.id] = await forSite(repo, scope.requestId, s.id, tiers, missing)
    }
    json = { sites }
    if (tiers.input) json.input = req
  }

  const bytes = Buffer.byteLength(JSON.stringify(json))
  return { scope, tiers, json, bytes, missing: Array.from(new Set(missing)) }
}

async function forCategory(
  repo: Repo,
  requestId: string,
  siteId: string,
  categoryId: string,
  tiers: AnalysisContextTiers,
  missing: string[]
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const tryPut = async (key: TierKey, stage: string, name: string) => {
    if (!tiers[key]) return
    const ref = { requestId, siteId, stage, name }
    if (await repo.artifactExists(ref)) out[key] = await repo.getJson(ref)
    else missing.push(key)
  }
  await tryPut("extractedContent", "extract-pages-content", `${categoryId}.json`)
  await tryPut("tech", "detect-tech", `${categoryId}.json`)
  await tryPut("lighthouse", "run-lighthouse", `${categoryId}.json`)
  // report is site-scoped even when viewed from category — include if requested
  if (tiers.report) {
    const ref = { requestId, siteId, stage: "build-report", name: "build-report.json" }
    if (await repo.artifactExists(ref)) out.report = await repo.getJson(ref)
    else missing.push("report")
  }
  if (tiers.rawPages) await addRawPages(repo, requestId, siteId, out, missing, categoryId)
  if (tiers.progress) await tryPutRoot(repo, "progress", { requestId, siteId, stage: "", name: "progress.json" }, tiers, out, missing)
  return out
}

async function forSite(
  repo: Repo,
  requestId: string,
  siteId: string,
  tiers: AnalysisContextTiers,
  missing: string[]
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const req = await repo.getRequest(requestId)
  if (tiers.report) {
    const ref = { requestId, siteId, stage: "build-report", name: "build-report.json" }
    if (await repo.artifactExists(ref)) out.report = await repo.getJson(ref)
    else missing.push("report")
  }
  for (const stageKey of [["extractedContent", "extract-pages-content"], ["tech", "detect-tech"], ["lighthouse", "run-lighthouse"]] as const) {
    const [tierKey, stage] = stageKey
    if (!tiers[tierKey]) continue
    const byCategory: Record<string, unknown> = {}
    for (const cat of req.categories) {
      const ref = { requestId, siteId, stage, name: `${cat.id}.json` }
      if (await repo.artifactExists(ref)) byCategory[cat.id] = await repo.getJson(ref)
    }
    if (Object.keys(byCategory).length > 0) out[tierKey] = byCategory
    else missing.push(tierKey)
  }
  if (tiers.rawPages) await addRawPages(repo, requestId, siteId, out, missing)
  if (tiers.progress) await tryPutRoot(repo, "progress", { requestId, siteId, stage: "", name: "progress.json" }, tiers, out, missing)
  return out
}

async function addRawPages(
  repo: Repo,
  requestId: string,
  siteId: string,
  out: Record<string, unknown>,
  missing: string[],
  categoryId?: string
) {
  const homeRef = { requestId, siteId, stage: "fetch-home", name: "home.html" }
  const pagesIndexRef = { requestId, siteId, stage: "fetch-pages", name: "index.json" }
  const pages: Record<string, string> = {}
  let any = false
  if (await repo.artifactExists(homeRef)) {
    pages["home.html"] = (await repo.getArtifact(homeRef)).toString("utf8")
    any = true
  }
  if (await repo.artifactExists(pagesIndexRef)) {
    const index = await repo.getJson<Record<string, { url: string; file: string; categoryId?: string }>>(pagesIndexRef)
    for (const [hash, entry] of Object.entries(index)) {
      if (categoryId && entry.categoryId !== categoryId) continue
      const mdRef = { requestId, siteId, stage: "fetch-pages", name: entry.file }
      if (await repo.artifactExists(mdRef)) {
        pages[entry.file] = (await repo.getArtifact(mdRef)).toString("utf8")
        any = true
      }
    }
  }
  if (any) out.rawPages = pages
  else missing.push("rawPages")
}

async function tryPutRoot(
  repo: Repo,
  key: string,
  ref: { requestId: string; siteId?: string; stage: string; name: string },
  _tiers: AnalysisContextTiers,
  out: Record<string, unknown>,
  missing: string[]
) {
  if (await repo.artifactExists(ref)) out[key] = await repo.getJson(ref)
  else missing.push(key)
}
```

Note: the test expectation for request-scope `sites.${siteId}.report` uses a dot path — use `expect(ctx.json).toMatchObject({ sites: { [siteId]: { report: { summary: "x" } } } })` instead. Update the test:

```ts
it("request scope aggregates across sites", async () => {
  const ctx = await buildAnalysisContext(repo, { kind: "request", requestId }, { report: true })
  expect(ctx.json).toMatchObject({ sites: { [siteId]: { report: { summary: "x" } } } })
})
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run scripts/analysis-context/build.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/analysis-context/
git commit -m "feat(analysis-context): implement buildAnalysisContext core assembly"
```

---

## Task 3: Presets + chunking

**Files:**
- Create: `scripts/analysis-context/presets.ts`
- Create: `scripts/analysis-context/chunk.ts`
- Create: `scripts/analysis-context/chunk.test.ts`
- Create: `scripts/analysis-context/index.ts`

- [ ] **Step 1: Write chunk tests**

Create `scripts/analysis-context/chunk.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { chunkAnalysisContext } from "./chunk"
import type { AnalysisContext } from "./types"

const ctx = (json: Record<string, unknown>): AnalysisContext => ({
  scope: { kind: "request", requestId: "r" },
  tiers: {},
  json,
  bytes: Buffer.byteLength(JSON.stringify(json)),
  missing: [],
})

describe("chunkAnalysisContext", () => {
  it("single chunk when under budget", () => {
    const chunks = chunkAnalysisContext(ctx({ a: 1, b: 2 }), 10_000)
    expect(chunks).toHaveLength(1)
    expect(JSON.parse(chunks[0])).toEqual({ a: 1, b: 2 })
  })
  it("splits at top-level keys when over budget", () => {
    const big = "x".repeat(200)
    const chunks = chunkAnalysisContext(ctx({ a: big, b: big, c: big }), 300)
    expect(chunks.length).toBeGreaterThan(1)
    const rejoined = chunks.reduce<Record<string, unknown>>((acc, c) => ({ ...acc, ...JSON.parse(c) }), {})
    expect(rejoined).toEqual({ a: big, b: big, c: big })
  })
  it("per-chunk size stays within budget when possible", () => {
    const big = "x".repeat(200)
    const chunks = chunkAnalysisContext(ctx({ a: big, b: big }), 300)
    for (const c of chunks) expect(Buffer.byteLength(c)).toBeLessThanOrEqual(400)
  })
  it("single oversized key goes in its own chunk", () => {
    const huge = "y".repeat(1000)
    const chunks = chunkAnalysisContext(ctx({ a: huge, b: "short" }), 300)
    expect(chunks.length).toBeGreaterThanOrEqual(2)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run scripts/analysis-context/chunk.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement chunk**

Create `scripts/analysis-context/chunk.ts`:

```ts
import type { AnalysisContext } from "./types"

const DEFAULT_MAX_BYTES = 150_000

export function chunkAnalysisContext(ctx: AnalysisContext, maxBytes: number = DEFAULT_MAX_BYTES): string[] {
  const full = JSON.stringify(ctx.json)
  if (Buffer.byteLength(full) <= maxBytes) return [full]

  const entries = Object.entries(ctx.json)
  const chunks: string[] = []
  let current: Record<string, unknown> = {}
  let currentSize = 2 // "{}"

  for (const [k, v] of entries) {
    const piece = JSON.stringify({ [k]: v })
    const pieceSize = Buffer.byteLength(piece)
    if (pieceSize > maxBytes) {
      if (Object.keys(current).length > 0) {
        chunks.push(JSON.stringify(current))
        current = {}
        currentSize = 2
      }
      chunks.push(piece)
      continue
    }
    if (currentSize + pieceSize > maxBytes && Object.keys(current).length > 0) {
      chunks.push(JSON.stringify(current))
      current = {}
      currentSize = 2
    }
    current[k] = v
    currentSize = Buffer.byteLength(JSON.stringify(current))
  }
  if (Object.keys(current).length > 0) chunks.push(JSON.stringify(current))
  return chunks
}
```

- [ ] **Step 4: Implement presets + barrel**

Create `scripts/analysis-context/presets.ts`:

```ts
import type { Repo } from "../db/repo"
import type { AnalysisContext, AnalysisContextScope } from "./types"
import { buildAnalysisContext } from "./build"

export function buildReportContext(repo: Repo, scope: AnalysisContextScope): Promise<AnalysisContext> {
  return buildAnalysisContext(repo, scope, { report: true })
}

export function buildExtractedContentContext(repo: Repo, scope: AnalysisContextScope): Promise<AnalysisContext> {
  return buildAnalysisContext(repo, scope, { extractedContent: true })
}
```

Create `scripts/analysis-context/index.ts`:

```ts
export * from "./types"
export * from "./scope-codec"
export { buildAnalysisContext } from "./build"
export { buildReportContext, buildExtractedContentContext } from "./presets"
export { chunkAnalysisContext } from "./chunk"
```

- [ ] **Step 5: Run all module tests**

Run: `npx vitest run scripts/analysis-context/`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/analysis-context/
git commit -m "feat(analysis-context): add presets, chunker, public barrel"
```

---

## Task 4: Repo chat persistence methods

**Files:**
- Modify: `scripts/db/repo.ts`
- Create: `scripts/db/__tests__/chat.test.ts`

- [ ] **Step 1: Write failing tests**

Create `scripts/db/__tests__/chat.test.ts`:

```ts
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
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run scripts/db/__tests__/chat.test.ts`
Expected: FAIL.

- [ ] **Step 3: Add methods to Repo**

In `scripts/db/repo.ts`, add imports at top:

```ts
import type { AnalysisContextScope, ChatMeta, ChatMessage, ChatRecord, AnalysisContextTiers } from "../analysis-context/types"
import { scopeKey } from "../analysis-context/scope-codec"
```

Append inside the `Repo` class before the closing brace:

```ts
  // ── scoped chats ──

  private chatDir(requestId: string, key: string): string {
    return join(requestDir(this.root, requestId), "chats", key)
  }

  async createScopedChat(
    scope: AnalysisContextScope,
    meta: { model: string; tiers: AnalysisContextTiers; title: string }
  ): Promise<ChatRecord> {
    const id = newId("chat")
    const record: ChatRecord = {
      id,
      createdAt: new Date().toISOString(),
      title: meta.title,
      model: meta.model,
      tiers: meta.tiers,
      messages: [],
    }
    const path = join(this.chatDir(scope.requestId, scopeKey(scope)), `${id}.json`)
    await this.store.writeFile(path, JSON.stringify(record, null, 2))
    return record
  }

  async getScopedChat(scope: AnalysisContextScope, chatId: string): Promise<ChatRecord> {
    const path = join(this.chatDir(scope.requestId, scopeKey(scope)), `${chatId}.json`)
    const buf = await this.store.readFile(path)
    return JSON.parse(buf.toString("utf8")) as ChatRecord
  }

  async listScopedChats(scope: AnalysisContextScope): Promise<ChatMeta[]> {
    const dir = this.chatDir(scope.requestId, scopeKey(scope))
    if (!(await this.store.exists(dir))) return []
    const files = await this.store.listFiles(dir)
    const metas: ChatMeta[] = []
    for (const f of files) {
      if (!f.endsWith(".json")) continue
      const buf = await this.store.readFile(f)
      const rec = JSON.parse(buf.toString("utf8")) as ChatRecord
      const { messages: _ignored, ...meta } = rec
      metas.push(meta)
    }
    return metas.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async appendScopedChatMessage(
    scope: AnalysisContextScope,
    chatId: string,
    msg: ChatMessage
  ): Promise<void> {
    const rec = await this.getScopedChat(scope, chatId)
    rec.messages.push(msg)
    const path = join(this.chatDir(scope.requestId, scopeKey(scope)), `${chatId}.json`)
    await this.store.writeFile(path, JSON.stringify(rec, null, 2))
  }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run scripts/db/__tests__/chat.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add scripts/db/repo.ts scripts/db/__tests__/chat.test.ts
git commit -m "feat(repo): add scoped chat persistence methods"
```

---

## Task 5: Chat module (Anthropic wrapper)

**Files:**
- Create: `scripts/chat/models.ts`
- Create: `scripts/chat/stream.ts`
- Create: `scripts/chat/stream.test.ts`
- Create: `scripts/chat/index.ts`

- [ ] **Step 1: Write failing test**

Create `scripts/chat/stream.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { buildChatMessages } from "./stream"
import type { AnalysisContext } from "../analysis-context/types"

const ctx = (json: Record<string, unknown>): AnalysisContext => ({
  scope: { kind: "request", requestId: "r" },
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
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run scripts/chat/stream.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement models**

Create `scripts/chat/models.ts`:

```ts
export const SUPPORTED_CHAT_MODELS = [
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const

export type ChatModelId = (typeof SUPPORTED_CHAT_MODELS)[number]["id"]

export function isSupportedModel(id: string): id is ChatModelId {
  return SUPPORTED_CHAT_MODELS.some(m => m.id === id)
}
```

- [ ] **Step 4: Implement stream (message builder + runner)**

Create `scripts/chat/stream.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import type { AnalysisContext, ChatMessage } from "../analysis-context/types"
import { chunkAnalysisContext } from "../analysis-context/chunk"

export type BuiltMessages = {
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
}

export function buildChatMessages(params: {
  context: AnalysisContext
  history: ChatMessage[]
  userMessage: string
  maxBytes?: number
}): BuiltMessages {
  const chunks = chunkAnalysisContext(params.context, params.maxBytes)
  const scopeDesc = describeScope(params.context.scope)

  if (chunks.length === 1) {
    const system = `You are helping the user understand analysis output for ${scopeDesc}. Analysis context (JSON):\n\n${chunks[0]}`
    return {
      system,
      messages: [
        ...params.history.map(m => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: params.userMessage },
      ],
    }
  }

  const system = `You are helping the user understand analysis output for ${scopeDesc}. Analysis context is delivered across ${chunks.length} consecutive messages. Reply with exactly "ok" after each, until you receive "END-OF-CONTEXT", then answer the user's question using the combined context.`
  const messages: Array<{ role: "user" | "assistant"; content: string }> = []
  chunks.forEach((chunk, i) => {
    messages.push({ role: "user", content: `Context part ${i + 1}/${chunks.length}:\n\n${chunk}` })
    messages.push({ role: "assistant", content: "ok" })
  })
  messages.push({ role: "user", content: "END-OF-CONTEXT" })
  messages.push({ role: "assistant", content: "ok" })
  for (const m of params.history) messages.push({ role: m.role, content: m.content })
  messages.push({ role: "user", content: params.userMessage })
  return { system, messages }
}

function describeScope(s: AnalysisContext["scope"]): string {
  if (s.kind === "request") return `the entire analysis request ${s.requestId}`
  if (s.kind === "site") return `site ${s.siteId} in request ${s.requestId}`
  return `category ${s.categoryId} of site ${s.siteId} in request ${s.requestId}`
}

export type StreamEvent = { type: "token"; text: string } | { type: "done" } | { type: "error"; message: string }

export async function* streamScopedChat(params: {
  model: string
  context: AnalysisContext
  history: ChatMessage[]
  userMessage: string
  maxBytes?: number
  client?: Anthropic
}): AsyncIterable<StreamEvent> {
  const client = params.client ?? new Anthropic()
  const { system, messages } = buildChatMessages(params)

  try {
    const stream = client.messages.stream({
      model: params.model,
      max_tokens: 4096,
      system,
      messages,
    })
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield { type: "token", text: event.delta.text }
      }
    }
    yield { type: "done" }
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) }
  }
}
```

- [ ] **Step 5: Create barrel**

Create `scripts/chat/index.ts`:

```ts
export * from "./models"
export { buildChatMessages, streamScopedChat } from "./stream"
export type { StreamEvent, BuiltMessages } from "./stream"
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run scripts/chat/`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/chat/
git commit -m "feat(chat): add Anthropic streaming wrapper + chunked context builder"
```

---

## Task 6: `GET /api/compose` route

**Files:**
- Create: `src/app/api/compose/route.ts`
- Create: `src/app/api/compose/route.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/app/api/compose/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../../../scripts/db/repo"
import { encodeScope, encodeTiers } from "../../../../scripts/analysis-context/scope-codec"
import { GET } from "./route"

describe("GET /api/compose", () => {
  let dir: string
  let requestId: string
  let siteId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "api-compose-"))
    process.env.YOGA_DATA_DIR = dir
    const repo = new Repo(dir)
    const req = await repo.createRequest({
      categories: [{ name: "Home", extraInfo: "", prompt: "", model: "sonnet" }],
      sites: [{ url: "https://a.test" }],
    })
    requestId = req.id
    siteId = req.sites[0].id
    await repo.putJson({ requestId, siteId, stage: "build-report", name: "build-report.json" }, { summary: "ok" })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.YOGA_DATA_DIR
  })

  it("returns composed JSON", async () => {
    const scope = encodeScope({ kind: "site", requestId, siteId })
    const tiers = encodeTiers({ report: true })
    const req = new Request(`http://localhost/api/compose?scope=${scope}&tiers=${tiers}`)
    const res = await GET(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.json).toEqual({ report: { summary: "ok" } })
    expect(body.bytes).toBeGreaterThan(0)
  })

  it("400 on malformed scope", async () => {
    const req = new Request("http://localhost/api/compose?scope=bad&tiers=r")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/app/api/compose/route.test.ts`
Expected: FAIL.

- [ ] **Step 3: Check Repo constructor**

`Repo` takes `dataDir`. For the route we need a shared instance. Check if there's a singleton pattern.

Run: `grep -rn "new Repo" src/app scripts/cli | head`
Expected output shows existing usages.

If no singleton exists, create `src/lib/repo.ts`:

```ts
import { Repo } from "../../scripts/db/repo"

let instance: Repo | null = null

export function getRepo(): Repo {
  if (!instance) {
    const dataDir = process.env.YOGA_DATA_DIR ?? "data"
    instance = new Repo(dataDir)
  }
  return instance
}

export function resetRepoForTests(): void {
  instance = null
}
```

- [ ] **Step 4: Implement the route**

Create `src/app/api/compose/route.ts`:

```ts
import { NextResponse } from "next/server"
import { decodeScope, decodeTiers } from "../../../../scripts/analysis-context/scope-codec"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import { getRepo, resetRepoForTests } from "../../../lib/repo"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scopeRaw = url.searchParams.get("scope") ?? ""
  const tiersRaw = url.searchParams.get("tiers") ?? ""
  try {
    const scope = decodeScope(scopeRaw)
    const tiers = decodeTiers(tiersRaw)
    // Re-init in tests when YOGA_DATA_DIR changed between cases
    if (process.env.NODE_ENV === "test") resetRepoForTests()
    const ctx = await buildAnalysisContext(getRepo(), scope, tiers)
    return NextResponse.json(ctx)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "bad request" }, { status: 400 })
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/app/api/compose/`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/compose/ src/lib/repo.ts
git commit -m "feat(api): add GET /api/compose route"
```

---

## Task 7: `POST /api/chat` streaming route

**Files:**
- Create: `src/app/api/chat/route.ts`
- Create: `src/app/api/chat/route.test.ts`

- [ ] **Step 1: Write failing test (non-streaming path: create chat, persist)**

Create `src/app/api/chat/route.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../../../scripts/db/repo"
import { resetRepoForTests } from "../../../lib/repo"
import { POST } from "./route"

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
```

- [ ] **Step 2: Run — expect fail**

Run: `npx vitest run src/app/api/chat/`
Expected: FAIL.

- [ ] **Step 3: Implement route**

Create `src/app/api/chat/route.ts`:

```ts
import { NextResponse } from "next/server"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"
import { isSupportedModel } from "../../../../scripts/chat/models"
import { streamScopedChat } from "../../../../scripts/chat/stream"
import { getRepo, resetRepoForTests } from "../../../lib/repo"

type Body = {
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
  model: string
  chatId?: string
  userMessage: string
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
  if (!isSupportedModel(body.model)) {
    return NextResponse.json({ error: `unsupported model: ${body.model}` }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })
  }

  if (process.env.NODE_ENV === "test") resetRepoForTests()
  const repo = getRepo()

  let chatId = body.chatId
  let history: Awaited<ReturnType<typeof repo.getScopedChat>>["messages"] = []
  if (chatId) {
    const existing = await repo.getScopedChat(body.scope, chatId)
    history = existing.messages
  } else {
    const created = await repo.createScopedChat(body.scope, {
      model: body.model,
      tiers: body.tiers,
      title: body.userMessage.slice(0, 60),
    })
    chatId = created.id
  }

  await repo.appendScopedChatMessage(body.scope, chatId, {
    role: "user",
    content: body.userMessage,
    createdAt: new Date().toISOString(),
  })

  const ctx = await buildAnalysisContext(repo, body.scope, body.tiers)

  const encoder = new TextEncoder()
  let assistantText = ""
  let truncated = false

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chatId", chatId })}\n\n`))
      try {
        for await (const ev of streamScopedChat({
          model: body.model,
          context: ctx,
          history,
          userMessage: body.userMessage,
        })) {
          if (ev.type === "token") {
            assistantText += ev.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
          } else if (ev.type === "error") {
            truncated = true
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
          }
        }
      } finally {
        await repo.appendScopedChatMessage(body.scope, chatId!, {
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
          ...(truncated ? { truncated: true } : {}),
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  })
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/app/api/chat/`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/
git commit -m "feat(api): add POST /api/chat streaming route"
```

---

## Task 8: Install shadcn primitives (sheet, dropdown-menu)

**Files:**
- Modify: `src/components/ui/shadcn/` (generated)

- [ ] **Step 1: Add sheet component**

Run: `npx shadcn@latest add sheet`
Expected: creates `src/components/ui/shadcn/sheet.tsx`.

- [ ] **Step 2: Add dropdown-menu component**

Run: `npx shadcn@latest add dropdown-menu`
Expected: creates `src/components/ui/shadcn/dropdown-menu.tsx`.

- [ ] **Step 3: Verify**

Run: `ls src/components/ui/shadcn/`
Expected: `sheet.tsx` and `dropdown-menu.tsx` present.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/shadcn/sheet.tsx src/components/ui/shadcn/dropdown-menu.tsx package.json package-lock.json
git commit -m "chore(shadcn): add sheet + dropdown-menu primitives"
```

---

## Task 9: `useAnalysisContext` client hook

**Files:**
- Create: `src/components/ScopeActions/lib/useAnalysisContext.ts`

- [ ] **Step 1: Implement**

Create `src/components/ScopeActions/lib/useAnalysisContext.ts`:

```ts
"use client"
import { useEffect, useRef, useState } from "react"
import type { AnalysisContext, AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"
import { encodeScope, encodeTiers } from "../../../../scripts/analysis-context/scope-codec"

export function useAnalysisContext(scope: AnalysisContextScope, tiers: AnalysisContextTiers, debounceMs = 250) {
  const [data, setData] = useState<AnalysisContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const hasAny = Object.values(tiers).some(Boolean)
    if (!hasAny) {
      setData(null)
      return
    }
    const timer = setTimeout(async () => {
      ctrlRef.current?.abort()
      const ctrl = new AbortController()
      ctrlRef.current = ctrl
      setLoading(true)
      setError(null)
      try {
        const qs = `scope=${encodeURIComponent(encodeScope(scope))}&tiers=${encodeURIComponent(encodeTiers(tiers))}`
        const res = await fetch(`/api/compose?${qs}`, { signal: ctrl.signal })
        if (!res.ok) throw new Error(`compose failed: ${res.status}`)
        const body = (await res.json()) as AnalysisContext
        setData(body)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [JSON.stringify(scope), JSON.stringify(tiers), debounceMs])

  return { data, loading, error }
}

export async function fetchAnalysisContextOnce(
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers
): Promise<AnalysisContext> {
  const qs = `scope=${encodeURIComponent(encodeScope(scope))}&tiers=${encodeURIComponent(encodeTiers(tiers))}`
  const res = await fetch(`/api/compose?${qs}`)
  if (!res.ok) throw new Error(`compose failed: ${res.status}`)
  return (await res.json()) as AnalysisContext
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement("textarea")
  ta.value = text
  ta.style.position = "fixed"
  ta.style.left = "-9999px"
  document.body.appendChild(ta)
  ta.select()
  document.execCommand("copy")
  document.body.removeChild(ta)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScopeActions/
git commit -m "feat(ScopeActions): add useAnalysisContext client hook"
```

---

## Task 10: `ComposeModal` component

**Files:**
- Create: `src/components/ScopeActions/components/ComposeModal.tsx`

- [ ] **Step 1: Implement**

Create `src/components/ScopeActions/components/ComposeModal.tsx`:

```tsx
"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/shadcn/dialog"
import { Checkbox } from "@/components/ui/shadcn/checkbox"
import { Textarea } from "@/components/ui/shadcn/textarea"
import { Button } from "@/components/ui/shadcn/button"
import { useAnalysisContext, copyToClipboard } from "../lib/useAnalysisContext"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  scope: AnalysisContextScope
  mode: "copy" | "chat"
  onStartChat?: (tiers: AnalysisContextTiers) => void
}

const TOGGLES: Array<{ key: keyof AnalysisContextTiers; label: string }> = [
  { key: "tech", label: "Analyze tech" },
  { key: "lighthouse", label: "Lighthouse" },
  { key: "extractedContent", label: "Extracted content" },
  { key: "rawPages", label: "Raw pages" },
]

export function ComposeModal({ open, onOpenChange, scope, mode, onStartChat }: Props) {
  const [tiers, setTiers] = useState<AnalysisContextTiers>({})
  const { data, loading, error } = useAnalysisContext(scope, tiers)
  const pretty = data ? JSON.stringify(data.json, null, 2) : ""

  const toggle = (k: keyof AnalysisContextTiers) => setTiers(t => ({ ...t, [k]: !t[k] }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configure {mode === "copy" ? "copy" : "chat context"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            {TOGGLES.map(t => {
              const missing = data?.missing.includes(t.key)
              return (
                <label key={t.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!tiers[t.key]}
                    onCheckedChange={() => toggle(t.key)}
                    disabled={missing}
                  />
                  <span className={missing ? "text-muted-foreground line-through" : ""}>{t.label}</span>
                </label>
              )
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {loading ? "Loading…" : error ? error : data ? `${data.bytes.toLocaleString()} bytes` : "Select data to include."}
          </div>
          <Textarea value={pretty} readOnly rows={16} className="font-mono text-xs" />
        </div>
        <DialogFooter>
          {mode === "copy" ? (
            <Button
              disabled={!data}
              onClick={async () => {
                if (!data) return
                await copyToClipboard(pretty)
                onOpenChange(false)
              }}
            >
              Copy
            </Button>
          ) : (
            <Button
              disabled={!data}
              onClick={() => {
                if (!data) return
                onStartChat?.(tiers)
                onOpenChange(false)
              }}
            >
              Start chat
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ScopeActions/components/ComposeModal.tsx
git commit -m "feat(ScopeActions): add ComposeModal"
```

---

## Task 11: `ChatDrawer` component

**Files:**
- Create: `src/components/ScopeActions/components/ChatDrawer.tsx`

- [ ] **Step 1: Implement**

Create `src/components/ScopeActions/components/ChatDrawer.tsx`:

```tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/shadcn/sheet"
import { Button } from "@/components/ui/shadcn/button"
import { Input } from "@/components/ui/shadcn/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcn/select"
import { SUPPORTED_CHAT_MODELS } from "../../../../scripts/chat/models"
import type { AnalysisContextScope, AnalysisContextTiers, ChatMessage, ChatMeta } from "../../../../scripts/analysis-context/types"
import { encodeScope } from "../../../../scripts/analysis-context/scope-codec"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  scope: AnalysisContextScope
  initialTiers: AnalysisContextTiers
}

type UIMessage = ChatMessage

export function ChatDrawer({ open, onOpenChange, scope, initialTiers }: Props) {
  const [model, setModel] = useState<string>(SUPPORTED_CHAT_MODELS[1].id)
  const [messages, setMessages] = useState<UIMessage[]>([])
  const [input, setInput] = useState("")
  const [chatId, setChatId] = useState<string | null>(null)
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const qs = `scope=${encodeURIComponent(encodeScope(scope))}`
    fetch(`/api/chat/list?${qs}`).then(r => r.json()).then((list: ChatMeta[]) => setChats(list)).catch(() => {})
  }, [open, JSON.stringify(scope)])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function resumeChat(id: string) {
    const qs = `scope=${encodeURIComponent(encodeScope(scope))}&chatId=${id}`
    const r = await fetch(`/api/chat/get?${qs}`)
    const body = await r.json()
    setChatId(id)
    setMessages(body.messages)
    setModel(body.model)
  }

  async function send() {
    if (!input.trim() || sending) return
    const userMsg: UIMessage = { role: "user", content: input, createdAt: new Date().toISOString() }
    setMessages(m => [...m, userMsg, { role: "assistant", content: "", createdAt: new Date().toISOString() }])
    setSending(true)
    const userMessage = input
    setInput("")
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ scope, tiers: initialTiers, model, chatId, userMessage }),
      })
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "request failed" }))
        setMessages(m => {
          const copy = [...m]
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: `Error: ${err.error}` }
          return copy
        })
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split("\n\n")
        buf = parts.pop() ?? ""
        for (const p of parts) {
          if (!p.startsWith("data: ")) continue
          const ev = JSON.parse(p.slice(6))
          if (ev.type === "chatId") setChatId(ev.chatId)
          else if (ev.type === "token") {
            setMessages(m => {
              const copy = [...m]
              copy[copy.length - 1] = { ...copy[copy.length - 1], content: copy[copy.length - 1].content + ev.text }
              return copy
            })
          }
        }
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl flex flex-col">
        <SheetHeader>
          <SheetTitle>Chat about this analysis</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 border-b pb-2">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPORTED_CHAT_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {chats.length > 0 && (
            <Select onValueChange={resumeChat}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Resume chat" /></SelectTrigger>
              <SelectContent>
                {chats.map(c => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex-1 overflow-auto space-y-3 py-3">
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-sm" : "text-sm bg-muted rounded p-2"}>
              <div className="text-xs text-muted-foreground mb-1">{m.role}</div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <div className="flex gap-2 border-t pt-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask a question…"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()}>Send</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Add list + get helper routes**

Create `src/app/api/chat/list/route.ts`:

```ts
import { NextResponse } from "next/server"
import { decodeScope } from "../../../../../scripts/analysis-context/scope-codec"
import { getRepo } from "../../../../lib/repo"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scopeRaw = url.searchParams.get("scope") ?? ""
  try {
    const scope = decodeScope(scopeRaw)
    const metas = await getRepo().listScopedChats(scope)
    return NextResponse.json(metas)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "bad" }, { status: 400 })
  }
}
```

Create `src/app/api/chat/get/route.ts`:

```ts
import { NextResponse } from "next/server"
import { decodeScope } from "../../../../../scripts/analysis-context/scope-codec"
import { getRepo } from "../../../../lib/repo"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const scopeRaw = url.searchParams.get("scope") ?? ""
  const chatId = url.searchParams.get("chatId") ?? ""
  try {
    const scope = decodeScope(scopeRaw)
    const record = await getRepo().getScopedChat(scope, chatId)
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "bad" }, { status: 400 })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ScopeActions/components/ChatDrawer.tsx src/app/api/chat/list/ src/app/api/chat/get/
git commit -m "feat(ScopeActions): add ChatDrawer + chat list/get routes"
```

---

## Task 12: `ScopeActions` (CopyMenu + ChatMenu)

**Files:**
- Create: `src/components/ScopeActions/ScopeActions.tsx`
- Create: `src/components/ScopeActions/components/CopyMenu.tsx`
- Create: `src/components/ScopeActions/components/ChatMenu.tsx`
- Create: `src/components/ScopeActions/index.ts`

- [ ] **Step 1: CopyMenu**

Create `src/components/ScopeActions/components/CopyMenu.tsx`:

```tsx
"use client"
import { useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/shadcn/dropdown-menu"
import { Button } from "@/components/ui/shadcn/button"
import { Copy } from "lucide-react"
import { fetchAnalysisContextOnce, copyToClipboard } from "../lib/useAnalysisContext"
import { ComposeModal } from "./ComposeModal"
import type { AnalysisContextScope } from "../../../../scripts/analysis-context/types"

export function CopyMenu({ scope }: { scope: AnalysisContextScope }) {
  const [modalOpen, setModalOpen] = useState(false)

  async function copyPreset(tiers: { report?: boolean; extractedContent?: boolean }) {
    const ctx = await fetchAnalysisContextOnce(scope, tiers)
    await copyToClipboard(JSON.stringify(ctx.json, null, 2))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm"><Copy className="mr-1 h-3.5 w-3.5" />Copy</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => copyPreset({ report: true })}>Report</DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyPreset({ extractedContent: true })}>Content</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModalOpen(true)}>Configure…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ComposeModal open={modalOpen} onOpenChange={setModalOpen} scope={scope} mode="copy" />
    </>
  )
}
```

- [ ] **Step 2: ChatMenu**

Create `src/components/ScopeActions/components/ChatMenu.tsx`:

```tsx
"use client"
import { useState } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/shadcn/dropdown-menu"
import { Button } from "@/components/ui/shadcn/button"
import { MessageSquare } from "lucide-react"
import { ChatDrawer } from "./ChatDrawer"
import { ComposeModal } from "./ComposeModal"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"

export function ChatMenu({ scope }: { scope: AnalysisContextScope }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [tiers, setTiers] = useState<AnalysisContextTiers>({})

  function openWith(t: AnalysisContextTiers) {
    setTiers(t)
    setDrawerOpen(true)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm"><MessageSquare className="mr-1 h-3.5 w-3.5" />Chat</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => openWith({ report: true })}>About the report</DropdownMenuItem>
          <DropdownMenuItem onClick={() => openWith({ extractedContent: true })}>About the content</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModalOpen(true)}>Configure…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ComposeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        scope={scope}
        mode="chat"
        onStartChat={(t) => openWith(t)}
      />
      <ChatDrawer open={drawerOpen} onOpenChange={setDrawerOpen} scope={scope} initialTiers={tiers} />
    </>
  )
}
```

- [ ] **Step 3: ScopeActions + barrel**

Create `src/components/ScopeActions/ScopeActions.tsx`:

```tsx
"use client"
import { CopyMenu } from "./components/CopyMenu"
import { ChatMenu } from "./components/ChatMenu"
import type { AnalysisContextScope } from "../../../scripts/analysis-context/types"

export function ScopeActions({ scope }: { scope: AnalysisContextScope }) {
  return (
    <div className="flex items-center gap-2">
      <CopyMenu scope={scope} />
      <ChatMenu scope={scope} />
    </div>
  )
}
```

Create `src/components/ScopeActions/index.ts`:

```ts
export { ScopeActions } from "./ScopeActions"
```

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScopeActions/
git commit -m "feat(ScopeActions): add CopyMenu, ChatMenu, root component"
```

---

## Task 13: Insert at request + sidebar

**Files:**
- Modify: `src/app/(report)/analyses/[requestId]/page.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/SitesSidebar.tsx`

- [ ] **Step 1: Request page header**

Read `src/app/(report)/analyses/[requestId]/page.tsx`, find the header area, add:

```tsx
import { ScopeActions } from "@/components/ScopeActions"
```

and inside the header JSX (alongside the title):

```tsx
<ScopeActions scope={{ kind: "request", requestId }} />
```

- [ ] **Step 2: Sidebar footer**

Read `src/app/(report)/analyses/[requestId]/[siteId]/SitesSidebar.tsx`, add:

```tsx
import { ScopeActions } from "@/components/ScopeActions"
```

At the bottom of the sidebar list, before the closing wrapper:

```tsx
<div className="border-t pt-3 mt-3">
  <ScopeActions scope={{ kind: "request", requestId }} />
</div>
```

Ensure `requestId` is available as a prop; thread it through if not already present.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(report\)/analyses/
git commit -m "feat(ui): insert ScopeActions at request header + sidebar footer"
```

---

## Task 14: Insert at site (PageNav) and category (CategoryBlock)

**Files:**
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/PageNav.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx`

- [ ] **Step 1: PageNav — site scope**

Read `src/app/(report)/analyses/[requestId]/[siteId]/PageNav.tsx`. Accept `requestId` and `siteId` props if missing. At the bottom of the floating nav container, insert:

```tsx
import { ScopeActions } from "@/components/ScopeActions"
// ...
<div className="mt-4 border-t pt-3">
  <ScopeActions scope={{ kind: "site", requestId, siteId }} />
</div>
```

- [ ] **Step 2: CategoryBlock — category scope**

Read `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx`. In the block header row (next to the category title), insert:

```tsx
import { ScopeActions } from "@/components/ScopeActions"
// ...
<ScopeActions scope={{ kind: "category", requestId, siteId, categoryId: category.id }} />
```

Ensure `requestId` and `siteId` are threaded through to `CategoryBlock` — pass from the parent page if not present.

- [ ] **Step 3: Verify typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(report\)/analyses/
git commit -m "feat(ui): insert ScopeActions at PageNav (site) and CategoryBlock (category)"
```

---

## Task 15: End-to-end manual verification

**Files:** none (runtime verification).

- [ ] **Step 1: Start dev server**

Run: `npm run dev`
Expected: Next.js listening on `http://localhost:3000`.

- [ ] **Step 2: Open an existing analysis**

Navigate to an analysis with generated artifacts. Verify:

- Request page top header shows **Copy** + **Chat** buttons.
- Sidebar footer shows them.
- Site page `PageNav` (floating right) shows them.
- Each `CategoryBlock` header shows them.

- [ ] **Step 3: Copy presets**

Click **Copy → Report** on a category. Paste into a scratch file. Verify it contains only the build-report payload for the site. Repeat for **Copy → Content** at category scope and confirm it contains only that category's `extract-pages-content` output.

- [ ] **Step 4: Configure modal**

Click **Copy → Configure…** at site scope. Toggle each checkbox, confirm the textarea updates (debounced). Confirm `missing` toggles are grayed with strike-through. Click **Copy** — verify clipboard matches textarea.

- [ ] **Step 5: Chat**

Ensure `ANTHROPIC_API_KEY` is set. Click **Chat → About the report** at site scope. Ask a question. Verify streamed tokens appear. Close drawer, reopen — verify "Resume chat" dropdown lists the prior chat and loads it with history.

- [ ] **Step 6: Error paths**

- Unset `ANTHROPIC_API_KEY`, send a chat message — verify error message in drawer.
- Force a request for a scope with no generated artifacts (pending run) — verify `missing` surfaces in modal and `data.json` is empty.

- [ ] **Step 7: Commit verification notes**

Only if changes were needed during verification. Otherwise skip.

---

## Task 16: Finish — run full test suite

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: all green, includes new suites.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no new errors.

- [ ] **Step 3: Final report**

Summarize implementation in chat: task list completed, any deviations from plan, manual-verification result.

---

## Self-review notes

- Spec coverage:
  - Category/site/request scopes → Tasks 1, 2, 13, 14.
  - Copy tiers (Report / Content / Configure) → Tasks 10, 12.
  - Chat drawer with model select + persist + resume → Tasks 5, 7, 11.
  - Chunked multi-part context delivery → Tasks 3, 5.
  - Error handling (API key missing, missing artifacts, clipboard fallback, abort) → Tasks 6, 7, 9, 10.
  - Insertion points (4 total) → Tasks 13, 14.
- No placeholders; all steps include concrete code.
- Type consistency: `AnalysisContextScope`, `AnalysisContextTiers`, `ChatMessage`, `ChatRecord`, `ChatMeta`, `scopeKey`, `SUPPORTED_CHAT_MODELS` used consistently across tasks.
