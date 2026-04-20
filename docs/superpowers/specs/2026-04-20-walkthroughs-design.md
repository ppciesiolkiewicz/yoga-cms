# Walkthroughs — Design

## Summary

Add guided walkthroughs (product tours) to three pages:

- `/create` — how to submit a new analysis
- `/analyses` — how to read the list of submitted analyses
- `/analyses/[requestId]/[siteId]` — how data is categorized and how chat/copy scope actions work on the site report

Each tour auto-runs once per browser on first visit and is always replayable via a `?` icon button.

## Library choice

[driver.js](https://driverjs.com/) — ~5kb, framework-agnostic, CSS-selector targeting, imperative API. Chosen over Shepherd.js (heavier, opinionated styling), @reactour/tour (React-coupled), and a custom implementation (reinventing).

## Module layout

```
src/components/Walkthrough/
  index.ts
  Walkthrough.tsx         # client component; mounts driver.js, handles auto-start
  WalkthroughButton.tsx   # "?" icon button that replays the tour
  useWalkthrough.ts       # seen-flag read/write + start/reset helpers
  utils.ts                # waitForSelector helper for async steps
  types.ts                # Step, Tour types
```

Per-page tour definitions colocated with the route:

```
src/app/(main)/create/walkthrough.ts
src/app/(main)/analyses/walkthrough.ts
src/app/(report)/analyses/[requestId]/[siteId]/walkthrough.ts
```

Each file exports a `Tour` object: `{ id: string; steps: Step[] }`.

## Public API

```tsx
// rendered inside each page.tsx
<Walkthrough tour={createTour} autoStart />

// rendered in the page header (or near page title)
<WalkthroughButton tour={createTour} />
```

```ts
// types.ts
export type Step = {
  target: string; // CSS selector, usually [data-tour="..."]
  title: string;
  body: string;
  onBefore?: () => Promise<void> | void;
  onAfter?: () => void;
  skipIfMissing?: boolean; // skip the step when target not found
};

export type Tour = {
  id: string; // used as localStorage key suffix
  steps: Step[];
};
```

### Behavior

- `Walkthrough` is a client component. On mount:
  - If `autoStart` and `localStorage['walkthrough:<id>:seen']` is absent → start tour.
  - On driver.js `onDestroyed` (finish or skip) → set the seen flag.
- `WalkthroughButton` on click → clears the seen flag and starts the tour. Always works, regardless of prior state.

## Target convention

Existing components receive `data-tour="<page>-<slot>"` attributes. No new CSS hooks, no coupling to class names.

### `/create`

| Slot                | Copy (title → body)                                     |
| ------------------- | ------------------------------------------------------- |
| `create-search`     | Search — "Search and select websites to analyze."       |
| `create-sites`      | Sites — "Pick which sites to analyze."                  |
| `create-categories` | Categories — "Define analysis categories with prompts." |
| `create-review`     | Review — "Review your setup before submitting."         |
| `create-submit`     | Submit — "Start the analysis."                          |

### `/analyses`

| Slot              | Copy                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `analyses-table`  | Your analyses — "Every analysis you've submitted shows up here." |
| `analyses-status` | Status — "Progress per site."                                    |
| `analyses-row`    | Open a report — "Click a row to open its full report."           |

### `/analyses/[requestId]/[siteId]`

| Slot                    | Copy                                                                                                                                                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `site-sidebar`          | Sites — "Switch between sites in this analysis. Each site was fetched and analyzed independently using the same categories, so you can compare how different sites handle the same topics."                                                 |
| `site-category`         | Categories — "Data is grouped by category (home, navigation, tech, assessments, etc.). Each category aggregates findings across all crawled pages for this site, giving you one consolidated view per topic instead of page-by-page noise." |
| `site-category-actions` | Category scope — "Category chat analyzes all the data across sites for this category. Copy exports the same data as structured context."                                                                                                    |
| `site-page-actions`     | Website scope — "Website chat is about this entire site — all pages, all categories. Copy exports the site's data."                                                                                                                         |
| `site-request-actions`  | Analysis scope — "Analysis chat uses data for all pages across all sites in this analysis. Copy exports the full analysis."                                                                                                                 |
| `site-chat-drawer`      | Scoped chat — "Answers are grounded strictly in the scope you picked — no leakage across unrelated data."                                                                                                                                   |

## Async / conditional steps

The site-report tour's final step highlights the chat drawer, which is not mounted until the user clicks the Chat button. The step definition uses `onBefore` to force the drawer open and wait for the selector, and `onAfter` to close it again on step exit:

```ts
{
  target: '[data-tour="site-chat-drawer"]',
  title: 'Scoped chat',
  body: '…',
  onBefore: async () => {
    // open chat from the analysis (request) scope, which the prior step just highlighted
    document
      .querySelector<HTMLElement>('[data-tour="site-request-actions"] [data-chat-trigger]')
      ?.click();
    await waitForSelector('[data-tour="site-chat-drawer"]', { timeout: 2000 });
  },
  onAfter: () => {
    // close drawer on step leave, regardless of direction
    document
      .querySelector<HTMLElement>('[data-tour="site-chat-drawer"] [data-tour-close]')
      ?.click();
  },
}
```

`waitForSelector(selector, { timeout })` lives in `utils.ts` — polls `document.querySelector` and resolves when found, rejects on timeout. If it rejects, the step is skipped (same behavior as `skipIfMissing`).

## Persistence

- Storage: `window.localStorage`, one key per tour: `walkthrough:<tourId>:seen = "1"`.
- Written on finish OR skip; cleared by `WalkthroughButton` replay.
- Scope: per browser, per user. No server-side persistence.
- Dev helper: `window.__resetWalkthroughs()` — clears all `walkthrough:*` keys. Only exposed when `process.env.NODE_ENV !== 'production'`.

## Styling

- Import driver.js default CSS once in `src/app/globals.css`.
- Override via driver config: `popoverClass: 'walkthrough-popover'`.
- `.walkthrough-popover` in `globals.css` matches shadcn Card tokens — `bg-card`, `text-card-foreground`, `border`, `rounded-md`, `shadow-md` equivalents. Dark mode via existing `.dark` root selector.
- Highlight ring: tune driver's `stagePadding` and `stageRadius` to match Card radius (`8px`).

## Error handling

- Missing target + `skipIfMissing: true` → step silently skipped.
- Missing target otherwise → warn in console (dev only), skip step.
- `waitForSelector` timeout → treated as missing target; step skipped.
- localStorage unavailable (e.g., private mode quirks) → tour always runs; button still works.

## Out of scope

- No automated tests (manual verification only — documented in PR description).
- No server-side persistence / user account tie-in.
- No multi-tour orchestration (each tour is independent).
- No analytics events (can be added later as an `onStepChange` hook if needed).
