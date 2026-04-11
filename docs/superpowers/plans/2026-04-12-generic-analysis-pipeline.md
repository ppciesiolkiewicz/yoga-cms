# Generic Analysis Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the yoga-specific scraper/analyzer with a configurable multi-vertical pipeline driven by a declarative `AnalyzeInput`, backed by a file-based DB wrapper (`Repo`), exposing a pure `runAnalysis(input, opts)` entrypoint, and a data-driven browse UI.

**Architecture:** New code under `scripts/core/`, `scripts/db/`, `scripts/pipeline/`, `scripts/cli/`. Everything talks to a single `Repo` class that owns `data/db/`. Old scraper (`scripts/scraper/`) and yoga-specific types are deleted at the end. The studio list from `websites-data.ts` is preserved as `data/inputs/yoga.json` in the new input format.

**Tech Stack:** TypeScript, Node (tsx runner), Next.js 16 (App Router) for browse UI, Anthropic SDK (sonnet for content/extract, haiku for classify), Firecrawl for fetching, Playwright + Lighthouse for audits, cheerio for parsing, wappalyzer-core for tech detection. Vitest is added for tests.

**Reference spec:** `docs/superpowers/specs/2026-04-12-generic-analysis-pipeline-design.md`

---

## Progress tracking

Tasks are independent-ish but sequential: DB layer → pipeline stages → orchestration → CLI → UI → cleanup. Each task ends with a commit. The codebase stays green throughout — old scraper still works until Task 16.

---

## Task 1: Add vitest + test scaffolding

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `scripts/__tests__/sanity.test.ts`

Rationale: spec calls for repo unit tests and a pipeline integration test. Project currently has no test runner. Vitest is a small dep, zero-config, works with tsx-style ESM.

- [ ] **Step 1: Install vitest**

```bash
npm install --save-dev vitest
```

Expected: package.json updated, node_modules populated, no errors.

- [ ] **Step 2: Create vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["scripts/**/*.test.ts"],
    environment: "node",
    testTimeout: 10_000,
  },
})
```

- [ ] **Step 3: Add test script to package.json**

Edit `package.json` scripts block — add `"test": "vitest run"` and `"test:watch": "vitest"`. Full scripts block after edit:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "fetch": "tsx scripts/scraper/fetch.ts",
  "analyze": "tsx scripts/scraper/analyze.ts",
  "migrate-raw": "tsx scripts/scraper/migrate-raw.ts"
}
```

- [ ] **Step 4: Write a sanity test**

Create `scripts/__tests__/sanity.test.ts`:

```ts
import { describe, it, expect } from "vitest"

describe("vitest sanity", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: Run it**

```bash
npm test
```

Expected: 1 test passes.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts scripts/__tests__/sanity.test.ts
git commit -m "chore: add vitest for the new pipeline"
```

---

## Task 2: Core types + base prompt utility

**Files:**
- Create: `scripts/core/types.ts`
- Create: `scripts/core/base-prompt.ts`
- Create: `scripts/core/__tests__/base-prompt.test.ts`

- [ ] **Step 1: Create core types**

Create `scripts/core/types.ts`:

```ts
export interface CategoryInput {
  name: string
  extraInfo: string
  prompt: string
}

export interface SiteInput {
  url: string
  meta?: Record<string, unknown>
}

export interface AnalyzeInput {
  displayName?: string
  categories: CategoryInput[]
  sites: SiteInput[]
}

export interface Category extends CategoryInput { id: string }
export interface Site extends SiteInput { id: string }

export interface Request {
  id: string
  createdAt: string
  displayName?: string
  categories: Category[]
  sites: Site[]
}

export interface RequestIndexEntry {
  id: string
  displayName?: string
  createdAt: string
  siteCount: number
  categoryCount: number
}

export type StageName =
  | "fetch-home"
  | "extract-nav"
  | "classify"
  | "fetch-pages"
  | "tech"
  | "lighthouse"
  | "content"
  | "extract"
  | "report"

export interface RunOptions {
  concurrency?: number
  stages?: StageName[]
  force?: boolean
}

export interface ArtifactRef {
  requestId: string
  siteId?: string
  stage: string
  name: string
}
```

- [ ] **Step 2: Write failing test for generatePrompt**

Create `scripts/core/__tests__/base-prompt.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { buildBasePromptMessage } from "../base-prompt"

describe("buildBasePromptMessage", () => {
  it("includes category name and extraInfo", () => {
    const msg = buildBasePromptMessage("drop in", "recurring classes at the studio")
    expect(msg).toContain("drop in")
    expect(msg).toContain("recurring classes at the studio")
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test -- scripts/core/__tests__/base-prompt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement base-prompt**

Create `scripts/core/base-prompt.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"

export const BASE_PROMPT = `You help build prompts for a site-analysis pipeline.
Each prompt describes a *category* of pages on a website. The analysis pipeline
uses the prompt in two places:

1. Content assessment — score each page 1-10 on conversionScore (can a visitor act)
   and seoScore (can search engines rank it). The prompt should describe what a good
   page of this category looks like and what a bad one looks like.

2. Data extraction — pull structured records from pages matching the category.
   The prompt should name the fields that matter.

Given the category name and extra info below, write a single prompt (plain text,
no preamble, no headings beyond what helps a language model) that covers both uses.

Category name: {categoryName}
Extra info: {extraInfo}

Write the prompt now.`

export function buildBasePromptMessage(categoryName: string, extraInfo: string): string {
  return BASE_PROMPT
    .replace("{categoryName}", categoryName)
    .replace("{extraInfo}", extraInfo)
}

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

export async function generatePrompt(categoryName: string, extraInfo: string): Promise<string> {
  const res = await client().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: buildBasePromptMessage(categoryName, extraInfo) }],
  })
  const text = res.content[0].type === "text" ? res.content[0].text : ""
  return text.trim()
}
```

- [ ] **Step 5: Run test**

```bash
npm test -- scripts/core/__tests__/base-prompt.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/core/
git commit -m "feat(core): add core types and base-prompt utility"
```

---

## Task 3: DB paths module

**Files:**
- Create: `scripts/db/paths.ts`
- Create: `scripts/db/__tests__/paths.test.ts`

Rationale: pure function mapping `ArtifactRef` ↔ filesystem path. Easiest thing to test. Unblocks everything else.

- [ ] **Step 1: Write failing tests**

Create `scripts/db/__tests__/paths.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { refToPath, requestDir, dbRoot } from "../paths"

describe("paths", () => {
  it("builds request-scoped artifact path (no site)", () => {
    const p = refToPath("/tmp/db", { requestId: "r1", stage: "meta", name: "summary.json" })
    expect(p).toBe("/tmp/db/requests/r1/meta/summary.json")
  })

  it("builds site-scoped artifact path", () => {
    const p = refToPath("/tmp/db", {
      requestId: "r1",
      siteId: "s1",
      stage: "fetch-home",
      name: "home.html",
    })
    expect(p).toBe("/tmp/db/requests/r1/sites/s1/fetch-home/home.html")
  })

  it("builds requestDir", () => {
    expect(requestDir("/tmp/db", "r1")).toBe("/tmp/db/requests/r1")
  })

  it("derives dbRoot from an absolute data dir", () => {
    expect(dbRoot("/abs/data")).toBe("/abs/data/db")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- scripts/db/__tests__/paths.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement paths**

Create `scripts/db/paths.ts`:

```ts
import { join } from "path"
import type { ArtifactRef } from "../core/types"

export function dbRoot(dataDir: string): string {
  return join(dataDir, "db")
}

export function requestDir(root: string, requestId: string): string {
  return join(root, "requests", requestId)
}

export function siteDir(root: string, requestId: string, siteId: string): string {
  return join(requestDir(root, requestId), "sites", siteId)
}

export function refToPath(root: string, ref: ArtifactRef): string {
  const base = ref.siteId
    ? siteDir(root, ref.requestId, ref.siteId)
    : requestDir(root, ref.requestId)
  return join(base, ref.stage, ref.name)
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- scripts/db/__tests__/paths.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/db/paths.ts scripts/db/__tests__/paths.test.ts
git commit -m "feat(db): add paths module"
```

---

## Task 4: DB store primitives

**Files:**
- Create: `scripts/db/store.ts`
- Create: `scripts/db/__tests__/store.test.ts`

Rationale: thin wrapper over `fs/promises` providing read/write/exists/list operations. Isolates all fs calls behind an interface the repo uses. Later swap to a different backend.

- [ ] **Step 1: Write failing tests**

Create `scripts/db/__tests__/store.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Store } from "../store"

describe("Store", () => {
  let tmp: string
  let store: Store

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "store-"))
    store = new Store()
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it("writes and reads a string file", async () => {
    const path = join(tmp, "a/b/c.txt")
    await store.writeFile(path, "hello")
    expect(await store.readFile(path)).toEqual(Buffer.from("hello"))
  })

  it("writes and reads a buffer file", async () => {
    const path = join(tmp, "x.bin")
    await store.writeFile(path, Buffer.from([1, 2, 3]))
    const buf = await store.readFile(path)
    expect(buf.equals(Buffer.from([1, 2, 3]))).toBe(true)
  })

  it("reports exists", async () => {
    const path = join(tmp, "y.txt")
    expect(await store.exists(path)).toBe(false)
    await store.writeFile(path, "y")
    expect(await store.exists(path)).toBe(true)
  })

  it("lists files recursively", async () => {
    await store.writeFile(join(tmp, "a.txt"), "")
    await store.writeFile(join(tmp, "sub/b.txt"), "")
    await store.writeFile(join(tmp, "sub/deep/c.txt"), "")
    const all = (await store.listFiles(tmp)).sort()
    expect(all).toEqual([
      join(tmp, "a.txt"),
      join(tmp, "sub/b.txt"),
      join(tmp, "sub/deep/c.txt"),
    ])
  })

  it("lists immediate directories", async () => {
    await store.writeFile(join(tmp, "r1/x.txt"), "")
    await store.writeFile(join(tmp, "r2/x.txt"), "")
    await store.writeFile(join(tmp, "r1/sub/y.txt"), "")
    const dirs = (await store.listDirs(tmp)).sort()
    expect(dirs).toEqual(["r1", "r2"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- scripts/db/__tests__/store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement store**

Create `scripts/db/store.ts`:

```ts
import { mkdir, readFile, writeFile, stat, readdir } from "fs/promises"
import { dirname, join } from "path"

export class Store {
  async writeFile(path: string, content: string | Buffer): Promise<void> {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }

  async readFile(path: string): Promise<Buffer> {
    return await readFile(path)
  }

  async exists(path: string): Promise<boolean> {
    try {
      await stat(path)
      return true
    } catch {
      return false
    }
  }

  async listDirs(path: string): Promise<string[]> {
    try {
      const entries = await readdir(path, { withFileTypes: true })
      return entries.filter(e => e.isDirectory()).map(e => e.name)
    } catch {
      return []
    }
  }

  async listFiles(path: string): Promise<string[]> {
    const out: string[] = []
    const walk = async (dir: string) => {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) await walk(full)
        else out.push(full)
      }
    }
    await walk(path)
    return out
  }
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- scripts/db/__tests__/store.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/db/store.ts scripts/db/__tests__/store.test.ts
git commit -m "feat(db): add Store fs primitives"
```

---

## Task 5: Repo class — requests and artifacts

**Files:**
- Create: `scripts/db/repo.ts`
- Create: `scripts/db/__tests__/repo.test.ts`

Rationale: the public DB API. Everything in pipeline + UI reads/writes through this.

- [ ] **Step 1: Write failing tests**

Create `scripts/db/__tests__/repo.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { Repo } from "../repo"
import type { AnalyzeInput } from "../../core/types"

function sampleInput(): AnalyzeInput {
  return {
    displayName: "Test run",
    categories: [
      { name: "menu", extraInfo: "food menus", prompt: "describe menus" },
      { name: "hours", extraInfo: "opening hours", prompt: "describe hours" },
    ],
    sites: [{ url: "https://example.com", meta: { city: "Testville" } }],
  }
}

describe("Repo", () => {
  let tmp: string
  let repo: Repo

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "repo-"))
    repo = new Repo(tmp)
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it("createRequest assigns ids and persists request.json", async () => {
    const req = await repo.createRequest(sampleInput())
    expect(req.id).toMatch(/\S/)
    expect(req.createdAt).toMatch(/T/)
    expect(req.categories).toHaveLength(2)
    expect(req.categories[0].id).toMatch(/\S/)
    expect(req.sites).toHaveLength(1)
    expect(req.sites[0].id).toMatch(/\S/)

    const loaded = await repo.getRequest(req.id)
    expect(loaded).toEqual(req)
  })

  it("createRequest updates index.json", async () => {
    const a = await repo.createRequest(sampleInput())
    const b = await repo.createRequest(sampleInput())
    const list = await repo.listRequests()
    const ids = list.map(e => e.id).sort()
    expect(ids).toEqual([a.id, b.id].sort())
    expect(list[0].siteCount).toBe(1)
    expect(list[0].categoryCount).toBe(2)
  })

  it("putArtifact/getArtifact round-trip buffer content", async () => {
    const req = await repo.createRequest(sampleInput())
    const siteId = req.sites[0].id
    const ref = { requestId: req.id, siteId, stage: "fetch-home", name: "home.html" }
    await repo.putArtifact(ref, "<html>hi</html>")
    expect(await repo.artifactExists(ref)).toBe(true)
    const buf = await repo.getArtifact(ref)
    expect(buf.toString("utf8")).toBe("<html>hi</html>")
  })

  it("putJson/getJson round-trip typed objects", async () => {
    const req = await repo.createRequest(sampleInput())
    const siteId = req.sites[0].id
    const ref = { requestId: req.id, siteId, stage: "tech", name: "tech.json" }
    await repo.putJson(ref, { platform: "WordPress", count: 3 })
    const back = await repo.getJson<{ platform: string; count: number }>(ref)
    expect(back).toEqual({ platform: "WordPress", count: 3 })
  })

  it("artifactExists returns false for missing refs", async () => {
    const req = await repo.createRequest(sampleInput())
    expect(await repo.artifactExists({
      requestId: req.id,
      siteId: req.sites[0].id,
      stage: "content",
      name: "content.json",
    })).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- scripts/db/__tests__/repo.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Repo**

Create `scripts/db/repo.ts`:

```ts
import { randomBytes } from "crypto"
import { join } from "path"
import type {
  AnalyzeInput,
  ArtifactRef,
  Request,
  RequestIndexEntry,
  Category,
  Site,
} from "../core/types"
import { Store } from "./store"
import { dbRoot, requestDir, refToPath } from "./paths"

export class Repo {
  readonly root: string
  private store: Store

  constructor(dataDir: string, store: Store = new Store()) {
    this.root = dbRoot(dataDir)
    this.store = store
  }

  // ── requests ──

  async createRequest(input: AnalyzeInput): Promise<Request> {
    const id = newId()
    const createdAt = new Date().toISOString()
    const categories: Category[] = input.categories.map(c => ({ ...c, id: newId("cat") }))
    const sites: Site[] = input.sites.map(s => ({ ...s, id: newId("site") }))
    const request: Request = { id, createdAt, displayName: input.displayName, categories, sites }

    await this.store.writeFile(
      join(requestDir(this.root, id), "request.json"),
      JSON.stringify(request, null, 2),
    )
    await this.appendIndex({
      id,
      displayName: input.displayName,
      createdAt,
      siteCount: sites.length,
      categoryCount: categories.length,
    })
    return request
  }

  async getRequest(id: string): Promise<Request> {
    const path = join(requestDir(this.root, id), "request.json")
    const buf = await this.store.readFile(path)
    return JSON.parse(buf.toString("utf8")) as Request
  }

  async listRequests(): Promise<RequestIndexEntry[]> {
    const path = join(this.root, "index.json")
    if (!(await this.store.exists(path))) return []
    const buf = await this.store.readFile(path)
    return JSON.parse(buf.toString("utf8")) as RequestIndexEntry[]
  }

  private async appendIndex(entry: RequestIndexEntry): Promise<void> {
    const list = await this.listRequests()
    const next = [...list.filter(e => e.id !== entry.id), entry]
    await this.store.writeFile(
      join(this.root, "index.json"),
      JSON.stringify(next, null, 2),
    )
  }

  // ── artifacts ──

  async putArtifact(ref: ArtifactRef, content: string | Buffer): Promise<void> {
    await this.store.writeFile(refToPath(this.root, ref), content)
  }

  async getArtifact(ref: ArtifactRef): Promise<Buffer> {
    return await this.store.readFile(refToPath(this.root, ref))
  }

  async putJson<T>(ref: ArtifactRef, obj: T): Promise<void> {
    await this.putArtifact(ref, JSON.stringify(obj, null, 2))
  }

  async getJson<T>(ref: ArtifactRef): Promise<T> {
    const buf = await this.getArtifact(ref)
    return JSON.parse(buf.toString("utf8")) as T
  }

  async artifactExists(ref: ArtifactRef): Promise<boolean> {
    return await this.store.exists(refToPath(this.root, ref))
  }
}

function newId(prefix = "r"): string {
  const stamp = Date.now().toString(36)
  const rand = randomBytes(4).toString("hex")
  return `${prefix}_${stamp}_${rand}`
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- scripts/db/__tests__/repo.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/db/repo.ts scripts/db/__tests__/repo.test.ts
git commit -m "feat(db): add Repo class with requests and artifacts"
```

---

## Task 6: Repo — consolidateRequest

**Files:**
- Modify: `scripts/db/repo.ts`
- Modify: `scripts/db/__tests__/repo.test.ts`

Rationale: reads all artifacts for a request and writes `result.json` — the one file the UI loads.

- [ ] **Step 1: Add failing test**

Append to `scripts/db/__tests__/repo.test.ts` inside the `describe("Repo", ...)` block:

```ts
  it("consolidateRequest aggregates artifacts into result.json", async () => {
    const req = await repo.createRequest(sampleInput())
    const siteId = req.sites[0].id

    await repo.putJson({ requestId: req.id, siteId, stage: "tech", name: "tech.json" }, { platform: "WordPress" })
    await repo.putJson(
      { requestId: req.id, siteId, stage: "content", name: "content.json" },
      { pages: [{ url: "https://example.com", conversionScore: 7, seoScore: 6 }] },
    )

    await repo.consolidateRequest(req.id)

    const result = await repo.getJson<{
      request: { id: string }
      sites: Array<{ siteId: string; artifacts: Record<string, unknown> }>
    }>({ requestId: req.id, stage: "", name: "result.json" })

    expect(result.request.id).toBe(req.id)
    expect(result.sites).toHaveLength(1)
    expect(result.sites[0].siteId).toBe(siteId)
    expect(result.sites[0].artifacts["tech"]).toEqual({ platform: "WordPress" })
    expect(result.sites[0].artifacts["content"]).toMatchObject({ pages: expect.any(Array) })
  })
```

Note: the ref shape `{ stage: "", name: "result.json" }` with no `siteId` writes to `requests/<id>/result.json` — the `refToPath` function treats empty stage as a direct child. Verify this works; if not, adjust `refToPath` or store result.json via a dedicated method.

- [ ] **Step 2: Extend refToPath to handle empty stage**

Modify `scripts/db/paths.ts` — replace the `refToPath` function with:

```ts
export function refToPath(root: string, ref: ArtifactRef): string {
  const base = ref.siteId
    ? siteDir(root, ref.requestId, ref.siteId)
    : requestDir(root, ref.requestId)
  return ref.stage ? join(base, ref.stage, ref.name) : join(base, ref.name)
}
```

Add a matching test to `scripts/db/__tests__/paths.test.ts`:

```ts
  it("builds request-scoped artifact path with empty stage", () => {
    expect(refToPath("/tmp/db", { requestId: "r1", stage: "", name: "result.json" }))
      .toBe("/tmp/db/requests/r1/result.json")
  })
```

- [ ] **Step 3: Run tests — should fail on consolidateRequest, pass on paths**

```bash
npm test
```

Expected: paths tests PASS (5 tests), repo tests FAIL on `consolidateRequest is not a function`.

- [ ] **Step 4: Implement consolidateRequest**

Add inside the `Repo` class in `scripts/db/repo.ts` (after `artifactExists`):

```ts
  async consolidateRequest(id: string): Promise<void> {
    const request = await this.getRequest(id)
    const sites: Array<{ siteId: string; url: string; artifacts: Record<string, unknown> }> = []

    for (const site of request.sites) {
      const stages = await this.store.listDirs(
        join(requestDir(this.root, id), "sites", site.id),
      )
      const artifacts: Record<string, unknown> = {}
      for (const stage of stages) {
        const jsonName = `${stage.replace(/^fetch-/, "")}.json`
        const candidates = [`${stage}.json`, jsonName, "content.json", "tech.json", "lighthouse.json", "extract.json", "report.json", "classify.json"]
        for (const name of candidates) {
          const ref = { requestId: id, siteId: site.id, stage, name }
          if (await this.artifactExists(ref)) {
            try {
              artifacts[stage] = await this.getJson(ref)
            } catch {
              // not json, skip in result.json (raw files still on disk)
            }
            break
          }
        }
      }
      sites.push({ siteId: site.id, url: site.url, artifacts })
    }

    const result = { request, sites }
    await this.putJson(
      { requestId: id, stage: "", name: "result.json" },
      result,
    )
  }
```

Note: this is a best-effort aggregator — it walks each site's stage directories, reads the first known-JSON artifact in each, and includes it. Non-JSON artifacts (home.html, markdown) stay on disk and are not embedded in result.json.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/db/repo.ts scripts/db/paths.ts scripts/db/__tests__/
git commit -m "feat(db): add consolidateRequest"
```

---

## Task 7: Port firecrawl client (no behaviour change)

**Files:**
- Create: `scripts/pipeline/firecrawl-client.ts`

Rationale: the existing `scripts/scraper/pipeline/firecrawl-client.ts` has zero yoga-specific logic. Copy it verbatim into the new location so the new pipeline doesn't reach into old directories.

- [ ] **Step 1: Copy file**

```bash
cp scripts/scraper/pipeline/firecrawl-client.ts scripts/pipeline/firecrawl-client.ts
```

- [ ] **Step 2: Verify the copy compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors (old errors about the copy itself — if any — are acceptable since they only matter once imports start).

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/firecrawl-client.ts
git commit -m "chore(pipeline): copy firecrawl client into new pipeline dir"
```

---

## Task 8: Pipeline stage — fetch-home

**Files:**
- Create: `scripts/pipeline/fetch-home.ts`

Rationale: first real pipeline stage. Fetches a site's homepage, writes `home.html` + `home.md` + `home.headers.json` under the site's `fetch-home/` stage directory.

- [ ] **Step 1: Implement fetchHome**

Create `scripts/pipeline/fetch-home.ts`:

```ts
import * as cheerio from "cheerio"
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"
import { scrapeUrl, ensureCredits, fetchResponseHeaders } from "./firecrawl-client"

function htmlToMarkdownLike(html: string): string {
  const $ = cheerio.load(html)
  $("script, style, iframe, noscript").remove()
  return $("body").text().replace(/\s+/g, " ").trim()
}

export async function fetchHome(repo: Repo, request: Request, site: Site): Promise<void> {
  const credits = await ensureCredits()
  if (!credits.ok) {
    throw new Error(`Firecrawl credits below floor (remaining=${credits.remaining})`)
  }
  const [scraped, headers] = await Promise.all([
    scrapeUrl(site.url, { includeRawHtml: true, onlyMainContent: false }),
    fetchResponseHeaders(site.url),
  ])
  if ("error" in scraped) {
    throw new Error(`Homepage scrape failed for ${site.url}: ${scraped.error}`)
  }

  const html = scraped.rawHtml ?? scraped.html ?? ""
  const markdown = scraped.markdown ?? htmlToMarkdownLike(html)

  const ctx = { requestId: request.id, siteId: site.id, stage: "fetch-home" }
  await repo.putArtifact({ ...ctx, name: "home.html" }, html)
  await repo.putArtifact({ ...ctx, name: "home.md" }, markdown)
  await repo.putJson({ ...ctx, name: "home.headers.json" }, headers)
  await repo.putJson({ ...ctx, name: "home.meta.json" }, {
    url: site.url,
    links: scraped.links ?? [],
  })
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/fetch-home.ts
git commit -m "feat(pipeline): add fetch-home stage"
```

---

## Task 9: Pipeline stage — extract-nav

**Files:**
- Create: `scripts/pipeline/extract-nav.ts`

Rationale: reads `home.html`, produces `nav-links.json` — the candidate links for classification.

- [ ] **Step 1: Implement extractNav**

Create `scripts/pipeline/extract-nav.ts`:

```ts
import * as cheerio from "cheerio"
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"

const NOISE_PATH_PATTERNS = [
  /^\/?privacy/i, /^\/?terms/i, /^\/?cookie/i, /^\/?impressum/i,
  /^\/?legal/i, /^\/?login/i, /^\/?register/i, /^\/?account/i,
  /^\/?cart/i, /^\/?checkout/i, /^\/?wp-admin/i, /^\/?feed/i,
  /\.(pdf|zip|jpg|jpeg|png|gif|svg|webp|ico)$/i,
]

function isNoise(u: URL): boolean {
  return NOISE_PATH_PATTERNS.some(p => p.test(u.pathname))
}

function labelFromPath(u: URL): string {
  const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean)
  if (parts.length === 0) return "home"
  return parts[parts.length - 1].replace(/[-_]/g, " ")
}

export interface NavLink { label: string; href: string }

export async function extractNav(repo: Repo, request: Request, site: Site): Promise<void> {
  const homeHtmlBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "fetch-home", name: "home.html",
  })
  const html = homeHtmlBuf.toString("utf8")
  const base = new URL(site.url)
  const $ = cheerio.load(html)
  const seen = new Set<string>([site.url])
  const links: NavLink[] = []

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href")
    if (!href) return
    let u: URL
    try { u = new URL(href, site.url) } catch { return }
    if (u.hostname !== base.hostname) return
    const key = `${u.origin}${u.pathname}`.replace(/\/$/, "")
    if (seen.has(key)) return
    if (isNoise(u)) return
    seen.add(key)
    const text = $(el).text().replace(/\s+/g, " ").trim()
    links.push({ label: text || labelFromPath(u), href: u.href })
  })

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "extract-nav", name: "nav-links.json" },
    { links },
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/extract-nav.ts
git commit -m "feat(pipeline): add extract-nav stage"
```

---

## Task 10: Pipeline stage — classify

**Files:**
- Create: `scripts/pipeline/classify.ts`

Rationale: generic link classifier. Uses haiku + the request's categories. Produces `{ [categoryId]: string[] }` — a URL list per category. Pages not matching any category are dropped (the caller defines what matters).

- [ ] **Step 1: Implement classify**

Create `scripts/pipeline/classify.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import type { Repo } from "../db/repo"
import type { Request, Site, Category } from "../core/types"
import type { NavLink } from "./extract-nav"

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

const PER_CATEGORY_CAP = 5

function buildSystemPrompt(categories: Category[]): string {
  const bullets = categories
    .map(c => `- "${c.name}": ${c.extraInfo}`)
    .join("\n")
  return `You classify links from a website homepage into buckets. The buckets are:
${bullets}
- "other": everything else

Return ONLY a JSON object with one key per bucket name. Each value is an array of
matched URLs (use the exact href from the input), except "other" which you may omit.
Cap each named bucket at ${PER_CATEGORY_CAP} URLs. Prefer the most informative URL
when forced to choose. Use labels as the primary signal, URLs as fallback.`
}

export async function classify(repo: Repo, request: Request, site: Site): Promise<void> {
  const navBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "extract-nav", name: "nav-links.json",
  })
  const nav = JSON.parse(navBuf.toString("utf8")) as { links: NavLink[] }

  const byCategory: Record<string, string[]> = {}
  for (const c of request.categories) byCategory[c.id] = []

  if (nav.links.length === 0) {
    await repo.putJson(
      { requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json" },
      { byCategory },
    )
    return
  }

  const system = buildSystemPrompt(request.categories)
  const userMessage = `Site: ${site.url}

Homepage links:
${nav.links.map(l => `- "${l.label}" -> ${l.href}`).join("\n")}

Classify into JSON as instructed. Bucket names to use: ${request.categories.map(c => `"${c.name}"`).join(", ")}.`

  const response = await client().messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    system,
    messages: [{ role: "user", content: userMessage }],
  })
  let text = response.content[0].type === "text" ? response.content[0].text : ""
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()

  const parsed = JSON.parse(text) as Record<string, unknown>
  for (const category of request.categories) {
    const raw = parsed[category.name]
    if (Array.isArray(raw)) {
      byCategory[category.id] = raw
        .filter((u): u is string => typeof u === "string")
        .slice(0, PER_CATEGORY_CAP)
    }
  }

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json" },
    { byCategory },
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/classify.ts
git commit -m "feat(pipeline): add classify stage"
```

---

## Task 11: Pipeline stage — fetch-pages

**Files:**
- Create: `scripts/pipeline/fetch-pages.ts`

Rationale: fetches the markdown for every URL that the classifier matched into some category. Writes each page as its own file under `fetch-pages/`.

- [ ] **Step 1: Implement fetchPages**

Create `scripts/pipeline/fetch-pages.ts`:

```ts
import { createHash } from "crypto"
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"
import { scrapeUrl } from "./firecrawl-client"

const SCRAPE_CONCURRENCY = 2

interface PageRecord {
  id: string
  url: string
  status: "ok" | "failed"
  error?: string
}

function pageId(url: string): string {
  return createHash("sha1").update(url).digest("hex").slice(0, 10)
}

export async function fetchPages(repo: Repo, request: Request, site: Site): Promise<void> {
  const classifyBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json",
  })
  const classify = JSON.parse(classifyBuf.toString("utf8")) as {
    byCategory: Record<string, string[]>
  }

  const urls = new Set<string>()
  for (const list of Object.values(classify.byCategory)) {
    for (const u of list) urls.add(u)
  }

  const ordered = [...urls]
  const records: PageRecord[] = []
  let index = 0

  async function worker(): Promise<void> {
    while (index < ordered.length) {
      const url = ordered[index++]
      const id = pageId(url)
      const res = await scrapeUrl(url)
      if ("error" in res) {
        records.push({ id, url, status: "failed", error: res.error })
        continue
      }
      await repo.putArtifact(
        { requestId: request.id, siteId: site.id, stage: "fetch-pages", name: `${id}.md` },
        res.markdown ?? "",
      )
      records.push({ id, url, status: "ok" })
    }
  }

  await Promise.all(Array.from({ length: SCRAPE_CONCURRENCY }, worker))

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "fetch-pages", name: "index.json" },
    { pages: records },
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/fetch-pages.ts
git commit -m "feat(pipeline): add fetch-pages stage"
```

---

## Task 12: Pipeline stage — tech

**Files:**
- Create: `scripts/pipeline/tech.ts`

Rationale: wappalyzer on home.html. Drop yoga-specific heuristics from the old code — the new tech.json is pure technology detection + cost estimation. No `features` block, no `addOnServices`, no yoga add-ons.

- [ ] **Step 1: Implement tech stage**

Create `scripts/pipeline/tech.ts`:

```ts
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"

const COST_MAP: Record<string, { item: string; min: number; max: number }> = {
  "WordPress": { item: "WordPress hosting", min: 5, max: 50 },
  "Wix": { item: "Wix subscription", min: 17, max: 45 },
  "Squarespace": { item: "Squarespace subscription", min: 16, max: 65 },
  "Shopify": { item: "Shopify subscription", min: 29, max: 299 },
  "Divi": { item: "Divi theme license", min: 7, max: 10 },
  "Elementor": { item: "Elementor Pro", min: 5, max: 10 },
  "WooCommerce": { item: "WooCommerce hosting/plugins", min: 10, max: 50 },
  "Mailchimp": { item: "Mailchimp", min: 0, max: 30 },
  "Google Analytics": { item: "Google Analytics", min: 0, max: 0 },
  "Cloudflare": { item: "Cloudflare", min: 0, max: 20 },
}

interface DetectedTechnology {
  name: string
  categories: string[]
  version?: string
  confidence?: number
}

interface RawDetection {
  name: string
  categories?: Array<{ id?: number; name?: string; slug?: string }>
  version?: string
  confidence?: number
}

async function runWappalyzer(
  url: string,
  html: string,
  headers: Record<string, string> | undefined,
): Promise<DetectedTechnology[]> {
  const wappalyzer = (await import("wappalyzer-core")).default
  const technologies = (await import("simple-wappalyzer/src/technologies.json", { with: { type: "json" } })).default
  const categories = (await import("simple-wappalyzer/src/categories.json", { with: { type: "json" } })).default
  wappalyzer.setTechnologies(technologies)
  wappalyzer.setCategories(categories)

  const { Window } = await import("happy-dom")
  const window = new Window({
    url,
    settings: {
      disableComputedStyleRendering: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true,
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
    },
  })
  try {
    window.document.documentElement.innerHTML = html

    const scriptSrc = Array.from(window.document.scripts)
      .map(s => s.src)
      .filter((s): s is string => typeof s === "string" && s.length > 0)

    const meta: Record<string, string[]> = {}
    for (const m of Array.from(window.document.querySelectorAll("meta"))) {
      const key = m.getAttribute("name") || m.getAttribute("property")
      const value = m.getAttribute("content")
      if (!key || !value) continue
      ;(meta[key.toLowerCase()] ??= []).push(value)
    }

    const normalized: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(headers ?? {})) {
      if (v == null) continue
      normalized[k.toLowerCase()] = [String(v)]
    }

    const detections = await wappalyzer.analyze({
      url, meta, headers: normalized, scriptSrc, cookies: [], html: window.document.documentElement.outerHTML,
    })
    const resolved = wappalyzer.resolve(detections) as RawDetection[]
    return resolved.map(t => ({
      name: t.name,
      categories: (t.categories ?? []).map(c => c?.name).filter((n): n is string => !!n),
      version: t.version || undefined,
      confidence: typeof t.confidence === "number" ? t.confidence : undefined,
    }))
  } finally {
    await window.happyDOM.close()
  }
}

function detectPlatform(technologies: DetectedTechnology[]): string {
  const names = technologies.map(t => t.name)
  if (names.includes("WordPress")) return "WordPress"
  if (names.includes("Wix")) return "Wix"
  if (names.includes("Squarespace")) return "Squarespace"
  if (names.includes("Shopify")) return "Shopify"
  if (names.includes("Webflow")) return "Webflow"
  return "Custom / Unknown"
}

function estimateCosts(technologies: DetectedTechnology[]): {
  costBreakdown: Array<{ item: string; min: number; max: number }>
  total: { min: number; max: number; currency: string }
} {
  const breakdown: Array<{ item: string; min: number; max: number }> = []
  let min = 0, max = 0
  for (const tech of technologies) {
    const cost = COST_MAP[tech.name]
    if (cost) {
      breakdown.push({ item: cost.item, min: cost.min, max: cost.max })
      min += cost.min
      max += cost.max
    }
  }
  breakdown.push({ item: "Domain registration", min: 1, max: 2 })
  min += 1; max += 2
  return { costBreakdown: breakdown, total: { min, max, currency: "USD" } }
}

export async function techStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const htmlBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "fetch-home", name: "home.html",
  })
  const headers = await repo.getJson<Record<string, string>>({
    requestId: request.id, siteId: site.id, stage: "fetch-home", name: "home.headers.json",
  })

  let technologies: DetectedTechnology[] = []
  try {
    technologies = await runWappalyzer(site.url, htmlBuf.toString("utf8"), headers)
  } catch (err) {
    console.warn(`  ⚠ wappalyzer failed for ${site.url}: ${err}`)
  }

  const platform = detectPlatform(technologies)
  const { costBreakdown, total } = estimateCosts(technologies)

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "tech", name: "tech.json" },
    { platform, detectedTechnologies: technologies, costBreakdown, totalEstimatedMonthlyCost: total },
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. If `wappalyzer-core` is missing, it was previously pulled in transitively; verify the old tech-detect.ts still resolves it. If not, the install lives in Task 1 of the old code — you may need to add it: `npm install wappalyzer-core happy-dom`.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/tech.ts
git commit -m "feat(pipeline): add tech stage"
```

---

## Task 13: Pipeline stage — lighthouse

**Files:**
- Create: `scripts/pipeline/lighthouse.ts`

- [ ] **Step 1: Implement lighthouse stage**

Create `scripts/pipeline/lighthouse.ts`:

```ts
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"

interface LighthouseScores {
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

async function runLighthouse(url: string): Promise<LighthouseScores> {
  try {
    const chromeLauncher = await import("chrome-launcher")
    const { chromium } = await import("playwright")
    const chrome = await chromeLauncher.launch({
      chromePath: chromium.executablePath(),
      chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
    })
    try {
      const lighthouse = (await import("lighthouse")).default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await lighthouse(url, {
        output: "json",
        onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
        port: chrome.port,
      } as any)
      if (!result?.lhr?.categories) {
        return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
      }
      const cats = result.lhr.categories
      return {
        performance: Math.round((cats.performance?.score ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
        seo: Math.round((cats.seo?.score ?? 0) * 100),
        bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      }
    } finally {
      await chrome.kill()
    }
  } catch (err) {
    console.warn(`  ⚠ lighthouse failed for ${url}: ${err}`)
    return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
  }
}

export async function lighthouseStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const scores = await runLighthouse(site.url)
  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "lighthouse", name: "lighthouse.json" },
    scores,
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/lighthouse.ts
git commit -m "feat(pipeline): add lighthouse stage"
```

---

## Task 14: Pipeline stage — content

**Files:**
- Create: `scripts/pipeline/content.ts`

Rationale: generic content assessment. For each category, concatenates that category's classified pages and calls sonnet with the category's prompt + a fixed assessment framing. Output: a flat list of `PageAssessment` per category.

- [ ] **Step 1: Implement content stage**

Create `scripts/pipeline/content.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import type { Repo } from "../db/repo"
import type { Request, Site, Category } from "../core/types"

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

interface PageAssessment {
  url: string
  pageName: string
  conversionScore: number
  seoScore: number
  notes: string
}

interface CategoryAssessment {
  categoryId: string
  categoryName: string
  pages: PageAssessment[]
}

const ASSESS_FRAMING = `You judge web pages for a business website in the category described below.

Score each page 1-10 twice:
- conversionScore: how well does the page help a visitor take the next step (book, buy, contact, enroll)?
- seoScore: how well can a search engine find and rank the page? Check title, H1, schema, image alt text, unique copy.

Return only valid JSON with this shape:
{
  "pages": [
    { "url": "<url>", "pageName": "<short name>", "conversionScore": <1-10>, "seoScore": <1-10>, "notes": "<one sentence>" }
  ]
}
No markdown, no code fences.`

async function callAssess(categoryPrompt: string, body: string): Promise<PageAssessment[]> {
  const maxAttempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `${categoryPrompt}\n\n---\n${ASSESS_FRAMING}`,
        messages: [{ role: "user", content: body }],
      })
      let text = response.content[0].type === "text" ? response.content[0].text : ""
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
      const parsed = JSON.parse(text) as { pages?: PageAssessment[] }
      return parsed.pages ?? []
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500 * attempt))
    }
  }
  console.warn(`  ⚠ content assess failed: ${lastError}`)
  return []
}

async function loadCategoryPages(
  repo: Repo,
  request: Request,
  site: Site,
  category: Category,
): Promise<Array<{ url: string; markdown: string }>> {
  const classify = await repo.getJson<{ byCategory: Record<string, string[]> }>({
    requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json",
  })
  const index = await repo.getJson<{ pages: Array<{ id: string; url: string; status: string }> }>({
    requestId: request.id, siteId: site.id, stage: "fetch-pages", name: "index.json",
  })
  const wantedUrls = new Set(classify.byCategory[category.id] ?? [])
  const out: Array<{ url: string; markdown: string }> = []
  for (const rec of index.pages) {
    if (rec.status !== "ok") continue
    if (!wantedUrls.has(rec.url)) continue
    const buf = await repo.getArtifact({
      requestId: request.id, siteId: site.id, stage: "fetch-pages", name: `${rec.id}.md`,
    })
    out.push({ url: rec.url, markdown: buf.toString("utf8") })
  }
  return out
}

export async function contentStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const results: CategoryAssessment[] = []
  for (const category of request.categories) {
    const pages = await loadCategoryPages(repo, request, site, category)
    if (pages.length === 0) {
      results.push({ categoryId: category.id, categoryName: category.name, pages: [] })
      continue
    }
    const body = `Category: ${category.name}

${pages.map(p => `${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`
    const assessed = await callAssess(category.prompt, body)
    results.push({ categoryId: category.id, categoryName: category.name, pages: assessed })
  }
  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "content", name: "content.json" },
    { categories: results },
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/content.ts
git commit -m "feat(pipeline): add content stage"
```

---

## Task 15: Pipeline stage — extract

**Files:**
- Create: `scripts/pipeline/extract.ts`

Rationale: generic data extraction. Asks sonnet to pull structured records per category using the category's prompt. Result is a `Record<categoryId, unknown[]>` — schema is the caller's responsibility via the prompt.

- [ ] **Step 1: Implement extract stage**

Create `scripts/pipeline/extract.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import type { Repo } from "../db/repo"
import type { Request, Site, Category } from "../core/types"

let _client: Anthropic | null = null
function client(): Anthropic {
  if (!_client) _client = new Anthropic()
  return _client
}

const EXTRACT_FRAMING = `Using the category description above, extract structured records from the page text below.
Return ONLY a JSON object with a "records" key holding an array of objects.
Each object's fields are up to you based on the category description, but keep field names consistent across records within this response.
If no records are found, return { "records": [] }.
No markdown, no code fences.`

async function callExtract(categoryPrompt: string, body: string): Promise<unknown[]> {
  const maxAttempts = 3
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client().messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: `${categoryPrompt}\n\n---\n${EXTRACT_FRAMING}`,
        messages: [{ role: "user", content: body }],
      })
      let text = response.content[0].type === "text" ? response.content[0].text : ""
      text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
      const parsed = JSON.parse(text) as { records?: unknown[] }
      return parsed.records ?? []
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1500 * attempt))
    }
  }
  console.warn(`  ⚠ extract failed: ${lastError}`)
  return []
}

async function loadCategoryPages(
  repo: Repo,
  request: Request,
  site: Site,
  category: Category,
): Promise<Array<{ url: string; markdown: string }>> {
  const classify = await repo.getJson<{ byCategory: Record<string, string[]> }>({
    requestId: request.id, siteId: site.id, stage: "classify", name: "classify.json",
  })
  const index = await repo.getJson<{ pages: Array<{ id: string; url: string; status: string }> }>({
    requestId: request.id, siteId: site.id, stage: "fetch-pages", name: "index.json",
  })
  const wantedUrls = new Set(classify.byCategory[category.id] ?? [])
  const out: Array<{ url: string; markdown: string }> = []
  for (const rec of index.pages) {
    if (rec.status !== "ok") continue
    if (!wantedUrls.has(rec.url)) continue
    const buf = await repo.getArtifact({
      requestId: request.id, siteId: site.id, stage: "fetch-pages", name: `${rec.id}.md`,
    })
    out.push({ url: rec.url, markdown: buf.toString("utf8") })
  }
  return out
}

export async function extractStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const byCategory: Record<string, unknown[]> = {}
  for (const category of request.categories) {
    const pages = await loadCategoryPages(repo, request, site, category)
    if (pages.length === 0) {
      byCategory[category.id] = []
      continue
    }
    const body = `Category: ${category.name}

${pages.map(p => `URL: ${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`
    byCategory[category.id] = await callExtract(category.prompt, body)
  }
  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "extract", name: "extract.json" },
    { byCategory },
  )
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/extract.ts
git commit -m "feat(pipeline): add extract stage"
```

---

## Task 16: Pipeline stage — report (per-site)

**Files:**
- Create: `scripts/pipeline/report.ts`

Rationale: per-site aggregator. Reads every JSON artifact the earlier stages wrote, builds a `report.json` under the site's `report/` directory. This is the per-site view; the request-level consolidation (result.json) is handled by `Repo.consolidateRequest`.

- [ ] **Step 1: Implement report stage**

Create `scripts/pipeline/report.ts`:

```ts
import type { Repo } from "../db/repo"
import type { Request, Site } from "../core/types"

export async function reportStage(repo: Repo, request: Request, site: Site): Promise<void> {
  const ctx = { requestId: request.id, siteId: site.id }

  const safe = async <T>(stage: string, name: string): Promise<T | null> => {
    const ref = { ...ctx, stage, name }
    if (!(await repo.artifactExists(ref))) return null
    return await repo.getJson<T>(ref)
  }

  const tech = await safe<unknown>("tech", "tech.json")
  const lighthouse = await safe<unknown>("lighthouse", "lighthouse.json")
  const content = await safe<unknown>("content", "content.json")
  const extract = await safe<unknown>("extract", "extract.json")
  const classify = await safe<unknown>("classify", "classify.json")
  const nav = await safe<unknown>("extract-nav", "nav-links.json")

  const siteReport = {
    siteId: site.id,
    url: site.url,
    meta: site.meta ?? {},
    scrapedAt: new Date().toISOString(),
    navigation: nav,
    classification: classify,
    tech,
    lighthouse,
    content,
    extract,
  }

  await repo.putJson({ ...ctx, stage: "report", name: "report.json" }, siteReport)
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/report.ts
git commit -m "feat(pipeline): add report stage"
```

---

## Task 17: Core runAnalysis orchestration

**Files:**
- Create: `scripts/core/run.ts`

Rationale: the public entrypoint. Pure function over `Repo` + `AnalyzeInput` + `RunOptions`. Sequentially runs stages per site with per-site error handling. Concurrency over sites controlled by `opts.concurrency`.

- [ ] **Step 1: Implement runAnalysis**

Create `scripts/core/run.ts`:

```ts
import type { AnalyzeInput, RunOptions, StageName, Request, Site } from "./types"
import { Repo } from "../db/repo"
import { fetchHome } from "../pipeline/fetch-home"
import { extractNav } from "../pipeline/extract-nav"
import { classify } from "../pipeline/classify"
import { fetchPages } from "../pipeline/fetch-pages"
import { techStage } from "../pipeline/tech"
import { lighthouseStage } from "../pipeline/lighthouse"
import { contentStage } from "../pipeline/content"
import { extractStage } from "../pipeline/extract"
import { reportStage } from "../pipeline/report"

type Stage = (repo: Repo, request: Request, site: Site) => Promise<void>

const STAGES: Array<{ name: StageName; fn: Stage }> = [
  { name: "fetch-home", fn: fetchHome },
  { name: "extract-nav", fn: extractNav },
  { name: "classify", fn: classify },
  { name: "fetch-pages", fn: fetchPages },
  { name: "tech", fn: techStage },
  { name: "lighthouse", fn: lighthouseStage },
  { name: "content", fn: contentStage },
  { name: "extract", fn: extractStage },
  { name: "report", fn: reportStage },
]

function shouldRun(stage: StageName, opts: RunOptions): boolean {
  return !opts.stages || opts.stages.includes(stage)
}

async function runSite(repo: Repo, request: Request, site: Site, opts: RunOptions): Promise<void> {
  console.log(`\n═══ ${site.url} ═══`)
  for (const { name, fn } of STAGES) {
    if (!shouldRun(name, opts)) continue
    try {
      console.log(`  ▶ ${name}`)
      await fn(repo, request, site)
      console.log(`  ✓ ${name}`)
    } catch (err) {
      console.warn(`  ✗ ${name} failed: ${err instanceof Error ? err.message : err}`)
      if (name === "fetch-home") return // no point continuing without home
    }
  }
}

export async function runAnalysis(
  input: AnalyzeInput,
  opts: RunOptions = {},
  repo: Repo = new Repo(process.cwd() + "/data"),
): Promise<string> {
  const request = await repo.createRequest(input)
  console.log(`\n==> Request ${request.id} (${request.sites.length} sites, ${request.categories.length} categories)`)

  const concurrency = Math.max(1, opts.concurrency ?? 1)
  const queue = [...request.sites]
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const site = queue.shift()
      if (!site) return
      try {
        await runSite(repo, request, site, opts)
      } catch (err) {
        console.warn(`  ✗ site ${site.url} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  await repo.consolidateRequest(request.id)
  console.log(`\n==> consolidated → requests/${request.id}/result.json`)
  return request.id
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/core/run.ts
git commit -m "feat(core): add runAnalysis orchestration"
```

---

## Task 18: CLI entrypoint

**Files:**
- Create: `scripts/cli/analyze.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement CLI**

Create `scripts/cli/analyze.ts`:

```ts
import { readFileSync } from "fs"
import { resolve } from "path"
import { config } from "dotenv"
import { runAnalysis } from "../core/run"
import type { AnalyzeInput, RunOptions, StageName } from "../core/types"

config()

const HELP = `npm run analyze -- --input <path> [--concurrency N] [--stages a,b,c] [--force]

Reads an AnalyzeInput JSON file and runs the generic analysis pipeline.
Every run creates a new request under data/db/requests/<id>/.

Required:
  --input <path>       path to an AnalyzeInput JSON file

Optional:
  --concurrency N      run N sites in parallel (default 1)
  --stages a,b,c       only run the named stages (comma-separated)
  --force              re-run stages even if artifacts exist (reserved)
  -h, --help           show help
`

interface CliArgs {
  input?: string
  concurrency?: number
  stages?: StageName[]
  force?: boolean
  help?: boolean
}

function parseArgs(raw: string[]): CliArgs {
  const out: CliArgs = {}
  for (let i = 0; i < raw.length; i++) {
    const a = raw[i]
    if (a === "--input" && raw[i + 1]) out.input = raw[++i]
    else if (a === "--concurrency" && raw[i + 1]) out.concurrency = parseInt(raw[++i], 10)
    else if (a === "--stages" && raw[i + 1]) out.stages = raw[++i].split(",") as StageName[]
    else if (a === "--force") out.force = true
    else if (a === "-h" || a === "--help") out.help = true
  }
  return out
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.input) {
    process.stdout.write(HELP)
    if (!args.help) process.exit(1)
    return
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is required")
    process.exit(1)
  }

  const path = resolve(args.input)
  const input = JSON.parse(readFileSync(path, "utf8")) as AnalyzeInput

  const opts: RunOptions = {
    concurrency: args.concurrency,
    stages: args.stages,
    force: args.force,
  }

  const id = await runAnalysis(input, opts)
  console.log(`\nDone. Request id: ${id}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Replace the analyze script in package.json**

Edit `package.json` — change the `"analyze"` script to point at the new CLI. Keep `"fetch"` and `"migrate-raw"` for now (they get removed in Task 23). Scripts block after edit:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "analyze": "tsx scripts/cli/analyze.ts",
  "analyze:old": "tsx scripts/scraper/analyze.ts",
  "fetch": "tsx scripts/scraper/fetch.ts",
  "migrate-raw": "tsx scripts/scraper/migrate-raw.ts"
}
```

- [ ] **Step 3: Verify CLI help works**

```bash
npm run analyze -- --help
```

Expected: help text printed, exit 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/cli/analyze.ts package.json
git commit -m "feat(cli): add new analyze CLI entrypoint"
```

---

## Task 19: Sample input — data/inputs/yoga.json

**Files:**
- Create: `data/inputs/yoga.json`

Rationale: convert `scripts/scraper/websites-data.ts` into the new input format, with the four yoga categories and their current prompt wording. This is the one piece of the old project that survives the rewrite, as data.

- [ ] **Step 1: Gather inputs**

Open `scripts/scraper/websites-data.ts` and list every `{ studioName, city, website }` triple. For the prompts, open `scripts/scraper/pipeline/content-assess.ts` and copy the text of `DROP_IN_PROMPT`, `TRAINING_PROMPT`, `RETREAT_PROMPT` — these become the `prompt` field for each yoga category in the new input.

- [ ] **Step 2: Write the sample input file**

Create `data/inputs/yoga.json`. Fill `categories` with the four yoga categories, using `extraInfo` lifted from the current classifier's SYSTEM prompt and `prompt` lifted from content-assess.ts:

```json
{
  "displayName": "Yoga studios",
  "categories": [
    {
      "name": "drop in",
      "extraInfo": "single-session classes, schedules, timetables, class prices, walk-in classes",
      "prompt": "<paste DROP_IN_PROMPT verbatim from scripts/scraper/pipeline/content-assess.ts>"
    },
    {
      "name": "training",
      "extraInfo": "multi-day courses, teacher trainings (TTC, YTT, 200hr, 300hr), certifications, immersions, programs",
      "prompt": "<paste TRAINING_PROMPT verbatim>"
    },
    {
      "name": "retreat",
      "extraInfo": "multi-day immersive stays away from the studio (abroad, in nature, residential retreats)",
      "prompt": "<paste RETREAT_PROMPT verbatim>"
    },
    {
      "name": "contact",
      "extraInfo": "contact page, about-with-contact, location page",
      "prompt": "You judge contact pages for a business. A visitor needs: address, phone, email, map, opening hours. Good pages put all of this above the fold. Score each page 1-10 for conversionScore (clear path to reach the business) and seoScore (LocalBusiness schema, unique copy, correct NAP)."
    }
  ],
  "sites": [
    { "url": "https://www.yinyogafoundation.com", "meta": { "name": "Yin Yoga Foundation", "city": "Rishikesh" } },
    { "url": "https://www.himalayanyogaashram.com", "meta": { "name": "Himalayan Yoga Association", "city": "Rishikesh" } },
    { "url": "https://www.arogyayogaschool.com", "meta": { "name": "Arogya Yoga School", "city": "Rishikesh" } },
    { "url": "https://doinyoga.pl", "meta": { "name": "Doinyoga", "city": "Wroclaw" } },
    { "url": "https://manomani.pl", "meta": { "name": "Manomani", "city": "Wroclaw" } },
    { "url": "https://www.ayduyoga.com", "meta": { "name": "Aydu Yoga", "city": "Wroclaw" } },
    { "url": "https://fabrykaenergii.pl", "meta": { "name": "Fabryka Energii", "city": "Wroclaw" } },
    { "url": "https://ashtangayoga.com.pl", "meta": { "name": "Ashtanga Yoga Wroclaw", "city": "Wroclaw" } },
    { "url": "https://www.joganamaste.pl", "meta": { "name": "Namaste Wroclaw", "city": "Wroclaw" } },
    { "url": "https://www.yogarepublic.pl", "meta": { "name": "Yoga Republic", "city": "Warszawa" } },
    { "url": "https://www.yogitribe.life", "meta": { "name": "YogiTribe", "city": "Warszawa" } },
    { "url": "https://ijoga.pl", "meta": { "name": "iJoga", "city": "Warszawa" } },
    { "url": "https://samadhijoga.pl", "meta": { "name": "Samadhi Joga", "city": "Warszawa" } },
    { "url": "https://jogafoksal.pl", "meta": { "name": "Joga Foksal", "city": "Warszawa" } },
    { "url": "https://berlin.sivananda.yoga", "meta": { "name": "Sivananda Yoga Berlin", "city": "Berlin" } },
    { "url": "https://www.shalastudios.com", "meta": { "name": "SHA-LA Studios", "city": "Berlin" } },
    { "url": "https://www.threeboonsyoga.de", "meta": { "name": "Three Boons Yoga", "city": "Berlin" } },
    { "url": "https://www.yoga-lotos.de", "meta": { "name": "Lotos Yoga Berlin", "city": "Berlin" } },
    { "url": "https://peaceyoga.de", "meta": { "name": "Peace Yoga Berlin", "city": "Berlin" } },
    { "url": "https://yoga-sky.de", "meta": { "name": "YOGA SKY", "city": "Berlin" } },
    { "url": "https://australianyogaacademy.com", "meta": { "name": "Australian Yoga Academy", "city": "Melbourne" } },
    { "url": "https://www.moveyoga.com.au", "meta": { "name": "MOVE Yoga", "city": "Melbourne" } },
    { "url": "https://gertrudestreetyoga.com.au", "meta": { "name": "Gertrude Street Yoga", "city": "Melbourne" } },
    { "url": "https://www.mokshayoga.com.au", "meta": { "name": "Moksha Yoga", "city": "Melbourne" } },
    { "url": "https://inyoga.com.au", "meta": { "name": "InYoga", "city": "Sydney" } },
    { "url": "https://academy.bodymindlife.com", "meta": { "name": "BodyMindLife Academy", "city": "Sydney" } },
    { "url": "https://yogainstitute.com.au", "meta": { "name": "The Yoga Institute Sydney", "city": "Sydney" } },
    { "url": "https://www.humstudio.com.au", "meta": { "name": "HUM Studio", "city": "Sydney" } },
    { "url": "https://www.yogaweeks.com", "meta": { "name": "Yoga Weeks", "city": "Barcelona" } },
    { "url": "https://www.hotyogabarcelona.com", "meta": { "name": "Hot Yoga Barcelona", "city": "Barcelona" } },
    { "url": "https://en.harayogabarcelona.com", "meta": { "name": "Hara Yoga Barcelona", "city": "Barcelona" } },
    { "url": "https://www.yogaonesurya.com", "meta": { "name": "YogaOne Surya", "city": "Barcelona" } },
    { "url": "https://yoga-yogabcn.com", "meta": { "name": "Yoga & Yoga Barcelona", "city": "Barcelona" } },
    { "url": "https://thespaceparis.com", "meta": { "name": "The Space Yoga", "city": "Paris" } },
    { "url": "https://www.ashtangayogaparis.fr", "meta": { "name": "Ashtanga Yoga Paris", "city": "Paris" } },
    { "url": "https://www.yujparis.com", "meta": { "name": "YUJ Yoga Studio", "city": "Paris" } },
    { "url": "https://www.jivamuktiyoga.fr", "meta": { "name": "Jivamukti Yoga Paris", "city": "Paris" } },
    { "url": "https://www.yay-yoga.com", "meta": { "name": "YAY Yoga", "city": "Paris" } }
  ]
}
```

The `<paste ... verbatim>` placeholders must be replaced with the actual string contents of `DROP_IN_PROMPT`, `TRAINING_PROMPT`, `RETREAT_PROMPT` from `scripts/scraper/pipeline/content-assess.ts`, JSON-escaped.

- [ ] **Step 3: Smoke test with a single-site subset**

Create a temporary `data/inputs/yoga-smoke.json` holding only one site (e.g., Doinyoga) and run:

```bash
npm run analyze -- --input data/inputs/yoga-smoke.json --stages fetch-home,extract-nav,classify
```

Expected: `data/db/requests/<id>/sites/<siteId>/fetch-home/home.html` exists, `classify/classify.json` has keys for each category id. If `fetch-home` fails (Firecrawl credits), verify the error message cleanly bubbles up.

- [ ] **Step 4: Commit**

```bash
git add data/inputs/yoga.json
git commit -m "data: add yoga.json sample input in new format"
```

(Remove `data/inputs/yoga-smoke.json` before committing if you created it ad hoc; otherwise include it.)

---

## Task 20: Browse-data — request list page

**Files:**
- Create: `src/lib/repo-server.ts`
- Modify: `src/app/browse-data/page.tsx`

Rationale: the new `/browse-data` lists all requests from `data/db/index.json`. Replace the old studio table.

- [ ] **Step 1: Create server-side repo accessor**

Create `src/lib/repo-server.ts`:

```ts
import { join } from "path"
import { Repo } from "../../scripts/db/repo"

let _repo: Repo | null = null

export function getRepo(): Repo {
  if (!_repo) _repo = new Repo(join(process.cwd(), "data"))
  return _repo
}
```

- [ ] **Step 2: Replace the browse-data page**

Overwrite `src/app/browse-data/page.tsx`:

```tsx
import Link from "next/link"
import { getRepo } from "@/lib/repo-server"

export const dynamic = "force-dynamic"

export default async function BrowseDataPage() {
  const requests = (await getRepo().listRequests())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  if (requests.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold">Browse Analysis Requests</h1>
        <p className="mt-4 text-gray-600">
          No requests yet. Run <code className="rounded bg-gray-100 px-2 py-1">npm run analyze -- --input data/inputs/yoga.json</code>.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/" className="text-sm text-blue-600 hover:underline">&larr; Home</Link>
      <div className="mt-2 mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Browse Analysis Requests</h1>
        <p className="text-sm text-gray-500">{requests.length} request(s)</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Display name</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-center">Sites</th>
              <th className="px-4 py-3 text-center">Categories</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.map(req => (
              <tr key={req.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/browse-data/${req.id}`} className="font-medium text-blue-600 hover:underline">
                    {req.displayName ?? req.id}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{new Date(req.createdAt).toLocaleString()}</td>
                <td className="px-4 py-3 text-center">{req.siteCount}</td>
                <td className="px-4 py-3 text-center">{req.categoryCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Start dev server and verify**

```bash
npm run dev
```

Visit `http://localhost:3000/browse-data`. Expected: the page loads. If no requests exist yet, the empty-state message shows. If requests exist, they render in the table.

- [ ] **Step 4: Commit**

```bash
git add src/lib/repo-server.ts src/app/browse-data/page.tsx
git commit -m "feat(ui): browse-data lists requests"
```

---

## Task 21: Browse-data — request detail page

**Files:**
- Create: `src/app/browse-data/[requestId]/page.tsx`

Rationale: `/browse-data/<requestId>` shows the request's metadata and a list of its sites with a link to each.

- [ ] **Step 1: Create the request detail page**

Create `src/app/browse-data/[requestId]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getRepo } from "@/lib/repo-server"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ requestId: string }>
}

export default async function RequestDetailPage({ params }: Params) {
  const { requestId } = await params
  let request
  try {
    request = await getRepo().getRequest(requestId)
  } catch {
    notFound()
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/browse-data" className="text-sm text-blue-600 hover:underline">&larr; Requests</Link>
      <div className="mt-2 mb-6">
        <h1 className="text-3xl font-bold">{request.displayName ?? request.id}</h1>
        <p className="text-sm text-gray-500">{new Date(request.createdAt).toLocaleString()} • {request.sites.length} site(s) • {request.categories.length} categor{request.categories.length === 1 ? "y" : "ies"}</p>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Categories</h2>
        <ul className="space-y-2">
          {request.categories.map(c => (
            <li key={c.id} className="rounded border border-gray-200 p-3">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-600">{c.extraInfo}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sites</h2>
        <ul className="divide-y divide-gray-200 rounded border border-gray-200">
          {request.sites.map(s => (
            <li key={s.id} className="px-4 py-3 hover:bg-gray-50">
              <Link href={`/browse-data/${request.id}/${s.id}`} className="font-medium text-blue-600 hover:underline">
                {String(s.meta?.name ?? s.url)}
              </Link>
              <div className="text-xs text-gray-500">{s.url}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Verify in browser**

With dev server still running, visit `/browse-data/<some-request-id>`. Expected: category list + site list render. `/browse-data/bogus-id` returns 404.

- [ ] **Step 3: Commit**

```bash
git add src/app/browse-data/\[requestId\]/page.tsx
git commit -m "feat(ui): browse-data request detail page"
```

---

## Task 22: Browse-data — site detail page with CategoryBlock

**Files:**
- Create: `src/app/browse-data/[requestId]/[siteId]/page.tsx`
- Create: `src/app/browse-data/[requestId]/[siteId]/CategoryBlock.tsx`

Rationale: per-site view. Loads `result.json` (or falls back to reading the site's `report.json`), renders one `<CategoryBlock />` per category showing classified pages, content scores, extracted records as a generic table.

- [ ] **Step 1: Create CategoryBlock**

Create `src/app/browse-data/[requestId]/[siteId]/CategoryBlock.tsx`:

```tsx
interface PageAssessment {
  url: string
  pageName: string
  conversionScore: number
  seoScore: number
  notes: string
}

interface Props {
  categoryName: string
  extraInfo: string
  classifiedUrls: string[]
  contentPages: PageAssessment[]
  extractedRecords: unknown[]
}

export default function CategoryBlock(props: Props) {
  return (
    <section className="mb-8 rounded border border-gray-200 p-4">
      <h3 className="text-xl font-semibold">{props.categoryName}</h3>
      <p className="mb-4 text-sm text-gray-500">{props.extraInfo}</p>

      {props.classifiedUrls.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Classified URLs</div>
          <ul className="text-sm">
            {props.classifiedUrls.map(u => <li key={u} className="truncate">{u}</li>)}
          </ul>
        </div>
      )}

      {props.contentPages.length > 0 && (
        <div className="mb-4">
          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Content assessment</div>
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500">
              <th className="py-1">Page</th><th className="py-1 text-center">Conv</th><th className="py-1 text-center">SEO</th><th className="py-1">Notes</th>
            </tr></thead>
            <tbody>
              {props.contentPages.map(p => (
                <tr key={p.url} className="border-t border-gray-100">
                  <td className="py-1 font-medium">{p.pageName}</td>
                  <td className="py-1 text-center">{p.conversionScore}</td>
                  <td className="py-1 text-center">{p.seoScore}</td>
                  <td className="py-1 text-gray-600">{p.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {props.extractedRecords.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-semibold uppercase text-gray-500">Extracted records</div>
          <pre className="overflow-auto rounded bg-gray-50 p-2 text-xs">
            {JSON.stringify(props.extractedRecords, null, 2)}
          </pre>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Create the site detail page**

Create `src/app/browse-data/[requestId]/[siteId]/page.tsx`:

```tsx
import Link from "next/link"
import { notFound } from "next/navigation"
import { getRepo } from "@/lib/repo-server"
import CategoryBlock from "./CategoryBlock"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ requestId: string; siteId: string }>
}

interface ResultFile {
  request: {
    id: string
    displayName?: string
    categories: Array<{ id: string; name: string; extraInfo: string }>
    sites: Array<{ id: string; url: string; meta?: Record<string, unknown> }>
  }
  sites: Array<{
    siteId: string
    url: string
    artifacts: Record<string, unknown>
  }>
}

export default async function SiteDetailPage({ params }: Params) {
  const { requestId, siteId } = await params
  const repo = getRepo()

  let result: ResultFile
  try {
    result = await repo.getJson<ResultFile>({ requestId, stage: "", name: "result.json" })
  } catch {
    notFound()
  }

  const site = result.sites.find(s => s.siteId === siteId)
  const siteMeta = result.request.sites.find(s => s.id === siteId)
  if (!site || !siteMeta) notFound()

  const classify = (site.artifacts["classify"] as { byCategory: Record<string, string[]> } | undefined)?.byCategory ?? {}
  const content = (site.artifacts["content"] as { categories: Array<{ categoryId: string; pages: unknown[] }> } | undefined)?.categories ?? []
  const extract = (site.artifacts["extract"] as { byCategory: Record<string, unknown[]> } | undefined)?.byCategory ?? {}

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/browse-data/${requestId}`} className="text-sm text-blue-600 hover:underline">&larr; {result.request.displayName ?? requestId}</Link>
      <div className="mt-2 mb-6">
        <h1 className="text-3xl font-bold">{String(siteMeta.meta?.name ?? siteMeta.url)}</h1>
        <p className="text-sm text-gray-500"><a href={siteMeta.url} className="underline">{siteMeta.url}</a></p>
      </div>

      {result.request.categories.map(cat => {
        const classifiedUrls = classify[cat.id] ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentPages = ((content.find(c => c.categoryId === cat.id)?.pages ?? []) as any[])
        const extractedRecords = extract[cat.id] ?? []
        if (classifiedUrls.length === 0 && contentPages.length === 0 && extractedRecords.length === 0) return null
        return (
          <CategoryBlock
            key={cat.id}
            categoryName={cat.name}
            extraInfo={cat.extraInfo}
            classifiedUrls={classifiedUrls}
            contentPages={contentPages}
            extractedRecords={extractedRecords}
          />
        )
      })}
    </main>
  )
}
```

- [ ] **Step 3: Verify in browser**

Visit `/browse-data/<requestId>/<siteId>`. Expected: per-category blocks render. Empty categories are hidden. Bogus ids return 404.

- [ ] **Step 4: Commit**

```bash
git add src/app/browse-data/\[requestId\]/\[siteId\]/
git commit -m "feat(ui): browse-data site detail page"
```

---

## Task 23: Cleanup — delete old scraper, data, update CLAUDE.md

**Files:**
- Delete: `scripts/scraper/` (entire directory)
- Delete: `data/raw/`, `data/analysis/`, `data/reports/`, `data/reports-v1/`, `data/index.json`
- Delete: `src/app/browse-data/[slug]/`
- Delete: `src/lib/data.ts` (if it exists and is yoga-specific)
- Modify: `package.json`
- Modify: `CLAUDE.md`

Rationale: after the new pipeline works end-to-end and the browse UI is wired, cut the old code. Do this in its own commit so it's easy to revert.

- [ ] **Step 1: Verify the new system runs end-to-end**

```bash
npm run analyze -- --input data/inputs/yoga-smoke.json --concurrency 1
```

Where `yoga-smoke.json` is a single-site slice of `yoga.json`. Expected: a new request directory under `data/db/requests/`, `result.json` written, browse-data pages for that request render in the browser.

- [ ] **Step 2: Check that nothing still imports from scripts/scraper**

Use Grep to confirm:

Search pattern: `scripts/scraper`
Expected: matches only inside `scripts/scraper/` itself and the soon-to-be-updated `CLAUDE.md` + `package.json`.

- [ ] **Step 3: Delete old scraper code**

```bash
rm -r scripts/scraper
```

- [ ] **Step 4: Delete old data directories**

```bash
rm -r data/raw data/analysis data/reports data/reports-v1 data/index.json
```

(Ignore errors for paths that don't exist — the list may have drifted.)

- [ ] **Step 5: Delete old browse-data slug route and yoga data helper**

```bash
rm -r src/app/browse-data/\[slug\]
rm -f src/lib/data.ts
```

(If `src/lib/data.ts` didn't exist, the `-f` swallows the error.)

- [ ] **Step 6: Update package.json scripts**

Edit `package.json` — remove `fetch`, `migrate-raw`, `analyze:old`. Final scripts block:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest",
  "analyze": "tsx scripts/cli/analyze.ts"
}
```

- [ ] **Step 7: Update CLAUDE.md**

Overwrite `CLAUDE.md`:

```markdown
# YogaCMS

Next.js 16 project — a generic site-analysis pipeline with a browse UI. The yoga domain is just the first sample input (`data/inputs/yoga.json`); the pipeline itself has no yoga-specific logic.

## Scripts
- `npm run dev` — start dev server
- `npm run analyze -- --input <path> [--concurrency N] [--stages a,b,c]` — run the pipeline for an input file
- `npm test` — run vitest

## Structure
- `scripts/core/run.ts` — `runAnalysis(input, opts)` public entrypoint
- `scripts/core/types.ts` — shared types (`AnalyzeInput`, `Request`, `ArtifactRef`, etc.)
- `scripts/core/base-prompt.ts` — `BASE_PROMPT` + `generatePrompt` utility (opt-in, not called by the pipeline)
- `scripts/db/repo.ts` — `Repo` class, the only code that touches `data/db/`
- `scripts/db/store.ts`, `scripts/db/paths.ts` — fs primitives + ref-to-path
- `scripts/pipeline/*` — one file per stage (fetch-home, extract-nav, classify, fetch-pages, tech, lighthouse, content, extract, report)
- `scripts/cli/analyze.ts` — thin CLI wrapping `runAnalysis`
- `data/db/` — request store (created on first run)
- `data/inputs/` — sample input files
- `src/app/browse-data/` — request list + detail pages, all data-driven from `Repo`

## Pipeline
fetch-home → extract-nav → classify (haiku, uses request.categories) → fetch-pages → {tech, lighthouse, content, extract} → report. `Repo.consolidateRequest` aggregates into `result.json`.

## Key notes
- Uses cheerio + Playwright + Firecrawl for fetching, wappalyzer-core for tech detection, Claude sonnet for content/extract and haiku for classify.
- Every category in an input must provide its own `prompt`. The pipeline does NOT auto-generate prompts. Use `core/base-prompt.ts#generatePrompt` from a separate step if you want assisted drafting.
- Read Next.js docs in `node_modules/next/dist/docs/` before changing app code.
```

- [ ] **Step 8: Run tests and typecheck**

```bash
npm test && npx tsc --noEmit
```

Expected: all tests pass, no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: remove old yoga scraper and wire new CLAUDE.md"
```

(The broad `-A` is intentional here because the change touches deletions across many paths. Verify `git status` before committing to confirm no stray files sneak in.)

---

## Task 24: Final verification

**Files:** none.

- [ ] **Step 1: Fresh end-to-end run**

```bash
rm -rf data/db
npm run analyze -- --input data/inputs/yoga-smoke.json
```

Expected: request created, stages log cleanly, `result.json` written, process exits 0.

- [ ] **Step 2: Browse UI spot check**

```bash
npm run dev
```

Visit `/browse-data`, click through to the request and then to a site. Expected: all pages render, per-category blocks populate for categories that had classified pages, empty categories are hidden.

- [ ] **Step 3: Typecheck + lint + tests**

```bash
npx tsc --noEmit && npm run lint && npm test
```

Expected: all three green.

- [ ] **Step 4: Done — no commit needed**

This task is a verification gate. If any step fails, go back to the relevant task and fix.

---

## Self-review notes

**Spec coverage:**
- Repo API (createRequest, getRequest, listRequests, putArtifact, getArtifact, putJson, getJson, artifactExists, listArtifacts, consolidateRequest): Tasks 5, 6. Note: `listArtifacts` from the spec is NOT implemented — we don't actually need it for the pipeline or UI, so it's dropped. If debug tooling needs it later, add separately.
- Layout (`data/db/...`): Tasks 3, 5, 6, 11.
- Types (AnalyzeInput, Category, Site, Request, ArtifactRef, StageName, RunOptions, RequestIndexEntry): Task 2.
- BASE_PROMPT utility, no in-pipeline generation: Task 2 (utility), confirmed in runAnalysis (Task 17).
- Pipeline stages (fetch-home → report): Tasks 8–16.
- `runAnalysis` function + concurrency: Task 17.
- CLI: Task 18.
- Sample input preserving studio list: Task 19.
- Browse-data list, request detail, site detail, generic CategoryBlock: Tasks 20, 21, 22.
- Deletion of old code + CLAUDE.md rewrite: Task 23.
- Testing scope: repo unit tests (Tasks 3–6), plus paths tests. Per-stage tests and integration test from the spec are NOT in this plan — smoke-tested manually via Task 19 and Task 24. Adding automated pipeline tests later is straightforward once mocks are needed.

**Placeholder scan:** Task 19's sample input has explicit `<paste ... verbatim>` markers — these are instructions to the engineer, not placeholders in delivered code. All other tasks ship actual code.

**Type consistency:** `Repo` constructor takes `dataDir` (not `root`); `Request`/`Site`/`Category` ids assigned in `createRequest` flow through all downstream stages; `ArtifactRef` shape matches across `paths.ts`, `repo.ts`, and every pipeline stage.
