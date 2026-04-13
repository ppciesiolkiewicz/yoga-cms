# YogaCMS

Next.js 16 project — a generic site-analysis pipeline with a browse UI. The yoga domain is just the first sample input (`data/inputs/yoga.json`); the pipeline itself has no yoga-specific logic.

## Scripts
- `npm run dev` — start dev server
- `npm run analyze -- --input <path> [--concurrency N] [--stages a,b,c]` — run the pipeline for an input file
- `npm test` — run vitest

## Structure
- `scripts/core/run.ts` — `runAnalysis(input, opts)` public entrypoint
- `scripts/core/types.ts` — shared types (`AnalyzeInput`, `Request`, `ArtifactRef`, `CategoryProgress`, etc.)
- `scripts/core/base-prompt.ts` — `BASE_PROMPT` + `generatePrompt` utility (opt-in, not called by the pipeline)
- `scripts/db/repo.ts` — `Repo` class, the only code that touches `data/db/`
- `scripts/db/store.ts`, `scripts/db/paths.ts` — fs primitives + ref-to-path
- `scripts/pipeline/*` — one file per stage (fetch-home, parse-links, classify-nav, fetch-pages, detect-tech, run-lighthouse, assess-pages, extract-pages-content, build-report)
- `scripts/cli/analyze.ts` — thin CLI wrapping `runAnalysis`
- `data/db/` — request store (created on first run)
- `data/inputs/` — sample input files
- `src/app/browse-data/` — request list + detail pages, all data-driven from `Repo`

## Pipeline
fetch-home → parse-links → classify-nav → fetch-pages (shared) → FOR EACH CATEGORY { detect-tech?, run-lighthouse?, assess-pages, extract-pages-content } → build-report.

Per-category stages store artifacts as `<stage>/<categoryId>.json`. Progress is tracked in `progress.json` per site.

Categories can opt into `wappalyzer: true` and/or `lighthouse: true` in the input to enable detect-tech and run-lighthouse for that category. assess-pages and extract-pages-content always run.

`Repo.consolidateRequest` aggregates into `result.json`.

## UI & Component Guidelines

### Language & Tone
- All user-facing text must be professional, friendly, and clear.
- Prefer plain language over jargon. Write labels, tooltips, and messages as if explaining to a non-technical user.
- Error messages should explain what happened and what the user can do next.

### Atomic Design
Follow atomic design methodology for component organization:
- **Atoms** (`src/components/ui/`) — smallest primitives: Button, Input, Textarea, Card, Checkbox, Chip, Collapsible, Carousel. Built on Radix UI where applicable. These are generic, reusable, and have no domain knowledge.
- **Molecules** (`src/components/`) — small compositions of atoms for a specific purpose (e.g. SearchBar = Input + Button, ScoreBadge, StatusBadge). May contain light layout logic.
- **Organisms** (`src/app/**/` colocated) — feature-level compositions (e.g. SitesSidebar, CategoryBlock). Live next to the route that uses them. Can import atoms and molecules.
- **Pages** (`src/app/**/page.tsx`) — route entry points. Compose organisms, handle data fetching.

### Component Structure
Components can have nested sub-components in a `components/` folder:
```
src/components/ui/
  Input/
    index.ts          # re-exports Input only
    Input.tsx
    components/        # private sub-components
      Label.tsx
      ...
```
Sub-components inside a `components/` folder are **private** — they must not be re-exported through `index.ts` and are considered internal implementation details of their parent component. Only the parent component should import them.

### Component Rules
- New UI primitives go in `src/components/ui/` and must be exported from `src/components/ui/index.ts`.
- Use Radix UI for any interactive primitive (dialogs, dropdowns, tooltips, tabs, etc.). Don't build custom implementations.
- Style with Tailwind classes. No CSS modules, no styled-components.
- All interactive components must be keyboard-accessible and include proper ARIA attributes.
- Prefer composition over prop sprawl — use children/slots instead of dozens of config props.

## Key notes
- Uses cheerio + Playwright + Firecrawl for fetching, wappalyzer-core for tech detection, Claude sonnet for content/extract and haiku for classify.
- Every category in an input must provide its own `prompt`. The pipeline does NOT auto-generate prompts. Use `core/base-prompt.ts#generatePrompt` from a separate step if you want assisted drafting.
- Wappalyzer needs raw HTML but fetch-pages only stores markdown. For all categories, detect-tech uses the homepage HTML as a proxy (tech stack is generally site-wide).
- classify-nav automatically assigns `site.url` to any category named "home" (case-insensitive).
- Read Next.js docs in `node_modules/next/dist/docs/` before changing app code.
