# Create Page UI Polish

**Date:** 2026-04-13
**Scope:** Visual polish pass on `/create` wizard — step indicator, sites section, empty state, review step, and general spacing.

## Changes

### 1. Step Indicator → Underline Tabs

**File:** `src/app/(main)/create/page.tsx` (lines 137–161)

Replace the pill-button stepper with a horizontal tab bar using bottom-border active state.

- Container: `flex` row with `border-b-2 border-border-default`
- Each tab: `px-5 py-2.5 text-sm font-medium` button
- Active tab: `text-foreground border-b-2 border-accent -mb-[2px]` with step number colored `text-accent-fg`
- Inactive tab: `text-foreground-faint hover:text-foreground-secondary`
- Remove the `→` arrow spans between steps
- Keep all three tabs clickable (existing `setStep` handlers)

### 2. Selected Sites → Card List

**File:** `src/app/(main)/create/SitesSection.tsx`

Replace the `<table>` with a vertical stack of site cards.

**Site card structure:**
```
[Globe icon 36x36] | [Name badge (editable input)] | [× remove]
                    | URL (text-accent-fg, text-xs)
                    | Snippet (text-foreground-faint, text-xs)
```

- Outer: `flex items-center gap-3 p-3 bg-surface-alt/50 border border-border-subtle rounded-xl`
- Globe icon: `w-9 h-9 rounded-lg bg-accent-subtle flex items-center justify-center text-accent-fg` — use a Lucide `Globe` icon
- Name: render the existing `Input` for `site.meta.name` inline in the card, styled compact
- URL + snippet below the name
- Remove button: existing ghost `×`, positioned at card end
- Cards stack with `space-y-2`

**Add-URL row:**
- `flex items-center gap-3 p-3 border border-dashed border-border-subtle rounded-xl`
- "+" icon placeholder on the left (same 36×36 slot, muted)
- Input takes `flex-1`, same placeholder text
- "Add +" button at the right
- Below the card: `text-xs text-foreground-faint mt-1` hint: "Or search above and select from results"

### 3. Empty State (No Sites)

When `entries.length === 0`, show only:
- Section heading "Selected Sites"
- The dashed add-URL card (same as above)
- The hint text

No illustration, no centered empty message.

### 4. Review Step → Syntax-Highlighted JSON

**File:** `src/app/(main)/create/ReviewSection.tsx`

Replace the raw `<pre>` with a syntax-highlighted JSON viewer.

- Build a simple `JsonView` component inline (no new dependency)
- Recursively render JSON with colored spans using theme-aware colors:
  - Keys: `text-accent-fg`
  - Strings: `text-success`
  - Numbers/Booleans: `text-warning`
  - Null: `text-foreground-faint`
  - Punctuation (braces, brackets, commas, colons): `text-foreground-faint`
- Wrap in a `Card` with `font-mono text-xs leading-relaxed p-5`
- Indentation via `pl-5` per nesting level
- No collapsible sections — the payload is small enough

### 5. General Spacing & Consistency

**File:** `src/app/(main)/create/page.tsx`

- Page header: reduce `mb-6` to `mb-4` on the header wrapper
- Name input: `mt-2` instead of `mt-3`, keep `w-80`
- Tab bar: `mt-5 mb-6` (was `mb-6` with no top margin)
- Section headings throughout: standardize to `text-base font-semibold mb-1` for title + `text-xs text-foreground-muted mb-3` for description

## Files Modified

1. `src/app/(main)/create/page.tsx` — tab indicator, spacing
2. `src/app/(main)/create/SitesSection.tsx` — table → card list
3. `src/app/(main)/create/ReviewSection.tsx` — JSON syntax highlighting

## Not Changed

- `SearchSection.tsx` — search form and SERP carousel unchanged
- `CategoriesSection.tsx` — category cards and modal unchanged
- `SerpCard.tsx` — search result cards unchanged
- No new UI components created (JsonView is local to ReviewSection)
- No new dependencies — `lucide-react` is already installed via shadcn
