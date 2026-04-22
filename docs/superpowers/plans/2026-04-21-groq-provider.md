# Groq Provider Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Groq as a swappable LLM provider alongside Anthropic. Every pipeline stage + chat routes through a provider-agnostic `AIClient` class, configured centrally in a new `core/settings.ts`. UI surfaces the active provider with grouped dropdowns and badges.

**Architecture:** New top-level `core/` directory (shared between `scripts/` and `src/`) holds `ai-client.ts` (abstract class + Anthropic/Groq subclasses + `getClient()` factory), `settings.ts` (per-stage model defaults), and `validate-env.ts` (fail-fast env check). All three call sites (classify-nav, extract-pages-content, base-prompt) + chat streaming migrate to `getClient(provider).complete(...)`. Pricing table restructures from tier-indexed to provider-indexed. Input schema drops `MODEL_MAP` shorthand in favor of explicit `provider` + raw `model` fields per category.

**Tech Stack:** TypeScript, Next.js 16, Vitest, `@anthropic-ai/sdk`, `groq-sdk` (new), shadcn/Radix UI, Tailwind.

**Worktree:** `/Users/pio/projects/web-analyzer/.worktrees/groq-provider` on branch `feat/groq-provider`. All file paths below are relative to this worktree root.

**Spec:** [docs/superpowers/specs/2026-04-20-groq-provider-design.md](../specs/2026-04-20-groq-provider-design.md)

---

## Phase 1 — Foundation

### Task 1: Add `@core/*` path alias and create `core/` directory

**Files:**
- Modify: `tsconfig.json:21-23`
- Create: `core/.gitkeep`

- [ ] **Step 1: Add alias to tsconfig**

Edit `tsconfig.json`:

```json
    "paths": {
      "@/*": ["./src/*"],
      "@core/*": ["./core/*"]
    }
```

- [ ] **Step 2: Create the directory with a placeholder**

```bash
mkdir -p core && touch core/.gitkeep
```

- [ ] **Step 3: Verify tsc still parses config**

Run: `npx tsc --noEmit`
Expected: no errors (may print unrelated warnings — only fail on errors)

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json core/.gitkeep
git commit -m "chore: add @core/* path alias and core/ directory"
```

---

### Task 2: Install `groq-sdk`

**Files:**
- Modify: `package.json:14-38` (dependencies block)
- Modify: `package-lock.json`

- [ ] **Step 1: Install the SDK**

Run: `npm install groq-sdk`
Expected: new entry in `package.json` dependencies; `package-lock.json` updated.

- [ ] **Step 2: Verify install**

Run: `node -e "console.log(require('groq-sdk').default ? 'ok' : 'missing')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add groq-sdk dependency"
```

---

## Phase 2 — Core Primitives (TDD)

### Task 3: Create `core/ai-client.ts` — abstract class + Anthropic/Groq subclasses

**Files:**
- Create: `core/ai-client.ts`
- Create: `core/ai-client.test.ts`

- [ ] **Step 1: Write failing test for types and `getClient` factory**

Create `core/ai-client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest"
import { getClient, AIClient, type Provider, type CompleteRequest } from "./ai-client"

// Mock both SDKs at module level
const anthropicCreate = vi.fn()
const anthropicStream = vi.fn()
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: anthropicCreate, stream: anthropicStream },
  })),
}))

const groqCreate = vi.fn()
vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: groqCreate } },
  })),
}))

beforeEach(() => {
  anthropicCreate.mockReset()
  anthropicStream.mockReset()
  groqCreate.mockReset()
  process.env.ANTHROPIC_API_KEY = "test-anthropic"
  process.env.GROQ_API_KEY = "test-groq"
  // Reset singleton cache — easiest way is a fresh import per test file, so rely on test isolation
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/ai-client.test.ts`
Expected: FAIL with "Cannot find module './ai-client'" or similar.

- [ ] **Step 3: Write the implementation**

Create `core/ai-client.ts`:

```ts
import Anthropic from "@anthropic-ai/sdk"
import Groq from "groq-sdk"

export type Provider = "anthropic" | "groq"

export interface CompleteRequest {
  model: string
  system: string
  messages: { role: "user" | "assistant"; content: string }[]
  maxTokens: number
}

export interface CompleteResponse {
  text: string
  usage: { inputTokens: number; outputTokens: number }
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "done" }

export abstract class AIClient {
  abstract readonly provider: Provider
  abstract complete(req: CompleteRequest): Promise<CompleteResponse>
  abstract stream(req: CompleteRequest): AsyncIterable<StreamEvent>
}

class AnthropicClient extends AIClient {
  readonly provider: Provider = "anthropic"
  private client = new Anthropic()

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const res = await this.client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
    })
    const text = res.content[0]?.type === "text" ? res.content[0].text : ""
    return {
      text,
      usage: {
        inputTokens: res.usage.input_tokens,
        outputTokens: res.usage.output_tokens,
      },
    }
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamEvent> {
    const stream = this.client.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
    })
    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        yield { type: "text", delta: ev.delta.text }
      }
    }
    yield { type: "done" }
  }
}

class GroqClient extends AIClient {
  readonly provider: Provider = "groq"
  private client = new Groq()

  async complete(req: CompleteRequest): Promise<CompleteResponse> {
    const res = await this.client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens,
      messages: [
        { role: "system", content: req.system },
        ...req.messages,
      ],
    })
    const text = res.choices[0]?.message?.content ?? ""
    return {
      text,
      usage: {
        inputTokens: res.usage?.prompt_tokens ?? 0,
        outputTokens: res.usage?.completion_tokens ?? 0,
      },
    }
  }

  async *stream(req: CompleteRequest): AsyncIterable<StreamEvent> {
    const stream = await this.client.chat.completions.create({
      model: req.model,
      max_tokens: req.maxTokens,
      stream: true,
      messages: [
        { role: "system", content: req.system },
        ...req.messages,
      ],
    })
    for await (const chunk of stream as AsyncIterable<{ choices: Array<{ delta: { content?: string } }> }>) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield { type: "text", delta }
    }
    yield { type: "done" }
  }
}

const cache: Partial<Record<Provider, AIClient>> = {}

export function getClient(provider: Provider): AIClient {
  if (!cache[provider]) {
    cache[provider] = provider === "anthropic" ? new AnthropicClient() : new GroqClient()
  }
  return cache[provider]!
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run core/ai-client.test.ts`
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/ai-client.ts core/ai-client.test.ts
git commit -m "feat(core): ai-client with Anthropic and Groq subclasses"
```

---

### Task 4: Create `core/settings.ts`

**Files:**
- Create: `core/settings.ts`
- Create: `core/settings.test.ts`

- [ ] **Step 1: Write failing test**

Create `core/settings.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { SETTINGS } from "./settings"

describe("SETTINGS", () => {
  it("defaults classify-nav to a Groq small model", () => {
    expect(SETTINGS.models.classifyNav.provider).toBe("groq")
    expect(SETTINGS.models.classifyNav.model).toBe("llama-3.1-8b-instant")
  })

  it("defaults extract-pages to Anthropic sonnet", () => {
    expect(SETTINGS.models.extractPages.provider).toBe("anthropic")
    expect(SETTINGS.models.extractPages.model).toBe("claude-sonnet-4-6")
  })

  it("defaults base-prompt generation to Anthropic sonnet", () => {
    expect(SETTINGS.models.basePromptGen).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    })
  })

  it("defaults chat to Anthropic sonnet", () => {
    expect(SETTINGS.models.chatDefault).toEqual({
      provider: "anthropic",
      model: "claude-sonnet-4-6",
    })
  })

  it("declares provider env var names", () => {
    expect(SETTINGS.providers.anthropic.apiKeyEnv).toBe("ANTHROPIC_API_KEY")
    expect(SETTINGS.providers.groq.apiKeyEnv).toBe("GROQ_API_KEY")
  })

  it("provides stage estimates for quote generation", () => {
    expect(SETTINGS.stageEstimates.classifyNavOutputTokens).toBeTypeOf("number")
    expect(SETTINGS.stageEstimates.extractPagesOutputTokens).toBeTypeOf("number")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/settings.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `core/settings.ts`:

```ts
import type { Provider } from "./ai-client"

export interface ModelRef {
  provider: Provider
  model: string
}

export const SETTINGS = {
  models: {
    classifyNav:   { provider: "groq",      model: "llama-3.1-8b-instant" },
    extractPages:  { provider: "anthropic", model: "claude-sonnet-4-6" },
    basePromptGen: { provider: "anthropic", model: "claude-sonnet-4-6" },
    chatDefault:   { provider: "anthropic", model: "claude-sonnet-4-6" },
  },
  stageEstimates: {
    classifyNavOutputTokens:  500,
    extractPagesOutputTokens: 1500,
  },
  providers: {
    anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY" },
    groq:      { apiKeyEnv: "GROQ_API_KEY" },
  },
} as const satisfies {
  models: Record<string, ModelRef>
  stageEstimates: Record<string, number>
  providers: Record<Provider, { apiKeyEnv: string }>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run core/settings.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/settings.ts core/settings.test.ts
git commit -m "feat(core): settings with per-stage model defaults"
```

---

### Task 5: Create `core/validate-env.ts`

**Files:**
- Create: `core/validate-env.ts`
- Create: `core/validate-env.test.ts`

- [ ] **Step 1: Write failing test**

Create `core/validate-env.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest"
import { requireApiKeysFor } from "./validate-env"

describe("requireApiKeysFor", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.GROQ_API_KEY
  })

  it("does nothing when keys are present", () => {
    process.env.ANTHROPIC_API_KEY = "x"
    process.env.GROQ_API_KEY = "y"
    expect(() => requireApiKeysFor(["anthropic", "groq"])).not.toThrow()
  })

  it("throws listing all missing env vars", () => {
    expect(() => requireApiKeysFor(["anthropic", "groq"])).toThrow(
      /ANTHROPIC_API_KEY.*GROQ_API_KEY|GROQ_API_KEY.*ANTHROPIC_API_KEY/,
    )
  })

  it("only checks the given providers", () => {
    process.env.ANTHROPIC_API_KEY = "x"
    // GROQ_API_KEY is missing but not requested
    expect(() => requireApiKeysFor(["anthropic"])).not.toThrow()
  })

  it("deduplicates repeated providers", () => {
    expect(() => requireApiKeysFor(["anthropic", "anthropic"])).toThrow(/ANTHROPIC_API_KEY/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run core/validate-env.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write the implementation**

Create `core/validate-env.ts`:

```ts
import { SETTINGS } from "./settings"
import type { Provider } from "./ai-client"

export function requireApiKeysFor(providers: Provider[]): void {
  const unique = Array.from(new Set(providers))
  const missing: string[] = []
  for (const p of unique) {
    const env = SETTINGS.providers[p].apiKeyEnv
    if (!process.env[env]) missing.push(env)
  }
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run core/validate-env.test.ts`
Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/validate-env.ts core/validate-env.test.ts
git commit -m "feat(core): requireApiKeysFor startup validator"
```

---

## Phase 3 — Type Migration

### Task 6: Add `provider` to `AIQuery`, update `CategoryInput` schema, delete `MODEL_MAP`

This is a breaking schema change. It touches several files at once because leaving them inconsistent would fail typecheck between commits. Do them all in this task.

**Files:**
- Modify: `scripts/core/types.ts`
- Delete: `scripts/core/models.ts`
- Modify: `data/inputs/yoga.json` (every category entry)

- [ ] **Step 1: Update `CategoryInput` and `AIQuery` in types.ts**

Edit `scripts/core/types.ts`:

Replace:
```ts
import type { ModelTier } from "./models"

export interface CategoryInput {
  name: string
  extraInfo: string
  prompt: string
  model: ModelTier
  lighthouse?: boolean
  wappalyzer?: boolean
}
```

with:
```ts
import type { Provider } from "../../core/ai-client"

export interface CategoryInput {
  name: string
  extraInfo: string
  prompt: string
  provider: Provider
  model: string
  lighthouse?: boolean
  wappalyzer?: boolean
}
```

Replace:
```ts
export interface AIQuery {
  id: string
  requestId: string
  siteId: string
  categoryId?: string
  stage: string
  model: string
  prompt: string          // full system message (category.prompt + stage framing)
  dataRefs: string[]      // page URLs fed as context
  response: string
  usage?: { inputTokens: number; outputTokens: number }
  createdAt: string
}
```

with:
```ts
export interface AIQuery {
  id: string
  requestId: string
  siteId: string
  categoryId?: string
  stage: string
  provider: Provider
  model: string
  prompt: string          // full system message (category.prompt + stage framing)
  dataRefs: string[]      // page URLs fed as context
  response: string
  usage?: { inputTokens: number; outputTokens: number }
  createdAt: string
}
```

- [ ] **Step 2: Delete `scripts/core/models.ts`**

```bash
git rm scripts/core/models.ts
```

- [ ] **Step 3: Migrate `data/inputs/yoga.json`**

For every category object in `data/inputs/yoga.json`, replace `"model": "sonnet"` (or `"haiku"`/`"opus"`) with two fields:
- `"provider": "anthropic"`
- `"model": "claude-sonnet-4-6"` (or `"claude-haiku-4-5"`/`"claude-opus-4-6"`)

Use this sed one-liner from the worktree root:

```bash
node -e '
const fs = require("fs");
const path = "data/inputs/yoga.json";
const data = JSON.parse(fs.readFileSync(path, "utf8"));
const map = { haiku: "claude-haiku-4-5", sonnet: "claude-sonnet-4-6", opus: "claude-opus-4-6" };
for (const c of data.categories) {
  if (c.model in map) {
    c.provider = "anthropic";
    c.model = map[c.model];
  }
}
fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
'
```

- [ ] **Step 4: Verify migration**

Run: `node -e "const d=require('./data/inputs/yoga.json'); console.log(d.categories.map(c => ({n:c.name, p:c.provider, m:c.model})))"`
Expected: every category has `p: "anthropic"` and a `claude-*` model id.

- [ ] **Step 5: Don't run typecheck yet**

Other files still import `MODEL_MAP`. They'll be fixed in Phase 4. Proceed to commit; the tree will typecheck after Task 10.

- [ ] **Step 6: Commit**

```bash
git add scripts/core/types.ts data/inputs/yoga.json
git commit -m "refactor: drop MODEL_MAP shorthand, require provider+model in CategoryInput"
```

---

## Phase 4 — Pipeline Call-Site Migration

### Task 7: Migrate `scripts/pipeline/classify-nav.ts` to `AIClient`

**Files:**
- Modify: `scripts/pipeline/classify-nav.ts`

- [ ] **Step 1: Replace Anthropic import with AIClient + SETTINGS**

Replace the entire file `scripts/pipeline/classify-nav.ts` with:

```ts
import { newId } from "../db/repo"
import type { Repo } from "../db/repo"
import type { Request, Site, Category, AIQuery } from "../core/types"
import type { NavLink } from "./parse-links"
import { getClient } from "../../core/ai-client"
import { SETTINGS } from "../../core/settings"

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

export async function classifyNav(repo: Repo, request: Request, site: Site): Promise<void> {
  const navBuf = await repo.getArtifact({
    requestId: request.id, siteId: site.id, stage: "parse-links", name: "nav-links.json",
  })
  const nav = JSON.parse(navBuf.toString("utf8")) as { links: NavLink[] }

  const byCategory: Record<string, string[]> = {}
  for (const c of request.categories) byCategory[c.id] = []

  if (nav.links.length === 0) {
    await repo.putJson(
      { requestId: request.id, siteId: site.id, stage: "classify-nav", name: "classify-nav.json" },
      { byCategory },
    )
    return
  }

  const system = buildSystemPrompt(request.categories)
  const userMessage = `Site: ${site.url}

Homepage links:
${nav.links.map(l => `- "${l.label}" -> ${l.href}`).join("\n")}

Classify into JSON as instructed. Bucket names to use: ${request.categories.map(c => `"${c.name}"`).join(", ")}.`

  const { provider, model } = SETTINGS.models.classifyNav
  const client = getClient(provider)
  const response = await client.complete({
    model,
    maxTokens: 1024,
    system,
    messages: [{ role: "user", content: userMessage }],
  })
  let text = response.text
  text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()

  const query: AIQuery = {
    id: newId("q"),
    requestId: request.id,
    siteId: site.id,
    stage: "classify-nav",
    provider,
    model,
    prompt: system,
    dataRefs: nav.links.map(l => l.href),
    response: text,
    usage: response.usage,
    createdAt: new Date().toISOString(),
  }
  await repo.putQuery(query)

  const parsed = JSON.parse(text) as Record<string, unknown>
  for (const category of request.categories) {
    const raw = parsed[category.name]
    if (Array.isArray(raw)) {
      byCategory[category.id] = raw
        .filter((u): u is string => typeof u === "string")
        .slice(0, PER_CATEGORY_CAP)
    }
  }

  // Automatically assign the site root URL to any category named "home" (case-insensitive)
  for (const category of request.categories) {
    if (category.name.toLowerCase() === "home" && !byCategory[category.id]?.includes(site.url)) {
      ;(byCategory[category.id] ??= []).unshift(site.url)
    }
  }

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "classify-nav", name: "classify-nav.json" },
    { byCategory },
  )
}
```

- [ ] **Step 2: Commit (typecheck will still fail in extract-pages-content — that's fine)**

```bash
git add scripts/pipeline/classify-nav.ts
git commit -m "refactor(classify-nav): route through AIClient + settings"
```

---

### Task 8: Migrate `scripts/pipeline/extract-pages-content.ts` with per-category override

**Files:**
- Modify: `scripts/pipeline/extract-pages-content.ts`

- [ ] **Step 1: Replace the file**

Replace the entire file `scripts/pipeline/extract-pages-content.ts` with:

```ts
import { newId } from "../db/repo";
import type { Repo } from "../db/repo";
import type { Request, Site, Category, AIQuery } from "../core/types";
import { loadCategoryPages } from "./load-pages";
import { getClient, type Provider } from "../../core/ai-client";
import { SETTINGS } from "../../core/settings";

const EXTRACT_FRAMING = `You are analyzing web pages for the category described above.
For each page provided below, extract one record.
Follow the JSON schema from the category description exactly.

## Required fields (always include)
- "url": the page URL
- "pageName": short human-readable page name
- "summary": 1-2 sentence plain-language overview

## Field naming conventions (follow strictly)
- Scores: name ends with "Score", value is a number 1-10 (e.g. "conversionScore": 7)
- Booleans: name starts with "has"/"is" or ends with "Visible" (e.g. "pricingVisible": true)
- Short text: "notes", "description" — 1-2 sentences max
- Tags/lists: arrays of short strings (e.g. "classStyles": ["Hatha", "Vinyasa"])
- Plain strings: everything else (e.g. "price": "€15 drop-in")

Return a JSON object: { "records": [<one record per page>] }.
No markdown, no code fences.`;

interface ExtractResult {
  records: unknown[];
  queryInfo: { prompt: string; response: string; usage: { inputTokens: number; outputTokens: number } } | null;
}

async function callExtract(
  category: Category,
  body: string,
): Promise<ExtractResult> {
  const system = `${category.prompt}\n\n---\n${EXTRACT_FRAMING}`;
  const { provider, model } = category
  const client = getClient(provider)
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.complete({
        model,
        maxTokens: 4096,
        system,
        messages: [{ role: "user", content: body }],
      });
      let text = response.text;
      text = text
        .replace(/^```(?:json)?\s*\n?/i, "")
        .replace(/\n?```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(text) as { records?: unknown[] };
      return {
        records: parsed.records ?? [],
        queryInfo: {
          prompt: system,
          response: text,
          usage: response.usage,
        },
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts)
        await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  console.warn(`  ⚠ extract failed: ${lastError}`);
  return { records: [], queryInfo: null };
}

export async function extractPagesContentForCategory(
  repo: Repo,
  request: Request,
  site: Site,
  category: Category,
): Promise<void> {
  const pages = await loadCategoryPages(repo, request, site, category);
  if (pages.length === 0) {
    await repo.putJson(
      {
        requestId: request.id,
        siteId: site.id,
        stage: "extract-pages-content",
        name: `${category.id}.json`,
      },
      { categoryId: category.id, records: [] },
    );
    return;
  }

  const body = `Category: ${category.name}\n\n${pages.map((p) => `URL: ${p.url}\n${p.markdown.slice(0, 12000)}`).join("\n\n---\n\n")}`;
  const result = await callExtract(category, body);

  if (result.queryInfo) {
    const { provider, model } = category
    const query: AIQuery = {
      id: newId("q"),
      requestId: request.id,
      siteId: site.id,
      categoryId: category.id,
      stage: "extract-pages-content",
      provider,
      model,
      prompt: result.queryInfo.prompt,
      dataRefs: pages.map((p) => p.url),
      response: result.queryInfo.response,
      usage: result.queryInfo.usage,
      createdAt: new Date().toISOString(),
    };
    await repo.putQuery(query);
  }

  await repo.putJson(
    {
      requestId: request.id,
      siteId: site.id,
      stage: "extract-pages-content",
      name: `${category.id}.json`,
    },
    { categoryId: category.id, records: result.records },
  );
}
```

- [ ] **Step 2: Skip unit test**

No new unit test. The pipeline function now reads `category.provider` and `category.model` directly — per the spec, both are required on `CategoryInput`. The existing `build.test.ts` and `generate-quote.test.ts` already exercise this path indirectly; any schema mismatch will surface in typecheck or in Task 20's full-suite run.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors in `scripts/pipeline/extract-pages-content.ts`. (Other files may still error — fixed in later tasks.)

- [ ] **Step 4: Commit**

```bash
git add scripts/pipeline/extract-pages-content.ts
git commit -m "refactor(extract-pages-content): route through AIClient, read provider+model from category"
```

---

### Task 9: Migrate `scripts/core/base-prompt.ts`

**Files:**
- Modify: `scripts/core/base-prompt.ts`

- [ ] **Step 1: Replace the file**

Replace the entire file `scripts/core/base-prompt.ts` with:

```ts
import { getClient } from "../../core/ai-client"
import { SETTINGS } from "../../core/settings"

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

export async function generatePrompt(categoryName: string, extraInfo: string): Promise<string> {
  const { provider, model } = SETTINGS.models.basePromptGen
  const client = getClient(provider)
  const res = await client.complete({
    model,
    maxTokens: 1024,
    system: "",
    messages: [{ role: "user", content: buildBasePromptMessage(categoryName, extraInfo) }],
  })
  return res.text.trim()
}
```

- [ ] **Step 2: Verify typecheck now passes project-wide**

Run: `npx tsc --noEmit`
Expected: zero errors in `scripts/` and `core/`. Some pricing errors may remain (e.g. `extractPagesContent[cat.model]` no longer makes sense) — those are fixed in Phase 5.

If typecheck fails only in `scripts/pipeline/generate-quote.ts` and `scripts/pipeline/finalize-order.ts` — that is expected. Proceed.

- [ ] **Step 3: Commit**

```bash
git add scripts/core/base-prompt.ts
git commit -m "refactor(base-prompt): route through AIClient + settings"
```

---

## Phase 5 — Pricing Restructure

### Task 10: Restructure `scripts/quote/pricing.json` and `scripts/quote/pricing.ts`

**Files:**
- Modify: `scripts/quote/pricing.json` (full rewrite)
- Modify: `scripts/quote/pricing.ts`
- Modify: `scripts/quote/pricing.test.ts`

- [ ] **Step 1: Replace pricing.json**

Overwrite `scripts/quote/pricing.json`:

```json
{
  "version": 2,
  "currency": "USD",
  "serviceFee": {
    "perPage": 0.01
  },
  "firecrawl": {
    "perScrape": 0.002
  },
  "models": {
    "anthropic": {
      "claude-haiku-4-5":  { "inputPer1kTokens": 0.001, "outputPer1kTokens": 0.005 },
      "claude-sonnet-4-6": { "inputPer1kTokens": 0.003, "outputPer1kTokens": 0.015 },
      "claude-opus-4-6":   { "inputPer1kTokens": 0.015, "outputPer1kTokens": 0.075 }
    },
    "groq": {
      "llama-3.1-8b-instant":        { "inputPer1kTokens": 0.00005, "outputPer1kTokens": 0.00008 },
      "llama-3.3-70b-versatile":     { "inputPer1kTokens": 0.00059, "outputPer1kTokens": 0.00079 },
      "moonshotai/kimi-k2-instruct": { "inputPer1kTokens": 0.001,   "outputPer1kTokens": 0.003 }
    }
  },
  "lighthouse": {
    "perRun": 0.00
  },
  "wappalyzer": {
    "perRun": 0.00
  },
  "contentEstimator": {
    "perPage": 0.00
  }
}
```

- [ ] **Step 2: Replace pricing.ts**

Overwrite `scripts/quote/pricing.ts`:

```ts
import { readFileSync } from "fs"
import { join } from "path"
import type { Provider } from "../../core/ai-client"

export interface ModelPricing {
  inputPer1kTokens: number
  outputPer1kTokens: number
}

export interface PricingConfig {
  version: number
  currency: string
  serviceFee: { perPage: number }
  firecrawl: { perScrape: number }
  models: Record<Provider, Record<string, ModelPricing>>
  lighthouse: { perRun: number }
  wappalyzer: { perRun: number }
  contentEstimator: { perPage: number }
}

const DEFAULT_PATH = join(__dirname, "pricing.json")

export function loadPricingConfig(path: string = DEFAULT_PATH): PricingConfig {
  const raw = readFileSync(path, "utf8")
  const config = JSON.parse(raw) as PricingConfig
  if (config.version !== 2) {
    throw new Error(`Unsupported pricing config version: ${config.version}`)
  }
  return config
}

export function lookupModelPricing(
  config: PricingConfig,
  provider: Provider,
  model: string,
): ModelPricing {
  const byProvider = config.models[provider]
  if (!byProvider) throw new Error(`No pricing for provider: ${provider}`)
  const pricing = byProvider[model]
  if (!pricing) throw new Error(`No pricing for ${provider}/${model}`)
  return pricing
}
```

- [ ] **Step 3: Rewrite pricing.test.ts**

Overwrite `scripts/quote/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { loadPricingConfig, lookupModelPricing } from "./pricing"
import { join } from "path"

describe("loadPricingConfig", () => {
  it("loads and validates the default pricing.json", () => {
    const config = loadPricingConfig(join(__dirname, "pricing.json"))
    expect(config.version).toBe(2)
    expect(config.currency).toBe("USD")
    expect(config.serviceFee.perPage).toBe(0.01)
    expect(config.firecrawl.perScrape).toBeTypeOf("number")
    expect(config.models.anthropic["claude-sonnet-4-6"].inputPer1kTokens).toBeTypeOf("number")
    expect(config.models.groq["llama-3.1-8b-instant"].inputPer1kTokens).toBeTypeOf("number")
  })

  it("throws on missing file", () => {
    expect(() => loadPricingConfig("/nonexistent/path.json")).toThrow()
  })
})

describe("lookupModelPricing", () => {
  const config = loadPricingConfig(join(__dirname, "pricing.json"))

  it("returns pricing for a known provider+model", () => {
    const p = lookupModelPricing(config, "anthropic", "claude-sonnet-4-6")
    expect(p.inputPer1kTokens).toBe(0.003)
    expect(p.outputPer1kTokens).toBe(0.015)
  })

  it("throws for unknown model", () => {
    expect(() => lookupModelPricing(config, "anthropic", "gpt-5")).toThrow(/No pricing/)
  })
})
```

- [ ] **Step 4: Run pricing tests**

Run: `npx vitest run scripts/quote/pricing.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/quote/pricing.json scripts/quote/pricing.ts scripts/quote/pricing.test.ts
git commit -m "refactor(pricing): provider-indexed pricing config"
```

---

### Task 11: Update `scripts/pipeline/generate-quote.ts` to use the new pricing shape

**Files:**
- Modify: `scripts/pipeline/generate-quote.ts`

- [ ] **Step 1: Update imports and the two pricing lookups**

Edit `scripts/pipeline/generate-quote.ts`:

Add import near the top:

```ts
import { lookupModelPricing } from "../quote/pricing"
import { SETTINGS } from "../../core/settings"
```

Replace the `computeSunkCosts` function body (the classify-nav cost section):

OLD:
```ts
    classifyNavCost =
      (inputTokens / 1000) * pricing.ai.classifyNav.inputPer1kTokens +
      (outputTokens / 1000) * pricing.ai.classifyNav.outputPer1kTokens
```

NEW:
```ts
    const classifyPricing = lookupModelPricing(
      pricing,
      SETTINGS.models.classifyNav.provider,
      SETTINGS.models.classifyNav.model,
    )
    classifyNavCost =
      (inputTokens / 1000) * classifyPricing.inputPer1kTokens +
      (outputTokens / 1000) * classifyPricing.outputPer1kTokens
```

Replace the extract-pages-content lookup inside the `for (const cat of request.categories)` loop:

OLD:
```ts
    // extract-pages-content
    const extractPricing = pricing.ai.extractPagesContent[cat.model]
    const extractInput = inputTokens / 1000
    const extractOutput = extractPricing.estimatedOutputTokens / 1000
    const extractCost =
      extractInput * extractPricing.inputPer1kTokens +
      extractOutput * extractPricing.outputPer1kTokens
```

NEW:
```ts
    // extract-pages-content — provider+model come from the category
    const extractPricing = lookupModelPricing(pricing, cat.provider, cat.model)
    const extractInput = inputTokens / 1000
    const extractOutput = SETTINGS.stageEstimates.extractPagesOutputTokens / 1000
    const extractCost =
      extractInput * extractPricing.inputPer1kTokens +
      extractOutput * extractPricing.outputPer1kTokens
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors in `generate-quote.ts`. `finalize-order.ts` will still error — fixed next task.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/generate-quote.ts
git commit -m "refactor(generate-quote): use provider-indexed pricing lookup"
```

---

### Task 12: Update `scripts/pipeline/finalize-order.ts`

**Files:**
- Modify: `scripts/pipeline/finalize-order.ts`

- [ ] **Step 1: Swap the tier-indexed lookup for provider+model lookup via the stored query**

Edit `scripts/pipeline/finalize-order.ts`:

Add import near top:

```ts
import { lookupModelPricing } from "../quote/pricing"
```

Replace the block that looks up extract pricing (currently around lines 53-67):

OLD:
```ts
      } else if (li.stage === "extract-pages-content") {
        const stageQueries = queryByStage[li.stage] ?? []
        let totalInputTokens = 0
        let totalCost = 0
        for (const q of stageQueries) {
          // Find category model for this query, default to sonnet pricing
          const cat = request.categories.find(c => c.id === q.categoryId)
          const tier = cat?.model ?? "sonnet"
          const aiConfig = pricing.ai.extractPagesContent[tier]
          const result = tokenCost(q, aiConfig)
          totalInputTokens += result.inputTokens + result.outputTokens
          totalCost += result.cost
        }
        li.actualQuantity = totalInputTokens
        li.actualCost = totalCost
      }
```

NEW:
```ts
      } else if (li.stage === "extract-pages-content") {
        const stageQueries = queryByStage[li.stage] ?? []
        let totalInputTokens = 0
        let totalCost = 0
        for (const q of stageQueries) {
          // Use the provider+model recorded on the query itself — authoritative
          const aiConfig = lookupModelPricing(pricing, q.provider, q.model)
          const result = tokenCost(q, aiConfig)
          totalInputTokens += result.inputTokens + result.outputTokens
          totalCost += result.cost
        }
        li.actualQuantity = totalInputTokens
        li.actualCost = totalCost
      }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/pipeline/finalize-order.ts
git commit -m "refactor(finalize-order): lookup pricing from query-recorded provider+model"
```

---

## Phase 6 — Chat

### Task 13: Restructure `scripts/chat/models.ts` allowlist

**Files:**
- Modify: `scripts/chat/models.ts`

- [ ] **Step 1: Replace the file**

Overwrite `scripts/chat/models.ts`:

```ts
import type { Provider } from "../../core/ai-client"

export interface ChatModel {
  id: string
  label: string
  provider: Provider
}

export const SUPPORTED_CHAT_MODELS: ChatModel[] = [
  { id: "claude-opus-4-6",               label: "Claude Opus 4.6",   provider: "anthropic" },
  { id: "claude-sonnet-4-6",             label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001",     label: "Claude Haiku 4.5",  provider: "anthropic" },
  { id: "llama-3.1-8b-instant",          label: "Llama 3.1 8B",      provider: "groq"      },
  { id: "llama-3.3-70b-versatile",       label: "Llama 3.3 70B",     provider: "groq"      },
  { id: "moonshotai/kimi-k2-instruct",   label: "Kimi K2",           provider: "groq"      },
]

export function getChatModel(id: string): ChatModel | undefined {
  return SUPPORTED_CHAT_MODELS.find(m => m.id === id)
}

export function isSupportedModel(id: string): boolean {
  return SUPPORTED_CHAT_MODELS.some(m => m.id === id)
}
```

- [ ] **Step 2: Add a unit test**

Create `scripts/chat/models.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { SUPPORTED_CHAT_MODELS, getChatModel, isSupportedModel } from "./models"

describe("SUPPORTED_CHAT_MODELS", () => {
  it("includes both Anthropic and Groq entries", () => {
    const providers = new Set(SUPPORTED_CHAT_MODELS.map(m => m.provider))
    expect(providers.has("anthropic")).toBe(true)
    expect(providers.has("groq")).toBe(true)
  })

  it("lookup by id returns provider", () => {
    expect(getChatModel("claude-sonnet-4-6")?.provider).toBe("anthropic")
    expect(getChatModel("llama-3.1-8b-instant")?.provider).toBe("groq")
  })

  it("isSupportedModel recognizes entries", () => {
    expect(isSupportedModel("claude-sonnet-4-6")).toBe(true)
    expect(isSupportedModel("gpt-5")).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run scripts/chat/models.test.ts`
Expected: 3 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/chat/models.ts scripts/chat/models.test.ts
git commit -m "refactor(chat/models): tag allowlist with provider, add Groq entries"
```

---

### Task 14: Migrate `scripts/chat/stream.ts` to `AIClient`

**Files:**
- Modify: `scripts/chat/stream.ts`

- [ ] **Step 1: Replace the file**

Overwrite `scripts/chat/stream.ts`:

```ts
import type { AnalysisContext, ChatMessage } from "../analysis-context/types"
import { chunkAnalysisContext } from "../analysis-context/chunk"
import { getClient } from "../../core/ai-client"
import { getChatModel } from "./models"

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
  return `category ${s.categoryId} across all sites in request ${s.requestId}`
}

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

export async function* streamScopedChat(params: {
  model: string
  context: AnalysisContext
  history: ChatMessage[]
  userMessage: string
  maxBytes?: number
}): AsyncIterable<StreamEvent> {
  const chatModel = getChatModel(params.model)
  if (!chatModel) {
    yield { type: "error", message: `Unsupported model: ${params.model}` }
    return
  }
  const client = getClient(chatModel.provider)
  const { system, messages } = buildChatMessages(params)

  try {
    for await (const ev of client.stream({
      model: chatModel.id,
      maxTokens: 4096,
      system,
      messages,
    })) {
      if (ev.type === "text") yield { type: "token", text: ev.delta }
    }
    yield { type: "done" }
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) }
  }
}
```

Note: the optional `client?: Anthropic` parameter is removed. Callers never used it outside tests, and tests will mock at the module level via `vi.mock("@anthropic-ai/sdk")` / `vi.mock("groq-sdk")`.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/chat/stream.ts
git commit -m "refactor(chat/stream): route through AIClient, resolve provider from model"
```

---

### Task 15: Update `/api/chat/route.ts` — provider-aware env validation

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Replace env check**

Edit `src/app/api/chat/route.ts`:

**Swap the import on line 4** — replace `isSupportedModel` with `getChatModel`:

OLD:
```ts
import { isSupportedModel } from "../../../../scripts/chat/models"
```

NEW:
```ts
import { getChatModel } from "../../../../scripts/chat/models"
```

**Add a new import below the existing imports** (after the `getRepo` line):

```ts
import { requireApiKeysFor } from "../../../../core/validate-env"
```

**Replace lines 23-28** (the `isSupportedModel` + `ANTHROPIC_API_KEY` block):

OLD:
```ts
  if (!isSupportedModel(body.model)) {
    return NextResponse.json({ error: `unsupported model: ${body.model}` }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })
  }
```

NEW:
```ts
  const chatModel = getChatModel(body.model)
  if (!chatModel) {
    return NextResponse.json({ error: `unsupported model: ${body.model}` }, { status: 400 })
  }
  try {
    requireApiKeysFor([chatModel.provider])
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "refactor(api/chat): validate provider key based on requested model"
```

---

## Phase 7 — UI

### Task 16: Create `ProviderBadge` atom

**Files:**
- Create: `src/components/ui/ProviderBadge.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create the component**

Create `src/components/ui/ProviderBadge.tsx`:

```tsx
import { Badge } from "./shadcn/badge"
import type { Provider } from "../../../core/ai-client"

type Props = {
  provider: Provider
  className?: string
}

const LABELS: Record<Provider, string> = {
  anthropic: "Anthropic",
  groq: "Groq",
}

const TONES: Record<Provider, string> = {
  anthropic: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  groq: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
}

export function ProviderBadge({ provider, className = "" }: Props) {
  return (
    <Badge variant="outline" className={`${TONES[provider]} ${className}`}>
      {LABELS[provider]}
    </Badge>
  )
}
```

- [ ] **Step 2: Export from barrel**

Edit `src/components/ui/index.ts` — add after line 17:

```ts
export { ProviderBadge } from "./ProviderBadge"
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ProviderBadge.tsx src/components/ui/index.ts
git commit -m "feat(ui): ProviderBadge atom"
```

---

### Task 17: Group model picker by provider in `ChatDrawer`

**Files:**
- Modify: `src/components/ScopeActions/components/ChatDrawer.tsx`

- [ ] **Step 1: Update imports**

Edit `src/components/ScopeActions/components/ChatDrawer.tsx`:

Replace the shadcn Select import block (lines 12-18) to include `SelectGroup` + `SelectLabel`:

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select"
```

Add import for `ProviderBadge` and `getChatModel`:

```tsx
import { ProviderBadge } from "@/components/ui"
import { getChatModel } from "../../../../scripts/chat/models"
```

- [ ] **Step 2: Replace the flat SelectContent with a grouped one**

Find (around lines 161-166):

```tsx
            <SelectContent>
              {SUPPORTED_CHAT_MODELS.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
```

Replace with:

```tsx
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Anthropic</SelectLabel>
                {SUPPORTED_CHAT_MODELS.filter(m => m.provider === "anthropic").map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Groq</SelectLabel>
                {SUPPORTED_CHAT_MODELS.filter(m => m.provider === "groq").map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
```

- [ ] **Step 3: Add a `ProviderBadge` next to the `SelectTrigger`**

Immediately after the closing `</Select>` for the model picker, add:

```tsx
          {(() => {
            const cm = getChatModel(model)
            return cm ? <ProviderBadge provider={cm.provider} className="text-[10px]" /> : null
          })()}
```

- [ ] **Step 4: Dev-test the UI**

Run: `npm run dev` in the background (`run_in_background: true`) and browse to a route that opens the chat drawer. Verify:
- Model picker shows `Anthropic` and `Groq` section headers
- Each section lists its models
- Selecting a Groq model updates the provider badge next to the picker

Capture a screenshot or describe the observed state. If the drawer isn't immediately reachable without data, skip this step with a note and rely on typecheck + unit tests; flag for manual QA.

- [ ] **Step 5: Commit**

```bash
git add src/components/ScopeActions/components/ChatDrawer.tsx
git commit -m "feat(chat-drawer): group model picker by provider + show provider badge"
```

---

### Task 18: Show model + provider badge in `ChatHistoryMenu`

**Files:**
- Modify: `src/components/ScopeActions/components/ChatHistoryMenu.tsx`

- [ ] **Step 1: Import the badge and the model lookup**

Edit `src/components/ScopeActions/components/ChatHistoryMenu.tsx`:

Add imports after existing imports:

```tsx
import { ProviderBadge } from "@/components/ui"
import { getChatModel } from "../../../../scripts/chat/models"
```

- [ ] **Step 2: Render the provider badge in each history row**

Inside the `DropdownMenuItem` render, find the block (around lines 71-78):

```tsx
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1" aria-hidden="true">
                  {labels.map(label => (
                    <Badge key={label} variant="outline" className="text-[10px]">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
```

Replace with:

```tsx
              <div className="flex flex-wrap items-center gap-1" aria-hidden="true">
                {(() => {
                  const cm = getChatModel(c.model)
                  return cm ? (
                    <>
                      <ProviderBadge provider={cm.provider} className="text-[10px]" />
                      <Badge variant="outline" className="text-[10px]">{cm.label}</Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{c.model}</Badge>
                  )
                })()}
                {labels.map(label => (
                  <Badge key={label} variant="outline" className="text-[10px]">
                    {label}
                  </Badge>
                ))}
              </div>
```

Update the `aria` string a few lines above to include the model label:

OLD:
```tsx
          const aria =
            labels.length > 0
              ? `${title}, created ${when}, data: ${labels.join(", ")}`
              : `${title}, created ${when}`
```

NEW:
```tsx
          const modelLabel = getChatModel(c.model)?.label ?? c.model
          const aria =
            labels.length > 0
              ? `${title}, ${modelLabel}, created ${when}, data: ${labels.join(", ")}`
              : `${title}, ${modelLabel}, created ${when}`
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ScopeActions/components/ChatHistoryMenu.tsx
git commit -m "feat(chat-history): show model name + provider badge per chat"
```

---

## Phase 8 — Startup Validation

### Task 19: Validate required API keys at CLI startup

**Files:**
- Modify: `scripts/cli/analyze.ts`

- [ ] **Step 1: Replace the ANTHROPIC_API_KEY check with a provider-set check**

Edit `scripts/cli/analyze.ts`:

Add imports after existing imports (line 5):

```ts
import { SETTINGS } from "../../core/settings"
import { requireApiKeysFor } from "../../core/validate-env"
import type { Provider } from "../../core/ai-client"
```

Replace the ANTHROPIC_API_KEY block (lines 52-55):

OLD:
```ts
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY is required")
    process.exit(1)
  }
```

NEW:
```ts
  const path = resolve(args.input)
  const input = JSON.parse(readFileSync(path, "utf8")) as AnalyzeInput

  const providers = new Set<Provider>([
    SETTINGS.models.classifyNav.provider,
    SETTINGS.models.extractPages.provider,
  ])
  for (const c of input.categories) {
    if (c.provider) providers.add(c.provider)
  }
  try {
    requireApiKeysFor(Array.from(providers))
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
```

Remove the (now duplicated) input-loading block that follows. The full main() function becomes:

```ts
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || !args.input) {
    process.stdout.write(HELP)
    if (!args.help) process.exit(1)
    return
  }

  const path = resolve(args.input)
  const input = JSON.parse(readFileSync(path, "utf8")) as AnalyzeInput

  const providers = new Set<Provider>([
    SETTINGS.models.classifyNav.provider,
    SETTINGS.models.extractPages.provider,
  ])
  for (const c of input.categories) {
    if (c.provider) providers.add(c.provider)
  }
  try {
    requireApiKeysFor(Array.from(providers))
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }

  const opts: RunOptions = {
    concurrency: args.concurrency,
    stages: args.stages,
    force: args.force,
  }

  const id = await runAnalysis(input, opts)
  console.log(`\nDone. Request id: ${id}`)
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 3: Smoke-test the CLI's validation**

Run: `ANTHROPIC_API_KEY="" GROQ_API_KEY="" npx tsx scripts/cli/analyze.ts --input data/inputs/yoga.json`
Expected: exits with code 1 and prints `Error: Missing required env vars: ANTHROPIC_API_KEY, GROQ_API_KEY` (order may vary).

Run: `ANTHROPIC_API_KEY="x" GROQ_API_KEY="" npx tsx scripts/cli/analyze.ts --input data/inputs/yoga.json`
Expected: exits with code 1 and prints `Error: Missing required env vars: GROQ_API_KEY`.

- [ ] **Step 4: Commit**

```bash
git add scripts/cli/analyze.ts
git commit -m "feat(cli): validate all required provider keys before run"
```

---

## Phase 9 — Final Validation

### Task 20: Run the full suite

**Files:** none

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all tests PASS. Note the baseline was 79 passing; after this plan, expect at least ~95 (new tests: 7 ai-client + 6 settings + 4 validate-env + 2 resolveModelForCategory + 2 lookupModelPricing + 3 chat/models = 24 net-new, minus any replaced).

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: 0 errors. Fix any import-order or unused-import warnings introduced.

- [ ] **Step 4: Update `.env.example`**

If `.env.example` exists, add `GROQ_API_KEY=` to it. If not, create it with both keys:

```
ANTHROPIC_API_KEY=
GROQ_API_KEY=
```

Commit:

```bash
git add .env.example
git commit -m "chore: document GROQ_API_KEY in .env.example"
```

- [ ] **Step 5: Update CLAUDE.md**

Edit `CLAUDE.md` — in the "Key notes" section, replace the line about Claude sonnet/haiku with:

```
- Uses cheerio + Playwright + Firecrawl for fetching, wappalyzer-core for tech detection. LLM calls route through `core/ai-client.ts` with Anthropic + Groq support; per-stage defaults live in `core/settings.ts`. Every category in an input must provide an explicit `provider` + `model`.
```

Also in the "Structure" section, add two lines:

```
- `core/ai-client.ts` — provider-agnostic `AIClient` class, Anthropic/Groq subclasses, `getClient()` factory
- `core/settings.ts` — per-stage model defaults, provider env-var mapping
```

Commit:

```bash
git add CLAUDE.md
git commit -m "docs: note Groq support + core/ directory"
```

---

## Self-Review (Author Checklist)

**Spec coverage:**
- ✅ §1 AI client class in single file → Task 3
- ✅ §2 settings.ts → Task 4
- ✅ §3 Input schema change + yoga.json migration → Task 6
- ✅ §4 Pricing restructure → Tasks 10–12
- ✅ §5 AIQuery.provider → Task 6 + write sites in Tasks 7, 8
- ✅ §6 Chat allowlist + stream + API route → Tasks 13–15
- ✅ §7 ProviderBadge + UI badges → Tasks 16–18
- ✅ §8 Pipeline call-site migration → Tasks 7–9
- ✅ §9 Startup validation → Tasks 5 + 19
- ✅ §10 groq-sdk dependency → Task 2

**Placeholder scan:** none — all code and commands inline.

**Type consistency:**
- `Provider`, `CompleteRequest`, `CompleteResponse`, `StreamEvent` defined in Task 3, consumed unchanged in Tasks 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19.
- `ModelRef` defined in Task 4, referenced in `SETTINGS.models.*`.
- `PricingConfig.models` defined in Task 10, consumed in Tasks 11, 12.
- `ChatModel` defined in Task 13, consumed in Tasks 14, 15, 17, 18.

**Migration risk:** Tasks 6–9 leave the tree in a state where typecheck fails temporarily (pricing-related). Task 10 fixes it. If an execution run pauses between Tasks 9 and 10, the tree is not in a shippable state — noted inline.

**Test discipline:** TDD (red/green/commit) used for every new unit. UI changes rely on typecheck + a dev-server smoke step since there is no React testing setup in the project. Flag for manual QA at the end.
