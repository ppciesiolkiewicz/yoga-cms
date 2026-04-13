# Create Page UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the `/create` wizard page — replace the step indicator with underline tabs, convert the sites table to cards, add syntax-highlighted JSON to the review step, and tighten spacing.

**Architecture:** Pure UI changes across 3 files. No new components, no new dependencies. All changes are visual — no data flow or state changes.

**Tech Stack:** React, Tailwind CSS, lucide-react (Globe icon), existing UI primitives (Card, Input, Button)

**Spec:** `docs/superpowers/specs/2026-04-13-create-page-ui-polish-design.md`

---

### Task 1: Step Indicator — Underline Tabs

**Files:**
- Modify: `src/app/(main)/create/page.tsx:137-161`

- [ ] **Step 1: Replace the step indicator markup**

In `src/app/(main)/create/page.tsx`, replace the step indicator block (the `<div className="mb-6 flex items-center gap-2 text-sm">` and everything inside it) with:

```tsx
{/* Tab navigation */}
<div className="mb-6 mt-5 flex border-b-2 border-border-default">
  {([
    { key: "search" as const, label: "Sites", number: 1 },
    { key: "categories" as const, label: "Categories", number: 2 },
    { key: "review" as const, label: "Review", number: 3 },
  ]).map((tab) => (
    <button
      key={tab.key}
      type="button"
      onClick={() => setStep(tab.key)}
      className={`px-5 py-2.5 text-sm font-medium transition-colors ${
        step === tab.key
          ? "border-b-2 border-accent text-foreground -mb-[2px]"
          : "text-foreground-faint hover:text-foreground-secondary"
      }`}
    >
      <span className={step === tab.key ? "text-accent-fg" : ""}>{tab.number}.</span>{" "}
      {tab.label}
    </button>
  ))}
</div>
```

- [ ] **Step 2: Tighten header spacing**

In the same file, change the header wrapper `<div className="mb-6">` (around the h1, p, and Input) to:

```tsx
<div className="mb-4">
```

And change the name Input's `className="mt-3 w-80"` to:

```tsx
className="mt-2 w-80"
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev` (if not already running)

Open `http://localhost:3001/create`. Confirm:
- Three tabs ("1. Sites", "2. Categories", "3. Review") with underline style
- Active tab has accent bottom border and white text
- Clicking tabs switches content
- Tighter spacing between title and tabs

- [ ] **Step 4: Commit**

```bash
git add src/app/(main)/create/page.tsx
git commit -m "refactor: replace step indicator pills with underline tabs"
```

---

### Task 2: Selected Sites — Card List

**Files:**
- Modify: `src/app/(main)/create/SitesSection.tsx`

- [ ] **Step 1: Add Globe import and replace the table with card list**

Replace the entire content of `src/app/(main)/create/SitesSection.tsx` with:

```tsx
"use client"

import { type ChangeEvent, useState } from "react"
import { Globe, Plus } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

export interface SelectedSite {
  url: string
  title: string
  snippet: string
  meta: { name: string }
}

function normalizeUrl(raw: string): string | null {
  let value = raw.trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) value = "https://" + value
  try {
    return new URL(value).href
  } catch {
    return null
  }
}

function SiteCard({
  url,
  site,
  onUpdateMeta,
  onRemove,
}: {
  url: string
  site: SelectedSite
  onUpdateMeta: (url: string, field: "name", value: string) => void
  onRemove: (url: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-alt/50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent-fg">
        <Globe className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <Input
          value={site.meta.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateMeta(url, "name", e.target.value)}
          className="h-7 w-40 text-xs"
        />
        <div className="mt-1 truncate text-xs text-accent-fg">{url}</div>
        {site.title && (
          <div className="truncate text-xs text-foreground-faint">{site.title}</div>
        )}
      </div>
      <Button variant="ghost" onClick={() => onRemove(url)} className="text-foreground-faint hover:text-error">
        &times;
      </Button>
    </div>
  )
}

function AddSiteRow({
  manualUrl,
  setManualUrl,
  onAdd,
  disabled,
}: {
  manualUrl: string
  setManualUrl: (v: string) => void
  onAdd: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-subtle p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-foreground-faint">
        <Plus className="h-4 w-4" />
      </div>
      <Input
        value={manualUrl}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setManualUrl(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") { e.preventDefault(); onAdd() }
        }}
        placeholder="Enter a URL, e.g. example.com"
        className="flex-1"
      />
      <Button
        variant="ghost"
        onClick={onAdd}
        disabled={disabled}
        className="font-medium text-accent-fg hover:text-accent-fg"
      >
        Add +
      </Button>
    </div>
  )
}

export function SitesSection({
  sites,
  onAdd,
  onUpdateMeta,
  onRemove,
}: {
  sites: Map<string, SelectedSite>
  onAdd: (url: string, title: string, snippet: string) => void
  onUpdateMeta: (url: string, field: "name", value: string) => void
  onRemove: (url: string) => void
}) {
  const entries = [...sites.entries()]
  const [manualUrl, setManualUrl] = useState("")

  function handleAddManual() {
    const url = normalizeUrl(manualUrl)
    if (!url || sites.has(url)) return
    onAdd(url, "", "")
    setManualUrl("")
  }

  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">
        Selected Sites{entries.length > 0 ? ` (${entries.length})` : ""}
      </h2>

      <div className="space-y-2">
        {entries.map(([url, site]) => (
          <SiteCard
            key={url}
            url={url}
            site={site}
            onUpdateMeta={onUpdateMeta}
            onRemove={onRemove}
          />
        ))}

        <AddSiteRow
          manualUrl={manualUrl}
          setManualUrl={setManualUrl}
          onAdd={handleAddManual}
          disabled={!manualUrl.trim()}
        />
      </div>

      <p className="mt-1 text-xs text-foreground-faint">
        Or search above and select from results
      </p>
    </section>
  )
}
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/create`. Confirm:
- Empty state shows just the dashed add-URL row with hint text
- Type a URL and click "Add +" — a card appears with globe icon, editable name, URL, and remove button
- Multiple cards stack vertically
- Remove button works

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/create/SitesSection.tsx
git commit -m "refactor: replace sites table with card list"
```

---

### Task 3: Review Step — Syntax-Highlighted JSON

**Files:**
- Modify: `src/app/(main)/create/ReviewSection.tsx`

- [ ] **Step 1: Replace ReviewSection with syntax-highlighted JSON**

Replace the entire content of `src/app/(main)/create/ReviewSection.tsx` with:

```tsx
import type { AnalyzeInput } from "../../../../scripts/core/types"
import { Card } from "@/components/ui/Card"

function JsonValue({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null) {
    return <span className="text-foreground-faint">null</span>
  }

  if (typeof value === "boolean") {
    return <span className="text-warning">{String(value)}</span>
  }

  if (typeof value === "number") {
    return <span className="text-warning">{value}</span>
  }

  if (typeof value === "string") {
    return <span className="text-success">&quot;{value}&quot;</span>
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-foreground-faint">[]</span>
    }
    return (
      <span>
        <span className="text-foreground-faint">[</span>
        {value.map((item, i) => (
          <div key={i} style={{ paddingLeft: 20 }}>
            <JsonValue value={item} depth={depth + 1} />
            {i < value.length - 1 && <span className="text-foreground-faint">,</span>}
          </div>
        ))}
        <span className="text-foreground-faint">]</span>
      </span>
    )
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return <span className="text-foreground-faint">{"{}"}</span>
    }
    return (
      <span>
        <span className="text-foreground-faint">{"{"}</span>
        {entries.map(([key, val], i) => (
          <div key={key} style={{ paddingLeft: 20 }}>
            <span className="text-accent-fg">&quot;{key}&quot;</span>
            <span className="text-foreground-faint">: </span>
            <JsonValue value={val} depth={depth + 1} />
            {i < entries.length - 1 && <span className="text-foreground-faint">,</span>}
          </div>
        ))}
        <span className="text-foreground-faint">{"}"}</span>
      </span>
    )
  }

  return <span>{String(value)}</span>
}

export function ReviewSection({ input }: { input: AnalyzeInput }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-semibold">Review</h2>
      <Card className="overflow-x-auto p-5 font-mono text-xs leading-relaxed">
        <JsonValue value={input} />
      </Card>
    </section>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to step 3 (Review) at `http://localhost:3001/create`. Confirm:
- JSON renders with colored syntax (keys in accent, strings in green, booleans/numbers in amber)
- Proper indentation for nested objects and arrays
- Card wraps the content with rounded border
- Horizontal scrollbar appears only if content overflows

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/create/ReviewSection.tsx
git commit -m "refactor: add syntax-highlighted JSON to review step"
```

---

### Task 4: Section Heading Consistency

**Files:**
- Modify: `src/app/(main)/create/SearchSection.tsx:46-47`

- [ ] **Step 1: Update SearchSection heading classes**

In `src/app/(main)/create/SearchSection.tsx`, change:

```tsx
<h2 className="mb-1 text-lg font-semibold">Add new search</h2>
<p className="mb-3 text-sm text-foreground-muted">Select web pages you want to analyze</p>
```

to:

```tsx
<h2 className="mb-1 text-base font-semibold">Add new search</h2>
<p className="mb-3 text-xs text-foreground-muted">Select web pages you want to analyze</p>
```

- [ ] **Step 2: Verify in browser**

Confirm heading sizes are consistent between "Add new search" and "Selected Sites" sections.

- [ ] **Step 3: Commit**

```bash
git add src/app/(main)/create/SearchSection.tsx
git commit -m "style: standardize section heading sizes on create page"
```

---

### Task 5: Final Visual Check

**Files:** None (verification only)

- [ ] **Step 1: Full walkthrough**

Open `http://localhost:3001/create` and walk through all three steps:

1. **Step 1 (Sites):** Tab underline active on "1. Sites". Search form and site cards render correctly. Add a site manually, confirm card appears. Remove it.
2. **Step 2 (Categories):** Click "2. Categories" tab. Built-in and custom categories render correctly (these were not changed but check for regressions).
3. **Step 3 (Review):** Click "3. Review" tab. Syntax-highlighted JSON renders with proper colors and indentation.
4. **Navigation:** Click between all three tabs freely. Back/forward buttons at bottom of each step still work.

- [ ] **Step 2: Check light mode**

Toggle the theme (sun/moon icon in header). Confirm:
- Tab underline uses theme accent color
- Site cards have visible borders
- JSON syntax colors are readable (accent-fg, success, warning tokens adapt to light mode)

- [ ] **Step 3: Final commit if any touch-ups needed**

If any spacing or color tweaks were needed during review, commit them:

```bash
git add -u
git commit -m "style: final polish tweaks for create page"
```
