# Cross-site category scope, richer chat history, analyses chat count — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the category Copy/Chat actions operate across all sites in an analysis; enrich the previous-chats dropdown in `ChatDrawer` with date and tier chips; add a "Questions" (chat count) column to the Past Analyses table.

**Architecture:** Drop `siteId` from the `category` variant of `AnalysisContextScope` so the context builder aggregates per-site data under a `sites: {}` map. The scope codec gains a 3-segment `cat:{req}:{cat}` form and rejects the old 4-segment form. Chat storage keys follow automatically via `scopeKey`. `Repo.countChats` counts `chats/**/*.json` files for a request and `listRequests` exposes it as `chatCount`. The `ChatDrawer` dropdown is rebuilt with `DropdownMenu` + custom rows (title, relative date, tier badges).

**Tech Stack:** Next.js 16 (app router), TypeScript, Vitest, React client components, shadcn/ui (Radix) primitives, Tailwind.

---

## File Structure

**Modify:**
- `scripts/analysis-context/types.ts` — drop `siteId` on category variant, add optional `siteIds`.
- `scripts/analysis-context/scope-codec.ts` — encode/decode/scopeKey for new 3-segment `cat:` form.
- `scripts/analysis-context/scope-codec.test.ts` — update category roundtrip, add legacy rejection case.
- `scripts/analysis-context/build.ts` — category branch loops sites, returns `{ sites: { [siteId]: … } }`.
- `scripts/analysis-context/__tests__/build.test.ts` (create if missing) OR existing builder test — covers cross-site category aggregation.
- `src/components/ScopeActions/lib/scopeLabel.ts` — new category description text.
- `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx` — remove `siteId` from the scope prop.
- `scripts/core/types.ts` — add `chatCount: number` to `RequestIndexEntry`.
- `scripts/db/repo.ts` — add `countChats`; include `chatCount` in `listRequests` output.
- `scripts/db/__tests__/repo.test.ts` OR new test file — covers `countChats` and `listRequests` chat-count wiring.
- `src/app/(main)/analyses/AnalysesTable.tsx` — add "Questions" column, bump pending divider `colSpan`.
- `src/components/ScopeActions/components/ChatDrawer.tsx` — replace `Select` for history with `DropdownMenu` of rich rows.

**Create:**
- `src/components/ScopeActions/lib/relativeDate.ts` — helper turning an ISO date into "14m ago" / "2d ago".
- `src/components/ScopeActions/lib/relativeDate.test.ts` — unit tests for that helper.
- `src/components/ScopeActions/components/ChatHistoryMenu.tsx` — the new dropdown component consumed by `ChatDrawer`.

**Leave alone:**
- `src/app/api/chat/list/route.ts`, `src/app/api/chat/get/route.ts` — still operate on `decodeScope`, no shape change.
- `src/app/api/compose/route.ts` — same.
- `scripts/db/store.ts` — already exposes `listDirs` / `listFiles`.

---

## Task 1: Update `AnalysisContextScope` category variant

**Files:**
- Modify: `scripts/analysis-context/types.ts:1-4`

- [ ] **Step 1: Edit the type**

Replace the category variant. Full declaration becomes:

```ts
export type AnalysisContextScope =
  | { kind: "request"; requestId: string }
  | { kind: "site"; requestId: string; siteId: string }
  | { kind: "category"; requestId: string; categoryId: string; siteIds?: string[] }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Errors in `scope-codec.ts`, `build.ts`, `CategoryBlock.tsx` (callers still pass `siteId`). Those are fixed in the next tasks — do **not** run a build or other tests yet.

- [ ] **Step 3: Do NOT commit yet**

The repo is temporarily in a non-compiling state. Commit only after Task 2 makes the codec compile; the final repo-compiling commit comes at the end of Task 4.

---

## Task 2: Scope codec supports new category form

**Files:**
- Modify: `scripts/analysis-context/scope-codec.ts`
- Test: `scripts/analysis-context/scope-codec.test.ts`

- [ ] **Step 1: Rewrite the category roundtrip test**

Replace the existing `round-trips category scope` test and add a rejection case for the legacy 4-segment form. The full test file becomes:

```ts
import { describe, it, expect } from "vitest"
import { encodeScope, decodeScope, encodeTiers, decodeTiers, scopeKey } from "./scope-codec"

describe("scope-codec", () => {
  it("round-trips request scope", () => {
    const s = { kind: "request" as const, requestId: "r_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips site scope", () => {
    const s = { kind: "site" as const, requestId: "r_1", siteId: "site_1" }
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("round-trips category scope without siteIds", () => {
    const s = { kind: "category" as const, requestId: "r_1", categoryId: "home" }
    expect(encodeScope(s)).toBe("cat:r_1:home")
    expect(decodeScope(encodeScope(s))).toEqual(s)
  })
  it("rejects malformed scope", () => {
    expect(() => decodeScope("bogus")).toThrow()
  })
  it("rejects legacy 4-segment category scope", () => {
    expect(() => decodeScope("cat:r_1:site_1:home")).toThrow()
  })
  it("scopeKey for category drops siteId", () => {
    const s = { kind: "category" as const, requestId: "r_1", categoryId: "home" }
    expect(scopeKey(s)).toBe("cat-home")
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

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/analysis-context/scope-codec.test.ts`
Expected: `round-trips category scope without siteIds`, `rejects legacy 4-segment category scope`, and `scopeKey for category drops siteId` all FAIL (old code still encodes 4 segments and produces `site-…-cat-…` key).

- [ ] **Step 3: Rewrite the codec**

Full contents of `scripts/analysis-context/scope-codec.ts`:

```ts
import type { AnalysisContextScope, AnalysisContextTiers } from "./types"

export function encodeScope(s: AnalysisContextScope): string {
  if (s.kind === "request") return `req:${s.requestId}`
  if (s.kind === "site") return `site:${s.requestId}:${s.siteId}`
  return `cat:${s.requestId}:${s.categoryId}`
}

export function decodeScope(raw: string): AnalysisContextScope {
  const [kind, ...rest] = raw.split(":")
  if (kind === "req" && rest.length === 1) return { kind: "request", requestId: rest[0] }
  if (kind === "site" && rest.length === 2)
    return { kind: "site", requestId: rest[0], siteId: rest[1] }
  if (kind === "cat" && rest.length === 2)
    return { kind: "category", requestId: rest[0], categoryId: rest[1] }
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
  return `cat-${s.categoryId}`
}
```

Note: `siteIds` on a category scope is **not** encoded. Callers that pass it today do not need roundtrip fidelity.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/analysis-context/scope-codec.test.ts`
Expected: all cases PASS.

- [ ] **Step 5: Do NOT commit yet**

`build.ts` and `CategoryBlock.tsx` still break compilation — commit at the end of Task 4.

---

## Task 3: Category branch in `buildAnalysisContext` aggregates across sites

**Files:**
- Modify: `scripts/analysis-context/build.ts:11-26`
- Test: `scripts/analysis-context/__tests__/build.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create the test file:

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

  it("category scope aggregates per-site data keyed by siteId", async () => {
    const req = await repo.createRequest(input)
    const [siteA, siteB] = req.sites
    const ref = (siteId: string) => ({
      requestId: req.id,
      siteId,
      stage: "extract-pages-content",
      name: "pricing.json",
    })
    await repo.putJson(ref(siteA.id), { items: ["A"] })
    await repo.putJson(ref(siteB.id), { items: ["B"] })

    const ctx = await buildAnalysisContext(
      repo,
      { kind: "category", requestId: req.id, categoryId: "pricing" },
      { extractedContent: true },
    )

    expect(ctx.json).toEqual({
      sites: {
        [siteA.id]: { extractedContent: { items: ["A"] } },
        [siteB.id]: { extractedContent: { items: ["B"] } },
      },
    })
    expect(ctx.bytes).toBeGreaterThan(0)
  })

  it("category scope with explicit siteIds filters the aggregation", async () => {
    const req = await repo.createRequest(input)
    const [siteA, siteB] = req.sites
    const ref = (siteId: string) => ({
      requestId: req.id,
      siteId,
      stage: "extract-pages-content",
      name: "pricing.json",
    })
    await repo.putJson(ref(siteA.id), { items: ["A"] })
    await repo.putJson(ref(siteB.id), { items: ["B"] })

    const ctx = await buildAnalysisContext(
      repo,
      { kind: "category", requestId: req.id, categoryId: "pricing", siteIds: [siteA.id] },
      { extractedContent: true },
    )

    expect(Object.keys(ctx.json.sites as object)).toEqual([siteA.id])
  })

  it("category scope includes request input when tiers.input is set", async () => {
    const req = await repo.createRequest(input)
    const ctx = await buildAnalysisContext(
      repo,
      { kind: "category", requestId: req.id, categoryId: "home" },
      { input: true },
    )
    const json = ctx.json as { input?: unknown; sites: Record<string, unknown> }
    expect(json.input).toBeTruthy()
    expect(Object.keys(json.sites)).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run scripts/analysis-context/__tests__/build.test.ts`
Expected: FAIL — the current category branch still passes `scope.siteId` which no longer exists, producing a TS error / runtime error.

- [ ] **Step 3: Rewrite the category branch in `build.ts`**

Replace lines 11-26 of `scripts/analysis-context/build.ts` with:

```ts
  const missing: string[] = []
  let json: Record<string, unknown> = {}

  if (scope.kind === "category") {
    const req = await repo.getRequest(scope.requestId)
    const siteIds = scope.siteIds ?? req.sites.map(s => s.id)
    const bySite: Record<string, unknown> = {}
    for (const siteId of siteIds) {
      bySite[siteId] = await forCategory(
        repo, scope.requestId, siteId, scope.categoryId, tiers, missing,
      )
    }
    json = { sites: bySite }
    if (tiers.input) json.input = req
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
```

Leave `forCategory`, `forSite`, and `addRawPages` unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run scripts/analysis-context/__tests__/build.test.ts`
Expected: all three cases PASS.

- [ ] **Step 5: Do NOT commit yet**

`CategoryBlock.tsx` still references `siteId` on the scope prop and breaks the build. Fix in Task 4 before committing.

---

## Task 4: Drop `siteId` from `CategoryBlock` scope and update scope label

**Files:**
- Modify: `src/components/ScopeActions/lib/scopeLabel.ts:3-13`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx:220-227`

- [ ] **Step 1: Update the scope description**

Full contents of `src/components/ScopeActions/lib/scopeLabel.ts`:

```ts
import type { AnalysisContextScope } from "../../../../scripts/analysis-context/types"

export function scopeDescription(s: AnalysisContextScope): string {
  if (s.kind === "request") return "the entire analysis (all sites and all categories)"
  if (s.kind === "site") return "this site (all of its categories)"
  return "this category across all sites in this analysis"
}

export function scopeShortLabel(s: AnalysisContextScope): string {
  if (s.kind === "request") return "analysis"
  if (s.kind === "site") return "site"
  return "category"
}
```

- [ ] **Step 2: Update the `CategoryBlock` scope prop**

Replace lines 220-227 in `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx` with:

```tsx
          <ScopeActions
            scope={{
              kind: "category",
              requestId: props.requestId,
              categoryId: props.categoryId,
            }}
          />
```

- [ ] **Step 3: Grep for any other remaining category scope call sites**

Run: `grep -rn 'kind: "category"' src scripts`
Expected: only the line you just edited and type/test files. If any production caller still passes `siteId`, remove it there too using the same pattern.

- [ ] **Step 4: Type-check the whole repo**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all tests PASS (includes the new `build.test.ts` and updated `scope-codec.test.ts`).

- [ ] **Step 6: Commit Tasks 1–4 as one logical change**

The category-scope refactor is not useful in pieces — commit it now.

```bash
git add scripts/analysis-context/types.ts \
        scripts/analysis-context/scope-codec.ts \
        scripts/analysis-context/scope-codec.test.ts \
        scripts/analysis-context/build.ts \
        scripts/analysis-context/__tests__/build.test.ts \
        src/components/ScopeActions/lib/scopeLabel.ts \
        src/app/\(report\)/analyses/\[requestId\]/\[siteId\]/CategoryBlock.tsx
git commit -m "feat(scope): category scope aggregates across all sites"
```

---

## Task 5: Extend `RequestIndexEntry` with `chatCount`

**Files:**
- Modify: `scripts/core/types.ts:41-48`

- [ ] **Step 1: Add `chatCount` to the in-memory shape**

Replace the `RequestIndexEntry` interface with:

```ts
export interface RequestIndexEntry {
  id: string
  displayName?: string
  createdAt: string
  siteCount: number
  categoryCount: number
  status: RequestStatus
  chatCount: number
}
```

`StoredRequestIndexEntry` is `Omit<RequestIndexEntry, "status">` today. Update it to exclude `chatCount` too:

```ts
/** Shape stored on disk — status and chatCount are derived at read time */
export type StoredRequestIndexEntry = Omit<RequestIndexEntry, "status" | "chatCount">
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors in `scripts/db/repo.ts` (listRequests doesn't populate `chatCount`) and `src/app/(main)/analyses/AnalysesTable.tsx` (row type missing `chatCount`). Those get fixed in Tasks 6–7.

- [ ] **Step 3: Do NOT commit yet**

Commit after the count column is wired through.

---

## Task 6: `Repo.countChats` + `listRequests` exposes `chatCount`

**Files:**
- Modify: `scripts/db/repo.ts`
- Test: `scripts/db/__tests__/repo.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `scripts/db/__tests__/repo.test.ts`:

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

describe("Repo chat counts", () => {
  let dir: string
  let repo: Repo

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "repo-chats-"))
    repo = new Repo(dir)
  })
  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it("countChats returns 0 when no chats directory exists", async () => {
    const req = await repo.createRequest(input)
    expect(await repo.countChats(req.id)).toBe(0)
  })

  it("countChats sums .json files across scope subdirectories", async () => {
    const req = await repo.createRequest(input)
    await repo.createScopedChat(
      { kind: "request", requestId: req.id },
      { model: "m", tiers: {}, title: "A" },
    )
    await repo.createScopedChat(
      { kind: "request", requestId: req.id },
      { model: "m", tiers: {}, title: "B" },
    )
    await repo.createScopedChat(
      { kind: "category", requestId: req.id, categoryId: "home" },
      { model: "m", tiers: {}, title: "C" },
    )
    expect(await repo.countChats(req.id)).toBe(3)
  })

  it("listRequests populates chatCount per entry", async () => {
    const req = await repo.createRequest(input)
    await repo.createScopedChat(
      { kind: "request", requestId: req.id },
      { model: "m", tiers: {}, title: "only" },
    )
    const list = await repo.listRequests()
    const match = list.find(e => e.id === req.id)
    expect(match?.chatCount).toBe(1)
  })
})
```

Note: `describe` blocks may already exist in this file — append the new block rather than replacing. If imports at the top of the file already cover what you need, reuse them and remove the duplicates from the snippet above.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run scripts/db/__tests__/repo.test.ts`
Expected: the three new cases FAIL — `repo.countChats` is undefined and `listRequests` does not return `chatCount`.

- [ ] **Step 3: Implement `countChats`**

In `scripts/db/repo.ts`, add this method inside the `Repo` class (immediately below `listRequests`, before `appendIndex`):

```ts
  async countChats(requestId: string): Promise<number> {
    const dir = join(requestDir(this.root, requestId), "chats")
    if (!(await this.store.exists(dir))) return 0
    const files = await this.store.listFiles(dir)
    return files.filter(f => f.endsWith(".json")).length
  }
```

`store.listFiles` already walks recursively (see `scripts/db/store.ts:32-49`), so this covers every scope subdirectory.

- [ ] **Step 4: Wire `chatCount` into `listRequests`**

Replace the existing `listRequests` method body:

```ts
  async listRequests(): Promise<RequestIndexEntry[]> {
    const path = join(this.root, "index.json")
    if (!(await this.store.exists(path))) return []
    const buf = await this.store.readFile(path)
    const entries = JSON.parse(buf.toString("utf8")) as StoredRequestIndexEntry[]
    return Promise.all(
      entries.map(async e => ({
        ...e,
        status: await this.deriveStatus(e.id),
        chatCount: await this.countChats(e.id),
      })),
    )
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run scripts/db/__tests__/repo.test.ts`
Expected: all PASS.

- [ ] **Step 6: Do NOT commit yet**

Commit after the table consumes the new field.

---

## Task 7: Add "Questions" column to `AnalysesTable`

**Files:**
- Modify: `src/app/(main)/analyses/AnalysesTable.tsx`

- [ ] **Step 1: Add `chatCount` to the row interface**

Replace lines 8-15:

```tsx
interface AnalysisRow {
  id: string
  displayName?: string
  createdAt: string
  siteCount: number
  categoryCount: number
  status: RequestStatus
  chatCount: number
}
```

- [ ] **Step 2: Add the cell to `Row`**

Inside `Row`, add one `<td>` after the Categories cell (line 62). Updated block:

```tsx
      <td className="px-4 py-3 text-center">{req.siteCount}</td>
      <td className="px-4 py-3 text-center">{req.categoryCount}</td>
      <td className="px-4 py-3 text-center">{req.chatCount}</td>
```

- [ ] **Step 3: Add the header cell and bump the pending divider colSpan**

Replace the `<thead>` block:

```tsx
        <thead className="bg-surface-alt text-xs uppercase text-foreground-muted">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Created</th>
            <th className="px-4 py-3 text-center">Sites</th>
            <th className="px-4 py-3 text-center">Categories</th>
            <th className="px-4 py-3 text-center">Questions</th>
          </tr>
        </thead>
```

Inside the Pending divider `<tr>` (currently `<td colSpan={5}`), update to `<td colSpan={6}`.

- [ ] **Step 4: Type-check the whole repo**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: all PASS.

- [ ] **Step 6: Manual smoke test**

Start the dev server and open `http://localhost:3000/analyses`.

Run: `npm run dev` (in a separate terminal)
Open: `http://localhost:3000/analyses`
Expected: table shows a "Questions" column on the right. For any request with no chats, the cell reads `0`. Start a chat from a report page, reload the analyses page, and confirm the count increments.

- [ ] **Step 7: Commit Tasks 5–7**

```bash
git add scripts/core/types.ts \
        scripts/db/repo.ts \
        scripts/db/__tests__/repo.test.ts \
        src/app/\(main\)/analyses/AnalysesTable.tsx
git commit -m "feat(analyses): show chat count per analysis"
```

---

## Task 8: Relative-date helper

**Files:**
- Create: `src/components/ScopeActions/lib/relativeDate.ts`
- Test: `src/components/ScopeActions/lib/relativeDate.test.ts`

- [ ] **Step 1: Write the failing test**

Full contents of `src/components/ScopeActions/lib/relativeDate.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/ScopeActions/lib/relativeDate.test.ts`
Expected: FAIL — file does not exist.

- [ ] **Step 3: Implement the helper**

Full contents of `src/components/ScopeActions/lib/relativeDate.ts`:

```ts
export function relativeDate(iso: string, nowMs: number = Date.now()): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ""
  const diff = Math.max(0, nowMs - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/ScopeActions/lib/relativeDate.test.ts`
Expected: all cases PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScopeActions/lib/relativeDate.ts src/components/ScopeActions/lib/relativeDate.test.ts
git commit -m "feat(chat): add relativeDate helper for chat history"
```

---

## Task 9: `ChatHistoryMenu` component

**Files:**
- Create: `src/components/ScopeActions/components/ChatHistoryMenu.tsx`

- [ ] **Step 1: Implement the component**

Full contents:

```tsx
"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu"
import { Badge } from "@/components/ui/shadcn/badge"
import { Button } from "@/components/ui/shadcn/button"
import { ChevronDown } from "lucide-react"
import { relativeDate } from "../lib/relativeDate"
import type {
  AnalysisContextTiers,
  ChatMeta,
} from "../../../../scripts/analysis-context/types"

type Props = {
  chats: ChatMeta[]
  activeChatId: string | null
  onResume: (id: string) => void
}

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

export function ChatHistoryMenu({ chats, activeChatId, onResume }: Props) {
  if (chats.length === 0) return null
  const active = chats.find(c => c.id === activeChatId)
  const triggerLabel = active?.title?.trim() || "Resume chat"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-55 justify-between">
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {chats.map(c => {
          const labels = activeTiers(c.tiers)
          return (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => onResume(c.id)}
              className="flex-col items-start gap-1 py-2"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {c.title?.trim() || c.id}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeDate(c.createdAt)}
                </span>
              </div>
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {labels.map(label => (
                    <Badge key={label} variant="outline" className="text-[10px]">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If `dropdown-menu` or `badge` modules resolve incorrectly, verify their paths under `src/components/ui/shadcn/`.

- [ ] **Step 3: Do NOT commit yet**

Commit once `ChatDrawer` is switched over (next task).

---

## Task 10: Swap `ChatDrawer` dropdown for `ChatHistoryMenu`

**Files:**
- Modify: `src/components/ScopeActions/components/ChatDrawer.tsx`

- [ ] **Step 1: Drop the `Select`-based history control**

Remove these imports (lines 12-18 of the current file):

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select"
```

The `Select` for the model picker stays. Only the `Select` used for chat history goes away.

Wait — the model picker also uses `Select`. Keep its import path. Rewrite the imports block as:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select"
import { ChatHistoryMenu } from "./ChatHistoryMenu"
```

- [ ] **Step 2: Replace the in-header chats control**

Find the block (approximately lines 168-181 in the current file):

```tsx
          {chats.length > 0 && (
            <Select value={chatId ?? ""} onValueChange={resumeChat}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Resume chat" />
              </SelectTrigger>
              <SelectContent>
                {chats.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title || c.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
```

Replace with:

```tsx
          <ChatHistoryMenu chats={chats} activeChatId={chatId} onResume={resumeChat} />
```

(`ChatHistoryMenu` returns `null` when `chats` is empty, so the outer conditional is no longer needed.)

- [ ] **Step 3: Type-check and run tests**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 4: Manual smoke test**

Start the dev server and walk through a chat:

Run: `npm run dev`
Open: a report URL like `http://localhost:3000/analyses/<id>/<siteId>`.

Checks:
1. Click the Chat button on a category → "About the report" (or the Configure modal) → start a chat, send a message.
2. Close the drawer, open the same category's Chat button on a **different** site page (same categoryId). Expected: the dropdown trigger shows "Resume chat"; opening it reveals the chat you just started with title, relative time, and at least one tier badge. Click → messages render.
3. Tooltip on the Chat button reads "Ask Claude about this category across all sites in this analysis."
4. Open `http://localhost:3000/analyses` and confirm the row's `Questions` count reflects the newly created chat.

If any check fails, stop and debug before committing.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScopeActions/components/ChatDrawer.tsx \
        src/components/ScopeActions/components/ChatHistoryMenu.tsx
git commit -m "feat(chat): enrich chat history dropdown with date and tier badges"
```

---

## Task 11: Delete legacy per-site category chat directories

**Files:**
- No source files. One-off cleanup of `data/db/**`.

Old chats stored under `data/db/*/chats/site-*-cat-*/` cannot be reached through the new codec (`scopeKey` for category is now `cat-{categoryId}`). User approved deletion. This task runs once, locally.

- [ ] **Step 1: Dry-run the match**

Run: `find data/db -type d -regex '.*/chats/site-[^/]*-cat-[^/]*$' -print`
Expected: a list of directories that will be removed, or no output if none exist. If output looks wrong (e.g. matches a legitimate directory), stop and investigate before proceeding.

- [ ] **Step 2: Delete the matched directories**

Run: `find data/db -type d -regex '.*/chats/site-[^/]*-cat-[^/]*$' -exec rm -rf {} +`
Expected: command returns with no error. Re-running Step 1 afterwards shows no output.

- [ ] **Step 3: Verify the analyses chat count reflects the deletion**

Open `http://localhost:3000/analyses`. Any row whose Questions count dropped is expected — those rows had legacy per-site category chats that are now gone.

- [ ] **Step 4: No commit**

`data/db/**` is not checked in. Nothing to commit here.

---

## Final checks

- [ ] **Step 1: Full test run**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Inspect the final commit log**

Run: `git log --oneline -5`
Expected: three new commits (category scope refactor, analyses chat count, chat history dropdown) — plus the small relativeDate helper commit. Tidy with an interactive rebase only if the user asks.
