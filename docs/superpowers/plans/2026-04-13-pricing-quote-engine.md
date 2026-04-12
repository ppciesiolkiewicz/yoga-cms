# Pricing & Quote Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quoting system that estimates pipeline costs before expensive stages run, pauses for approval, and tracks actual costs after completion.

**Architecture:** Two new pipeline stages (estimate-content, generate-quote) inserted between classify-nav and fetch-pages, with an interactive pause. A finalize-order step after build-report fills in actuals. All pricing rules live in a JSON config. Content estimation uses a mock service behind an interface for future swap.

**Tech Stack:** TypeScript, Node readline, vitest

**Spec:** `docs/superpowers/specs/2026-04-13-pricing-quote-engine-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `scripts/quote/pricing.json` | Rate configuration (service fee, firecrawl, AI model costs, etc.) |
| `scripts/quote/pricing.ts` | Load + validate pricing config, export `PricingConfig` type |
| `scripts/quote/content-estimator.ts` | `ContentEstimatorService` interface + `MockContentEstimator` |
| `scripts/pipeline/estimate-content.ts` | Pipeline stage: call estimator for classified URLs per site |
| `scripts/pipeline/generate-quote.ts` | Pipeline stage: read estimates + pricing, create Order, print summary |
| `scripts/pipeline/finalize-order.ts` | Post-pipeline: update Order with actuals from AIQuery records |
| `scripts/quote/pricing.test.ts` | Tests for pricing config loading |
| `scripts/quote/content-estimator.test.ts` | Tests for mock content estimator |
| `scripts/pipeline/estimate-content.test.ts` | Tests for estimate-content stage |
| `scripts/pipeline/generate-quote.test.ts` | Tests for quote generation logic |
| `scripts/pipeline/finalize-order.test.ts` | Tests for order finalization |

### Modified files
| File | Changes |
|---|---|
| `scripts/core/types.ts` | Add `PageEstimate`, `SiteEstimate`, `OrderLineItem`, `Order`, `OrderStatus` types; update `StageName` |
| `scripts/core/run.ts` | Split into two phases, add pause logic, add finalize-order call |

---

### Task 1: Add Types

**Files:**
- Modify: `scripts/core/types.ts`

- [ ] **Step 1: Add content estimation types**

Add after the `AIQuery` interface at the end of `scripts/core/types.ts`:

```ts
export interface PageEstimate {
  url: string
  charCount: number
  estimatedTokens: number
}

export interface SiteEstimate {
  siteId: string
  pages: PageEstimate[]
  totalChars: number
  totalEstimatedTokens: number
}
```

- [ ] **Step 2: Add Order types**

Add after `SiteEstimate`:

```ts
export type OrderStatus = "quoted" | "approved" | "completed"

export interface OrderLineItem {
  stage: string
  description: string
  unit: string
  quantity: number
  unitCost: number
  estimatedCost: number
  actualCost?: number
  actualQuantity?: number
}

export interface OrderSite {
  siteId: string
  url: string
  pageCount: number
  estimatedTokens: number
  lineItems: OrderLineItem[]
  subtotal: number
}

export interface Order {
  id: string
  requestId: string
  createdAt: string
  status: OrderStatus
  sites: OrderSite[]
  totalEstimatedCost: number
  totalActualCost?: number
  approvedAt?: string
  completedAt?: string
}
```

- [ ] **Step 3: Update StageName**

Replace the existing `StageName` type:

```ts
export type StageName =
  | "fetch-home"
  | "parse-links"
  | "classify-nav"
  | "estimate-content"
  | "generate-quote"
  | "fetch-pages"
  | "run-categories"
  | "build-report"
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors (existing code doesn't reference the new stages yet)

- [ ] **Step 5: Commit**

```bash
git add scripts/core/types.ts
git commit -m "feat(types): add Order, PageEstimate, SiteEstimate types and new stage names"
```

---

### Task 2: Pricing Config

**Files:**
- Create: `scripts/quote/pricing.json`
- Create: `scripts/quote/pricing.ts`
- Create: `scripts/quote/pricing.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/quote/pricing.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { loadPricingConfig } from "./pricing"
import { join } from "path"

describe("loadPricingConfig", () => {
  it("loads and validates the default pricing.json", () => {
    const config = loadPricingConfig(join(__dirname, "pricing.json"))
    expect(config.version).toBe(1)
    expect(config.currency).toBe("USD")
    expect(config.serviceFee.perPage).toBe(0.01)
    expect(config.firecrawl.perScrape).toBeTypeOf("number")
    expect(config.ai.classifyNav.model).toBe("claude-haiku-4-5")
    expect(config.ai.assessPages.inputPer1kTokens).toBeTypeOf("number")
    expect(config.ai.extractPagesContent.estimatedOutputTokens).toBeTypeOf("number")
  })

  it("throws on missing file", () => {
    expect(() => loadPricingConfig("/nonexistent/path.json")).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/quote/pricing.test.ts`
Expected: FAIL — module `./pricing` not found

- [ ] **Step 3: Create pricing.json**

Create `scripts/quote/pricing.json`:

```json
{
  "version": 1,
  "currency": "USD",
  "serviceFee": {
    "perPage": 0.01
  },
  "firecrawl": {
    "perScrape": 0.002
  },
  "ai": {
    "classifyNav": {
      "model": "claude-haiku-4-5",
      "inputPer1kTokens": 0.001,
      "outputPer1kTokens": 0.005,
      "estimatedOutputTokens": 500
    },
    "assessPages": {
      "model": "claude-sonnet-4-6",
      "inputPer1kTokens": 0.003,
      "outputPer1kTokens": 0.015,
      "estimatedOutputTokens": 1000
    },
    "extractPagesContent": {
      "model": "claude-sonnet-4-6",
      "inputPer1kTokens": 0.003,
      "outputPer1kTokens": 0.015,
      "estimatedOutputTokens": 1500
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

- [ ] **Step 4: Create pricing.ts**

Create `scripts/quote/pricing.ts`:

```ts
import { readFileSync } from "fs"
import { join } from "path"

export interface AIStageConfig {
  model: string
  inputPer1kTokens: number
  outputPer1kTokens: number
  estimatedOutputTokens: number
}

export interface PricingConfig {
  version: number
  currency: string
  serviceFee: { perPage: number }
  firecrawl: { perScrape: number }
  ai: {
    classifyNav: AIStageConfig
    assessPages: AIStageConfig
    extractPagesContent: AIStageConfig
  }
  lighthouse: { perRun: number }
  wappalyzer: { perRun: number }
  contentEstimator: { perPage: number }
}

const DEFAULT_PATH = join(__dirname, "pricing.json")

export function loadPricingConfig(path: string = DEFAULT_PATH): PricingConfig {
  const raw = readFileSync(path, "utf8")
  const config = JSON.parse(raw) as PricingConfig
  if (config.version !== 1) {
    throw new Error(`Unsupported pricing config version: ${config.version}`)
  }
  return config
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run scripts/quote/pricing.test.ts`
Expected: 2 tests PASS

- [ ] **Step 6: Commit**

```bash
git add scripts/quote/pricing.json scripts/quote/pricing.ts scripts/quote/pricing.test.ts
git commit -m "feat(quote): add pricing config and loader"
```

---

### Task 3: Mock Content Estimator

**Files:**
- Create: `scripts/quote/content-estimator.ts`
- Create: `scripts/quote/content-estimator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/quote/content-estimator.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { MockContentEstimator } from "./content-estimator"

describe("MockContentEstimator", () => {
  it("returns an estimate for each URL", async () => {
    const estimator = new MockContentEstimator()
    const urls = ["https://example.com/page1", "https://example.com/page2", "https://example.com/page3"]
    const results = await estimator.estimatePages(urls)

    expect(results).toHaveLength(3)
    for (let i = 0; i < urls.length; i++) {
      expect(results[i].url).toBe(urls[i])
      expect(results[i].charCount).toBeGreaterThanOrEqual(3000)
      expect(results[i].charCount).toBeLessThanOrEqual(8000)
    }
  })

  it("returns empty array for empty input", async () => {
    const estimator = new MockContentEstimator()
    const results = await estimator.estimatePages([])
    expect(results).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/quote/content-estimator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement content-estimator.ts**

Create `scripts/quote/content-estimator.ts`:

```ts
export interface ContentEstimate {
  url: string
  charCount: number
}

export interface ContentEstimatorService {
  estimatePages(urls: string[]): Promise<ContentEstimate[]>
}

export class MockContentEstimator implements ContentEstimatorService {
  async estimatePages(urls: string[]): Promise<ContentEstimate[]> {
    return urls.map(url => ({
      url,
      charCount: 3000 + Math.floor(Math.random() * 5000),
    }))
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/quote/content-estimator.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/quote/content-estimator.ts scripts/quote/content-estimator.test.ts
git commit -m "feat(quote): add ContentEstimatorService interface and mock implementation"
```

---

### Task 4: estimate-content Pipeline Stage

**Files:**
- Create: `scripts/pipeline/estimate-content.ts`
- Create: `scripts/pipeline/estimate-content.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/pipeline/estimate-content.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { estimateContent } from "./estimate-content"
import type { Request, Site, SiteEstimate } from "../core/types"

function makeMockRepo(classifyData: { byCategory: Record<string, string[]> }) {
  const stored: Record<string, unknown> = {}
  return {
    getJson: vi.fn().mockResolvedValue(classifyData),
    putJson: vi.fn().mockImplementation(async (ref, data) => {
      stored[`${ref.stage}/${ref.name}`] = data
    }),
    _stored: stored,
  }
}

const site: Site = { id: "site_1", url: "https://example.com" }
const request: Request = {
  id: "r_1",
  createdAt: "2026-04-13T00:00:00Z",
  categories: [
    { id: "cat_1", name: "home", extraInfo: "Homepage", prompt: "..." },
    { id: "cat_2", name: "classes", extraInfo: "Classes", prompt: "..." },
  ],
  sites: [site],
}

describe("estimateContent", () => {
  it("produces a SiteEstimate with deduplicated pages", async () => {
    const repo = makeMockRepo({
      byCategory: {
        cat_1: ["https://example.com"],
        cat_2: ["https://example.com/classes", "https://example.com"],
      },
    })

    await estimateContent(repo as any, request, site)

    expect(repo.putJson).toHaveBeenCalledOnce()
    const [ref, data] = repo.putJson.mock.calls[0]
    expect(ref.stage).toBe("estimate-content")
    expect(ref.name).toBe("estimates.json")

    const estimate = data as SiteEstimate
    expect(estimate.siteId).toBe("site_1")
    // 2 unique URLs: example.com and example.com/classes
    expect(estimate.pages).toHaveLength(2)
    for (const page of estimate.pages) {
      expect(page.charCount).toBeGreaterThan(0)
      expect(page.estimatedTokens).toBe(Math.ceil(page.charCount / 4))
    }
    expect(estimate.totalChars).toBe(estimate.pages.reduce((s, p) => s + p.charCount, 0))
    expect(estimate.totalEstimatedTokens).toBe(estimate.pages.reduce((s, p) => s + p.estimatedTokens, 0))
  })

  it("handles empty classification", async () => {
    const repo = makeMockRepo({ byCategory: { cat_1: [], cat_2: [] } })
    await estimateContent(repo as any, request, site)

    const [, data] = repo.putJson.mock.calls[0]
    const estimate = data as SiteEstimate
    expect(estimate.pages).toHaveLength(0)
    expect(estimate.totalChars).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/pipeline/estimate-content.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement estimate-content.ts**

Create `scripts/pipeline/estimate-content.ts`:

```ts
import type { Repo } from "../db/repo"
import type { Request, Site, SiteEstimate, PageEstimate } from "../core/types"
import { MockContentEstimator, type ContentEstimatorService } from "../quote/content-estimator"

const estimator: ContentEstimatorService = new MockContentEstimator()

export async function estimateContent(repo: Repo, request: Request, site: Site): Promise<void> {
  const classify = await repo.getJson<{ byCategory: Record<string, string[]> }>({
    requestId: request.id, siteId: site.id, stage: "classify-nav", name: "classify-nav.json",
  })

  const urls = new Set<string>()
  for (const list of Object.values(classify.byCategory)) {
    for (const u of list) urls.add(u)
  }

  const ordered = [...urls]
  const estimates = ordered.length > 0 ? await estimator.estimatePages(ordered) : []

  const pages: PageEstimate[] = estimates.map(e => ({
    url: e.url,
    charCount: e.charCount,
    estimatedTokens: Math.ceil(e.charCount / 4),
  }))

  const result: SiteEstimate = {
    siteId: site.id,
    pages,
    totalChars: pages.reduce((s, p) => s + p.charCount, 0),
    totalEstimatedTokens: pages.reduce((s, p) => s + p.estimatedTokens, 0),
  }

  await repo.putJson(
    { requestId: request.id, siteId: site.id, stage: "estimate-content", name: "estimates.json" },
    result,
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/pipeline/estimate-content.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline/estimate-content.ts scripts/pipeline/estimate-content.test.ts
git commit -m "feat(pipeline): add estimate-content stage"
```

---

### Task 5: generate-quote Pipeline Stage

**Files:**
- Create: `scripts/pipeline/generate-quote.ts`
- Create: `scripts/pipeline/generate-quote.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/pipeline/generate-quote.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { generateQuote } from "./generate-quote"
import type { Request, Site, SiteEstimate, Order } from "../core/types"
import type { PricingConfig } from "../quote/pricing"

const pricing: PricingConfig = {
  version: 1,
  currency: "USD",
  serviceFee: { perPage: 0.01 },
  firecrawl: { perScrape: 0.002 },
  ai: {
    classifyNav: { model: "claude-haiku-4-5", inputPer1kTokens: 0.001, outputPer1kTokens: 0.005, estimatedOutputTokens: 500 },
    assessPages: { model: "claude-sonnet-4-6", inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, estimatedOutputTokens: 1000 },
    extractPagesContent: { model: "claude-sonnet-4-6", inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, estimatedOutputTokens: 1500 },
  },
  lighthouse: { perRun: 0 },
  wappalyzer: { perRun: 0 },
  contentEstimator: { perPage: 0 },
}

const site: Site = { id: "site_1", url: "https://example.com" }
const request: Request = {
  id: "r_1",
  createdAt: "2026-04-13T00:00:00Z",
  categories: [
    { id: "cat_1", name: "home", extraInfo: "Homepage", prompt: "p", lighthouse: true },
    { id: "cat_2", name: "classes", extraInfo: "Classes", prompt: "p" },
  ],
  sites: [site],
}

const siteEstimate: SiteEstimate = {
  siteId: "site_1",
  pages: [
    { url: "https://example.com", charCount: 4000, estimatedTokens: 1000 },
    { url: "https://example.com/classes", charCount: 6000, estimatedTokens: 1500 },
  ],
  totalChars: 10000,
  totalEstimatedTokens: 2500,
}

function makeMockRepo() {
  const stored: Record<string, unknown> = {}
  return {
    getJson: vi.fn().mockResolvedValue(siteEstimate),
    putJson: vi.fn().mockImplementation(async (ref, data) => {
      stored[`${ref.stage}/${ref.name}`] = data
    }),
    _stored: stored,
  }
}

describe("generateQuote", () => {
  it("creates an Order with quoted status and line items", async () => {
    const repo = makeMockRepo()
    const order = await generateQuote(repo as any, request, pricing)

    expect(order.requestId).toBe("r_1")
    expect(order.status).toBe("quoted")
    expect(order.sites).toHaveLength(1)

    const orderSite = order.sites[0]
    expect(orderSite.siteId).toBe("site_1")
    expect(orderSite.pageCount).toBe(2)
    expect(orderSite.lineItems.length).toBeGreaterThan(0)

    // Check service fee line item exists
    const serviceFee = orderSite.lineItems.find(li => li.stage === "service-fee")
    expect(serviceFee).toBeDefined()
    expect(serviceFee!.quantity).toBe(2)
    expect(serviceFee!.unitCost).toBe(0.01)
    expect(serviceFee!.estimatedCost).toBeCloseTo(0.02)

    // Check firecrawl line item
    const firecrawl = orderSite.lineItems.find(li => li.stage === "fetch-pages")
    expect(firecrawl).toBeDefined()
    expect(firecrawl!.quantity).toBe(2)

    // Check lighthouse line item exists (cat_1 has lighthouse: true)
    const lighthouse = orderSite.lineItems.find(li => li.stage === "run-lighthouse")
    expect(lighthouse).toBeDefined()

    // Total should be positive
    expect(orderSite.subtotal).toBeGreaterThan(0)
    expect(order.totalEstimatedCost).toBeGreaterThan(0)

    // Verify stored
    expect(repo.putJson).toHaveBeenCalled()
    const storeCall = repo.putJson.mock.calls.find(
      ([ref]: [any]) => ref.stage === "order" && ref.name === "order.json"
    )
    expect(storeCall).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/pipeline/generate-quote.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement generate-quote.ts**

Create `scripts/pipeline/generate-quote.ts`:

```ts
import { newId } from "../db/repo"
import type { Repo } from "../db/repo"
import type { Request, SiteEstimate, Order, OrderLineItem, OrderSite } from "../core/types"
import type { PricingConfig } from "../quote/pricing"

function buildSiteLineItems(
  request: Request,
  estimate: SiteEstimate,
  pricing: PricingConfig,
): OrderLineItem[] {
  const items: OrderLineItem[] = []
  const pageCount = estimate.pages.length

  // Service fee
  items.push({
    stage: "service-fee",
    description: "Service fee",
    unit: "per-page",
    quantity: pageCount,
    unitCost: pricing.serviceFee.perPage,
    estimatedCost: pageCount * pricing.serviceFee.perPage,
  })

  // Firecrawl scraping
  items.push({
    stage: "fetch-pages",
    description: "Firecrawl page scraping",
    unit: "per-page",
    quantity: pageCount,
    unitCost: pricing.firecrawl.perScrape,
    estimatedCost: pageCount * pricing.firecrawl.perScrape,
  })

  // Content estimator
  if (pricing.contentEstimator.perPage > 0) {
    items.push({
      stage: "estimate-content",
      description: "Content estimation service",
      unit: "per-page",
      quantity: pageCount,
      unitCost: pricing.contentEstimator.perPage,
      estimatedCost: pageCount * pricing.contentEstimator.perPage,
    })
  }

  // AI stages — per category
  for (const cat of request.categories) {
    const inputTokens = estimate.totalEstimatedTokens

    // assess-pages
    const assessInput = inputTokens / 1000
    const assessOutput = pricing.ai.assessPages.estimatedOutputTokens / 1000
    const assessCost =
      assessInput * pricing.ai.assessPages.inputPer1kTokens +
      assessOutput * pricing.ai.assessPages.outputPer1kTokens
    items.push({
      stage: "assess-pages",
      description: `Assess pages — ${cat.name}`,
      unit: "per-category",
      quantity: 1,
      unitCost: assessCost,
      estimatedCost: assessCost,
    })

    // extract-pages-content
    const extractInput = inputTokens / 1000
    const extractOutput = pricing.ai.extractPagesContent.estimatedOutputTokens / 1000
    const extractCost =
      extractInput * pricing.ai.extractPagesContent.inputPer1kTokens +
      extractOutput * pricing.ai.extractPagesContent.outputPer1kTokens
    items.push({
      stage: "extract-pages-content",
      description: `Extract content — ${cat.name}`,
      unit: "per-category",
      quantity: 1,
      unitCost: extractCost,
      estimatedCost: extractCost,
    })

    // Optional: lighthouse
    if (cat.lighthouse && pricing.lighthouse.perRun > 0) {
      items.push({
        stage: "run-lighthouse",
        description: `Lighthouse audit — ${cat.name}`,
        unit: "per-category",
        quantity: 1,
        unitCost: pricing.lighthouse.perRun,
        estimatedCost: pricing.lighthouse.perRun,
      })
    } else if (cat.lighthouse) {
      items.push({
        stage: "run-lighthouse",
        description: `Lighthouse audit — ${cat.name}`,
        unit: "per-category",
        quantity: 1,
        unitCost: 0,
        estimatedCost: 0,
      })
    }

    // Optional: wappalyzer
    if (cat.wappalyzer && pricing.wappalyzer.perRun > 0) {
      items.push({
        stage: "detect-tech",
        description: `Tech detection — ${cat.name}`,
        unit: "per-category",
        quantity: 1,
        unitCost: pricing.wappalyzer.perRun,
        estimatedCost: pricing.wappalyzer.perRun,
      })
    }
  }

  return items
}

export async function generateQuote(
  repo: Repo,
  request: Request,
  pricing: PricingConfig,
): Promise<Order> {
  const orderSites: OrderSite[] = []

  for (const site of request.sites) {
    let estimate: SiteEstimate
    try {
      estimate = await repo.getJson<SiteEstimate>({
        requestId: request.id, siteId: site.id, stage: "estimate-content", name: "estimates.json",
      })
    } catch {
      // Site failed Phase 1 — skip
      continue
    }

    const lineItems = buildSiteLineItems(request, estimate, pricing)
    const subtotal = lineItems.reduce((s, li) => s + li.estimatedCost, 0)

    orderSites.push({
      siteId: site.id,
      url: site.url,
      pageCount: estimate.pages.length,
      estimatedTokens: estimate.totalEstimatedTokens,
      lineItems,
      subtotal,
    })
  }

  const order: Order = {
    id: newId("ord"),
    requestId: request.id,
    createdAt: new Date().toISOString(),
    status: "quoted",
    sites: orderSites,
    totalEstimatedCost: orderSites.reduce((s, os) => s + os.subtotal, 0),
  }

  await repo.putJson(
    { requestId: request.id, stage: "order", name: "order.json" },
    order,
  )

  return order
}

export function formatQuoteSummary(order: Order): string {
  const lines: string[] = []
  lines.push(`\n╔══════════════════════════════════════╗`)
  lines.push(`║           QUOTE SUMMARY              ║`)
  lines.push(`╚══════════════════════════════════════╝`)
  lines.push(`  Order:   ${order.id}`)
  lines.push(`  Request: ${order.requestId}`)
  lines.push(``)

  for (const site of order.sites) {
    lines.push(`  ── ${site.url} (${site.pageCount} pages, ~${site.estimatedTokens} tokens) ──`)
    for (const li of site.lineItems) {
      const cost = li.estimatedCost.toFixed(4)
      lines.push(`    ${li.description.padEnd(35)} $${cost}`)
    }
    lines.push(`    ${"Subtotal".padEnd(35)} $${site.subtotal.toFixed(4)}`)
    lines.push(``)
  }

  lines.push(`  ${"TOTAL ESTIMATED COST".padEnd(37)} $${order.totalEstimatedCost.toFixed(4)}`)
  lines.push(``)
  return lines.join("\n")
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/pipeline/generate-quote.test.ts`
Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline/generate-quote.ts scripts/pipeline/generate-quote.test.ts
git commit -m "feat(pipeline): add generate-quote stage with order creation and formatting"
```

---

### Task 6: finalize-order Stage

**Files:**
- Create: `scripts/pipeline/finalize-order.ts`
- Create: `scripts/pipeline/finalize-order.test.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/pipeline/finalize-order.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest"
import { finalizeOrder } from "./finalize-order"
import type { Request, Order, AIQuery } from "../core/types"
import type { PricingConfig } from "../quote/pricing"

const pricing: PricingConfig = {
  version: 1,
  currency: "USD",
  serviceFee: { perPage: 0.01 },
  firecrawl: { perScrape: 0.002 },
  ai: {
    classifyNav: { model: "claude-haiku-4-5", inputPer1kTokens: 0.001, outputPer1kTokens: 0.005, estimatedOutputTokens: 500 },
    assessPages: { model: "claude-sonnet-4-6", inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, estimatedOutputTokens: 1000 },
    extractPagesContent: { model: "claude-sonnet-4-6", inputPer1kTokens: 0.003, outputPer1kTokens: 0.015, estimatedOutputTokens: 1500 },
  },
  lighthouse: { perRun: 0 },
  wappalyzer: { perRun: 0 },
  contentEstimator: { perPage: 0 },
}

const order: Order = {
  id: "ord_1",
  requestId: "r_1",
  createdAt: "2026-04-13T00:00:00Z",
  status: "approved",
  sites: [{
    siteId: "site_1",
    url: "https://example.com",
    pageCount: 2,
    estimatedTokens: 2500,
    lineItems: [
      { stage: "service-fee", description: "Service fee", unit: "per-page", quantity: 2, unitCost: 0.01, estimatedCost: 0.02 },
      { stage: "fetch-pages", description: "Firecrawl", unit: "per-page", quantity: 2, unitCost: 0.002, estimatedCost: 0.004 },
      { stage: "assess-pages", description: "Assess — home", unit: "per-category", quantity: 1, unitCost: 0.01, estimatedCost: 0.01 },
      { stage: "extract-pages-content", description: "Extract — home", unit: "per-category", quantity: 1, unitCost: 0.01, estimatedCost: 0.01 },
    ],
    subtotal: 0.044,
  }],
  totalEstimatedCost: 0.044,
  approvedAt: "2026-04-13T00:01:00Z",
}

const queries: AIQuery[] = [
  {
    id: "q_1", requestId: "r_1", siteId: "site_1", categoryId: "cat_1",
    stage: "assess-pages", model: "claude-sonnet-4-6",
    prompt: "a".repeat(4000), dataRefs: [], response: "b".repeat(2000),
    createdAt: "2026-04-13T00:02:00Z",
  },
  {
    id: "q_2", requestId: "r_1", siteId: "site_1", categoryId: "cat_1",
    stage: "extract-pages-content", model: "claude-sonnet-4-6",
    prompt: "c".repeat(4000), dataRefs: [], response: "d".repeat(3000),
    createdAt: "2026-04-13T00:03:00Z",
  },
]

const fetchPagesIndex = {
  pages: [
    { id: "abc123", url: "https://example.com", status: "ok" },
    { id: "def456", url: "https://example.com/classes", status: "ok" },
  ],
}

function makeMockRepo() {
  const stored: Record<string, unknown> = {}
  return {
    getJson: vi.fn().mockImplementation(async (ref: any) => {
      if (ref.stage === "order") return JSON.parse(JSON.stringify(order))
      if (ref.stage === "fetch-pages") return fetchPagesIndex
      throw new Error(`unexpected getJson: ${ref.stage}/${ref.name}`)
    }),
    putJson: vi.fn().mockImplementation(async (ref: any, data: unknown) => {
      stored[`${ref.stage}/${ref.name}`] = data
    }),
    getQueries: vi.fn().mockResolvedValue(queries),
    _stored: stored,
  }
}

describe("finalizeOrder", () => {
  it("updates order with actual costs and sets completed status", async () => {
    const repo = makeMockRepo()
    const request: Request = {
      id: "r_1", createdAt: "2026-04-13T00:00:00Z",
      categories: [{ id: "cat_1", name: "home", extraInfo: "Homepage", prompt: "p" }],
      sites: [{ id: "site_1", url: "https://example.com" }],
    }

    await finalizeOrder(repo as any, request, pricing)

    const storeCall = repo.putJson.mock.calls.find(
      ([ref]: [any]) => ref.stage === "order" && ref.name === "order.json"
    )
    expect(storeCall).toBeDefined()

    const updated = storeCall![1] as Order
    expect(updated.status).toBe("completed")
    expect(updated.completedAt).toBeDefined()
    expect(updated.totalActualCost).toBeTypeOf("number")
    expect(updated.totalActualCost).toBeGreaterThan(0)

    // AI line items should have actualCost filled
    const assessItem = updated.sites[0].lineItems.find(li => li.stage === "assess-pages")
    expect(assessItem?.actualCost).toBeTypeOf("number")
    expect(assessItem?.actualQuantity).toBeTypeOf("number")

    // Service fee actual = estimated (fixed rate)
    const feeItem = updated.sites[0].lineItems.find(li => li.stage === "service-fee")
    expect(feeItem?.actualCost).toBe(feeItem?.estimatedCost)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/pipeline/finalize-order.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement finalize-order.ts**

Create `scripts/pipeline/finalize-order.ts`:

```ts
import type { Repo } from "../db/repo"
import type { Request, Order, AIQuery } from "../core/types"
import type { PricingConfig } from "../quote/pricing"

function tokenCost(
  promptChars: number,
  responseChars: number,
  config: { inputPer1kTokens: number; outputPer1kTokens: number },
): { inputTokens: number; outputTokens: number; cost: number } {
  const inputTokens = Math.ceil(promptChars / 4)
  const outputTokens = Math.ceil(responseChars / 4)
  const cost =
    (inputTokens / 1000) * config.inputPer1kTokens +
    (outputTokens / 1000) * config.outputPer1kTokens
  return { inputTokens, outputTokens, cost }
}

export async function finalizeOrder(
  repo: Repo,
  request: Request,
  pricing: PricingConfig,
): Promise<void> {
  const order = await repo.getJson<Order>({
    requestId: request.id, stage: "order", name: "order.json",
  })

  for (const orderSite of order.sites) {
    const queries = await repo.getQueries(request.id, orderSite.siteId)

    // Group AI queries by stage
    const queryByStage: Record<string, AIQuery[]> = {}
    for (const q of queries) {
      ;(queryByStage[q.stage] ??= []).push(q)
    }

    // Get actual page count
    let actualPageCount = orderSite.pageCount
    try {
      const index = await repo.getJson<{ pages: Array<{ status: string }> }>({
        requestId: request.id, siteId: orderSite.siteId, stage: "fetch-pages", name: "index.json",
      })
      actualPageCount = index.pages.filter(p => p.status === "ok").length
    } catch {
      // use estimated count
    }

    for (const li of orderSite.lineItems) {
      if (li.stage === "service-fee") {
        li.actualQuantity = actualPageCount
        li.actualCost = actualPageCount * li.unitCost
      } else if (li.stage === "fetch-pages") {
        li.actualQuantity = actualPageCount
        li.actualCost = actualPageCount * li.unitCost
      } else if (li.stage === "assess-pages" || li.stage === "extract-pages-content") {
        const stageQueries = queryByStage[li.stage] ?? []
        let totalInputTokens = 0
        let totalCost = 0
        for (const q of stageQueries) {
          const aiConfig = li.stage === "assess-pages"
            ? pricing.ai.assessPages
            : pricing.ai.extractPagesContent
          const result = tokenCost(q.prompt.length, q.response.length, aiConfig)
          totalInputTokens += result.inputTokens + result.outputTokens
          totalCost += result.cost
        }
        li.actualQuantity = totalInputTokens
        li.actualCost = totalCost
      } else if (li.stage === "run-lighthouse" || li.stage === "detect-tech") {
        // Fixed cost stages — actual = estimated
        li.actualQuantity = li.quantity
        li.actualCost = li.estimatedCost
      } else if (li.stage === "estimate-content") {
        li.actualQuantity = li.quantity
        li.actualCost = li.estimatedCost
      }
    }
  }

  order.status = "completed"
  order.completedAt = new Date().toISOString()
  order.totalActualCost = order.sites.reduce(
    (total, s) => total + s.lineItems.reduce((st, li) => st + (li.actualCost ?? li.estimatedCost), 0),
    0,
  )

  await repo.putJson(
    { requestId: request.id, stage: "order", name: "order.json" },
    order,
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run scripts/pipeline/finalize-order.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/pipeline/finalize-order.ts scripts/pipeline/finalize-order.test.ts
git commit -m "feat(pipeline): add finalize-order stage to track actual costs"
```

---

### Task 7: Wire Up Runner (Two-Phase Pipeline)

**Files:**
- Modify: `scripts/core/run.ts`

- [ ] **Step 1: Add imports**

Add at the top of `scripts/core/run.ts`, after the existing imports:

```ts
import { estimateContent } from "../pipeline/estimate-content"
import { generateQuote, formatQuoteSummary } from "../pipeline/generate-quote"
import { finalizeOrder } from "../pipeline/finalize-order"
import { loadPricingConfig } from "../quote/pricing"
import { createInterface } from "readline"
```

- [ ] **Step 2: Add prompt helper**

Add after the `shouldRun` function:

```ts
async function promptApproval(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === "y")
    })
  })
}
```

- [ ] **Step 3: Split runSite into two phases**

Replace the existing `runSite` function with a `runSitePhase1` and `runSitePhase2`:

```ts
async function runSitePhase1(repo: Repo, request: Request, site: Site, opts: RunOptions): Promise<boolean> {
  console.log(`\n═══ ${site.url} (Phase 1: estimate) ═══`)

  const stages: Array<{ name: StageName; fn: () => Promise<void>; bail: boolean }> = [
    { name: "fetch-home", fn: () => fetchHome(repo, request, site), bail: true },
    { name: "parse-links", fn: () => parseLinks(repo, request, site), bail: false },
    { name: "classify-nav", fn: () => classifyNav(repo, request, site), bail: true },
    { name: "estimate-content", fn: () => estimateContent(repo, request, site), bail: true },
  ]

  for (const { name, fn, bail } of stages) {
    if (!shouldRun(name, opts)) continue
    try {
      console.log(`  ▶ ${name}`)
      await fn()
      console.log(`  ✓ ${name}`)
    } catch (err) {
      console.warn(`  ✗ ${name} failed: ${err instanceof Error ? err.message : err}`)
      if (bail) return false
    }
  }
  return true
}

async function runSitePhase2(repo: Repo, request: Request, site: Site, opts: RunOptions): Promise<void> {
  console.log(`\n═══ ${site.url} (Phase 2: analyze) ═══`)

  // fetch-pages
  if (shouldRun("fetch-pages", opts)) {
    try {
      console.log(`  ▶ fetch-pages`)
      await fetchPages(repo, request, site)
      console.log(`  ✓ fetch-pages`)
    } catch (err) {
      console.warn(`  ✗ fetch-pages failed: ${err instanceof Error ? err.message : err}`)
      return
    }
  }

  // Per-category processing
  if (shouldRun("run-categories", opts)) {
    const progress: Record<string, CategoryProgress> = {}
    for (const cat of request.categories) {
      progress[cat.id] = initCategoryProgress(cat)
    }
    await saveProgress(repo, request.id, site.id, progress)

    for (const cat of request.categories) {
      console.log(`  ▷ category: ${cat.name}`)

      await runCategoryTask(
        "detect-tech",
        () => detectTechForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
      await runCategoryTask(
        "run-lighthouse",
        () => runLighthouseForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
      await runCategoryTask(
        "assess-pages",
        () => assessPagesForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
      await runCategoryTask(
        "extract-pages-content",
        () => extractPagesContentForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
    }
  }

  // Build report
  if (shouldRun("build-report", opts)) {
    try {
      console.log(`  ▶ build-report`)
      await buildReportStage(repo, request, site)
      console.log(`  ✓ build-report`)
    } catch (err) {
      console.warn(`  ✗ build-report: ${err instanceof Error ? err.message : err}`)
    }
  }
}
```

- [ ] **Step 4: Rewrite runAnalysis with two-phase flow**

Replace the existing `runAnalysis` function:

```ts
export async function runAnalysis(
  input: AnalyzeInput,
  opts: RunOptions = {},
  repo: Repo = new Repo(process.cwd() + "/data"),
): Promise<string> {
  const request = await repo.createRequest(input)
  console.log(`\n==> Request ${request.id} (${request.sites.length} sites, ${request.categories.length} categories)`)

  const concurrency = Math.max(1, opts.concurrency ?? 1)

  // ── Phase 1: estimate ──
  const phase1Sites: Site[] = []
  const queue1 = [...request.sites]
  async function worker1(): Promise<void> {
    while (queue1.length > 0) {
      const site = queue1.shift()
      if (!site) return
      try {
        const ok = await runSitePhase1(repo, request, site, opts)
        if (ok) phase1Sites.push(site)
      } catch (err) {
        console.warn(`  ✗ site ${site.url} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker1))

  if (phase1Sites.length === 0) {
    console.warn("\n==> No sites completed Phase 1. Aborting.")
    return request.id
  }

  // ── Generate quote ──
  if (shouldRun("generate-quote" as StageName, opts)) {
    const pricing = loadPricingConfig()
    const order = await generateQuote(repo, request, pricing)
    console.log(formatQuoteSummary(order))

    const approved = await promptApproval("  Proceed with analysis? (y/n): ")
    if (!approved) {
      console.log("\n==> Quote rejected. Exiting.")
      return request.id
    }

    order.status = "approved"
    order.approvedAt = new Date().toISOString()
    await repo.putJson(
      { requestId: request.id, stage: "order", name: "order.json" },
      order,
    )
    console.log("\n==> Quote approved. Starting analysis...")
  }

  // ── Phase 2: analyze (only sites that passed Phase 1) ──
  const queue2 = [...phase1Sites]
  async function worker2(): Promise<void> {
    while (queue2.length > 0) {
      const site = queue2.shift()
      if (!site) return
      try {
        await runSitePhase2(repo, request, site, opts)
      } catch (err) {
        console.warn(`  ✗ site ${site.url} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker2))

  // ── Finalize order ──
  if (shouldRun("generate-quote" as StageName, opts)) {
    try {
      const pricing = loadPricingConfig()
      await finalizeOrder(repo, request, pricing)
      console.log(`\n==> Order finalized`)
    } catch (err) {
      console.warn(`  ✗ finalize-order: ${err instanceof Error ? err.message : err}`)
    }
  }

  await repo.consolidateRequest(request.id)
  console.log(`\n==> consolidated → requests/${request.id}/result.json`)
  return request.id
}
```

- [ ] **Step 5: Remove the old runSite function**

Delete the old `runSite` function (it's been replaced by `runSitePhase1` and `runSitePhase2`).

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 7: Run all tests**

Run: `npx vitest run`
Expected: all tests PASS

- [ ] **Step 8: Commit**

```bash
git add scripts/core/run.ts
git commit -m "feat(runner): split pipeline into two phases with quote approval pause"
```

---

### Task 8: Manual Smoke Test

**Files:** none (verification only)

- [ ] **Step 1: Run the pipeline with the smoke input**

Run: `npm run analyze -- --input data/inputs/yoga-smoke.json`

Expected behavior:
1. Phase 1 runs for each site (fetch-home, parse-links, classify-nav, estimate-content)
2. Quote summary prints with line items and costs
3. Prompts "Proceed with analysis? (y/n)"
4. Type `y` — Phase 2 runs (fetch-pages, assess, extract, report)
5. Order finalized with actuals
6. result.json consolidated

- [ ] **Step 2: Verify the order artifact**

After the run completes, check the order file was created:

Run: `cat data/db/requests/<requestId>/order/order.json | head -50`

Verify:
- `status` is `"completed"`
- `totalActualCost` is present and > 0
- Line items have both `estimatedCost` and `actualCost`

- [ ] **Step 3: Test quote rejection**

Run: `npm run analyze -- --input data/inputs/yoga-smoke.json`

When prompted, type `n`.

Expected: "Quote rejected. Exiting." — no Phase 2 stages run, no result.json created.
