# Walkthroughs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add driver.js-based guided walkthroughs to three pages (`/create`, `/analyses`, `/analyses/[requestId]/[siteId]`) with auto-start once per browser and a replay button.

**Architecture:** Shared `Walkthrough` client component + `WalkthroughButton` + `useWalkthrough` hook in `src/components/Walkthrough/`. Per-page tour definitions colocated with routes. Targets identified via `data-tour="<page>-<slot>"` attributes added to existing components. localStorage flag per tour gates auto-start. The final step of the site-report tour opens the chat drawer via custom DOM events.

**Tech Stack:** driver.js 1.x, React 19, Next.js 16, Tailwind 4.

**Spec:** `docs/superpowers/specs/2026-04-20-walkthroughs-design.md`.

---

## Task 1: Install driver.js

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install dependency**

Run: `npm install driver.js@1`

Expected: `driver.js` added under `dependencies` in `package.json`, lockfile updated.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add driver.js dependency"
```

---

## Task 2: Create Walkthrough core types

**Files:**
- Create: `src/components/Walkthrough/types.ts`

- [ ] **Step 1: Write types**

```ts
// src/components/Walkthrough/types.ts
export type Step = {
  /** CSS selector; typically `[data-tour="..."]` */
  target: string;
  title: string;
  body: string;
  /** Runs before the step is shown. May open drawers, wait for selectors, etc. */
  onBefore?: () => Promise<void> | void;
  /** Runs when leaving the step (both forward and backward). */
  onAfter?: () => void;
  /** If true, step is silently skipped when `target` is not in the DOM at start. */
  skipIfMissing?: boolean;
};

export type Tour = {
  /** Unique tour id. Used as localStorage key suffix. */
  id: string;
  steps: Step[];
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Walkthrough/types.ts
git commit -m "feat(walkthrough): add shared types"
```

---

## Task 3: Create `waitForSelector` utility

**Files:**
- Create: `src/components/Walkthrough/utils.ts`

- [ ] **Step 1: Implement utility**

```ts
// src/components/Walkthrough/utils.ts

/**
 * Polls the DOM for a selector. Resolves when found, rejects on timeout.
 * Used by tour steps that highlight elements added after a user action
 * (e.g., a drawer rendered only once a button is clicked).
 */
export function waitForSelector(
  selector: string,
  { timeout = 2000, interval = 50 }: { timeout?: number; interval?: number } = {},
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const found = document.querySelector(selector);
    if (found) return resolve(found);

    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        resolve(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error(`waitForSelector timeout: ${selector}`));
      }
    }, interval);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Walkthrough/utils.ts
git commit -m "feat(walkthrough): add waitForSelector utility"
```

---

## Task 4: Create `useWalkthrough` hook

**Files:**
- Create: `src/components/Walkthrough/useWalkthrough.ts`

- [ ] **Step 1: Implement hook**

```ts
// src/components/Walkthrough/useWalkthrough.ts
"use client";

import { useCallback } from "react";
import { driver, type Config, type DriveStep } from "driver.js";
import type { Tour } from "./types";

const SEEN_PREFIX = "walkthrough:";
const SEEN_SUFFIX = ":seen";

function seenKey(id: string) {
  return `${SEEN_PREFIX}${id}${SEEN_SUFFIX}`;
}

function readSeen(id: string): boolean {
  if (typeof window === "undefined") return true; // SSR: never auto-start
  try {
    return window.localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false; // storage unavailable → treat as unseen so tour still runs
  }
}

function markSeen(id: string) {
  try {
    window.localStorage.setItem(seenKey(id), "1");
  } catch {
    /* ignore */
  }
}

function clearSeen(id: string) {
  try {
    window.localStorage.removeItem(seenKey(id));
  } catch {
    /* ignore */
  }
}

/**
 * Returns helpers to run / replay / check-seen for a tour.
 * Callers decide when to invoke (auto-start on mount, or button click).
 */
export function useWalkthrough(tour: Tour) {
  const run = useCallback(() => {
    const steps: DriveStep[] = tour.steps.map((s) => ({
      element: s.target,
      popover: {
        title: s.title,
        description: s.body,
      },
      onHighlightStarted: s.onBefore
        ? async (_el, _step, opts) => {
            try {
              await s.onBefore!();
            } catch {
              // swallow — step will be skipped if target still absent
            }
            // re-highlight now that onBefore completed
            opts.driver.refresh();
          }
        : undefined,
      onDeselected: s.onAfter
        ? () => {
            try {
              s.onAfter!();
            } catch {
              /* ignore */
            }
          }
        : undefined,
    }));

    const config: Config = {
      showProgress: true,
      allowClose: true,
      popoverClass: "walkthrough-popover",
      stagePadding: 6,
      stageRadius: 8,
      steps,
      onDestroyed: () => markSeen(tour.id),
    };

    driver(config).drive();
  }, [tour]);

  const replay = useCallback(() => {
    clearSeen(tour.id);
    run();
  }, [tour, run]);

  const isSeen = useCallback(() => readSeen(tour.id), [tour]);

  return { run, replay, isSeen };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Walkthrough/useWalkthrough.ts
git commit -m "feat(walkthrough): add useWalkthrough hook"
```

---

## Task 5: Create `Walkthrough` mount component

**Files:**
- Create: `src/components/Walkthrough/Walkthrough.tsx`

- [ ] **Step 1: Implement component**

```tsx
// src/components/Walkthrough/Walkthrough.tsx
"use client";

import { useEffect, useRef } from "react";
import { useWalkthrough } from "./useWalkthrough";
import type { Tour } from "./types";

type Props = {
  tour: Tour;
  /** If true (default), auto-run tour once per browser on first mount. */
  autoStart?: boolean;
};

/**
 * Mounts a walkthrough on a page. Renders nothing.
 * Put one of these in each page.tsx that should show a tour.
 */
export function Walkthrough({ tour, autoStart = true }: Props) {
  const { run, isSeen } = useWalkthrough(tour);
  const started = useRef(false);

  useEffect(() => {
    if (!autoStart || started.current) return;
    if (isSeen()) return;
    started.current = true;
    // Defer one frame so client components that own `data-tour` targets have mounted.
    const id = window.setTimeout(() => run(), 50);
    return () => window.clearTimeout(id);
  }, [autoStart, isSeen, run]);

  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Walkthrough/Walkthrough.tsx
git commit -m "feat(walkthrough): add Walkthrough mount component"
```

---

## Task 6: Create `WalkthroughButton`

**Files:**
- Create: `src/components/Walkthrough/WalkthroughButton.tsx`

- [ ] **Step 1: Implement button**

```tsx
// src/components/Walkthrough/WalkthroughButton.tsx
"use client";

import { HelpCircle } from "lucide-react";
import { useWalkthrough } from "./useWalkthrough";
import type { Tour } from "./types";

type Props = {
  tour: Tour;
  className?: string;
};

export function WalkthroughButton({ tour, className }: Props) {
  const { replay } = useWalkthrough(tour);
  return (
    <button
      type="button"
      onClick={replay}
      aria-label="Replay walkthrough"
      title="Replay walkthrough"
      className={
        "inline-flex h-8 w-8 items-center justify-center rounded-full text-foreground-muted hover:bg-surface-alt hover:text-foreground " +
        (className ?? "")
      }
    >
      <HelpCircle className="h-5 w-5" />
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Walkthrough/WalkthroughButton.tsx
git commit -m "feat(walkthrough): add replay button"
```

---

## Task 7: Add Walkthrough barrel + dev helper

**Files:**
- Create: `src/components/Walkthrough/index.ts`

- [ ] **Step 1: Write barrel**

```ts
// src/components/Walkthrough/index.ts
export { Walkthrough } from "./Walkthrough";
export { WalkthroughButton } from "./WalkthroughButton";
export type { Tour, Step } from "./types";
export { waitForSelector } from "./utils";

// Dev-only helper: clears all walkthrough:* keys. Exposed on window.
if (
  typeof window !== "undefined" &&
  process.env.NODE_ENV !== "production"
) {
  (window as unknown as { __resetWalkthroughs?: () => void }).__resetWalkthroughs = () => {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith("walkthrough:")) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
    console.log(`[walkthrough] cleared ${keys.length} keys`);
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Walkthrough/index.ts
git commit -m "feat(walkthrough): add barrel + dev reset helper"
```

---

## Task 8: Import driver.js CSS + custom popover styles

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Add import + overrides**

Append to `src/app/globals.css`:

```css
/* Walkthrough (driver.js) */
@import "driver.js/dist/driver.css";

.walkthrough-popover {
  background-color: var(--surface);
  color: var(--foreground);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12);
  padding: 16px;
}

.walkthrough-popover .driver-popover-title {
  color: var(--foreground);
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 6px;
}

.walkthrough-popover .driver-popover-description {
  color: var(--foreground-secondary);
  font-size: 13px;
  line-height: 1.5;
}

.walkthrough-popover .driver-popover-footer {
  margin-top: 12px;
}

.walkthrough-popover .driver-popover-next-btn,
.walkthrough-popover .driver-popover-prev-btn,
.walkthrough-popover .driver-popover-close-btn {
  background-color: var(--accent);
  color: var(--foreground-on-accent);
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  text-shadow: none;
}

.walkthrough-popover .driver-popover-prev-btn {
  background-color: var(--surface-alt);
  color: var(--foreground-secondary);
}

.walkthrough-popover .driver-popover-progress-text {
  color: var(--foreground-muted);
  font-size: 11px;
}
```

- [ ] **Step 2: Run dev server to verify no CSS errors**

Run: `npm run dev`
Expected: server starts, no CSS compile errors in terminal. Stop server (Ctrl-C) after confirming.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(walkthrough): import driver.js css + custom popover style"
```

---

## Task 9: Add `data-tour` attrs to `/create` components

**Files:**
- Modify: `src/app/(main)/create/page.tsx`
- Modify: `src/app/(main)/create/SearchSection.tsx` (top-level wrapper)
- Modify: `src/app/(main)/create/SitesSection.tsx` (top-level wrapper)
- Modify: `src/app/(main)/create/CategoriesSection.tsx` (top-level wrapper)
- Modify: `src/app/(main)/create/ReviewSection.tsx` (top-level wrapper)

- [ ] **Step 1: Add attrs to sections**

For each of SearchSection, SitesSection, CategoriesSection, ReviewSection: add `data-tour="<slot>"` to the outermost returned element.

Slots:
- `SearchSection` → `data-tour="create-search"`
- `SitesSection` → `data-tour="create-sites"`
- `CategoriesSection` → `data-tour="create-categories"`
- `ReviewSection` → `data-tour="create-review"`

Example for `SitesSection.tsx` (adapt to each file's real outer element):

```tsx
<section data-tour="create-sites" className="…">
  {/* existing content */}
</section>
```

If a section's outer element is already a `div` / `section`, just add the attribute alongside existing props. Do not wrap in a new element.

- [ ] **Step 2: Add attr to the submit button**

In `src/app/(main)/create/ReviewSection.tsx`, locate the primary submit button (the one that starts the analysis) and add `data-tour="create-submit"` to it. If the submit lives in `page.tsx` instead, add it there.

Run: `npx grep -rn "Start" src/app/(main)/create/` (informational) to find the submit button text. Add the attribute to that button.

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`. Open http://localhost:3000/create. In devtools console, run:

```js
["create-search","create-sites","create-categories","create-review","create-submit"]
  .map(s => [s, !!document.querySelector(`[data-tour="${s}"]`)])
```

Expected: every slot except `create-categories` / `create-review` / `create-submit` is `true` on first load (those render only on their tabs — switch tabs to verify). Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/create/
git commit -m "feat(walkthrough): tag /create sections with data-tour attrs"
```

---

## Task 10: Create `/create` tour definition

**Files:**
- Create: `src/app/(main)/create/walkthrough.ts`

- [ ] **Step 1: Write tour**

```ts
// src/app/(main)/create/walkthrough.ts
import type { Tour } from "@/components/Walkthrough";

export const createTour: Tour = {
  id: "create",
  steps: [
    {
      target: '[data-tour="create-search"]',
      title: "Search",
      body: "Search and select websites to analyze.",
    },
    {
      target: '[data-tour="create-sites"]',
      title: "Your sites",
      body: "Pick which sites to analyze.",
      skipIfMissing: true,
    },
    {
      target: '[data-tour="create-categories"]',
      title: "Categories",
      body: "Define analysis categories with prompts.",
      skipIfMissing: true,
      onBefore: () => {
        // ensure the Categories tab is selected so target is in the DOM
        document
          .querySelector<HTMLElement>('[role="tab"][aria-selected="false"]:nth-of-type(2)')
          ?.click();
      },
    },
    {
      target: '[data-tour="create-review"]',
      title: "Review",
      body: "Review your setup before submitting.",
      skipIfMissing: true,
      onBefore: () => {
        document
          .querySelector<HTMLElement>('[role="tab"]:nth-of-type(3)')
          ?.click();
      },
    },
    {
      target: '[data-tour="create-submit"]',
      title: "Submit",
      body: "Start the analysis.",
      skipIfMissing: true,
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(main\)/create/walkthrough.ts
git commit -m "feat(walkthrough): add /create tour"
```

---

## Task 11: Mount Walkthrough + button on `/create`

**Files:**
- Modify: `src/app/(main)/create/page.tsx:127-140` (header block)

- [ ] **Step 1: Import**

At the top of `src/app/(main)/create/page.tsx`, add:

```tsx
import { Walkthrough, WalkthroughButton } from "@/components/Walkthrough";
import { createTour } from "./walkthrough";
```

- [ ] **Step 2: Mount**

Wrap the h1 with a flex row that includes the button, and add `<Walkthrough>` inside `<main>`:

Replace (current lines 128-140 approx):

```tsx
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Create Analysis</h1>
```

with:

```tsx
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Walkthrough tour={createTour} />
      <div className="mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Create Analysis</h1>
          <WalkthroughButton tour={createTour} />
        </div>
```

(close tags unchanged)

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`. Open http://localhost:3000/create in an incognito window. Expected: tour starts automatically within ~50ms, showing the Search step. Click through. Reopen `/create` — tour does NOT re-start. Click the `?` button — tour starts again. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/create/page.tsx
git commit -m "feat(walkthrough): mount /create tour"
```

---

## Task 12: Add `data-tour` attrs to `/analyses`

**Files:**
- Modify: `src/app/(main)/analyses/AnalysesTable.tsx:40` (table row), `:75-76` (outer div), `:82` (status th)

- [ ] **Step 1: Tag outer table wrapper**

In `src/app/(main)/analyses/AnalysesTable.tsx`, change:

```tsx
<div className="overflow-x-auto rounded-lg border border-border-default">
```

to:

```tsx
<div data-tour="analyses-table" className="overflow-x-auto rounded-lg border border-border-default">
```

- [ ] **Step 2: Tag status column header**

Change:

```tsx
<th className="px-4 py-3">Status</th>
```

to:

```tsx
<th data-tour="analyses-status" className="px-4 py-3">Status</th>
```

- [ ] **Step 3: Tag first data row**

In the `Row` component, add a prop `isFirst?: boolean` and apply `data-tour="analyses-row"` to the `<tr>` when true. Pass `isFirst={i === 0}` on the first row of whichever list renders first (completed; fallback pending if completed is empty):

```tsx
function Row({ req, isFirst }: { req: AnalysisRow; isFirst?: boolean }) {
  return (
    <tr
      {...(isFirst ? { "data-tour": "analyses-row" } : {})}
      className="hover:bg-surface-alt"
    >
      {/* unchanged */}
    </tr>
  );
}
```

In `AnalysesTable`, pass `isFirst` on the first item of the first list:

```tsx
const firstList = completed.length > 0 ? "completed" : "pending";
// ...
{completed.map((req, i) => (
  <Row key={req.id} req={req} isFirst={firstList === "completed" && i === 0} />
))}
// ...
{pending.map((req, i) => (
  <Row key={req.id} req={req} isFirst={firstList === "pending" && i === 0} />
))}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/analyses/AnalysesTable.tsx
git commit -m "feat(walkthrough): tag /analyses table with data-tour attrs"
```

---

## Task 13: Create `/analyses` tour

**Files:**
- Create: `src/app/(main)/analyses/walkthrough.ts`

- [ ] **Step 1: Write tour**

```ts
// src/app/(main)/analyses/walkthrough.ts
import type { Tour } from "@/components/Walkthrough";

export const analysesTour: Tour = {
  id: "analyses",
  steps: [
    {
      target: '[data-tour="analyses-table"]',
      title: "Your analyses",
      body: "Every analysis you've submitted shows up here.",
    },
    {
      target: '[data-tour="analyses-status"]',
      title: "Status",
      body: "Progress per site — pending, processing, complete, or rejected.",
    },
    {
      target: '[data-tour="analyses-row"]',
      title: "Open a report",
      body: "Click a row to open its full report.",
      skipIfMissing: true,
    },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(main\)/analyses/walkthrough.ts
git commit -m "feat(walkthrough): add /analyses tour"
```

---

## Task 14: Mount Walkthrough + button on `/analyses`

**Files:**
- Modify: `src/app/(main)/analyses/page.tsx`

- [ ] **Step 1: Import client boundary component**

`page.tsx` is a server component. `Walkthrough` and `WalkthroughButton` are client components. Direct import works in Next.js — they'll render as client components automatically.

Add at the top:

```tsx
import { Walkthrough, WalkthroughButton } from "@/components/Walkthrough";
import { analysesTour } from "./walkthrough";
```

- [ ] **Step 2: Mount in both render branches**

In the empty-state branch (lines 13-28), wrap the h1 like this:

```tsx
<main className="mx-auto max-w-6xl px-4 py-16">
  <Walkthrough tour={analysesTour} />
  <div className="flex items-center gap-2">
    <h1 className="text-3xl font-bold text-foreground">Past Analyses</h1>
    <WalkthroughButton tour={analysesTour} />
  </div>
  <p className="mt-4 text-foreground-secondary">
    {/* unchanged */}
  </p>
</main>
```

In the main branch (lines 31-51), replace:

```tsx
<div className="mt-2 mb-6 flex items-center justify-between">
  <h1 className="text-3xl font-bold text-foreground">Past Analyses</h1>
  <p className="text-sm text-foreground-muted">
    {requests.length} {requests.length === 1 ? "analysis" : "analyses"}
  </p>
</div>
```

with:

```tsx
<Walkthrough tour={analysesTour} />
<div className="mt-2 mb-6 flex items-center justify-between">
  <div className="flex items-center gap-2">
    <h1 className="text-3xl font-bold text-foreground">Past Analyses</h1>
    <WalkthroughButton tour={analysesTour} />
  </div>
  <p className="text-sm text-foreground-muted">
    {requests.length} {requests.length === 1 ? "analysis" : "analyses"}
  </p>
</div>
```

- [ ] **Step 3: Verify in browser**

Run: `npm run dev`. Open http://localhost:3000/analyses in incognito. Tour should auto-start, highlighting the table, then status header, then first row. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(main\)/analyses/page.tsx
git commit -m "feat(walkthrough): mount /analyses tour"
```

---

## Task 15: Add chat drawer open/close custom events

**Why a custom event instead of DOM clicks:** `ChatMenu` opens the drawer by setting React state inside a dropdown item click handler. Simulating the click chain (open dropdown → click item) is fragile and timing-dependent. A single `window` event is cleaner, adds ~6 lines, and doesn't leak walkthrough concepts elsewhere.

**Files:**
- Modify: `src/components/ScopeActions/components/ChatMenu.tsx`
- Modify: `src/components/ScopeActions/components/ChatDrawer.tsx`

- [ ] **Step 1: Add open listener to `ChatMenu`**

At the top of the `ChatMenu` function body (after `useState` declarations), add:

```tsx
import { useEffect } from "react";
// ... at top of ChatMenu component, after state:
useEffect(() => {
  function onOpen(e: Event) {
    const detail = (e as CustomEvent<{ scope: AnalysisContextScope }>).detail;
    if (JSON.stringify(detail.scope) !== JSON.stringify(scope)) return;
    setTiers({ report: true });
    setDrawerOpen(true);
  }
  window.addEventListener("walkthrough:open-chat", onOpen);
  return () => window.removeEventListener("walkthrough:open-chat", onOpen);
}, [scope]);
```

(`useEffect` import may already exist via `useState`; add to the existing import or add a new import line.)

- [ ] **Step 2: Add close listener to `ChatDrawer`**

In `ChatDrawer.tsx`, after the existing `useEffect` calls, add:

```tsx
useEffect(() => {
  function onClose() {
    onOpenChange(false);
  }
  window.addEventListener("walkthrough:close-chat", onClose);
  return () => window.removeEventListener("walkthrough:close-chat", onClose);
}, [onOpenChange]);
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ScopeActions/components/ChatMenu.tsx src/components/ScopeActions/components/ChatDrawer.tsx
git commit -m "feat(walkthrough): add chat open/close custom events"
```

---

## Task 16: Add `data-tour` attrs to site-report components

**Files:**
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/SitesSidebar.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/CategoryBlock.tsx`
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/PageNav.tsx`
- Modify: `src/components/ScopeActions/components/ChatDrawer.tsx`

- [ ] **Step 1: Tag sidebar**

In `SitesSidebar.tsx`, add `data-tour="site-sidebar"` to the outermost `<aside>` or `<nav>` element returned. Also add `data-tour="site-request-actions"` to the div wrapping the `ScopeActions` at line ~168:

```tsx
<div data-tour="site-request-actions" className="border-t border-border-default px-3 py-3 space-y-2">
  <ScopeActions scope={{ kind: "request", requestId }} orientation="vertical" />
  {/* existing Settings link */}
</div>
```

- [ ] **Step 2: Tag CategoryBlock**

In `CategoryBlock.tsx`, the outer element already has an id. Add `data-tour="site-category"` to it (line ~201). Then wrap the `ScopeActions` call (line ~220) with a div:

```tsx
<div data-tour="site-category-actions">
  <ScopeActions
    scope={{
      kind: "category",
      requestId: props.requestId,
      siteId: props.siteId,
      categoryId: props.categoryId,
    }}
  />
</div>
```

Only the **first** CategoryBlock on the page should get `data-tour="site-category"` and `data-tour="site-category-actions"` — multiple identical selectors would confuse driver.js. Add a `tourAnchor?: boolean` prop to `CategoryBlock` and apply the attributes conditionally:

```tsx
// in CategoryBlock props type:
tourAnchor?: boolean;

// on the outer <div>:
{...(props.tourAnchor ? { "data-tour": "site-category" } : {})}

// on the ScopeActions wrapper:
<div {...(props.tourAnchor ? { "data-tour": "site-category-actions" } : {})}>
  <ScopeActions … />
</div>
```

Then in `page.tsx`, pass `tourAnchor` on the first rendered category only (see Task 17).

- [ ] **Step 3: Tag PageNav**

In `PageNav.tsx`, wrap the `ScopeActions` at line ~101:

```tsx
<div data-tour="site-page-actions" className="mt-2 border-t border-border-default px-2 py-2">
  <ScopeActions scope={{ kind: "site", requestId, siteId }} orientation="vertical" />
</div>
```

(move existing `mt-2 border-t border-border-default px-2 py-2` wrapper's classes into the new div, remove the original wrapper).

- [ ] **Step 4: Tag ChatDrawer**

In `ChatDrawer.tsx`, find the `<SheetContent>` element returned when `open` is true. Add `data-tour="site-chat-drawer"` to it:

```tsx
<SheetContent data-tour="site-chat-drawer" …>
```

- [ ] **Step 5: Commit**

```bash
git add src/app/\(report\)/ src/components/ScopeActions/components/ChatDrawer.tsx
git commit -m "feat(walkthrough): tag site-report components with data-tour attrs"
```

---

## Task 17: Update `page.tsx` to pass `tourAnchor` to first CategoryBlock

**Files:**
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/page.tsx:233-268` (`renderCategory`)

- [ ] **Step 1: Track first rendered category**

Refactor `renderCategory` to accept a `tourAnchor` flag, and determine which category is first based on the same order used for rendering (home first, else first of otherCategories, else contact):

```tsx
// page.tsx — replace renderCategory signature
function renderCategory(
  cat: (typeof result.request.categories)[number],
  tourAnchor = false,
) {
  // ... unchanged body ...
  return (
    <CategoryBlock
      key={cat.id}
      requestId={requestId}
      siteId={siteId}
      categoryId={cat.id}
      categoryName={cat.name}
      extraInfo={cat.extraInfo}
      classifiedUrls={classifiedUrls}
      contentPages={contentPages}
      extractedRecords={extractedRecords}
      queries={categoryQueries}
      tech={tech}
      lighthouse={lighthouse}
      progress={progress}
      tourAnchor={tourAnchor}
    />
  );
}
```

Then pass `true` only on the first rendered category — the first one in `orderedCategories`:

```tsx
// replace the three render sites:
{homeCategory && (
  <>
    <SectionDivider />
    {renderCategory(homeCategory, orderedCategories[0] === homeCategory)}
  </>
)}

{otherCategories.map((cat) => (
  <div key={cat.id}>
    <SectionDivider />
    {renderCategory(cat, orderedCategories[0] === cat)}
  </div>
))}

{contactCategory && (
  <>
    <SectionDivider />
    {renderCategory(contactCategory, orderedCategories[0] === contactCategory)}
  </>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(report\)/analyses/\[requestId\]/\[siteId\]/page.tsx
git commit -m "feat(walkthrough): mark first CategoryBlock as tour anchor"
```

---

## Task 18: Create site-report tour

**Files:**
- Create: `src/app/(report)/analyses/[requestId]/[siteId]/walkthrough.ts`

- [ ] **Step 1: Write tour**

```ts
// src/app/(report)/analyses/[requestId]/[siteId]/walkthrough.ts
import type { Tour } from "@/components/Walkthrough";
import { waitForSelector } from "@/components/Walkthrough";
import type { AnalysisContextScope } from "../../../../../../scripts/analysis-context/types";

export function makeSiteTour(scope: {
  requestId: string;
  siteId: string;
}): Tour {
  const requestScope: AnalysisContextScope = {
    kind: "request",
    requestId: scope.requestId,
  };

  return {
    id: "site-report",
    steps: [
      {
        target: '[data-tour="site-sidebar"]',
        title: "Sites",
        body:
          "Switch between sites in this analysis. Each site was fetched and analyzed independently using the same categories, so you can compare how different sites handle the same topics.",
      },
      {
        target: '[data-tour="site-category"]',
        title: "Categories",
        body:
          "Data is grouped by category (home, navigation, tech, assessments, etc.). Each category aggregates findings across all crawled pages for this site, giving you one consolidated view per topic instead of page-by-page noise.",
        skipIfMissing: true,
      },
      {
        target: '[data-tour="site-category-actions"]',
        title: "Category scope",
        body:
          "Category chat analyzes all the data across sites for this category. Copy exports the same data as structured context.",
        skipIfMissing: true,
      },
      {
        target: '[data-tour="site-page-actions"]',
        title: "Website scope",
        body:
          "Website chat is about this entire site — all pages, all categories. Copy exports the site's data.",
      },
      {
        target: '[data-tour="site-request-actions"]',
        title: "Analysis scope",
        body:
          "Analysis chat uses data for all pages across all sites in this analysis. Copy exports the full analysis.",
      },
      {
        target: '[data-tour="site-chat-drawer"]',
        title: "Scoped chat",
        body:
          "Answers are grounded strictly in the scope you picked — no leakage across unrelated data.",
        onBefore: async () => {
          window.dispatchEvent(
            new CustomEvent("walkthrough:open-chat", {
              detail: { scope: requestScope },
            }),
          );
          await waitForSelector('[data-tour="site-chat-drawer"]', { timeout: 2500 });
        },
        onAfter: () => {
          window.dispatchEvent(new CustomEvent("walkthrough:close-chat"));
        },
      },
    ],
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/\(report\)/analyses/\[requestId\]/\[siteId\]/walkthrough.ts
git commit -m "feat(walkthrough): add site-report tour"
```

---

## Task 19: Mount site-report tour

**Files:**
- Modify: `src/app/(report)/analyses/[requestId]/[siteId]/page.tsx` (header + import)

- [ ] **Step 1: Import**

Add at the top:

```tsx
import { Walkthrough, WalkthroughButton } from "@/components/Walkthrough";
import { makeSiteTour } from "./walkthrough";
```

- [ ] **Step 2: Build tour + mount**

Inside the default export, after `const siteName = …`, add:

```tsx
const siteTour = makeSiteTour({ requestId, siteId });
```

In the return JSX, update the header (lines ~281-298):

```tsx
<div className="mb-6">
  <Walkthrough tour={siteTour} />
  <div className="flex items-center gap-2">
    <h1 className="text-3xl font-bold text-foreground">{siteName}</h1>
    <WalkthroughButton tour={siteTour} />
  </div>
  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
    {/* unchanged */}
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(report\)/analyses/\[requestId\]/\[siteId\]/page.tsx
git commit -m "feat(walkthrough): mount site-report tour"
```

---

## Task 20: Manual verification

**Files:** none (verification only)

- [ ] **Step 1: Full walkthrough in incognito**

Run: `npm run dev`.

Verify each page in a **fresh incognito window** (no localStorage):

1. http://localhost:3000/create — tour auto-starts, all 5 steps highlight correctly, finish sets localStorage, reopen → no auto-restart, click `?` → replays.
2. http://localhost:3000/analyses — same flow, 3 steps.
3. http://localhost:3000/analyses/<any-req>/<any-site> (pick one with data) — 6 steps, last step opens the chat drawer, clicking "Done" closes drawer.

- [ ] **Step 2: Dev reset helper**

Open devtools console, run: `__resetWalkthroughs()`. Expected: logs "cleared N keys". Reopen each page → tours auto-start again.

- [ ] **Step 3: Production build check**

Run: `npm run build`
Expected: build succeeds. No type errors.

- [ ] **Step 4: Stop dev server, final commit if needed**

If any fixes were needed during verification, commit them. Otherwise, nothing to do.

---

## Self-Review Notes

- **Spec coverage:**
  - driver.js library choice → Task 1, 4 ✓
  - Module layout → Tasks 2-7 ✓
  - `Walkthrough` / `WalkthroughButton` API → Tasks 5, 6 ✓
  - `Step` / `Tour` types → Task 2 ✓
  - Auto-start + seen-flag → Task 4, 5 ✓
  - `data-tour` convention → Tasks 9, 12, 16 ✓
  - Per-page tour copy → Tasks 10, 13, 18 ✓
  - Async step (chat drawer) → Tasks 15, 18 ✓
  - localStorage persistence + replay → Task 4 ✓
  - Dev helper → Task 7 ✓
  - Styling via `.walkthrough-popover` → Task 8 ✓
  - Missing-target handling (`skipIfMissing`) → Task 2, multiple tours ✓

- **Placeholder scan:** none.

- **Type consistency:** `Tour`, `Step`, `scope` types consistent across tasks. Custom event name `walkthrough:open-chat` / `walkthrough:close-chat` used identically in Tasks 15 and 18.

- **Out of scope (confirmed):** no automated tests, no analytics, no server persistence.
