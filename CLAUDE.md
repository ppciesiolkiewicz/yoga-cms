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

## Key notes
- Uses cheerio + Playwright + Firecrawl for fetching, wappalyzer-core for tech detection, Claude sonnet for content/extract and haiku for classify.
- Every category in an input must provide its own `prompt`. The pipeline does NOT auto-generate prompts. Use `core/base-prompt.ts#generatePrompt` from a separate step if you want assisted drafting.
- Wappalyzer needs raw HTML but fetch-pages only stores markdown. For all categories, detect-tech uses the homepage HTML as a proxy (tech stack is generally site-wide).
- classify-nav automatically assigns `site.url` to any category named "home" (case-insensitive).
- Read Next.js docs in `node_modules/next/dist/docs/` before changing app code.
