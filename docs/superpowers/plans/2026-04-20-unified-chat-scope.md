# Unified chat scope and shared drawer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse the `request | site | category` scope union into one shape (`{requestId, contextElements: {siteId, categoryId}[]}`), move chat history to a single shared drawer keyed only by request, and retire the URL-based scope codec. Existing chat data is wiped on rollout.

**Architecture:** Types change first so the rest of the codebase fails loudly. The context builder is rewritten around a site×category pair walk. `Repo` chat methods lose scope-keyed directories; chats live flat under `data/db/{requestId}/chats/{uuid}.json`. API endpoints stop encoding scope in URLs — `compose` becomes a POST, `chat/list` and `chat/get` query by `requestId` only. The shared `ChatDrawer` is lifted to a React context consumed by every preset button, and a new Configure modal with a site×category matrix replaces per-button config UI.

**Tech Stack:** TypeScript, Next.js 16 (app router), Vitest, shadcn/ui (Radix Dialog, DropdownMenu, Sheet), Tailwind. UUIDs via `crypto.randomUUID()`.

---

## File Structure

**Modify:**
- `scripts/analysis-context/types.ts` — swap the discriminated union for the new single shape.
- `scripts/analysis-context/build.ts` — rewrite the body around `contextElements`.
- `scripts/analysis-context/build.test.ts` — adapt existing tests, drop ones that assert the old flat site/category shapes.
- `scripts/analysis-context/__tests__/build.test.ts` — rewrite for the new shape (this file was added in the cross-site refactor; its assertions are now obsolete).
- `scripts/db/repo.ts` — replace `*Scoped*` chat methods with scope-agnostic ones; chatId → UUID.
- `scripts/db/__tests__/chat.test.ts` — rewrite around new API.
- `scripts/db/__tests__/repo.test.ts` — update the "chat counts" block (paths collapsed, no scope subdirs).
- `src/app/api/compose/route.ts` — GET → POST, JSON body.
- `src/app/api/compose/route.test.ts` — rewrite for POST.
- `src/app/api/chat/route.ts` — scope/tiers only required on new-chat path; resume ignores them.
- `src/app/api/chat/route.test.ts` — adapt to new scope shape.
- `src/app/api/chat/list/route.ts` — query by `requestId` only.
- `src/app/api/chat/get/route.ts` — query by `requestId` + `chatId` only.
- `src/components/ScopeActions/lib/useAnalysisContext.ts` — GET → POST.
- `src/components/ScopeActions/components/ChatMenu.tsx` — trigger the shared drawer instead of owning one; delete the walkthrough listener's dependency on local state.
- `src/components/ScopeActions/components/CopyMenu.tsx` — keep its own dropdown, update to new scope shape.
- `src/components/ScopeActions/components/ComposeModal.tsx` — add scope picker (site×category matrix); support read-only mode; simplify props.
- `src/components/ScopeActions/components/ChatDrawer.tsx` — major rewrite: shared instance, two-pane body, draft/active state machine.
- `src/components/ScopeActions/lib/scopeLabel.ts` — update `scopeDescription` / `scopeShortLabel` to the new shape.
- `src/components/ScopeActions/ScopeActions.tsx` — consume the shared drawer context.
- `src/app/(report)/analyses/[requestId]/[siteId]/page.tsx` — wrap the route with `ChatDrawerProvider`.
- `src/app/(report)/analyses/[requestId]/[siteId]/SitesSidebar.tsx` — pass new scope prop shape.
- `src/app/(report)/analyses/[requestId]/[siteId]/PageNav.tsx` — same.
- `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx` — same.
- `scripts/chat/stream.ts` — update `describeScope` to render the new shape.

**Create:**
- `src/components/ScopeActions/lib/presets.ts` — compute the 3 button presets as `{scope, tiers}` objects from the current `Request` shape.
- `src/components/ScopeActions/components/ChatDrawerProvider.tsx` — React context owning drawer open state, current draft (scope/tiers from the last preset click), and the active chat.
- `src/components/ScopeActions/components/ChatHistoryList.tsx` — left pane, replaces the `ChatHistoryMenu` dropdown.
- `src/app/api/request/[requestId]/route.ts` — GET endpoint the Configure modal uses to render the site×category matrix.

**Delete:**
- `scripts/analysis-context/scope-codec.ts`
- `scripts/analysis-context/scope-codec.test.ts`
- `src/components/ScopeActions/components/ChatHistoryMenu.tsx` (dropdown-style; replaced by the list).
- `src/components/ScopeActions/lib/relativeDate.test.ts` + `relativeDate.ts` — **keep** (still used by the new list).

**Leave alone:**
- `scripts/db/store.ts`, `scripts/db/paths.ts` — unchanged.
- `scripts/chat/stream.ts` `streamScopedChat` function body (only the scope-description helper changes).

---

## Task 1: New scope type + rewrite `buildAnalysisContext`

**Files:**
- Modify: `scripts/analysis-context/types.ts:1-4`
- Modify: `scripts/analysis-context/build.ts`
- Modify: `scripts/analysis-context/build.test.ts`
- Modify: `scripts/analysis-context/__tests__/build.test.ts`

- [ ] **Step 1: Update the scope type**

Full replacement of the `AnalysisContextScope` union in `scripts/analysis-context/types.ts`:

```ts
export type AnalysisContextScope = {
  requestId: string
  contextElements: { siteId: string; categoryId: string }[]
}
```

The rest of the file (`AnalysisContextTiers`, `AnalysisContext`, `ChatMessage`, `ChatMeta`, `ChatRecord`) stays as-is, except `ChatRecord` later gains a `scope` field in Task 2.

- [ ] **Step 2: Rewrite the old tests so they target the new shape**

Replace `scripts/analysis-context/__tests__/build.test.ts` in full:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../db/repo"
import { buildAnalysisContext } from "../build"
import type { AnalyzeInput } from "../../core/types"

const input: AnalyzeInput = {
  categories: [
    { name: "Home", extraInfo: "", prompt: "", model: "sonnet" },
    { name: "Pricing", extraInfo: "", prompt: "", model: "sonnet" },
  ],
  sites: [{ url: "https://a.test" }, { url: "https://b.test" }],
}

describe("buildAnalysisContext", () => {
  let dir: string
  let repo: Repo

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "build-"))
    repo = new Repo(dir)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("produces site-then-category nested shape for a single pair", async () => {
    const req = await repo.createRequest(input)
    const [siteA] = req.sites
    await repo.putJson(
      { requestId: req.id, siteId: siteA.id, stage: "extract-pages-content", name: "pricing.json" },
      { items: ["A"] },
    )

    const ctx = await buildAnalysisContext(
      repo,
      {
        requestId: req.id,
        contextElements: [{ siteId: siteA.id, categoryId: "pricing" }],
      },
      { extractedContent: true },
    )

    expect(ctx.json).toEqual({
      sites: {
        [siteA.id]: { pricing: { extractedContent: { items: ["A"] } } },
      },
    })
    expect(ctx.bytes).toBeGreaterThan(0)
  })

  it("aggregates many pairs under the same site key", async () => {
    const req = await repo.createRequest(input)
    const [siteA] = req.sites
    await repo.putJson(
      { requestId: req.id, siteId: siteA.id, stage: "extract-pages-content", name: "home.json" },
      { items: ["H"] },
    )
    await repo.putJson(
      { requestId: req.id, siteId: siteA.id, stage: "extract-pages-content", name: "pricing.json" },
      { items: ["P"] },
    )

    const ctx = await buildAnalysisContext(
      repo,
      {
        requestId: req.id,
        contextElements: [
          { siteId: siteA.id, categoryId: "home" },
          { siteId: siteA.id, categoryId: "pricing" },
        ],
      },
      { extractedContent: true },
    )

    expect(ctx.json).toEqual({
      sites: {
        [siteA.id]: {
          home: { extractedContent: { items: ["H"] } },
          pricing: { extractedContent: { items: ["P"] } },
        },
      },
    })
  })

  it("empty contextElements yields empty sites map", async () => {
    const req = await repo.createRequest(input)
    const ctx = await buildAnalysisContext(repo, { requestId: req.id, contextElements: [] }, { report: true })
    expect(ctx.json).toEqual({ sites: {} })
    expect(ctx.missing).toEqual([])
  })

  it("includes request input when tiers.input is set", async () => {
    const req = await repo.createRequest(input)
    const ctx = await buildAnalysisContext(
      repo,
      {
        requestId: req.id,
        contextElements: [{ siteId: req.sites[0].id, categoryId: "home" }],
      },
      { input: true },
    )
    const json = ctx.json as { input?: unknown }
    expect(json.input).toBeTruthy()
  })
})
```

- [ ] **Step 3: Delete the obsolete top-level build test**

Run: `rm scripts/analysis-context/build.test.ts`

(The remaining coverage lives in `scripts/analysis-context/__tests__/build.test.ts`. If `git status` shows anything odd, stop.)

- [ ] **Step 4: Run the new tests — they must fail**

Run: `npx vitest run scripts/analysis-context/__tests__/build.test.ts`
Expected: all four tests FAIL (old implementation still branches on `scope.kind`).

- [ ] **Step 5: Rewrite `buildAnalysisContext`**

Full body of `scripts/analysis-context/build.ts` (replace `buildAnalysisContext`; keep `forCategory` as-is; `forSite` may be deleted if it has no callers — verify with grep first and keep only if referenced):

```ts
import type { Repo } from "../db/repo"
import type { AnalysisContext, AnalysisContextScope, AnalysisContextTiers } from "./types"

type TierKey = keyof AnalysisContextTiers

export async function buildAnalysisContext(
  repo: Repo,
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers,
): Promise<AnalysisContext> {
  const missing: string[] = []
  const req = await repo.getRequest(scope.requestId)
  const sites: Record<string, Record<string, unknown>> = {}

  for (const { siteId, categoryId } of scope.contextElements) {
    const perCat = await forCategory(repo, scope.requestId, siteId, categoryId, tiers, missing)
    sites[siteId] = sites[siteId] ?? {}
    sites[siteId][categoryId] = perCat
  }

  const json: Record<string, unknown> = { sites }
  if (tiers.input) json.input = req
  const bytes = Buffer.byteLength(JSON.stringify(json))
  return { scope, tiers, json, bytes, missing: Array.from(new Set(missing)) }
}

async function forCategory(
  repo: Repo,
  requestId: string,
  siteId: string,
  categoryId: string,
  tiers: AnalysisContextTiers,
  missing: string[],
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
  if (tiers.report) {
    const ref = { requestId, siteId, stage: "build-report", name: "build-report.json" }
    if (await repo.artifactExists(ref)) out.report = await repo.getJson(ref)
    else missing.push("report")
  }
  if (tiers.rawPages) await addRawPages(repo, requestId, siteId, out, missing, categoryId)
  if (tiers.progress) {
    const ref = { requestId, siteId, stage: "", name: "progress.json" }
    if (await repo.artifactExists(ref)) out.progress = await repo.getJson(ref)
    else missing.push("progress")
  }
  return out
}

async function addRawPages(
  repo: Repo,
  requestId: string,
  siteId: string,
  out: Record<string, unknown>,
  missing: string[],
  categoryId?: string,
) {
  const homeRef = { requestId, siteId, stage: "fetch-home", name: "home.html" }
  const pagesIndexRef = { requestId, siteId, stage: "fetch-pages", name: "index.json" }
  const pages: Record<string, string> = {}
  let any = false

  if (!categoryId && (await repo.artifactExists(homeRef))) {
    pages["home.html"] = (await repo.getArtifact(homeRef)).toString("utf8")
    any = true
  }

  let allowedUrls: Set<string> | null = null
  if (categoryId) {
    const classifyRef = { requestId, siteId, stage: "classify-nav", name: "classify-nav.json" }
    if (await repo.artifactExists(classifyRef)) {
      const classify = await repo.getJson<{ byCategory?: Record<string, string[]> }>(classifyRef)
      allowedUrls = new Set(classify.byCategory?.[categoryId] ?? [])
    } else {
      allowedUrls = new Set()
    }
  }

  if (await repo.artifactExists(pagesIndexRef)) {
    const index = await repo.getJson<{ pages?: Array<{ id: string; url: string; status: string }> }>(pagesIndexRef)
    const records = index.pages ?? []
    for (const rec of records) {
      if (!rec || typeof rec.id !== "string" || rec.status !== "ok") continue
      if (allowedUrls && !allowedUrls.has(rec.url)) continue
      const fileName = `${rec.id}.md`
      const mdRef = { requestId, siteId, stage: "fetch-pages", name: fileName }
      if (await repo.artifactExists(mdRef)) {
        pages[fileName] = (await repo.getArtifact(mdRef)).toString("utf8")
        any = true
      }
    }
  }
  if (any) out.rawPages = pages
  else missing.push("rawPages")
}
```

`forSite` is removed — the new shape never aggregates by site alone. If grep finds an external caller, add it back minus the `forSite` call path.

- [ ] **Step 6: Run the tests — they must pass**

Run: `npx vitest run scripts/analysis-context/__tests__/build.test.ts`
Expected: all four tests PASS.

- [ ] **Step 7: Do NOT commit yet**

The repo is in a non-compiling state (every caller of the old scope shape is broken). Task 2–6 fix it progressively and commit together at the end of Task 6.

---

## Task 2: Scope-agnostic chat storage on `Repo` with UUID ids

**Files:**
- Modify: `scripts/db/repo.ts`
- Modify: `scripts/analysis-context/types.ts` (add `scope` to `ChatRecord`)
- Modify: `scripts/db/__tests__/chat.test.ts`

- [ ] **Step 1: Add `scope` to `ChatMeta` (and therefore `ChatRecord`)**

In `scripts/analysis-context/types.ts`, update `ChatMeta` and `ChatRecord`:

```ts
export type ChatMeta = {
  id: string
  createdAt: string
  title: string
  model: string
  tiers: AnalysisContextTiers
  scope: AnalysisContextScope
}

export type ChatRecord = ChatMeta & { messages: ChatMessage[] }
```

Scope is stored on `ChatMeta` (not only `ChatRecord`) so the history list has it without loading the full record.

- [ ] **Step 2: Rewrite `scripts/db/__tests__/chat.test.ts`**

Full contents:

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
```

- [ ] **Step 3: Run the tests — they must fail**

Run: `npx vitest run scripts/db/__tests__/chat.test.ts`
Expected: every test FAILS with `repo.createChat is not a function` (or similar).

- [ ] **Step 4: Rewrite the chat section of `scripts/db/repo.ts`**

Replace the section titled `// ── scoped chats ──` (lines 234 through the end of `appendScopedChatMessage`) with:

```ts
  // ── chats ──

  private chatsDir(requestId: string): string {
    return join(requestDir(this.root, requestId), "chats")
  }

  async createChat(
    requestId: string,
    init: { scope: AnalysisContextScope; model: string; tiers: AnalysisContextTiers; title: string },
  ): Promise<ChatRecord> {
    const id = randomUUID()
    const record: ChatRecord = {
      id,
      createdAt: new Date().toISOString(),
      title: init.title,
      model: init.model,
      tiers: init.tiers,
      scope: init.scope,
      messages: [],
    }
    const path = join(this.chatsDir(requestId), `${id}.json`)
    await this.store.writeFile(path, JSON.stringify(record, null, 2))
    return record
  }

  async getChat(requestId: string, chatId: string): Promise<ChatRecord> {
    const path = join(this.chatsDir(requestId), `${chatId}.json`)
    const buf = await this.store.readFile(path)
    return JSON.parse(buf.toString("utf8")) as ChatRecord
  }

  async listChats(requestId: string): Promise<ChatMeta[]> {
    const dir = this.chatsDir(requestId)
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

  async appendChatMessage(
    requestId: string,
    chatId: string,
    msg: ChatMessage,
  ): Promise<void> {
    const rec = await this.getChat(requestId, chatId)
    rec.messages.push(msg)
    const path = join(this.chatsDir(requestId), `${chatId}.json`)
    await this.store.writeFile(path, JSON.stringify(rec, null, 2))
  }
```

Update the imports at the top of `scripts/db/repo.ts`:

```ts
import { randomBytes, randomUUID } from "crypto"
```

Remove the now-unused `scopeKey` import. `Repo.countChats` (still needed for the analyses table) now walks a flat dir — no code change needed; `store.listFiles` is already recursive and the flat layout gives a correct count.

- [ ] **Step 5: Run the chat tests — they must pass**

Run: `npx vitest run scripts/db/__tests__/chat.test.ts`
Expected: 3/3 PASS.

- [ ] **Step 6: Update `scripts/db/__tests__/repo.test.ts` chat-count block**

The existing "Repo chat counts" describe block creates chats via `createScopedChat`. Replace those two calls:

```ts
    await repo.createChat(req.id, {
      scope: { requestId: req.id, contextElements: [] },
      model: "m", tiers: {}, title: "A",
    })
    await repo.createChat(req.id, {
      scope: { requestId: req.id, contextElements: [] },
      model: "m", tiers: {}, title: "B",
    })
    await repo.createChat(req.id, {
      scope: { requestId: req.id, contextElements: [{ siteId: "x", categoryId: "home" }] },
      model: "m", tiers: {}, title: "C",
    })
```

And in the "listRequests populates chatCount per entry" test, replace the single `createScopedChat` call similarly with `createChat(req.id, {...})`. The rest of the block stays.

- [ ] **Step 7: Run the repo tests — they must pass**

Run: `npx vitest run scripts/db/__tests__/repo.test.ts`
Expected: 9/9 PASS (or whatever count existed; no new failures).

- [ ] **Step 8: Do NOT commit yet**

Many callers (API routes, UI, chat stream) still reference the old methods. They're fixed in later tasks.

---

## Task 3: API routes — `/api/compose` POST, `/api/chat/*` request-keyed

**Files:**
- Modify: `src/app/api/compose/route.ts`
- Modify: `src/app/api/compose/route.test.ts`
- Modify: `src/app/api/chat/list/route.ts`
- Modify: `src/app/api/chat/get/route.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/chat/route.test.ts`

- [ ] **Step 1: Rewrite `src/app/api/compose/route.ts`**

Full contents:

```ts
import { NextResponse } from "next/server"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"
import { getRepo, resetRepoForTests } from "../../../lib/repo-server"

type Body = { scope: AnalysisContextScope; tiers: AnalysisContextTiers }

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
  if (!body?.scope?.requestId) {
    return NextResponse.json({ error: "missing requestId" }, { status: 400 })
  }
  if (process.env.NODE_ENV === "test") resetRepoForTests()
  try {
    const ctx = await buildAnalysisContext(getRepo(), body.scope, body.tiers ?? {})
    return NextResponse.json(ctx)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
```

- [ ] **Step 2: Rewrite `src/app/api/compose/route.test.ts`**

The existing test uses GET with encoded params. Rewrite it to exercise the POST path. Full contents:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../../../../scripts/db/repo"
import { resetRepoForTests } from "../../../lib/repo-server"
import { POST } from "./route"

describe("POST /api/compose", () => {
  let dir: string
  let requestId: string
  let siteId: string

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "compose-"))
    process.env.YOGA_DATA_DIR = dir
    resetRepoForTests()
    const repo = new Repo(dir)
    const req = await repo.createRequest({
      categories: [{ name: "Home", extraInfo: "", prompt: "", model: "sonnet" }],
      sites: [{ url: "https://a.test" }],
    })
    requestId = req.id
    siteId = req.sites[0].id
    await repo.putJson(
      { requestId, siteId, stage: "extract-pages-content", name: "home.json" },
      { items: ["X"] },
    )
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
    delete process.env.YOGA_DATA_DIR
  })

  it("returns the context for a pair", async () => {
    const res = await POST(
      new Request("http://localhost/api/compose", {
        method: "POST",
        body: JSON.stringify({
          scope: { requestId, contextElements: [{ siteId, categoryId: "home" }] },
          tiers: { extractedContent: true },
        }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.json.sites[siteId].home.extractedContent).toEqual({ items: ["X"] })
  })

  it("rejects missing requestId", async () => {
    const res = await POST(
      new Request("http://localhost/api/compose", {
        method: "POST",
        body: JSON.stringify({ scope: { contextElements: [] }, tiers: {} }),
      }),
    )
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3: Rewrite `src/app/api/chat/list/route.ts`**

Full contents:

```ts
import { NextResponse } from "next/server"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestId = url.searchParams.get("requestId") ?? ""
  if (!requestId) return NextResponse.json({ error: "missing requestId" }, { status: 400 })
  try {
    const metas = await getRepo().listChats(requestId)
    return NextResponse.json(metas)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
```

- [ ] **Step 4: Rewrite `src/app/api/chat/get/route.ts`**

Full contents:

```ts
import { NextResponse } from "next/server"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const requestId = url.searchParams.get("requestId") ?? ""
  const chatId = url.searchParams.get("chatId") ?? ""
  if (!requestId || !chatId)
    return NextResponse.json({ error: "missing requestId or chatId" }, { status: 400 })
  try {
    const record = await getRepo().getChat(requestId, chatId)
    return NextResponse.json(record)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "bad request" },
      { status: 400 },
    )
  }
}
```

- [ ] **Step 5: Rewrite `src/app/api/chat/route.ts`**

Full contents:

```ts
import { NextResponse } from "next/server"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import type { AnalysisContextScope, AnalysisContextTiers, ChatMessage } from "../../../../scripts/analysis-context/types"
import { isSupportedModel } from "../../../../scripts/chat/models"
import { streamScopedChat } from "../../../../scripts/chat/stream"
import { getRepo, resetRepoForTests } from "../../../lib/repo-server"

type Body = {
  requestId: string
  chatId?: string
  model: string
  userMessage: string
  scope?: AnalysisContextScope
  tiers?: AnalysisContextTiers
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
  if (!body.requestId) return NextResponse.json({ error: "missing requestId" }, { status: 400 })
  if (!isSupportedModel(body.model)) {
    return NextResponse.json({ error: `unsupported model: ${body.model}` }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })
  }

  if (process.env.NODE_ENV === "test") resetRepoForTests()
  const repo = getRepo()

  let chatId = body.chatId
  let scope: AnalysisContextScope
  let tiers: AnalysisContextTiers
  let history: ChatMessage[] = []

  if (chatId) {
    const existing = await repo.getChat(body.requestId, chatId)
    scope = existing.scope
    tiers = existing.tiers
    history = existing.messages
  } else {
    if (!body.scope || !body.tiers) {
      return NextResponse.json({ error: "scope and tiers required for new chat" }, { status: 400 })
    }
    if (body.scope.contextElements.length === 0) {
      return NextResponse.json({ error: "contextElements cannot be empty" }, { status: 400 })
    }
    scope = body.scope
    tiers = body.tiers
    const created = await repo.createChat(body.requestId, {
      scope,
      model: body.model,
      tiers,
      title: body.userMessage.slice(0, 60),
    })
    chatId = created.id
  }

  await repo.appendChatMessage(body.requestId, chatId, {
    role: "user",
    content: body.userMessage,
    createdAt: new Date().toISOString(),
  })

  const ctx = await buildAnalysisContext(repo, scope, tiers)

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
        await repo.appendChatMessage(body.requestId, chatId!, {
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

- [ ] **Step 6: Rewrite `src/app/api/chat/route.test.ts`**

The existing two tests still apply conceptually. Replace the bodies:

```ts
  it("creates chat, streams tokens, persists both messages", async () => {
    const body = {
      requestId,
      scope: { requestId, contextElements: [] },
      tiers: { report: true },
      model: "claude-sonnet-4-6",
      userMessage: "hi",
    }
    // ...stream read unchanged...
    const repo = new Repo(dir)
    const chats = await repo.listChats(requestId)
    expect(chats).toHaveLength(1)
    const full = await repo.getChat(requestId, chats[0].id)
    expect(full.messages).toHaveLength(2)
    expect(full.messages[0].content).toBe("hi")
    expect(full.messages[1].content).toBe("Hello world")
  })

  it("rejects unsupported model", async () => {
    const res = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        requestId,
        scope: { requestId, contextElements: [] },
        tiers: {},
        model: "gpt-9000",
        userMessage: "hi",
      }),
    }))
    expect(res.status).toBe(400)
  })
```

Note: the first test now passes `contextElements: []`. The route's new-chat branch rejects empty `contextElements` with 400. Update the body to include one element so the test stays green:

```ts
      scope: { requestId, contextElements: [{ siteId: "site_x", categoryId: "home" }] },
```

(Choose a real `siteId` from `req.sites[0].id` if the test file already sets that up — it does; see the existing `beforeEach`.)

- [ ] **Step 7: Run the API tests — they must pass**

Run: `npx vitest run src/app/api`
Expected: all tests PASS.

- [ ] **Step 8: Do NOT commit yet**

---

## Task 4: Client data hook + scope label

**Files:**
- Modify: `src/components/ScopeActions/lib/useAnalysisContext.ts`
- Modify: `src/components/ScopeActions/lib/scopeLabel.ts`
- Modify: `scripts/chat/stream.ts` (only `describeScope`)

- [ ] **Step 1: Rewrite `useAnalysisContext` to POST**

Full contents of `src/components/ScopeActions/lib/useAnalysisContext.ts`:

```ts
"use client"

import { useEffect, useRef, useState } from "react"
import type {
  AnalysisContext,
  AnalysisContextScope,
  AnalysisContextTiers,
} from "../../../../scripts/analysis-context/types"

export function useAnalysisContext(
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers,
  debounceMs = 250,
) {
  const [data, setData] = useState<AnalysisContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  const scopeKey = JSON.stringify(scope)
  const tiersKey = JSON.stringify(tiers)

  useEffect(() => {
    const hasAny = Object.values(tiers).some(Boolean)
    const hasPairs = scope.contextElements.length > 0
    if (!hasAny || !hasPairs) {
      setData(null)
      setError(null)
      return
    }
    const timer = setTimeout(async () => {
      ctrlRef.current?.abort()
      const ctrl = new AbortController()
      ctrlRef.current = ctrl
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/compose", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope, tiers }),
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(`compose failed: ${res.status}`)
        setData(await res.json() as AnalysisContext)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, tiersKey, debounceMs])

  return { data, loading, error }
}

export async function fetchAnalysisContextOnce(
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers,
): Promise<AnalysisContext> {
  const res = await fetch("/api/compose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, tiers }),
  })
  if (!res.ok) throw new Error(`compose failed: ${res.status}`)
  return await res.json() as AnalysisContext
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

- [ ] **Step 2: Rewrite `scopeLabel.ts`**

Full contents of `src/components/ScopeActions/lib/scopeLabel.ts`:

```ts
import type { AnalysisContextScope } from "../../../../scripts/analysis-context/types"

export function scopeDescription(s: AnalysisContextScope): string {
  const n = s.contextElements.length
  if (n === 0) return "the selected context (nothing picked yet)"
  if (n === 1) return "one site/category pair"
  const sites = new Set(s.contextElements.map(e => e.siteId)).size
  const cats = new Set(s.contextElements.map(e => e.categoryId)).size
  return `${n} pairs across ${sites} site(s) and ${cats} categor${cats === 1 ? "y" : "ies"}`
}

export function scopeShortLabel(s: AnalysisContextScope): string {
  return s.contextElements.length === 0 ? "context" : `${s.contextElements.length} pairs`
}
```

Note: most UI callers use the old kind-based shortcuts; this helper now returns generic descriptions. Button labels are hard-coded in the components (Task 7) so they don't need to read this.

- [ ] **Step 3: Update `scripts/chat/stream.ts` `describeScope`**

Replace the function body:

```ts
function describeScope(s: AnalysisContext["scope"]): string {
  const n = s.contextElements.length
  return `${n} site/category pair${n === 1 ? "" : "s"} in request ${s.requestId}`
}
```

- [ ] **Step 4: Do NOT commit yet**

---

## Task 5: Delete the codec, grep for leftover references

**Files:**
- Delete: `scripts/analysis-context/scope-codec.ts`
- Delete: `scripts/analysis-context/scope-codec.test.ts`

- [ ] **Step 1: Delete both files**

Run: `rm scripts/analysis-context/scope-codec.ts scripts/analysis-context/scope-codec.test.ts`

- [ ] **Step 2: Grep for any remaining importers**

Run: `grep -rn 'scope-codec\|encodeScope\|decodeScope\|scopeKey\|encodeTiers\|decodeTiers' src scripts`
Expected: no matches. If any remain (likely in `repo.ts` imports, `ChatDrawer.tsx`, `useAnalysisContext.ts`), remove them.

- [ ] **Step 3: Full type-check**

Run: `npx tsc --noEmit`
Expected: only UI-layer errors (ChatMenu/ChatDrawer/ComposeModal/preset consumers) remain. API + builder + repo + codec: clean. Any compile error in those means you missed a step.

- [ ] **Step 4: Do NOT commit yet**

UI still breaks compilation. Task 6 fixes it.

---

## Task 6: Wipe legacy chat data + shared drawer + Configure modal + preset wiring

This is the UI rewrite in one task because the parts depend on each other: the drawer needs the new modal; the buttons need the drawer context; the preset helper feeds all three.

**Files:**
- Create: `src/components/ScopeActions/lib/presets.ts`
- Create: `src/components/ScopeActions/components/ChatDrawerProvider.tsx`
- Create: `src/components/ScopeActions/components/ChatHistoryList.tsx`
- Delete: `src/components/ScopeActions/components/ChatHistoryMenu.tsx`
- Modify: `src/components/ScopeActions/components/ChatDrawer.tsx`
- Modify: `src/components/ScopeActions/components/ComposeModal.tsx`
- Modify: `src/components/ScopeActions/components/ChatMenu.tsx`
- Modify: `src/components/ScopeActions/components/CopyMenu.tsx`
- Modify: `src/components/ScopeActions/ScopeActions.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/page.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/SitesSidebar.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/PageNav.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx`

- [ ] **Step 1: Wipe legacy chat data on disk**

Run: `rm -rf data/db/*/chats`
Expected: removes every chat subdirectory. Nothing the pipeline needs lives under `chats/`. Confirm with:
Run: `find data/db -type d -name chats`
Expected: no output.

- [ ] **Step 2: Preset helper**

Full contents of `src/components/ScopeActions/lib/presets.ts`:

```ts
import type { Request } from "../../../../scripts/core/types"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"

export type Preset = {
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
}

function pairs(request: Request, filter?: { siteId?: string; categoryId?: string }): AnalysisContextScope["contextElements"] {
  const out: AnalysisContextScope["contextElements"] = []
  for (const s of request.sites) {
    if (filter?.siteId && s.id !== filter.siteId) continue
    for (const c of request.categories) {
      if (filter?.categoryId && c.id !== filter.categoryId) continue
      out.push({ siteId: s.id, categoryId: c.id })
    }
  }
  return out
}

export function requestPreset(request: Request, tiers: AnalysisContextTiers = { report: true }): Preset {
  return {
    scope: { requestId: request.id, contextElements: pairs(request) },
    tiers,
  }
}

export function sitePreset(request: Request, siteId: string, tiers: AnalysisContextTiers = { report: true }): Preset {
  return {
    scope: { requestId: request.id, contextElements: pairs(request, { siteId }) },
    tiers,
  }
}

export function categoryPreset(request: Request, categoryId: string, tiers: AnalysisContextTiers = { extractedContent: true }): Preset {
  return {
    scope: { requestId: request.id, contextElements: pairs(request, { categoryId }) },
    tiers,
  }
}
```

- [ ] **Step 3: ChatDrawer provider / context**

Full contents of `src/components/ScopeActions/components/ChatDrawerProvider.tsx`:

```tsx
"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"
import { ChatDrawer } from "./ChatDrawer"

type Draft = { scope: AnalysisContextScope; tiers: AnalysisContextTiers }

type Ctx = {
  requestId: string
  openWithPreset(draft: Draft): void
}

const DrawerCtx = createContext<Ctx | null>(null)

export function useChatDrawer(): Ctx {
  const ctx = useContext(DrawerCtx)
  if (!ctx) throw new Error("useChatDrawer must be inside <ChatDrawerProvider>")
  return ctx
}

export function ChatDrawerProvider({ requestId, children }: { requestId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const openWithPreset = useCallback((d: Draft) => {
    setActiveChatId(null)
    setDraft(d)
    setOpen(true)
  }, [])

  const value = useMemo<Ctx>(() => ({ requestId, openWithPreset }), [requestId, openWithPreset])

  return (
    <DrawerCtx.Provider value={value}>
      {children}
      <ChatDrawer
        requestId={requestId}
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        setDraft={setDraft}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
      />
    </DrawerCtx.Provider>
  )
}
```

- [ ] **Step 4: ChatHistoryList (left pane)**

Full contents of `src/components/ScopeActions/components/ChatHistoryList.tsx`:

```tsx
"use client"

import { Badge } from "@/components/ui/shadcn/badge"
import { relativeDate } from "../lib/relativeDate"
import type {
  AnalysisContextTiers,
  ChatMeta,
} from "../../../../scripts/analysis-context/types"

const TIER_LABELS: Array<[keyof AnalysisContextTiers, string]> = [
  ["report", "Report"],
  ["extractedContent", "Content"],
  ["tech", "Tech"],
  ["lighthouse", "Lighthouse"],
  ["rawPages", "Raw"],
  ["input", "Input"],
  ["progress", "Progress"],
]

function activeTiers(tiers: AnalysisContextTiers): string[] {
  return TIER_LABELS.filter(([k]) => tiers[k]).map(([, label]) => label)
}

export function ChatHistoryList({
  chats,
  activeChatId,
  onPick,
}: {
  chats: ChatMeta[]
  activeChatId: string | null
  onPick: (id: string) => void
}) {
  if (chats.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        No previous chats for this analysis yet.
      </p>
    )
  }
  return (
    <ul className="flex flex-col divide-y">
      {chats.map(c => {
        const labels = activeTiers(c.tiers)
        const selected = c.id === activeChatId
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className={
                "w-full px-3 py-2 text-left text-sm hover:bg-muted/40 " +
                (selected ? "bg-muted/60" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.title?.trim() || c.id}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeDate(c.createdAt)}
                </span>
              </div>
              {labels.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {labels.map(l => (
                    <Badge key={l} variant="outline" className="text-[10px]">
                      {l}
                    </Badge>
                  ))}
                </div>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 5: ChatDrawer rewrite**

Full contents of `src/components/ScopeActions/components/ChatDrawer.tsx`:

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/shadcn/sheet"
import { Button } from "@/components/ui/shadcn/button"
import { Input } from "@/components/ui/shadcn/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/shadcn/select"
import { SUPPORTED_CHAT_MODELS } from "../../../../scripts/chat/models"
import type {
  AnalysisContextScope,
  AnalysisContextTiers,
  ChatMessage,
  ChatMeta,
  ChatRecord,
} from "../../../../scripts/analysis-context/types"
import { ChatHistoryList } from "./ChatHistoryList"
import { ComposeModal } from "./ComposeModal"

type Draft = { scope: AnalysisContextScope; tiers: AnalysisContextTiers }

type Props = {
  requestId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  draft: Draft | null
  setDraft: (d: Draft | null) => void
  activeChatId: string | null
  setActiveChatId: (id: string | null) => void
}

export function ChatDrawer({
  requestId, open, onOpenChange, draft, setDraft, activeChatId, setActiveChatId,
}: Props) {
  const [model, setModel] = useState<string>(SUPPORTED_CHAT_MODELS[1].id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configureOpen, setConfigureOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0
  const active = chats.find(c => c.id === activeChatId) ?? null

  useEffect(() => {
    if (!open) return
    fetch(`/api/chat/list?requestId=${encodeURIComponent(requestId)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((list: ChatMeta[]) => setChats(Array.isArray(list) ? list : []))
      .catch(() => setChats([]))
  }, [open, requestId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  async function resumeChat(id: string) {
    const qs = `requestId=${encodeURIComponent(requestId)}&chatId=${id}`
    const r = await fetch(`/api/chat/get?${qs}`)
    if (!r.ok) return
    const body = (await r.json()) as ChatRecord
    setActiveChatId(id)
    setMessages(body.messages ?? [])
    setDraft(null)
    if (body.model) setModel(body.model)
  }

  function startNewChat() {
    setActiveChatId(null)
    setMessages([])
    setError(null)
  }

  async function send() {
    const userMessage = input.trim()
    if (!userMessage || sending) return
    if (!activeChatId && !draft) { setError("Pick a context via a preset button or Configure first."); return }
    setError(null)
    setInput("")
    setMessages(m => [
      ...m,
      { role: "user", content: userMessage, createdAt: new Date().toISOString() },
      { role: "assistant", content: "", createdAt: new Date().toISOString() },
    ])
    setSending(true)
    try {
      const payload: Record<string, unknown> = { requestId, model, userMessage }
      if (activeChatId) payload.chatId = activeChatId
      else { payload.scope = draft!.scope; payload.tiers = draft!.tiers }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok || !res.body) {
        const p = await res.json().catch(() => ({ error: `request failed (${res.status})` }))
        setError(p.error ?? `request failed (${res.status})`)
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
          const line = p.trim()
          if (!line.startsWith("data:")) continue
          const json = line.slice(5).trim()
          if (!json) continue
          let ev: { type: string; text?: string; chatId?: string; message?: string }
          try { ev = JSON.parse(json) } catch { continue }
          if (ev.type === "chatId" && ev.chatId) {
            setActiveChatId(ev.chatId)
            // once the backend assigns an id, the scope is locked; drop the draft.
            setDraft(null)
            // refresh the history list so the new chat appears in the left pane.
            fetch(`/api/chat/list?requestId=${encodeURIComponent(requestId)}`)
              .then(r => (r.ok ? r.json() : []))
              .then((list: ChatMeta[]) => setChats(Array.isArray(list) ? list : []))
          } else if (ev.type === "token" && typeof ev.text === "string") {
            const text = ev.text
            setMessages(m => {
              const copy = [...m]
              const last = copy[copy.length - 1]
              if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + text }
              return copy
            })
          } else if (ev.type === "error") {
            setError(ev.message ?? "stream error")
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  // ComposeModal inputs: whichever is currently in scope — the active chat's locked context (read-only), else the draft.
  const modalScope = active ? active.scope ?? draft?.scope : draft?.scope
  const modalTiers = active ? active.tiers : draft?.tiers ?? {}

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        <SheetHeader className="border-b">
          <SheetTitle>Chat about this analysis</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Select value={model} onValueChange={setModel} disabled={hasMessages}>
            <SelectTrigger className="w-50"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPORTED_CHAT_MODELS.map(m => (
                <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setConfigureOpen(true)}>
            Configure
          </Button>
          <Button variant="outline" size="sm" onClick={startNewChat}>
            New chat
          </Button>
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="w-64 shrink-0 overflow-auto border-r">
            <ChatHistoryList chats={chats} activeChatId={activeChatId} onPick={resumeChat} />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ask a question grounded in this analysis.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "rounded-md bg-muted px-3 py-2 text-sm" : "rounded-md border px-3 py-2 text-sm"}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap">
                    {m.content || (sending && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ))}
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="flex gap-2 border-t px-4 py-3">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask a question…"
                disabled={sending}
              />
              <Button onClick={send} disabled={sending || !input.trim()}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
      {configureOpen && modalScope && (
        <ComposeModal
          open={configureOpen}
          onOpenChange={setConfigureOpen}
          requestId={requestId}
          scope={modalScope}
          tiers={modalTiers}
          mode="chat"
          readOnly={hasMessages}
          onSave={(scope, tiers) => { setDraft({ scope, tiers }); setConfigureOpen(false) }}
        />
      )}
    </Sheet>
  )
}
```

- [ ] **Step 6: Rewrite ComposeModal**

Full contents of `src/components/ScopeActions/components/ComposeModal.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/shadcn/dialog"
import { Checkbox } from "@/components/ui/shadcn/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { Copy, Check } from "lucide-react"
import { useAnalysisContext, copyToClipboard } from "../lib/useAnalysisContext"
import type {
  AnalysisContextScope, AnalysisContextTiers,
} from "../../../../scripts/analysis-context/types"
import type { Request } from "../../../../scripts/core/types"

type TierKey = keyof AnalysisContextTiers

const ALL_TOGGLES: Array<{ key: TierKey; label: string; help: string }> = [
  { key: "report", label: "Report", help: "Final summary and recommendations." },
  { key: "extractedContent", label: "Extracted content", help: "Structured data pulled from pages." },
  { key: "tech", label: "Tech stack", help: "Detected technologies and estimated monthly cost." },
  { key: "lighthouse", label: "Lighthouse", help: "Performance, accessibility, SEO scores." },
  { key: "rawPages", label: "Raw pages", help: "Full page markdown. Large." },
  { key: "input", label: "Input", help: "Original request config: sites and categories." },
  { key: "progress", label: "Progress", help: "Pipeline progress.json for each site." },
]

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  requestId: string
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
  mode: "copy" | "chat"
  readOnly?: boolean
  onSave?: (scope: AnalysisContextScope, tiers: AnalysisContextTiers) => void
}

export function ComposeModal({
  open, onOpenChange, requestId, scope, tiers, mode, readOnly = false, onSave,
}: Props) {
  const [localScope, setLocalScope] = useState<AnalysisContextScope>(scope)
  const [localTiers, setLocalTiers] = useState<AnalysisContextTiers>(tiers)
  const [request, setRequest] = useState<Request | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (open) { setLocalScope(scope); setLocalTiers(tiers) } }, [open, scope, tiers])

  useEffect(() => {
    fetch(`/api/request/${requestId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(r => setRequest(r))
      .catch(() => setRequest(null))
  }, [requestId])

  const { data, loading } = useAnalysisContext(localScope, localTiers)
  const pretty = data ? JSON.stringify(data.json, null, 2) : ""

  function togglePair(siteId: string, categoryId: string) {
    if (readOnly) return
    const has = localScope.contextElements.some(e => e.siteId === siteId && e.categoryId === categoryId)
    setLocalScope(s => ({
      ...s,
      contextElements: has
        ? s.contextElements.filter(e => !(e.siteId === siteId && e.categoryId === categoryId))
        : [...s.contextElements, { siteId, categoryId }],
    }))
  }

  function toggleTier(k: TierKey) {
    if (readOnly) return
    setLocalTiers(t => ({ ...t, [k]: !t[k] }))
  }

  async function handleCopy() {
    if (!data) return
    await copyToClipboard(pretty)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const canSubmit = localScope.contextElements.length > 0 && Object.values(localTiers).some(Boolean)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-4 sm:w-5xl lg:w-6xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Context (read-only)" : `Configure ${mode === "copy" ? "copy" : "chat context"}`}</DialogTitle>
        </DialogHeader>

        {/* Scope matrix */}
        <div className="overflow-auto rounded-md border">
          {!request && <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>}
          {request && (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Site \\ Category</th>
                  {request.categories.map(c => (
                    <th key={c.id} className="px-3 py-2 text-left font-medium">{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {request.sites.map(s => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 text-foreground-muted">{s.url}</td>
                    {request.categories.map(c => {
                      const checked = localScope.contextElements.some(e => e.siteId === s.id && e.categoryId === c.id)
                      return (
                        <td key={c.id} className="px-3 py-2">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => togglePair(s.id, c.id)}
                            disabled={readOnly}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Tier toggles */}
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ALL_TOGGLES.map(t => {
              const missing = data?.missing?.includes(t.key)
              const checked = !!localTiers[t.key]
              return (
                <Tooltip key={t.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleTier(t.key)}
                      aria-pressed={checked}
                      disabled={readOnly}
                      className="flex items-center gap-2 text-sm disabled:opacity-60"
                    >
                      <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                      <span className={"select-none " + (missing ? "text-muted-foreground line-through" : "")}>
                        {t.label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    {missing ? `${t.help} (Not available for this scope.)` : t.help}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {loading ? "Loading…" : data ? `${data.bytes.toLocaleString()} bytes` : "Select context to include."}
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!data} onClick={handleCopy}>
            {copied ? <><Check className="mr-1 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy JSON</>}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
          <pre className="px-3 py-2 font-mono text-xs whitespace-pre-wrap wrap-break-word text-foreground">
            {pretty || (loading ? "Loading…" : "Select context to include.")}
          </pre>
        </div>

        {!readOnly && (
          <DialogFooter>
            {mode === "chat" && (
              <Button disabled={!canSubmit} onClick={() => { onSave?.(localScope, localTiers); onOpenChange(false) }}>
                Save
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

The modal now fetches the request shape to render the matrix. Add a supporting endpoint in the same step:

Create `src/app/api/request/[requestId]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { getRepo } from "../../../../lib/repo-server"

export async function GET(_req: Request, { params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params
  try {
    const r = await getRepo().getRequest(requestId)
    return NextResponse.json(r)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "not found" },
      { status: 404 },
    )
  }
}
```

- [ ] **Step 7: Button components wiring**

Full contents of `src/components/ScopeActions/components/ChatMenu.tsx`:

```tsx
"use client"

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { MessageSquare } from "lucide-react"
import { useChatDrawer } from "./ChatDrawerProvider"
import type { Preset } from "../lib/presets"

type Props = {
  label: string
  tooltip: string
  preset: Preset
  fullWidth?: boolean
}

export function ChatMenu({ label, tooltip, preset, fullWidth = false }: Props) {
  const { openWithPreset } = useChatDrawer()

  return (
    <DropdownMenu>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className={fullWidth ? "w-full justify-start" : undefined}>
                <MessageSquare className="mr-1 h-3.5 w-3.5" />{label}
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openWithPreset({ scope: preset.scope, tiers: { report: true } })}>
          Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openWithPreset({ scope: preset.scope, tiers: { extractedContent: true } })}>
          Content
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openWithPreset({ scope: preset.scope, tiers: preset.tiers })}>
          Configure…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

Full contents of `src/components/ScopeActions/components/CopyMenu.tsx`:

```tsx
"use client"

import { useState } from "react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { Copy } from "lucide-react"
import { fetchAnalysisContextOnce, copyToClipboard } from "../lib/useAnalysisContext"
import { ComposeModal } from "./ComposeModal"
import type { Preset } from "../lib/presets"
import type { AnalysisContextTiers } from "../../../../scripts/analysis-context/types"

type Props = {
  label: string
  tooltip: string
  preset: Preset
  requestId: string
  fullWidth?: boolean
}

export function CopyMenu({ label, tooltip, preset, requestId, fullWidth = false }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function copyPreset(tiers: AnalysisContextTiers) {
    if (busy) return
    setBusy(true)
    try {
      const ctx = await fetchAnalysisContextOnce(preset.scope, tiers)
      await copyToClipboard(JSON.stringify(ctx.json, null, 2))
    } finally { setBusy(false) }
  }

  return (
    <>
      <DropdownMenu>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy} className={fullWidth ? "w-full justify-start" : undefined}>
                  <Copy className="mr-1 h-3.5 w-3.5" />{label}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => copyPreset({ report: true })}>Report</DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyPreset({ extractedContent: true })}>Content</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModalOpen(true)}>Configure…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ComposeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        requestId={requestId}
        scope={preset.scope}
        tiers={preset.tiers}
        mode="copy"
      />
    </>
  )
}
```

Full contents of `src/components/ScopeActions/ScopeActions.tsx`:

```tsx
"use client"

import { CopyMenu } from "./components/CopyMenu"
import { ChatMenu } from "./components/ChatMenu"
import type { Preset } from "./lib/presets"

type Props = {
  preset: Preset
  label: string
  tooltip: string
  orientation?: "horizontal" | "vertical"
}

export function ScopeActions({ preset, label, tooltip, orientation = "horizontal" }: Props) {
  const vertical = orientation === "vertical"
  return (
    <div className={vertical ? "flex flex-col items-stretch gap-1.5" : "flex items-center gap-2"}>
      <CopyMenu label={`Copy ${label}`} tooltip={`Copy ${tooltip} to your clipboard.`} preset={preset} requestId={preset.scope.requestId} fullWidth={vertical} />
      <ChatMenu label={`Chat about ${label}`} tooltip={`Ask Claude about ${tooltip}.`} preset={preset} fullWidth={vertical} />
    </div>
  )
}
```

- [ ] **Step 8: Mount the provider and feed presets**

In `src/app/(report)/analyses/[requestId]/[siteId]/page.tsx`, wrap the page body. Find the JSX returned from `Page`. Locate the outermost element of the rendered tree and wrap with:

```tsx
<ChatDrawerProvider requestId={requestId}>
  {/* existing children */}
</ChatDrawerProvider>
```

Add the import at the top of the file:

```tsx
import { ChatDrawerProvider } from "@/components/ScopeActions/components/ChatDrawerProvider"
```

Note: `requestId` must be a string here — if `params` is a Promise, await it following the existing code's pattern.

In `src/app/(report)/analyses/[requestId]/[siteId]/SitesSidebar.tsx`, replace the `<ScopeActions scope=…>` call:

```tsx
<ScopeActions
  preset={requestPreset(request)}
  label="analysis"
  tooltip="the entire analysis (all sites and all categories)"
  orientation="vertical"
/>
```

Add the import: `import { requestPreset } from "@/components/ScopeActions/lib/presets"`. The `request` object is already in scope in this file; confirm with a quick read.

In `src/app/(report)/analyses/[requestId]/[siteId]/PageNav.tsx`, replace similarly:

```tsx
<ScopeActions
  preset={sitePreset(request, siteId)}
  label="site"
  tooltip="this site (all of its categories)"
  orientation="vertical"
/>
```

Add `import { sitePreset } from "@/components/ScopeActions/lib/presets"` and confirm `request` and `siteId` are in scope.

In `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx`, replace:

```tsx
<ScopeActions
  preset={categoryPreset(props.request, props.categoryId)}
  label="category"
  tooltip="this category across all sites in this analysis"
/>
```

Add `import { categoryPreset } from "@/components/ScopeActions/lib/presets"`. If `CategoryBlock` doesn't receive the full `Request`, thread it through its `props` (the parent already has it).

- [ ] **Step 9: Delete the old dropdown-menu component**

Run: `rm src/components/ScopeActions/components/ChatHistoryMenu.tsx`

Grep to confirm: `grep -rn ChatHistoryMenu src` should show zero results.

- [ ] **Step 10: Type-check and run the full test suite**

Run: `npx tsc --noEmit`
Expected: no errors, aside from the two pre-existing `scripts/pipeline/*.test.ts` errors inherited from earlier main — these are not ours and must remain unchanged.

Run: `npm test`
Expected: all tests PASS. Total count will be lower than before because `scope-codec.test.ts` and the obsolete `build.test.ts` are gone; `chat.test.ts`, `__tests__/build.test.ts`, and API tests were rewritten.

- [ ] **Step 11: Manual smoke test**

Run: `npm run dev` (separate terminal).

Checks:
1. Open a report page; every preset button (Request/Site/Category) opens the same drawer.
2. Left pane shows all chats for the request regardless of which button opened the drawer.
3. Configure modal shows a site×category matrix; toggling pairs updates the JSON preview.
4. After sending the first message, reopening Configure shows read-only controls.
5. `/analyses` "Questions" count updates after creating a chat.

If any check fails, stop and debug before committing.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat: unified chat scope, shared drawer, Configure matrix

AnalysisContextScope is now a single shape with enumerated site/category
pairs. Chats are stored flat per request and keyed by UUID. The drawer
lifts into a React context consumed by every preset button and uses a
site x category matrix for context configuration.

- Delete scope-codec; compose becomes POST with JSON body.
- Repo chat methods lose scope subdirs.
- Shared ChatDrawerProvider, ChatHistoryList, /api/request/[id] endpoint.
- Wipe legacy data/db/*/chats data (user-approved; dev-local).
EOF
)"
```

---

## Final checks

- [ ] **Step 1: Full tests**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: only the two pre-existing pipeline test errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Grep sanity**

Run: `grep -rn 'encodeScope\|decodeScope\|scope-codec\|createScopedChat\|getScopedChat\|listScopedChats\|appendScopedChatMessage\|scope\.kind\|kind: "category"\|kind: "site"\|kind: "request"' src scripts`
Expected: no matches anywhere in production code (`docs/` is fine).

- [ ] **Step 5: Hand off to user for UI smoke test**

Surface any behaviors you couldn't verify (the walkthrough listener on `window.walkthrough:open-chat` was removed — if walkthroughs rely on it, wiring an equivalent bridge through the provider is a small follow-up; call it out explicitly).
