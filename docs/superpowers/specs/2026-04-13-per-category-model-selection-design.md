# Per-Category Model Selection

## Problem

`extract-pages-content` hardcodes `claude-sonnet-4-6` for all categories. Different categories have different complexity — simple schemas waste money on sonnet, complex subjective analysis might benefit from opus. Users should choose the model per category.

## Scope

- `extract-pages-content` stage only
- `assess-pages` and `classify-nav` unchanged

## Design

### Input Schema

Add required `model` field to `CategoryInput`:

```typescript
// scripts/core/types.ts
export interface CategoryInput {
  name: string
  extraInfo: string
  prompt: string
  model: "haiku" | "sonnet" | "opus"  // NEW — required
  lighthouse?: boolean
  wappalyzer?: boolean
}
```

No default. Every category must declare its model explicitly.

### Model Resolution

New file `scripts/core/models.ts`:

```typescript
export const MODEL_MAP = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
} as const

export type ModelTier = keyof typeof MODEL_MAP
```

### Stage Change: `extract-pages-content`

Replace hardcoded `"claude-sonnet-4-6"` with `MODEL_MAP[category.model]` in both the API call (line 34) and the query record (line 72).

### Pricing Update

`scripts/quote/pricing.json` — replace single `extractPagesContent` entry with per-model pricing:

```json
"extractPagesContent": {
  "haiku": {
    "inputPer1kTokens": 0.001,
    "outputPer1kTokens": 0.005,
    "estimatedOutputTokens": 1500
  },
  "sonnet": {
    "inputPer1kTokens": 0.003,
    "outputPer1kTokens": 0.015,
    "estimatedOutputTokens": 1500
  },
  "opus": {
    "inputPer1kTokens": 0.015,
    "outputPer1kTokens": 0.075,
    "estimatedOutputTokens": 1500
  }
}
```

`generate-quote.ts` — `buildSiteLineItems()` reads `category.model` to look up the correct pricing tier instead of using a flat `pricing.ai.extractPagesContent`.

### Input File Updates

All 6 input files get `"model": "sonnet"` on each category (preserves current behavior):

- `data/inputs/yoga.json`
- `data/inputs/yoga-single.json`
- `data/inputs/yoga-smoke.json`
- `data/inputs/coffee-roasters.json`
- `data/inputs/coworking.json`
- `data/inputs/saas-landing.json`

### UI Impact

None. Browse UI reads from results, not input config. Model used could be surfaced later if desired.

## Files Changed

| File | Change |
|------|--------|
| `scripts/core/types.ts` | Add `model` to `CategoryInput` |
| `scripts/core/models.ts` | New — `MODEL_MAP` + `ModelTier` type |
| `scripts/pipeline/extract-pages-content.ts` | Use `MODEL_MAP[category.model]` |
| `scripts/quote/pricing.json` | Per-model pricing for `extractPagesContent` |
| `scripts/pipeline/generate-quote.ts` | Look up pricing by `category.model` |
| `data/inputs/*.json` (6 files) | Add `"model": "sonnet"` to each category |