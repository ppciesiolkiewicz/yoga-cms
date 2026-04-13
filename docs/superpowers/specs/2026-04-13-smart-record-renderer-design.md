# Smart Record Renderer: Remove assess-pages, Unified Extraction + Auto-Rendering

**Date:** 2026-04-13
**Status:** Draft

## Problem

The pipeline runs two Claude calls per category against the same page content:
1. `assess-pages` — hardcoded `ASSESS_FRAMING` that produces `conversionScore`, `seoScore`, `notes`
2. `extract-pages-content` — freeform extraction guided by `category.prompt`

This is redundant. Both read the same markdown, both use `category.prompt` as context. The hardcoded scoring dimensions (conversion, SEO) are not always relevant and cannot be customized per category.

The UI also renders extracted records as collapsed raw JSON, missing an opportunity to surface structured data meaningfully.

## Solution

1. Delete `assess-pages` stage entirely
2. Make `category.prompt` the single source of truth for what gets extracted (including optional scores)
3. Build a smart `RecordRenderer` that auto-renders any record shape by walking field types

## Design

### 1. Pipeline: Delete assess-pages

**Files to remove/modify:**
- Delete `scripts/pipeline/assess-pages.ts`
- Remove `assess-pages` from pipeline orchestration in `scripts/core/run.ts`
- Remove `assess-pages` from progress tracking
- Remove `assess-pages` from `Repo.consolidateRequest` artifact aggregation
- Remove `ContentAssessment` type usage from UI

### 2. Pipeline: Update EXTRACT_FRAMING

Current `EXTRACT_FRAMING` in `scripts/pipeline/extract-pages-content.ts`:
```
Using the category description above, extract structured records from the page text below.
Return ONLY a JSON object with a "records" key holding an array of objects.
Each object's fields are up to you based on the category description, but keep field names consistent across records within this response.
If no records are found, return { "records": [] }.
No markdown, no code fences.
```

New `EXTRACT_FRAMING`:
```
You are analyzing web pages for the category described above.
For each page below, extract one record.
If the category description specifies a JSON schema, follow it exactly.
Otherwise, return fields you find relevant based on the category description.
Every record must always include "url" (the page URL) and "summary" (1-2 sentence plain-language overview of the page).
Return: { "records": [<one record per page>] }.
No markdown, no code fences.
```

Key changes:
- Explicitly "one record per page" (was implicit)
- Handles two prompt modes: simple (summary-only) and structured (explicit JSON schema)
- Guarantees `url` + `summary` always present
- Composes cleanly with category.prompt — framing handles the **how**, prompt handles the **what**

### 3. Category Prompt Modes

**Simple mode** — prompt describes what to look for, no JSON schema. Model returns `url`, `summary`, and whatever fields it infers:
```
You judge yoga drop-in class pages.
A visitor wants to answer: "When can I come? How much? Where? What styles?"
Good page: schedule visible near the top, prices clear, easy to book...
Bad page: schedule hidden, prices missing...
```

**Structured mode** — prompt includes an explicit JSON schema with optional scores:
```
You judge yoga drop-in class pages.
A visitor wants to answer: "When can I come? How much? Where? What styles?"
Good page: schedule visible near the top, prices clear...
Bad page: schedule hidden, prices missing...

Return each record as:
{
  "url": "<page url>",
  "pageName": "<short name>",
  "summary": "<1-2 sentence overview>",
  "conversionScore": <1-10, how well does the page help a visitor book?>,
  "seoScore": <1-10, how well can Google find and rank the page?>,
  "classStyles": ["<style>", ...],
  "pricingVisible": true/false,
  "scheduleVisible": true/false,
  "notes": "<one sentence>"
}
```

Both modes work. The renderer handles whatever comes back.

### 4. Update All Input File Prompts

Update category prompts in all input files (`data/inputs/*.json`) to:
- Remove "Return only valid JSON. No markdown, no code fences." (now in EXTRACT_FRAMING)
- Remove standalone "Score each page 1-10 twice" instructions (now part of the record schema if desired)
- Add explicit JSON record schema (structured mode) where scoring is wanted
- Keep all domain knowledge (good page / bad page / SEO checks)

Files to update: `yoga.json`, `yoga-single.json`, `yoga-smoke.json`, `coffee-roasters.json`, `coworking.json`, `saas-landing.json`

### 5. UI: RecordRenderer Component

New component: `src/components/RecordRenderer.tsx`

Walks record fields **in order** and renders each by value type:

| Value type | Render as |
|---|---|
| `summary` (string, special key) | Prominent text paragraph at top of card |
| `*Score` (number, key ends in "Score") | `ScoreBadge` with label derived from field name (e.g. `conversionScore` -> "Conversion") |
| string that matches URL pattern | Clickable link |
| other string | Label + text content |
| boolean | Label + checkmark or cross icon |
| number (non-score) | Label + formatted number |
| array of strings (<=8 items) | Badge chips |
| array of objects | Sub-list with nested rendering |
| nested object | Indented key-value group |

**Field ordering rules:**
1. `url` and `pageName` go in card header (not in body)
2. `summary` always renders first in body
3. `*Score` fields group together as a badge row after summary
4. Remaining fields render in JSON key order

**Skipped fields:** `url`, `pageName`, `categoryId`, `categoryName` (already shown in card header or section header)

### 6. UI: CategoryBlock Simplification

Changes to `CategoryBlock.tsx`:
- Remove `contentPages` prop and `ContentAssessment`-related rendering
- Remove the "Content Assessment" section
- Extracted records become the **primary visible content** (no longer hidden behind accordion)
- Each record renders as a card using `RecordRenderer`
- Keep: tech card, lighthouse card, progress icon, query details accordion

### 7. What Stays the Same

- `extract-pages-content.ts` logic: still one call per category, still stores `{ categoryId, records }`
- All other pipeline stages unchanged
- `TechCard`, `LighthouseCard` components unchanged
- `ScoreBadge` component reused by `RecordRenderer`

## File Change Summary

| File | Action |
|---|---|
| `scripts/pipeline/assess-pages.ts` | Delete |
| `scripts/core/run.ts` | Remove assess-pages from orchestration |
| `scripts/pipeline/extract-pages-content.ts` | Update `EXTRACT_FRAMING` text |
| `data/inputs/yoga.json` | Update category prompts to structured mode |
| `data/inputs/yoga-single.json` | Update category prompts |
| `data/inputs/yoga-smoke.json` | Update category prompts |
| `data/inputs/coffee-roasters.json` | Update category prompts |
| `data/inputs/coworking.json` | Update category prompts |
| `data/inputs/saas-landing.json` | Update category prompts |
| `src/components/RecordRenderer.tsx` | New — smart field-type renderer |
| `CategoryBlock.tsx` | Remove contentPages, use RecordRenderer for records |
| `page.tsx` (site detail) | Remove contentMap/ContentAssessment, stop passing contentPages |
| `scripts/db/repo.ts` | Remove assess-pages from consolidateRequest |
| Progress tracking files | Remove assess-pages task |
