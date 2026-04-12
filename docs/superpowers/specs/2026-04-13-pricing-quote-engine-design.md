# Pricing & Quote Engine

## Problem

The analysis pipeline incurs real costs (Firecrawl scraping, Claude AI calls, service fees) but currently runs to completion with no cost visibility upfront. We need a quoting mechanism that estimates costs before committing to expensive stages, and tracks actuals after completion for invoicing.

## Pipeline Flow Change

### Current
```
fetch-home → parse-links → classify-nav → fetch-pages → [per-category AI stages] → build-report
```

### New
```
Phase 1 (all sites, parallel with concurrency):
  fetch-home → parse-links → classify-nav → estimate-content

Aggregate pause point:
  generate-quote → print summary → prompt y/n
  If no  → exit
  If yes → mark order approved

Phase 2 (all sites, parallel with concurrency):
  fetch-pages → [per-category stages] → build-report

Finalize:
  finalize-order → update actuals from AIQuery records
  consolidateRequest
```

Key constraint: the quote is **per-request** (aggregated across all sites), so all sites must complete Phase 1 before the quote is generated. The interactive prompt uses Node `readline` for a simple y/n on stdin.

If some sites fail during Phase 1, the quote is generated for sites that succeeded. Failed sites are listed in the terminal output but excluded from the Order. Phase 2 only runs for sites present in the approved Order.

## New Types

Added to `scripts/core/types.ts`:

### Content Estimation

```ts
interface PageEstimate {
  url: string
  charCount: number
  estimatedTokens: number  // charCount / 4
}

interface SiteEstimate {
  siteId: string
  pages: PageEstimate[]
  totalChars: number
  totalEstimatedTokens: number
}
```

### Order (Quote + Invoice unified)

```ts
interface OrderLineItem {
  stage: string
  description: string
  unit: string              // "per-site", "per-page", "per-token"
  quantity: number
  unitCost: number
  estimatedCost: number
  actualCost?: number       // filled after stage runs
  actualQuantity?: number   // actual tokens/pages used
}

interface Order {
  id: string
  requestId: string
  createdAt: string
  status: "quoted" | "approved" | "completed"
  sites: Array<{
    siteId: string
    url: string
    pageCount: number
    estimatedTokens: number
    lineItems: OrderLineItem[]
    subtotal: number
  }>
  totalEstimatedCost: number
  totalActualCost?: number
  approvedAt?: string
  completedAt?: string
}
```

### Updated StageName

```ts
type StageName =
  | "fetch-home"
  | "parse-links"
  | "classify-nav"
  | "estimate-content"
  | "generate-quote"
  | "fetch-pages"
  | "run-categories"
  | "build-report"
```

## Pricing Configuration

File: `scripts/quote/pricing.json`

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

Design choices:
- Token costs split by model (Haiku for classify, Sonnet for assess/extract)
- `estimatedOutputTokens` is a fixed estimate per AI call since output length is unpredictable
- Input tokens calculated from content estimates (charCount / 4) + system prompt overhead
- Lighthouse, wappalyzer, and contentEstimator are zero-cost placeholders for when they have real costs
- `contentEstimator.perPage` becomes non-zero when swapping in a real service (e.g., Browserless.io)

## Mock Content Estimator

File: `scripts/quote/content-estimator.ts`

```ts
interface ContentEstimate {
  url: string
  charCount: number
}

interface ContentEstimatorService {
  estimatePages(urls: string[]): Promise<ContentEstimate[]>
}

class MockContentEstimator implements ContentEstimatorService {
  async estimatePages(urls: string[]): Promise<ContentEstimate[]> {
    return urls.map(url => ({
      url,
      charCount: 3000 + Math.floor(Math.random() * 5000),
    }))
  }
}
```

Returns 3000-8000 chars per page (reasonable for a typical business page). When swapping in a real service, implement the same `ContentEstimatorService` interface.

## Pipeline Stages

### estimate-content (new)

File: `scripts/pipeline/estimate-content.ts`

- Reads `classify-nav/classify-nav.json` to get classified URLs per category
- Deduplicates URLs across categories
- Calls `ContentEstimatorService.estimatePages()` with all URLs
- Stores `estimate-content/estimates.json` per site as `SiteEstimate`

### generate-quote (new)

File: `scripts/pipeline/generate-quote.ts`

- Reads all `estimate-content/estimates.json` artifacts across sites
- Loads `scripts/quote/pricing.json`
- For each site, calculates line items:
  - Firecrawl: pageCount * firecrawl.perScrape
  - Service fee: pageCount * serviceFee.perPage
  - classify-nav AI cost: already incurred (sunk), shown for transparency
  - assess-pages AI cost: estimated input tokens (from content estimates) + output estimate, per category
  - extract-pages-content AI cost: same calculation, per category
  - lighthouse: per category if enabled, lighthouse.perRun
  - wappalyzer: per category if enabled, wappalyzer.perRun
  - content estimator: pageCount * contentEstimator.perPage
- Creates Order with status `"quoted"`, stores as `order/order.json` at request level (no siteId)
- Prints formatted quote summary to terminal

### finalize-order (new)

File: `scripts/pipeline/finalize-order.ts`

- Runs after build-report, before consolidateRequest
- Reads `order/order.json`
- For each site, reads AIQuery records to get actual prompt/response lengths
- Calculates actual token usage: `prompt.length / 4` for input, `response.length / 4` for output
- Reads `fetch-pages/index.json` to get actual page count (including failed pages)
- Updates each OrderLineItem with `actualCost` and `actualQuantity`
- Sets `totalActualCost`, `completedAt`, status `"completed"`
- Overwrites `order/order.json`

## Runner Changes

File: `scripts/core/run.ts`

The runner splits into two phases:

1. **Phase 1**: For each site (with concurrency), run: fetch-home, parse-links, classify-nav, estimate-content
2. **Aggregate**: Call generate-quote (reads all site estimates, produces one Order). Print quote. Prompt y/n via `readline`. If rejected, exit.
3. **Phase 2**: For each site (with concurrency), run: fetch-pages, per-category stages, build-report
4. **Finalize**: Call finalize-order, then consolidateRequest

The existing `shouldRun` / `--stages` filter continues to work. New stages are skippable.

## File Structure

### New files
```
scripts/quote/
  pricing.json              — rate configuration
  pricing.ts                — loads + validates pricing config, PricingConfig type
  content-estimator.ts      — ContentEstimatorService interface + MockContentEstimator

scripts/pipeline/
  estimate-content.ts       — stage: calls estimator for classified URLs per site
  generate-quote.ts         — stage: reads estimates + pricing, creates Order
  finalize-order.ts         — post-pipeline: updates Order with actuals
```

### Modified files
```
scripts/core/types.ts       — Order, OrderLineItem, PageEstimate, SiteEstimate, updated StageName
scripts/core/run.ts         — two-phase runner, pause logic, finalize-order call
```

## Scope

- Terminal/CLI only. No UI changes.
- Mock content estimator (swap in real service later).
- Order stored as JSON artifact on the request.
