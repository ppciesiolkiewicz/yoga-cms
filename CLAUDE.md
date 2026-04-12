# YogaCMS

Next.js 16 project — a generic site-analysis pipeline with a browse UI. The yoga domain is just the first sample input (`data/inputs/yoga.json`); the pipeline itself has no yoga-specific logic.

## Scripts
- `npm run dev` — start dev server
- `npm run analyze -- --input <path> [--concurrency N] [--stages a,b,c]` — run the pipeline for an input file
- `npm test` — run vitest

## Structure
- `scripts/core/run.ts` — `runAnalysis(input, opts)` public entrypoint
- `scripts/core/types.ts` — shared types (`AnalyzeInput`, `Request`, `ArtifactRef`, etc.)
- `scripts/core/base-prompt.ts` — `BASE_PROMPT` + `generatePrompt` utility (opt-in, not called by the pipeline)
- `scripts/db/repo.ts` — `Repo` class, the only code that touches `data/db/`
- `scripts/db/store.ts`, `scripts/db/paths.ts` — fs primitives + ref-to-path
- `scripts/pipeline/*` — one file per stage (fetch-home, extract-nav, classify, fetch-pages, tech, lighthouse, content, extract, report)
- `scripts/cli/analyze.ts` — thin CLI wrapping `runAnalysis`
- `data/db/` — request store (created on first run)
- `data/inputs/` — sample input files
- `src/app/browse-data/` — request list + detail pages, all data-driven from `Repo`

## Pipeline
fetch-home → extract-nav → classify (haiku, uses request.categories) → fetch-pages → {tech, lighthouse, content, extract} → report. `Repo.consolidateRequest` aggregates into `result.json`.

## Key notes
- Uses cheerio + Playwright + Firecrawl for fetching, wappalyzer-core for tech detection, Claude sonnet for content/extract and haiku for classify.
- Every category in an input must provide its own `prompt`. The pipeline does NOT auto-generate prompts. Use `core/base-prompt.ts#generatePrompt` from a separate step if you want assisted drafting.
- Read Next.js docs in `node_modules/next/dist/docs/` before changing app code.
