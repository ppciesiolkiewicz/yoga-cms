# SERP Discovery Page

## Goal

Single-page UI at `/create` that lets users search Google via Serper.dev, select websites from results, define analysis categories, and produce an `AnalyzeInput` JSON ready for the pipeline.

## Flow

```
[ Search bar ]
   |
   v
[ Horizontal carousel of search result cards ] -- user checks URLs per query
   |
   v
[ Selected sites list ] -- editable meta (name, city)
   |
   v
[ Categories ] -- home + contact predefined; add custom; wappalyzer/lighthouse toggles
   |
   v
[ Review ] -- rendered AnalyzeInput JSON
```

All four sections on one page. State local to the page component (`useState`).

---

## 1. API: `POST /api/serp`

**Route:** `src/app/api/serp/route.ts`

**Request:**
```json
{ "query": "yoga studios rishikesh", "page": 1 }
```

**Behavior:** Forward to `https://google.serper.dev/search` with `SERPER_API_KEY` from env. Return the raw Serper response with no transformation.

**Response:** Raw Serper JSON. Includes `organic`, `peopleAlsoAsk`, `relatedSearches`, `knowledgeGraph`, `topStories`, `images`, etc. — whatever Serper returns for the query.

**Error handling:** Return Serper error status/body as-is. 401 if no API key configured.

**Env:** `SERPER_API_KEY` in `.env.local`.

---

## 2. Page: `/create`

**Route:** `src/app/create/page.tsx` (single client component)

### 2.1 Search & Select Section

- Text input + "Search" button
- On submit: `POST /api/serp` with query
- Each completed search becomes a **card** in a **horizontal carousel**
  - Left/right arrow buttons to navigate between search cards
  - Each card header shows the query string
  - Card body renders all Serper response data:
    - **Organic results:** title, displayed URL, snippet — each with a checkbox for selection
    - **Knowledge graph:** rendered if present (title, description, image, attributes)
    - **People also ask:** collapsible list of questions + answers
    - **Related searches:** clickable chips (clicking runs that search)
    - **Top stories, images:** rendered if present
  - Visual style mirrors Google's layout — clean, readable, familiar
- Carousel component: `src/components/ui/Carousel.tsx`

### 2.2 Selected Sites Section

- Shows all checked URLs across all queries, deduplicated by URL
- Each entry: URL, title (from Serper), editable `name` and `city` fields (maps to `sites[].meta`)
- Remove button per site

### 2.3 Categories Section

- Pre-populated with two non-removable categories:
  - **home** — `name: "home"`, empty `extraInfo` and `prompt`
  - **contact** — `name: "contact"`, empty `extraInfo` and `prompt`
- "Add category" button to add custom categories
- Per category form fields: `name`, `extraInfo` (text input), `prompt` (textarea)
- Checkboxes per category: `wappalyzer`, `lighthouse`
- Remove button on custom categories (not on home/contact)

### 2.4 Review Section

- Generates `AnalyzeInput` JSON from current state:
  ```typescript
  {
    displayName: string,         // editable text field
    categories: CategoryInput[], // from section 2.3
    sites: SiteInput[]           // from section 2.2, { url, meta: { name, city } }
  }
  ```
- Rendered as formatted JSON on screen
- Matches exact shape of `data/inputs/yoga.json` and `AnalyzeInput` from `scripts/core/types.ts`

---

## 3. UI Components

All atoms in `src/components/ui/` with barrel export from `src/components/ui/index.ts`.

### New components needed:

| Component | File | Purpose | Radix? |
|-----------|------|---------|--------|
| Carousel | `Carousel.tsx` | Horizontal card carousel with arrow navigation | No (simple scroll + buttons) |
| Checkbox | `Checkbox.tsx` | Labeled checkbox | `@radix-ui/react-checkbox` |
| Input | `Input.tsx` | Styled text input | No |
| Textarea | `Textarea.tsx` | Styled textarea | No |
| Button | `Button.tsx` | Styled button with variants | No |
| Card | `Card.tsx` | Container with border/shadow | No |
| Chip | `Chip.tsx` | Small tag/pill (for related searches) | No |
| Collapsible | `Collapsible.tsx` | Expand/collapse (for People Also Ask) | `@radix-ui/react-collapsible` |

### Existing components (stay in `src/components/ui.tsx` or migrate):

Existing `ScoreBadge`, `StatusBadge`, `Tooltip`, `Accordion` in `ui.tsx` are used by browse-data pages. Migration to the `ui/` directory is out of scope for this spec — can be done later.

---

## 4. State Shape

All state local to the page component:

```typescript
interface SearchResult {
  query: string
  response: SerperResponse  // raw Serper JSON, typed loosely
}

interface SelectedSite {
  url: string
  title: string
  snippet: string
  meta: { name: string; city: string }
}

interface CategoryDraft {
  id: string              // crypto.randomUUID()
  name: string
  extraInfo: string
  prompt: string
  wappalyzer: boolean
  lighthouse: boolean
  removable: boolean      // false for home/contact
}

// Page state:
// searches: SearchResult[]
// selectedSites: Map<string, SelectedSite>  (keyed by URL)
// categories: CategoryDraft[]
// displayName: string
```

---

## 5. Output

The review section builds an `AnalyzeInput`:

```typescript
const input: AnalyzeInput = {
  displayName,
  categories: categories.map(c => ({
    name: c.name,
    extraInfo: c.extraInfo,
    prompt: c.prompt,
    ...(c.lighthouse && { lighthouse: true }),
    ...(c.wappalyzer && { wappalyzer: true }),
  })),
  sites: [...selectedSites.values()].map(s => ({
    url: s.url,
    meta: { name: s.meta.name, city: s.meta.city },
  })),
}
```

Displayed as formatted JSON. No "run" button in this MVP — output is shown for copy/use.

---

## 6. Dependencies

- `@radix-ui/react-checkbox` — checkbox primitive
- `@radix-ui/react-collapsible` — collapsible primitive
- No other new dependencies. Serper API is plain `fetch`.

---

## 7. Out of Scope

- Running the pipeline from the UI (future work)
- Persisting drafts / saving to DB
- Auth / rate limiting on the SERP endpoint
- Migrating existing `ui.tsx` components to `ui/` directory
- Pagination of Serper results (can add `page` param later)
