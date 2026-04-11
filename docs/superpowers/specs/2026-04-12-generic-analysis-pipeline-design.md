# Generic Analysis Pipeline — Design

**Date:** 2026-04-12
**Status:** Draft
**Scope:** Replace the yoga-specific scraper/analyzer with a configurable multi-vertical site analysis pipeline, backed by a file-based DB wrapper and a data-driven browse UI.

## Goals

1. Remove all yoga-specific linguistics from code, types, and runtime data model.
2. Drive the pipeline from a declarative input (`AnalyzeInput`) — categories, sites, optional prompts — no hardcoded verticals.
3. Introduce a DB wrapper (`repo`) over files so callers never touch `fs`. Enables later migration to a real DB.
4. Add a server-friendly entrypoint: `runAnalysis(input, opts)` as a pure function over the repo.
5. Make the browse-data UI data-driven: one generic per-category block rendering any vertical.

## Non-goals

- Migration of existing yoga *output* data (raw/, analysis/, reports/). Those are deleted; the new pipeline will regenerate them on demand.
- HTTP API, queue, or worker loop. Function-first; wire to Next.js API routes later if needed.
- Backwards compatibility with old CLI flags, old file layout, or old types.
- Rewriting prompt content. Existing yoga-worded prompts move into code-level BASE templates parameterized by category.

The old yoga *studio list* (from `scripts/scraper/websites-data.ts`) is preserved as a sample input file in the new format — see Rollout step 2.

## Core concepts

### Request
The unit of work. Created from an `AnalyzeInput`, assigned an ID, persisted, and referenced by every downstream artifact.

```ts
interface AnalyzeInput {
  displayName?: string
  categories: CategoryInput[]
  sites: SiteInput[]
}

interface CategoryInput {
  name: string           // free-form label: "drop in", "training", "menu"
  extraInfo: string      // guidance for the classifier (haiku) stage
  prompt: string         // full prompt used by content + extract stages
}

interface SiteInput {
  url: string
  meta?: Record<string, unknown>
}

interface Request {
  id: string
  createdAt: string
  displayName?: string
  categories: Category[]   // with assigned ids
  sites: Site[]            // with assigned ids
}

interface Category extends CategoryInput { id: string }
interface Site extends SiteInput { id: string }

interface RequestIndexEntry {
  id: string
  displayName?: string
  createdAt: string
  siteCount: number
  categoryCount: number
}

type StageName =
  | "fetch-home" | "extract-nav" | "classify" | "fetch-pages"
  | "tech" | "lighthouse" | "content" | "extract" | "report"
```

Per-request isolation: categories, prompts, and sites all belong to one request. No cross-request reuse. Re-running is a new request, not a mutation.

### Artifact
Every output of every stage is an artifact: a file on disk at a deterministic path. No record/file split.

```ts
interface ArtifactRef {
  requestId: string
  siteId?: string
  stage: string
  name: string   // "home.html", "classify.json", "content.json", etc.
}
```

The file extension encodes the format (`.json`, `.html`, `.md`, `.txt`). Repo knows how to serialize/deserialize.

### BASE_PROMPT
A single code-level constant template with `{categoryName}` + `{extraInfo}` slots, exposed as a utility `generatePrompt(name, extraInfo): Promise<string>` from `core/base-prompt.ts`. The pipeline **does not** call this automatically. Callers who want auto-generation run it themselves before building an `AnalyzeInput`. This keeps `runAnalysis` free of hidden Claude calls and guarantees every category on a saved request has a stable, caller-controlled prompt.

## Storage layer

### Layout

```
data/db/
  index.json                        # list of all requests
  requests/
    <requestId>/
      request.json                  # full Request record (prompts live inside)
      sites/
        <siteId>/
          fetch/
            home.html
            home.md
            nav-links.json
            pages.json
            pages/<pageId>.md
          classify/
            classify.json           # categoryId → [url, url, ...]
          analyze/
            tech.json
            lighthouse.json
            content.json
            extract.json
          report.json               # per-site summary
      result.json                   # consolidated, read by UI
```

### Repo API

```ts
class Repo {
  // requests
  createRequest(input: AnalyzeInput): Promise<Request>
  getRequest(id: string): Promise<Request>
  listRequests(): Promise<RequestIndexEntry[]>

  // artifacts
  putArtifact(ref: ArtifactRef, content: string | Buffer): Promise<void>
  getArtifact(ref: ArtifactRef): Promise<Buffer>
  putJson<T>(ref: ArtifactRef, obj: T): Promise<void>
  getJson<T>(ref: ArtifactRef): Promise<T>
  artifactExists(ref: ArtifactRef): Promise<boolean>
  listArtifacts(filter: Partial<ArtifactRef>): Promise<ArtifactRef[]>

  // consolidation
  consolidateRequest(id: string): Promise<void>   // writes result.json
}
```

The repo is the only thing in the codebase that touches `fs`. Everything else goes through it. This is the abstraction boundary that isolates future migration work (to SQLite, Supabase, GCP Cloud SQL, etc.).

Chosen approach: hand-rolled JSON wrapper, no external deps. Migration to a real DB later is accepted to be a larger rewrite of the repo internals; the API stays stable.

## Pipeline

### Stages

```
fetch-home     → home.html, home.md
extract-nav    → nav-links.json              (cheerio/playwright on home.html)
classify       → classify.json                (haiku, uses request.categories)
fetch-pages    → pages/<pageId>.md            (only categories matched)
tech           → tech.json                    (wappalyzer on home.html)
lighthouse     → lighthouse.json              (PageSpeed Insights)
content        → content.json                 (sonnet, per-category prompt)
extract        → extract.json                 (sonnet, per-category prompt)
report         → report.json                  (per-site aggregation)
```

### Orchestration

```ts
async function runAnalysis(
  input: AnalyzeInput,
  opts: RunOptions = {},
): Promise<string> {
  const request = await repo.createRequest(input)

  for (const site of request.sites) {       // opts.concurrency controls parallelism
    try {
      await fetchHome(repo, request, site)
      await extractNav(repo, request, site)
      await classify(repo, request, site)   // uses haiku
      await fetchPages(repo, request, site)

      await Promise.all([
        techDetect(repo, request, site),
        lighthouse(repo, request, site),
        contentAssess(repo, request, site), // uses per-category prompt
        dataExtract(repo, request, site),   // uses per-category prompt
      ])

      await buildSiteReport(repo, request, site)
    } catch (err) {
      // per-site error logged; other sites continue
    }
  }

  await repo.consolidateRequest(request.id)
  return request.id
}

interface RunOptions {
  concurrency?: number    // sites in parallel, default 1
  stages?: StageName[]    // subset to run
  force?: boolean         // re-run even if artifacts exist
}
```

### Pipeline stage shape

Every stage is a pure async function:

```ts
type Stage = (repo: Repo, request: Request, site: Site) => Promise<void>
```

Stages read prior artifacts through `repo`, write new ones through `repo`. No direct `fs`. No global state. Any stage can be tested in isolation with a tmp-dir repo and a fixture input.

### Prompt usage

Prompts are required on every category at input time. `runAnalysis` never generates or rewrites them. Stages read `category.prompt` straight from the request.

If a caller wants auto-generated prompts, they call `generatePrompt(name, extraInfo)` from `core/base-prompt.ts` themselves and assemble the input before handing it to `runAnalysis`. The sample CLI ships a small helper for this but the core pipeline treats prompts as opaque strings.

## Browse-data UI

```
/browse-data                       # list of requests
/browse-data/<requestId>           # request detail: displayName, sites
/browse-data/<requestId>/<siteId>  # per-site, per-category blocks
```

### Components

- **`RequestList`** — reads `data/db/index.json`, renders rows with displayName, createdAt, site count.
- **`RequestDetail`** — reads `request.json` + `result.json`, shows categories and sites list.
- **`SiteDetail`** — reads `result.json`, iterates categories, renders one `<CategoryBlock />` per category.
- **`<CategoryBlock />`** — takes `{ category, artifacts }`, renders: name, extraInfo, classified pages, content scores, extracted records as a generic JSON table. One component, every vertical.

### Display name generation

When a request has no `displayName`, `RequestList` calls an in-browser model (Chrome Prompt API, or `web-llm` fallback) with category names + site count to generate a readable title. Caches in `localStorage` keyed by `requestId`. Background detail, not part of the pipeline.

## File structure

```
scripts/
  core/
    run.ts              # runAnalysis, orchestration
    types.ts            # shared types
    base-prompt.ts      # BASE_PROMPT + prompt generator
  db/
    store.ts            # fs primitives (read/write/exists/list)
    paths.ts            # ArtifactRef ↔ path mapping
    repo.ts             # Repo class, public API
  pipeline/
    fetch-home.ts
    extract-nav.ts
    classify.ts         # generic, reads request.categories
    fetch-pages.ts
    tech.ts
    lighthouse.ts
    content.ts          # generic, uses per-category prompt
    extract.ts          # generic, uses per-category prompt
    report.ts           # per-site aggregation + consolidation call
  cli/
    analyze.ts          # thin CLI: load input file, call runAnalysis

src/app/browse-data/
  page.tsx                         # /browse-data
  [requestId]/page.tsx             # /browse-data/<id>
  [requestId]/[siteId]/page.tsx    # /browse-data/<id>/<siteId>

data/db/                           # created at first run
```

## Removed

- `scripts/scraper/` entirely (fetch.ts, analyze.ts, websites-data.ts, migrate-raw.ts, types.ts, `pipeline/*`, `global.d.ts`). The studio list from `websites-data.ts` is preserved as `data/inputs/yoga.json` (see Rollout step 2).
- `data/raw/`, `data/analysis/`, `data/reports/`, `data/reports-v1/`, `data/index.json`.
- `npm run fetch` and `npm run migrate-raw` scripts from `package.json`.
- All yoga vocabulary from code: `dropIn`, `training`, `retreat`, `StudioEntry`, `StudioReport`, `StudioOverrides`, etc. Yoga-specific terms survive only as strings inside the sample input file.

## Error handling

- Per-site try/catch in `runAnalysis` — one site's failure doesn't block others.
- Per-stage try/catch inside a site — a stage failure logs and continues. Missing artifacts are tolerated by `consolidateRequest`.
- Claude calls keep the existing 3-attempt retry pattern with exponential backoff.
- `result.json` represents whatever data was actually produced; UI handles missing fields gracefully.

## Testing

- **Repo unit tests** (tmp dir): create request, put/get artifacts, list filters, consolidate.
- **Per-stage tests**: fixture HTML/markdown + stubbed Claude/Firecrawl clients, assert artifact output.
- **Integration test**: one end-to-end `runAnalysis` call against a static fixture with mocked externals, assert `result.json` shape.

## Rollout

1. Build new system in `scripts/core/`, `scripts/db/`, `scripts/pipeline/`, `scripts/cli/` alongside old code (no coupling — old code stays functional while new code is developed).
2. Convert `scripts/scraper/websites-data.ts` into a sample input file at `data/inputs/yoga.json`. Shape:
   ```json
   {
     "displayName": "Yoga studios",
     "categories": [
       { "name": "drop in", "extraInfo": "single-session classes, schedules, timetables, class prices, walk-in classes" },
       { "name": "training", "extraInfo": "multi-day courses, teacher trainings (TTC, YTT), certifications, immersions" },
       { "name": "retreat",  "extraInfo": "multi-day immersive stays away from the studio" },
       { "name": "contact",  "extraInfo": "contact page, about-with-contact, location page" }
     ],
     "sites": [
       { "url": "https://www.yinyogafoundation.com", "meta": { "name": "Yin Yoga Foundation", "city": "Rishikesh" } },
       ...every studio from websites-data.ts, city preserved in meta...
     ]
   }
   ```
   This is the one piece of the old project that survives the rewrite — as data, not code.
3. Wire `npm run analyze -- --input path/to/input.json`. Smoke test with `data/inputs/yoga.json`.
4. Flip browse-data routes to read from `data/db/`.
5. Delete old scraper code and old output data directories (`data/raw/`, `data/analysis/`, `data/reports/`, `data/reports-v1/`, `data/index.json`, `scripts/scraper/`).
6. Update `CLAUDE.md` with new scripts, structure, and conventions.

## Open items

None — design is frozen pending user approval.
