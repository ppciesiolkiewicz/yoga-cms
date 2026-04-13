# Smart Record Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the redundant `assess-pages` pipeline stage and build a smart UI renderer that auto-displays extracted records by field type, making `category.prompt` the single source of truth for what data gets extracted.

**Architecture:** Delete assess-pages stage. Update `EXTRACT_FRAMING` to compose cleanly with category prompts (simple or structured mode). Build a `RecordRenderer` component that walks JSON fields and renders by type (strings, scores, booleans, arrays, objects). Update CategoryBlock to use RecordRenderer as primary content.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind CSS

---

### Task 1: Remove assess-pages from pipeline orchestration

**Files:**
- Modify: `scripts/core/types.ts:56`
- Modify: `scripts/core/run.ts:9,23,108-112`
- Delete: `scripts/pipeline/assess-pages.ts`

- [ ] **Step 1: Remove `assess-pages` from CategoryTaskName type**

In `scripts/core/types.ts`, change line 56 from:

```ts
export type CategoryTaskName = "detect-tech" | "run-lighthouse" | "assess-pages" | "extract-pages-content"
```

to:

```ts
export type CategoryTaskName = "detect-tech" | "run-lighthouse" | "extract-pages-content"
```

- [ ] **Step 2: Remove assess-pages from run.ts**

In `scripts/core/run.ts`:

Remove the import on line 9:
```ts
import { assessPagesForCategory } from "../pipeline/assess-pages"
```

Remove `"assess-pages": "pending"` from `initCategoryProgress` (line 23).

Remove the `runCategoryTask("assess-pages", ...)` block (lines 108-112):
```ts
      await runCategoryTask(
        "assess-pages",
        () => assessPagesForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
```

- [ ] **Step 3: Remove assess-pages from repo consolidation**

In `scripts/db/repo.ts`, line 119, change:

```ts
const perCategoryStages = new Set(["detect-tech", "run-lighthouse", "assess-pages", "extract-pages-content"])
```

to:

```ts
const perCategoryStages = new Set(["detect-tech", "run-lighthouse", "extract-pages-content"])
```

- [ ] **Step 4: Delete the assess-pages pipeline file**

```bash
rm scripts/pipeline/assess-pages.ts
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to assess-pages. (UI errors about `contentPages` are expected — fixed in Task 4.)

- [ ] **Step 6: Commit**

```bash
git add scripts/core/types.ts scripts/core/run.ts scripts/db/repo.ts
git rm scripts/pipeline/assess-pages.ts
git commit -m "feat: remove assess-pages pipeline stage

Scoring is now handled by category prompts via extract-pages-content.
One fewer Claude call per category."
```

---

### Task 2: Update EXTRACT_FRAMING and category prompts

**Files:**
- Modify: `scripts/pipeline/extract-pages-content.ts:13-17`
- Modify: `data/inputs/yoga.json`
- Modify: `data/inputs/yoga-single.json`
- Modify: `data/inputs/yoga-smoke.json`
- Modify: `data/inputs/coffee-roasters.json`
- Modify: `data/inputs/coworking.json`
- Modify: `data/inputs/saas-landing.json`

- [ ] **Step 1: Update EXTRACT_FRAMING**

In `scripts/pipeline/extract-pages-content.ts`, replace lines 13-17:

```ts
const EXTRACT_FRAMING = `Using the category description above, extract structured records from the page text below.
Return ONLY a JSON object with a "records" key holding an array of objects.
Each object's fields are up to you based on the category description, but keep field names consistent across records within this response.
If no records are found, return { "records": [] }.
No markdown, no code fences.`
```

with:

```ts
const EXTRACT_FRAMING = `You are analyzing web pages for the category described above.
For each page provided below, extract one record.
If the category description specifies a JSON schema, follow it exactly.
Otherwise, return fields you find relevant based on the category description.
Every record must always include "url" (the page URL) and "summary" (1-2 sentence plain-language overview of the page).
Fields ending in "Score" must be numbers from 1 to 10.
Return a JSON object: { "records": [<one record per page>] }.
No markdown, no code fences.`
```

- [ ] **Step 2: Update yoga.json category prompts**

Replace all category prompts in `data/inputs/yoga.json`. Each prompt keeps its domain knowledge but adds a JSON record schema at the end. Remove standalone "Return only valid JSON" and "Score each page" lines since EXTRACT_FRAMING handles the wrapper.

**Drop in** prompt:
```
You judge yoga drop-in class pages.\n\nA visitor wants to answer: \"When can I come? How much? Where? What styles?\"\n\nGood page:\n- Class schedule visible near the top — day, time, style\n- Prices clear (single class, class packs, first-time deals)\n- Studio address and how to get there\n- Easy way to book or just show up\n- Short class descriptions, not long philosophy\n\nBad page:\n- Schedule hidden below a long story\n- \"What is yoga\" text on a commercial class page\n- Prices missing or \"contact us for prices\"\n- Training and retreat offers mixed in with drop-in classes\n\nSEO (Google) — check:\n- Page title names the city and class type (e.g. \"Hatha classes in Barcelona\")\n- Clear H1 matching the title\n- LocalBusiness schema with address, phone, hours\n- Unique copy, not generic boilerplate\n- Images have alt text\n\nReturn each record as:\n{\n  \"url\": \"<page url>\",\n  \"pageName\": \"<short name>\",\n  \"summary\": \"<1-2 sentence overview of what the page offers>\",\n  \"conversionScore\": <1-10, how well does the page help a visitor book?>,\n  \"seoScore\": <1-10, how well can Google find and rank the page?>,\n  \"classStyles\": [\"<yoga style>\", ...],\n  \"pricingVisible\": true/false,\n  \"scheduleVisible\": true/false,\n  \"firstTimeDeal\": true/false,\n  \"notes\": \"<one sentence assessment>\"\n}
```

**Training** prompt:
```
You judge yoga teacher training (YTT) pages.\n\nA visitor is deciding: \"Should I enroll here, or keep looking?\"\n\nFive facts must be near the top, before any story:\n- WHEN — dates\n- WHERE — place\n- PRICE\n- WHAT — what you will learn, hours, style\n- HOW LONG — days or weeks\n\nGood page:\n- All 5 facts visible before any philosophy\n- Real curriculum with topics listed\n- Teacher names and short bios\n- Reviews or past student outcomes\n- Clear way to apply or book\n\nBad page:\n- \"What is yoga\" or philosophy before the price\n- \"Why choose us\" filler sections\n- Price or dates hidden far down\n- Many different training offers mixed on one page\n\nSEO (Google) — check:\n- Title names the course, hours, and city (e.g. \"200hr YTT Rishikesh\")\n- Clear H1 matching the title\n- Course schema, FAQ schema if there is a FAQ\n- Real curriculum depth — Google rewards this on training pages\n- Images with alt text, unique photos\n\nReturn each record as:\n{\n  \"url\": \"<page url>\",\n  \"pageName\": \"<short name>\",\n  \"summary\": \"<1-2 sentence overview>\",\n  \"conversionScore\": <1-10, how well does it help a visitor decide and enroll?>,\n  \"seoScore\": <1-10, how well can Google find and rank it?>,\n  \"trainingName\": \"<name of the training>\",\n  \"hours\": \"<e.g. 200hr>\",\n  \"price\": \"<price if visible>\",\n  \"dates\": \"<dates if visible>\",\n  \"style\": \"<yoga style>\",\n  \"curriculumVisible\": true/false,\n  \"teacherBiosVisible\": true/false,\n  \"notes\": \"<one sentence assessment>\"\n}
```

**Retreat** prompt:
```
You judge yoga retreat pages.\n\nA visitor wants to answer: \"Can I go? When? Where? How much? What happens each day?\"\n\nFive facts must be near the top, before any story:\n- WHEN — dates\n- WHERE — place\n- PRICE and what it includes\n- WHAT — yoga style, activities\n- HOW LONG — days\n\nGood page:\n- All 5 facts visible before the story\n- Real location — town, venue, not just \"paradise\"\n- What is included: room, food, yoga, transfers\n- Daily schedule\n- Clear way to book\n\nBad page:\n- Dates or price hidden\n- Long philosophy before facts\n- Stock photos with no real place info\n- Several different retreats mixed on one page\n\nSEO (Google) — check:\n- Title names the retreat type, place, and month (e.g. \"Yoga retreat in Bali, November\")\n- Clear H1 matching the title\n- Event or TouristTrip schema if possible\n- Real itinerary text, not filler\n- Images with alt text\n\nReturn each record as:\n{\n  \"url\": \"<page url>\",\n  \"pageName\": \"<short name>\",\n  \"summary\": \"<1-2 sentence overview>\",\n  \"conversionScore\": <1-10, how well does it help a visitor decide and book?>,\n  \"seoScore\": <1-10, how well can Google find and rank it?>,\n  \"retreatName\": \"<name>\",\n  \"where\": \"<location>\",\n  \"when\": \"<dates>\",\n  \"price\": \"<price if visible>\",\n  \"includes\": [\"<what is included>\", ...],\n  \"dailyScheduleVisible\": true/false,\n  \"notes\": \"<one sentence assessment>\"\n}
```

**Contact** prompt:
```
You judge contact pages for a business.\n\nA visitor needs: address, phone, email, map, opening hours.\nGood pages put all of this above the fold.\n\nReturn each record as:\n{\n  \"url\": \"<page url>\",\n  \"pageName\": \"<short name>\",\n  \"summary\": \"<1-2 sentence overview>\",\n  \"conversionScore\": <1-10, clear path to reach the business>,\n  \"seoScore\": <1-10, LocalBusiness schema, unique copy, correct NAP>,\n  \"hasAddress\": true/false,\n  \"hasPhone\": true/false,\n  \"hasEmail\": true/false,\n  \"hasMap\": true/false,\n  \"hasOpeningHours\": true/false,\n  \"notes\": \"<one sentence assessment>\"\n}
```

- [ ] **Step 3: Update yoga-single.json prompts**

Apply the same prompt updates. The Home category prompt becomes:

```
You judge a business homepage.\n\nA visitor lands here first.\n\nGood homepage:\n- Clear value proposition above the fold\n- Easy navigation to key pages (classes, pricing, contact)\n- Professional look, fast loading\n\nBad homepage:\n- Wall of text\n- Unclear what the business does\n- Buried navigation\n\nReturn each record as:\n{\n  \"url\": \"<page url>\",\n  \"pageName\": \"<short name>\",\n  \"summary\": \"<1-2 sentence overview>\",\n  \"conversionScore\": <1-10, does the homepage make a visitor want to stay and explore?>,\n  \"seoScore\": <1-10, title, H1, meta description, schema>,\n  \"valuePropositionClear\": true/false,\n  \"navigationEasy\": true/false,\n  \"notes\": \"<one sentence assessment>\"\n}
```

The Drop in, Training, Retreat, and Contact prompts use the same text as yoga.json (Step 2).

- [ ] **Step 4: Update yoga-smoke.json prompts**

Same prompts as yoga.json for Drop in, Training, Retreat, Contact (no Home category in smoke).

- [ ] **Step 5: Update coffee-roasters.json prompts**

Each category keeps its domain knowledge, adds a JSON record schema. Pattern is identical — keep the "Good page / Bad page / SEO check" sections, replace the "Score 1-10 / Return only valid JSON" tail with a `Return each record as:` JSON block.

**Home**: Add schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `valuePropositionClear`, `socialProofVisible`, `notes`.

**Shop**: Add schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `flavorNotesVisible`, `filteringAvailable`, `roastDateVisible`, `notes`.

**Subscription**: Add schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `pricingClear`, `frequencyOptions`, `cancellationPolicyClear`, `notes`.

**About**: Add schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `teamVisible`, `sourcingPhilosophyVisible`, `notes`.

**Contact**: Same pattern as yoga Contact.

- [ ] **Step 6: Update coworking.json prompts**

Same pattern. Each category keeps domain knowledge, gets a JSON record schema.

**Home**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `realPhotos`, `pricingVisible`, `locationClear`, `notes`.

**Pricing**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `allPlansVisible`, `dayPassAvailable`, `selfServeSignup`, `notes`.

**Spaces**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `realPhotos`, `amenitiesListed`, `addressWithMap`, `notes`.

**Community**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `upcomingEvents`, `memberSpotlights`, `notes`.

**Contact**: Same pattern as yoga Contact.

- [ ] **Step 7: Update saas-landing.json prompts**

Same pattern.

**Home**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `codeExampleVisible`, `freeTrialCta`, `technicalCredibility`, `notes`.

**Pricing**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `freeTierClear`, `usageBasedPricing`, `selfServeSignup`, `notes`.

**Docs**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `quickstartAvailable`, `codeExamplesWork`, `searchAvailable`, `notes`.

**Contact**: Schema with `url`, `pageName`, `summary`, `conversionScore`, `seoScore`, `supportChannels`: `["<channel>", ...]`, `notes`.

- [ ] **Step 8: Commit**

```bash
git add scripts/pipeline/extract-pages-content.ts data/inputs/
git commit -m "feat: update EXTRACT_FRAMING and category prompts

Category prompts now define record shape including optional scores.
EXTRACT_FRAMING handles JSON wrapper and guarantees url+summary."
```

---

### Task 3: Build RecordRenderer component

**Files:**
- Create: `src/components/RecordRenderer.tsx`

- [ ] **Step 1: Create RecordRenderer component**

Create `src/components/RecordRenderer.tsx`:

```tsx
"use client"

import { ScoreBadge, Tooltip } from "@/components/ui"

interface RecordRendererProps {
  record: Record<string, unknown>
}

const HEADER_FIELDS = new Set(["url", "pageName", "categoryId", "categoryName"])

function isUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

function isScoreField(key: string): boolean {
  return key.endsWith("Score") && key !== "score"
}

function labelFromKey(key: string): string {
  // "conversionScore" -> "Conversion", "pricingVisible" -> "Pricing Visible"
  const withoutScore = key.replace(/Score$/, "")
  return withoutScore
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, c => c.toUpperCase())
    .trim()
}

function ScoreRow({ record }: { record: Record<string, unknown> }) {
  const scores = Object.entries(record).filter(
    ([key, val]) => isScoreField(key) && typeof val === "number"
  )
  if (scores.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scores.map(([key, val]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-xs text-gray-500">{labelFromKey(key)}</span>
          <ScoreBadge score={val as number} />
        </div>
      ))}
    </div>
  )
}

function BooleanField({ label, value }: { label: string; value: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs">
      <span className={value ? "text-green-600" : "text-red-400"}>{value ? "\u2714" : "\u2716"}</span>
      <span className="text-gray-600">{label}</span>
    </span>
  )
}

function StringArrayBadges({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.slice(0, 8).map((item, i) => (
        <span key={i} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
          {item}
        </span>
      ))}
    </div>
  )
}

function FieldValue({ fieldKey, value }: { fieldKey: string; value: unknown }) {
  if (value === null || value === undefined) return null

  const label = labelFromKey(fieldKey)

  // Boolean
  if (typeof value === "boolean") {
    return <BooleanField label={label} value={value} />
  }

  // Number (non-score)
  if (typeof value === "number") {
    return (
      <div className="text-sm">
        <span className="font-medium text-gray-500">{label}:</span>{" "}
        <span className="text-gray-900">{value}</span>
      </div>
    )
  }

  // String
  if (typeof value === "string") {
    if (isUrl(value)) {
      return (
        <div className="text-sm">
          <span className="font-medium text-gray-500">{label}:</span>{" "}
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
            {value}
          </a>
        </div>
      )
    }
    return (
      <div className="text-sm">
        <span className="font-medium text-gray-500">{label}:</span>{" "}
        <span className="text-gray-900">{value}</span>
      </div>
    )
  }

  // Array of strings
  if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === "string")) {
    return (
      <div>
        <div className="mb-1 text-sm font-medium text-gray-500">{label}</div>
        <StringArrayBadges items={value as string[]} />
      </div>
    )
  }

  // Array of objects
  if (Array.isArray(value) && value.length > 0 && value.every(v => typeof v === "object" && v !== null)) {
    return (
      <div>
        <div className="mb-1 text-sm font-medium text-gray-500">{label}</div>
        <div className="space-y-1 pl-3 border-l-2 border-gray-100">
          {(value as Record<string, unknown>[]).map((item, i) => (
            <div key={i} className="text-xs text-gray-700">
              {Object.entries(item)
                .filter(([, v]) => v !== null && v !== undefined)
                .map(([k, v]) => `${k}: ${v}`)
                .join(" · ")}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Nested object
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return (
      <div>
        <div className="mb-1 text-sm font-medium text-gray-500">{label}</div>
        <div className="space-y-0.5 pl-3 border-l-2 border-gray-100">
          {Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined)
            .map(([k, v]) => (
              <div key={k} className="text-xs">
                <span className="text-gray-500">{labelFromKey(k)}:</span>{" "}
                <span className="text-gray-700">{String(v)}</span>
              </div>
            ))}
        </div>
      </div>
    )
  }

  return null
}

export function RecordRenderer({ record }: RecordRendererProps) {
  const summary = typeof record.summary === "string" ? record.summary : null

  // Collect remaining fields in order, excluding header fields, summary, and scores
  const remainingFields = Object.entries(record).filter(
    ([key]) => !HEADER_FIELDS.has(key) && key !== "summary" && !isScoreField(key)
  )

  // Separate booleans from other fields for compact rendering
  const booleanFields = remainingFields.filter(([, val]) => typeof val === "boolean")
  const otherFields = remainingFields.filter(([, val]) => typeof val !== "boolean")

  return (
    <div className="space-y-2">
      {summary && (
        <p className="text-sm text-gray-700">{summary}</p>
      )}

      <ScoreRow record={record} />

      {booleanFields.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {booleanFields.map(([key, val]) => (
            <BooleanField key={key} label={labelFromKey(key)} value={val as boolean} />
          ))}
        </div>
      )}

      {otherFields.map(([key, val]) => (
        <FieldValue key={key} fieldKey={key} value={val} />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit --files src/components/RecordRenderer.tsx 2>&1 | head -20
```

Expected: no errors in RecordRenderer.tsx (other files may have errors from Task 1 changes not yet applied to UI).

- [ ] **Step 3: Commit**

```bash
git add src/components/RecordRenderer.tsx
git commit -m "feat: add RecordRenderer component

Smart field-type renderer: summary text, *Score badges,
booleans as checkmarks, string arrays as chips, objects as
key-value groups. Walks record fields in JSON order."
```

---

### Task 4: Update CategoryBlock and page.tsx

**Files:**
- Modify: `src/app/(report)/browse-data/[requestId]/[siteId]/CategoryBlock.tsx`
- Modify: `src/app/(report)/browse-data/[requestId]/[siteId]/page.tsx`

- [ ] **Step 1: Rewrite CategoryBlock to use RecordRenderer**

Replace the full content of `src/app/(report)/browse-data/[requestId]/[siteId]/CategoryBlock.tsx`:

```tsx
import { TechCard, LighthouseCard } from "./TechCard"
import { RecordRenderer } from "@/components/RecordRenderer"
import { Tooltip, StatusBadge, Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui"

interface QueryInfo {
  id: string
  stage: string
  categoryId?: string
  prompt: string
  dataRefs: string[]
  model: string
}

type TaskStatus = "pending" | "running" | "completed" | "failed" | "not-requested"

interface TechArtifact {
  platform: string
  detectedTechnologies: Array<{ name: string; categories: string[]; version?: string; confidence?: number }>
  costBreakdown: Array<{ item: string; min: number; max: number }>
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
}

interface LighthouseArtifact {
  url?: string
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

interface Props {
  categoryId: string
  categoryName: string
  extraInfo: string
  classifiedUrls: string[]
  extractedRecords: unknown[]
  queries?: QueryInfo[]
  tech?: TechArtifact
  lighthouse?: LighthouseArtifact
  progress?: Record<string, TaskStatus>
}


function progressSummaryIcon(progress: Record<string, TaskStatus>): { icon: string; color: string } {
  const statuses = Object.values(progress)
  if (statuses.some(s => s === "failed")) return { icon: "\u2716", color: "text-red-500" }
  if (statuses.some(s => s === "running")) return { icon: "\u25CB", color: "text-blue-500 animate-pulse" }
  if (statuses.every(s => s === "completed" || s === "not-requested")) return { icon: "\u2714", color: "text-green-500" }
  return { icon: "\u25CB", color: "text-gray-400" }
}

function ProgressIcon({ progress }: { progress: Record<string, TaskStatus> }) {
  const { icon, color } = progressSummaryIcon(progress)
  const tooltipContent = (
    <div className="space-y-1">
      {Object.entries(progress).map(([task, status]) => (
        <div key={task} className="flex items-center gap-2">
          <StatusBadge status={status as TaskStatus} />
          <span>{task.replace(/-/g, " ")}</span>
        </div>
      ))}
    </div>
  )

  return (
    <Tooltip content={tooltipContent} side="left">
      <span className={`cursor-default text-lg ${color}`} aria-label="Pipeline progress">
        {icon}
      </span>
    </Tooltip>
  )
}

function QueryDetails({ query }: { query: QueryInfo }) {
  return (
    <Accordion className="mt-2 text-xs">
      <AccordionItem value="query">
        <AccordionTrigger className="text-xs text-blue-600 hover:underline py-1">
          <span>View AI query</span>
        </AccordionTrigger>
        <AccordionContent className="mt-2 space-y-2 rounded border border-gray-200 bg-gray-50 p-3">
          <div>
            <span className="font-semibold text-gray-700">Model:</span> {query.model}
          </div>
          <div>
            <span className="font-semibold text-gray-700">Prompt:</span>
            <pre className="mt-1 whitespace-pre-wrap text-gray-600">{query.prompt}</pre>
          </div>
          {query.dataRefs.length > 0 && (
            <div>
              <span className="font-semibold text-gray-700">Data ({query.dataRefs.length} pages):</span>
              <ul className="mt-1 text-gray-600">
                {query.dataRefs.map(ref => <li key={ref} className="truncate">{ref}</li>)}
              </ul>
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function getRecordHeader(record: unknown, index: number): { title: string; url: string } {
  if (typeof record !== "object" || record === null) return { title: `Record ${index + 1}`, url: "" }
  const obj = record as Record<string, unknown>

  let title = `Record ${index + 1}`
  for (const key of ["pageName", "name", "title", "studioName", "label"]) {
    if (typeof obj[key] === "string" && obj[key]) { title = obj[key] as string; break }
  }

  const url = typeof obj.url === "string" ? obj.url : ""
  return { title, url }
}

function ExtractedRecordCard({ record, index }: { record: unknown; index: number }) {
  const { title, url } = getRecordHeader(record, index)
  const recordObj = (typeof record === "object" && record !== null) ? record as Record<string, unknown> : {}

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-base font-semibold text-gray-900">{title}</div>
            {url && (
              <a href={url} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-sm text-blue-600 hover:underline truncate">
                {url}
              </a>
            )}
          </div>
        </div>
        <div className="mt-3">
          <RecordRenderer record={recordObj} />
        </div>
      </div>
      <Accordion className="border-t border-gray-100">
        <AccordionItem value="json">
          <AccordionTrigger className="px-4 py-2 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-700">
            <span>View raw JSON</span>
          </AccordionTrigger>
          <AccordionContent>
            <pre className="overflow-x-auto border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-700">
              {JSON.stringify(record, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export default function CategoryBlock(props: Props) {
  const extractQuery = props.queries?.find(q => q.stage === "extract-pages-content") ?? null

  return (
    <section
      id={`category-${props.categoryId}`}
      className="mb-6 rounded-lg border border-gray-200 bg-white p-6"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{props.categoryName}</h2>
          {props.extraInfo && (
            <p className="mt-1 text-sm text-gray-500">{props.extraInfo}</p>
          )}
        </div>
        {props.progress && <ProgressIcon progress={props.progress} />}
      </div>

      <TechCard tech={props.tech} />
      <LighthouseCard lighthouse={props.lighthouse} />

      {props.extractedRecords.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Page Analysis ({props.extractedRecords.length})
            </div>
          </div>
          {extractQuery && <QueryDetails query={extractQuery} />}
          <div className="mt-2 space-y-3">
            {props.extractedRecords.map((record, i) => (
              <ExtractedRecordCard key={i} record={record} index={i} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Update page.tsx — remove assess-pages references**

In `src/app/(report)/browse-data/[requestId]/[siteId]/page.tsx`:

Remove the `ContentAssessment` interface (lines 58-62):
```ts
interface ContentAssessment {
  categoryId: string
  categoryName: string
  pages: Array<{ url: string; pageName: string; conversionScore: number; seoScore: number; notes: string }>
}
```

Remove the `contentMap` line (line 87):
```ts
  const contentMap = (site.artifacts["assess-pages"] ?? {}) as Record<string, ContentAssessment>
```

In the `renderCategory` function, remove `contentPages` variable and its usage:
```ts
    const contentPages = contentMap[cat.id]?.pages ?? []
```

Remove `contentPages` from the emptiness check:
```ts
    if (
      classifiedUrls.length === 0 &&
      contentPages.length === 0 &&
      extractedRecords.length === 0 &&
      !tech &&
      !lighthouse
    ) {
```

Change to:
```ts
    if (
      classifiedUrls.length === 0 &&
      extractedRecords.length === 0 &&
      !tech &&
      !lighthouse
    ) {
```

Remove `contentPages` from the `CategoryBlock` JSX props:
```ts
        contentPages={contentPages}
```

- [ ] **Step 3: Verify full TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: PASS, no errors.

- [ ] **Step 4: Start dev server and verify the page renders**

```bash
npm run dev
```

Open `http://localhost:3001/browse-data/r_mnvuikg4_5f6a27f` and verify:
- Category blocks render without errors
- Extracted records show as cards with RecordRenderer (summary, scores, field values)
- Raw JSON accordion still works
- Tech and Lighthouse cards still render
- No console errors

- [ ] **Step 5: Commit**

```bash
git add src/app/'(report)'/browse-data/'[requestId]'/'[siteId]'/CategoryBlock.tsx
git add src/app/'(report)'/browse-data/'[requestId]'/'[siteId]'/page.tsx
git commit -m "feat: use RecordRenderer in CategoryBlock, remove assess-pages from UI

Extracted records are now primary content with smart field rendering.
Removed contentPages/ContentAssessment references."
```
