# SERP Discovery Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page UI at `/create` for searching Google via Serper.dev, selecting sites, defining categories, and producing `AnalyzeInput` JSON.

**Architecture:** Next.js API route proxies Serper.dev. Single client-side page with local `useState` state. UI atoms in `src/components/ui/` with Radix primitives for checkbox and collapsible. Output matches existing `AnalyzeInput` type from `scripts/core/types.ts`.

**Tech Stack:** Next.js 16 route handler, React 19, Radix UI (checkbox, collapsible), Tailwind CSS, Vitest

---

## File Structure

```
src/
├── app/
│   ├── api/serp/
│   │   └── route.ts              # POST proxy to Serper.dev
│   └── create/
│       ├── page.tsx              # Single-page client component (orchestrates all sections)
│       ├── SearchSection.tsx     # Search input + carousel of result cards
│       ├── SerpCard.tsx          # Single search result card (organic, PAA, related, KG)
│       ├── SitesSection.tsx      # Selected sites table with editable meta
│       ├── CategoriesSection.tsx # Category list with add/remove/edit
│       └── ReviewSection.tsx     # Generated AnalyzeInput JSON display
├── components/
│   └── ui/
│       ├── index.ts              # Barrel export
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Textarea.tsx
│       ├── Card.tsx
│       ├── Checkbox.tsx          # Radix-based
│       ├── Chip.tsx
│       ├── Carousel.tsx
│       └── Collapsible.tsx       # Radix-based
└── lib/
    └── serp-types.ts             # Serper response types
```

---

### Task 1: Install Radix dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install @radix-ui/react-checkbox @radix-ui/react-collapsible
```

- [ ] **Step 2: Verify install**

```bash
npm ls @radix-ui/react-checkbox @radix-ui/react-collapsible
```

Expected: both packages listed, no errors.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add radix checkbox and collapsible"
```

---

### Task 2: Serper response types

**Files:**
- Create: `src/lib/serp-types.ts`
- Test: `src/lib/__tests__/serp-types.test.ts`

- [ ] **Step 1: Write type validation test**

Create `src/lib/__tests__/serp-types.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import type { SerperResponse, OrganicResult } from "../serp-types"

describe("SerperResponse types", () => {
  it("accepts a minimal organic response", () => {
    const response: SerperResponse = {
      searchParameters: { q: "yoga studios", type: "search" },
      organic: [
        {
          title: "Best Yoga Studio",
          link: "https://example.com",
          snippet: "A great yoga studio",
          position: 1,
        },
      ],
    }
    expect(response.organic).toHaveLength(1)
    expect(response.organic![0].link).toBe("https://example.com")
  })

  it("accepts a full response with all optional sections", () => {
    const response: SerperResponse = {
      searchParameters: { q: "yoga", type: "search" },
      organic: [],
      knowledgeGraph: {
        title: "Yoga",
        type: "Practice",
        description: "Ancient practice",
        attributes: { origin: "India" },
      },
      peopleAlsoAsk: [
        { question: "What is yoga?", snippet: "Yoga is...", link: "https://example.com" },
      ],
      relatedSearches: [
        { query: "yoga near me" },
      ],
      topStories: [
        { title: "Story", link: "https://news.com", source: "News", date: "2026-01-01" },
      ],
      images: [
        { title: "Yoga pose", imageUrl: "https://img.com/1.jpg", link: "https://example.com" },
      ],
    }
    expect(response.knowledgeGraph?.title).toBe("Yoga")
    expect(response.peopleAlsoAsk).toHaveLength(1)
    expect(response.relatedSearches).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/lib/__tests__/serp-types.test.ts
```

Expected: FAIL — `../serp-types` module not found.

- [ ] **Step 3: Write the types**

Create `src/lib/serp-types.ts`:

```typescript
export interface OrganicResult {
  title: string
  link: string
  snippet: string
  position: number
  date?: string
  sitelinks?: Array<{ title: string; link: string }>
}

export interface KnowledgeGraph {
  title?: string
  type?: string
  description?: string
  imageUrl?: string
  url?: string
  attributes?: Record<string, string>
}

export interface PeopleAlsoAsk {
  question: string
  snippet?: string
  title?: string
  link?: string
}

export interface RelatedSearch {
  query: string
}

export interface TopStory {
  title: string
  link: string
  source?: string
  date?: string
  imageUrl?: string
}

export interface ImageResult {
  title: string
  imageUrl: string
  link: string
}

export interface SerperResponse {
  searchParameters?: { q: string; type?: string; [key: string]: unknown }
  organic?: OrganicResult[]
  knowledgeGraph?: KnowledgeGraph
  peopleAlsoAsk?: PeopleAlsoAsk[]
  relatedSearches?: RelatedSearch[]
  topStories?: TopStory[]
  images?: ImageResult[]
  [key: string]: unknown  // catch-all for any other sections Serper returns
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/lib/__tests__/serp-types.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/serp-types.ts src/lib/__tests__/serp-types.test.ts
git commit -m "feat: add Serper API response types"
```

---

### Task 3: SERP API route

**Files:**
- Create: `src/app/api/serp/route.ts`
- Test: `src/app/api/serp/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/app/api/serp/__tests__/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST } from "../route"

describe("POST /api/serp", () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("returns 401 when SERPER_API_KEY is not set", async () => {
    vi.stubEnv("SERPER_API_KEY", "")
    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "test" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when query is missing", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("forwards query to Serper and returns raw response", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    const mockSerperResponse = {
      organic: [{ title: "Result", link: "https://example.com", snippet: "A result", position: 1 }],
    }
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockSerperResponse), { status: 200 })
    )

    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "yoga studios" }),
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual(mockSerperResponse)
    expect(fetchSpy).toHaveBeenCalledWith("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": "test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: "yoga studios" }),
    })
  })

  it("passes page parameter to Serper", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ organic: [] }), { status: 200 })
    )

    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "yoga", page: 2 }),
    })
    await POST(req)

    expect(fetchSpy).toHaveBeenCalledWith("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": "test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ q: "yoga", page: 2 }),
    })
  })

  it("forwards Serper error status", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key")
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ message: "Rate limited" }), { status: 429 })
    )

    const req = new Request("http://localhost/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "yoga" }),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/app/api/serp/__tests__/route.test.ts
```

Expected: FAIL — `../route` module not found.

- [ ] **Step 3: Write the route handler**

Create `src/app/api/serp/route.ts`:

```typescript
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const apiKey = process.env.SERPER_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "SERPER_API_KEY not configured" }, { status: 401 })
  }

  const body = await req.json()
  if (!body.query || typeof body.query !== "string") {
    return NextResponse.json({ error: "query is required" }, { status: 400 })
  }

  const serperBody: Record<string, unknown> = { q: body.query }
  if (body.page) serperBody.page = body.page

  const serperRes = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(serperBody),
  })

  const data = await serperRes.json()
  return NextResponse.json(data, { status: serperRes.status })
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/app/api/serp/__tests__/route.test.ts
```

Expected: PASS (all 5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/app/api/serp/route.ts src/app/api/serp/__tests__/route.test.ts
git commit -m "feat: add POST /api/serp route proxying to Serper.dev"
```

---

### Task 4: UI atoms — Button, Input, Textarea, Card

**Files:**
- Create: `src/components/ui/Button.tsx`
- Create: `src/components/ui/Input.tsx`
- Create: `src/components/ui/Textarea.tsx`
- Create: `src/components/ui/Card.tsx`
- Create: `src/components/ui/index.ts`

- [ ] **Step 1: Create Button**

Create `src/components/ui/Button.tsx`:

```tsx
import { type ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "ghost"

const variantStyles: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "text-gray-600 hover:bg-gray-100",
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${variantStyles[variant]} ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 2: Create Input**

Create `src/components/ui/Input.tsx`:

```tsx
import { type InputHTMLAttributes } from "react"

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Create Textarea**

Create `src/components/ui/Textarea.tsx`:

```tsx
import { type TextareaHTMLAttributes } from "react"

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 4: Create Card**

Create `src/components/ui/Card.tsx`:

```tsx
import { type HTMLAttributes } from "react"

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 5: Create barrel export**

Create `src/components/ui/index.ts`:

```typescript
export { Button } from "./Button"
export { Input } from "./Input"
export { Textarea } from "./Textarea"
export { Card } from "./Card"
```

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add Button, Input, Textarea, Card UI atoms"
```

---

### Task 5: UI atoms — Checkbox, Chip, Collapsible, Carousel

**Files:**
- Create: `src/components/ui/Checkbox.tsx`
- Create: `src/components/ui/Chip.tsx`
- Create: `src/components/ui/Collapsible.tsx`
- Create: `src/components/ui/Carousel.tsx`
- Modify: `src/components/ui/index.ts`

- [ ] **Step 1: Create Checkbox**

Create `src/components/ui/Checkbox.tsx`:

```tsx
"use client"

import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  className = "",
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
      >
        <CheckboxPrimitive.Indicator>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  )
}
```

- [ ] **Step 2: Create Chip**

Create `src/components/ui/Chip.tsx`:

```tsx
import { type ButtonHTMLAttributes } from "react"

export function Chip({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 ${className}`}
      {...props}
    />
  )
}
```

- [ ] **Step 3: Create Collapsible**

Create `src/components/ui/Collapsible.tsx`:

```tsx
"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { useState, type ReactNode } from "react"

export function Collapsible({
  trigger,
  children,
  className = "",
}: {
  trigger: ReactNode
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} className={className}>
      <CollapsiblePrimitive.Trigger asChild>
        <button type="button" className="flex w-full items-center justify-between text-left text-sm">
          {trigger}
          <span className={`ml-2 transition-transform ${open ? "rotate-180" : ""}`}>&#9662;</span>
        </button>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content>
        {children}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
```

- [ ] **Step 4: Create Carousel**

Create `src/components/ui/Carousel.tsx`:

```tsx
"use client"

import { useRef, type ReactNode } from "react"

export function Carousel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 shadow-md hover:bg-gray-50"
        aria-label="Scroll left"
      >
        &#8249;
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth px-10 py-2 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 shadow-md hover:bg-gray-50"
        aria-label="Scroll right"
      >
        &#8250;
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Update barrel export**

Update `src/components/ui/index.ts`:

```typescript
export { Button } from "./Button"
export { Input } from "./Input"
export { Textarea } from "./Textarea"
export { Card } from "./Card"
export { Checkbox } from "./Checkbox"
export { Chip } from "./Chip"
export { Collapsible } from "./Collapsible"
export { Carousel } from "./Carousel"
```

- [ ] **Step 6: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add Checkbox, Chip, Collapsible, Carousel UI atoms"
```

---

### Task 6: SerpCard component

**Files:**
- Create: `src/app/create/SerpCard.tsx`

Renders a single Serper search response — organic results with checkboxes, knowledge graph, people also ask, related searches, top stories, images.

- [ ] **Step 1: Create SerpCard**

Create `src/app/create/SerpCard.tsx`:

```tsx
"use client"

import type { SerperResponse } from "@/lib/serp-types"
import { Card, Checkbox, Chip, Collapsible } from "@/components/ui"

export function SerpCard({
  query,
  response,
  selectedUrls,
  onToggleUrl,
  onSearchRelated,
}: {
  query: string
  response: SerperResponse
  selectedUrls: Set<string>
  onToggleUrl: (url: string, title: string, snippet: string) => void
  onSearchRelated: (query: string) => void
}) {
  return (
    <Card className="min-w-[600px] max-w-[600px] flex-shrink-0 overflow-y-auto p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-500">{query}</h3>

      {/* Knowledge Graph */}
      {response.knowledgeGraph && (
        <div className="mb-4 rounded-md border border-gray-100 bg-gray-50 p-3">
          <div className="flex gap-3">
            {response.knowledgeGraph.imageUrl && (
              <img
                src={response.knowledgeGraph.imageUrl}
                alt={response.knowledgeGraph.title ?? ""}
                className="h-16 w-16 rounded object-cover"
              />
            )}
            <div>
              {response.knowledgeGraph.title && (
                <div className="font-medium">{response.knowledgeGraph.title}</div>
              )}
              {response.knowledgeGraph.type && (
                <div className="text-xs text-gray-500">{response.knowledgeGraph.type}</div>
              )}
              {response.knowledgeGraph.description && (
                <div className="mt-1 text-sm text-gray-600">{response.knowledgeGraph.description}</div>
              )}
            </div>
          </div>
          {response.knowledgeGraph.attributes && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {Object.entries(response.knowledgeGraph.attributes).map(([k, v]) => (
                <div key={k}>
                  <dt className="inline font-medium text-gray-500">{k}: </dt>
                  <dd className="inline text-gray-700">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}

      {/* Organic Results */}
      {response.organic?.map((result) => (
        <div key={result.link} className="mb-3 flex items-start gap-2">
          <div className="pt-0.5">
            <Checkbox
              label=""
              checked={selectedUrls.has(result.link)}
              onCheckedChange={() => onToggleUrl(result.link, result.title, result.snippet)}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs text-green-700 truncate">{result.link}</div>
            <div className="text-sm font-medium text-blue-800">{result.title}</div>
            <div className="text-xs text-gray-600">{result.snippet}</div>
            {result.sitelinks && (
              <div className="mt-1 flex flex-wrap gap-1">
                {result.sitelinks.map((sl) => (
                  <a key={sl.link} href={sl.link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">
                    {sl.title}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}

      {/* People Also Ask */}
      {response.peopleAlsoAsk && response.peopleAlsoAsk.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">People also ask</div>
          <div className="space-y-1">
            {response.peopleAlsoAsk.map((paa) => (
              <Collapsible
                key={paa.question}
                trigger={<span className="text-sm text-gray-800">{paa.question}</span>}
                className="rounded border border-gray-100 px-3 py-2"
              >
                <div className="mt-2 text-xs text-gray-600">
                  {paa.snippet}
                  {paa.link && (
                    <a href={paa.link} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                      Source
                    </a>
                  )}
                </div>
              </Collapsible>
            ))}
          </div>
        </div>
      )}

      {/* Top Stories */}
      {response.topStories && response.topStories.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Top stories</div>
          <div className="space-y-2">
            {response.topStories.map((story) => (
              <a key={story.link} href={story.link} target="_blank" rel="noopener noreferrer" className="block text-sm">
                <div className="font-medium text-blue-800 hover:underline">{story.title}</div>
                <div className="text-xs text-gray-500">{story.source}{story.date && ` · ${story.date}`}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Images */}
      {response.images && response.images.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Images</div>
          <div className="flex gap-2 overflow-x-auto">
            {response.images.slice(0, 6).map((img) => (
              <a key={img.imageUrl} href={img.link} target="_blank" rel="noopener noreferrer">
                <img src={img.imageUrl} alt={img.title} className="h-20 w-20 rounded object-cover" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Related Searches */}
      {response.relatedSearches && response.relatedSearches.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">Related searches</div>
          <div className="flex flex-wrap gap-2">
            {response.relatedSearches.map((rs) => (
              <Chip key={rs.query} onClick={() => onSearchRelated(rs.query)}>
                {rs.query}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/create/SerpCard.tsx
git commit -m "feat: add SerpCard component for rendering Serper results"
```

---

### Task 7: SearchSection component

**Files:**
- Create: `src/app/create/SearchSection.tsx`

Wraps the search input, fires API calls, and renders SerpCards in a Carousel.

- [ ] **Step 1: Create SearchSection**

Create `src/app/create/SearchSection.tsx`:

```tsx
"use client"

import { useState } from "react"
import type { SerperResponse } from "@/lib/serp-types"
import { Button, Input, Carousel } from "@/components/ui"
import { SerpCard } from "./SerpCard"

interface SearchEntry {
  query: string
  response: SerperResponse
}

export function SearchSection({
  searches,
  selectedUrls,
  onSearch,
  onToggleUrl,
}: {
  searches: SearchEntry[]
  selectedUrls: Set<string>
  onSearch: (query: string) => Promise<void>
  onToggleUrl: (url: string, title: string, snippet: string) => void
}) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(searchQuery: string) {
    const q = searchQuery.trim()
    if (!q) return
    setLoading(true)
    try {
      await onSearch(q)
      setQuery("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Search</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit(query)
        }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search Google..."
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !query.trim()}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      {searches.length > 0 && (
        <Carousel className="mt-4">
          {searches.map((s, i) => (
            <SerpCard
              key={`${s.query}-${i}`}
              query={s.query}
              response={s.response}
              selectedUrls={selectedUrls}
              onToggleUrl={onToggleUrl}
              onSearchRelated={(q) => handleSubmit(q)}
            />
          ))}
        </Carousel>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/create/SearchSection.tsx
git commit -m "feat: add SearchSection with search input and carousel"
```

---

### Task 8: SitesSection component

**Files:**
- Create: `src/app/create/SitesSection.tsx`

Displays selected sites with editable meta fields.

- [ ] **Step 1: Create SitesSection**

Create `src/app/create/SitesSection.tsx`:

```tsx
"use client"

import { Button, Input } from "@/components/ui"

export interface SelectedSite {
  url: string
  title: string
  snippet: string
  meta: { name: string; city: string }
}

export function SitesSection({
  sites,
  onUpdateMeta,
  onRemove,
}: {
  sites: Map<string, SelectedSite>
  onUpdateMeta: (url: string, field: "name" | "city", value: string) => void
  onRemove: (url: string) => void
}) {
  const entries = [...sites.entries()]

  if (entries.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold">Selected Sites</h2>
        <p className="text-sm text-gray-500">No sites selected yet. Search and check sites above.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Selected Sites ({entries.length})</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map(([url, site]) => (
              <tr key={url}>
                <td className="px-3 py-2">
                  <div className="max-w-xs truncate text-blue-700">{url}</div>
                  <div className="truncate text-xs text-gray-400">{site.title}</div>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={site.meta.name}
                    onChange={(e) => onUpdateMeta(url, "name", e.target.value)}
                    className="w-40"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={site.meta.city}
                    onChange={(e) => onUpdateMeta(url, "city", e.target.value)}
                    className="w-32"
                  />
                </td>
                <td className="px-3 py-2">
                  <Button variant="ghost" onClick={() => onRemove(url)} className="text-red-500 hover:text-red-700">
                    &times;
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/create/SitesSection.tsx
git commit -m "feat: add SitesSection with editable meta fields"
```

---

### Task 9: CategoriesSection component

**Files:**
- Create: `src/app/create/CategoriesSection.tsx`

Category management with predefined home/contact, custom add/remove, wappalyzer/lighthouse toggles.

- [ ] **Step 1: Create CategoriesSection**

Create `src/app/create/CategoriesSection.tsx`:

```tsx
"use client"

import { Button, Input, Textarea, Checkbox, Card } from "@/components/ui"

export interface CategoryDraft {
  id: string
  name: string
  extraInfo: string
  prompt: string
  wappalyzer: boolean
  lighthouse: boolean
  removable: boolean
}

export function CategoriesSection({
  categories,
  onAdd,
  onRemove,
  onUpdate,
}: {
  categories: CategoryDraft[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, patch: Partial<CategoryDraft>) => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Categories</h2>
        <Button variant="secondary" onClick={onAdd}>+ Add category</Button>
      </div>
      <div className="space-y-3">
        {categories.map((cat) => (
          <Card key={cat.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={cat.name}
                    onChange={(e) => onUpdate(cat.id, { name: e.target.value })}
                    placeholder="Category name"
                    className="w-48"
                    disabled={!cat.removable}
                  />
                  <Input
                    value={cat.extraInfo}
                    onChange={(e) => onUpdate(cat.id, { extraInfo: e.target.value })}
                    placeholder="Extra info (keywords, description)"
                    className="flex-1"
                  />
                </div>
                <Textarea
                  value={cat.prompt}
                  onChange={(e) => onUpdate(cat.id, { prompt: e.target.value })}
                  placeholder="Assessment prompt..."
                  rows={3}
                  className="w-full"
                />
                <div className="flex gap-4">
                  <Checkbox
                    label="Wappalyzer"
                    checked={cat.wappalyzer}
                    onCheckedChange={(v) => onUpdate(cat.id, { wappalyzer: v })}
                  />
                  <Checkbox
                    label="Lighthouse"
                    checked={cat.lighthouse}
                    onCheckedChange={(v) => onUpdate(cat.id, { lighthouse: v })}
                  />
                </div>
              </div>
              {cat.removable && (
                <Button variant="ghost" onClick={() => onRemove(cat.id)} className="text-red-500 hover:text-red-700">
                  &times;
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/create/CategoriesSection.tsx
git commit -m "feat: add CategoriesSection with predefined home/contact"
```

---

### Task 10: ReviewSection component

**Files:**
- Create: `src/app/create/ReviewSection.tsx`

Renders the final `AnalyzeInput` JSON.

- [ ] **Step 1: Create ReviewSection**

Create `src/app/create/ReviewSection.tsx`:

```tsx
import type { AnalyzeInput } from "../../../scripts/core/types"
import { Card } from "@/components/ui"

export function ReviewSection({ input }: { input: AnalyzeInput }) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Review</h2>
      <Card className="p-4">
        <pre className="overflow-x-auto text-xs text-gray-800">
          {JSON.stringify(input, null, 2)}
        </pre>
      </Card>
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/create/ReviewSection.tsx
git commit -m "feat: add ReviewSection displaying AnalyzeInput JSON"
```

---

### Task 11: Create page — wire everything together

**Files:**
- Create: `src/app/create/page.tsx`

This is the orchestrator — holds all state, delegates to section components.

- [ ] **Step 1: Create the page**

Create `src/app/create/page.tsx`:

```tsx
"use client"

import { useState, useCallback } from "react"
import type { SerperResponse } from "@/lib/serp-types"
import type { AnalyzeInput } from "../../../scripts/core/types"
import { Input } from "@/components/ui"
import { SearchSection } from "./SearchSection"
import { SitesSection, type SelectedSite } from "./SitesSection"
import { CategoriesSection, type CategoryDraft } from "./CategoriesSection"
import { ReviewSection } from "./ReviewSection"

interface SearchEntry {
  query: string
  response: SerperResponse
}

const defaultCategories: CategoryDraft[] = [
  { id: crypto.randomUUID(), name: "home", extraInfo: "", prompt: "", wappalyzer: false, lighthouse: false, removable: false },
  { id: crypto.randomUUID(), name: "contact", extraInfo: "", prompt: "", wappalyzer: false, lighthouse: false, removable: false },
]

export default function CreatePage() {
  const [displayName, setDisplayName] = useState("")
  const [searches, setSearches] = useState<SearchEntry[]>([])
  const [selectedSites, setSelectedSites] = useState<Map<string, SelectedSite>>(new Map())
  const [categories, setCategories] = useState<CategoryDraft[]>(defaultCategories)

  const selectedUrls = new Set(selectedSites.keys())

  const handleSearch = useCallback(async (query: string) => {
    const res = await fetch("/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    const response: SerperResponse = await res.json()
    setSearches((prev) => [...prev, { query, response }])
  }, [])

  const handleToggleUrl = useCallback((url: string, title: string, snippet: string) => {
    setSelectedSites((prev) => {
      const next = new Map(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        const domain = new URL(url).hostname.replace("www.", "")
        next.set(url, { url, title, snippet, meta: { name: domain, city: "" } })
      }
      return next
    })
  }, [])

  const handleUpdateMeta = useCallback((url: string, field: "name" | "city", value: string) => {
    setSelectedSites((prev) => {
      const next = new Map(prev)
      const site = next.get(url)
      if (site) {
        next.set(url, { ...site, meta: { ...site.meta, [field]: value } })
      }
      return next
    })
  }, [])

  const handleRemoveSite = useCallback((url: string) => {
    setSelectedSites((prev) => {
      const next = new Map(prev)
      next.delete(url)
      return next
    })
  }, [])

  const handleAddCategory = useCallback(() => {
    setCategories((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", extraInfo: "", prompt: "", wappalyzer: false, lighthouse: false, removable: true },
    ])
  }, [])

  const handleRemoveCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const handleUpdateCategory = useCallback((id: string, patch: Partial<CategoryDraft>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    )
  }, [])

  const input: AnalyzeInput = {
    displayName: displayName || undefined,
    categories: categories.map((c) => ({
      name: c.name,
      extraInfo: c.extraInfo,
      prompt: c.prompt,
      ...(c.lighthouse && { lighthouse: true }),
      ...(c.wappalyzer && { wappalyzer: true }),
    })),
    sites: [...selectedSites.values()].map((s) => ({
      url: s.url,
      meta: { name: s.meta.name, city: s.meta.city },
    })),
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Analysis</h1>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (e.g. Yoga studios)"
          className="mt-2 w-80"
        />
      </div>

      <div className="space-y-8">
        <SearchSection
          searches={searches}
          selectedUrls={selectedUrls}
          onSearch={handleSearch}
          onToggleUrl={handleToggleUrl}
        />

        <SitesSection
          sites={selectedSites}
          onUpdateMeta={handleUpdateMeta}
          onRemove={handleRemoveSite}
        />

        <CategoriesSection
          categories={categories}
          onAdd={handleAddCategory}
          onRemove={handleRemoveCategory}
          onUpdate={handleUpdateCategory}
        />

        <ReviewSection input={input} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and test manually**

```bash
npm run dev
```

Open `http://localhost:3000/create`. Verify:
1. Navigation bar shows "YogaCMS", "Browse Data", "Create" links
2. Display name input works
3. Search input submits to `/api/serp` (needs `SERPER_API_KEY` in `.env.local`)
4. Results appear in carousel cards
5. Checking a result adds it to Selected Sites
6. Meta fields (name, city) are editable
7. Home and contact categories are pre-populated and not removable
8. Adding a custom category works, remove works
9. Wappalyzer/Lighthouse checkboxes toggle
10. Review section shows valid `AnalyzeInput` JSON

- [ ] **Step 4: Commit**

```bash
git add src/app/create/page.tsx
git commit -m "feat: wire up /create page with all sections"
```

---

### Task 12: Smoke test and final verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: all tests pass, including new serp-types and route tests.

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no errors (or only pre-existing warnings).

- [ ] **Step 4: Verify dev server**

```bash
npm run dev
```

Open `http://localhost:3000/create` and run through the full flow:
1. Search for "yoga studios rishikesh"
2. Select 2-3 results
3. Edit site names/cities
4. Add a "training" category with a prompt
5. Toggle wappalyzer on for training
6. Verify JSON output in Review section matches `AnalyzeInput` shape

- [ ] **Step 5: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during smoke testing"
```
