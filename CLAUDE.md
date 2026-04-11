# YogaCMS

Next.js 16 project — a CMS for yoga studios.

## Scripts
- `npm run dev` — start dev server
- `npm run fetch -- [options]` — download raw artifacts only (see `--help`)
- `npm run analyze -- [options]` — process raw into final report (see `--help`)
- `npm run migrate-raw` — one-time migration for phase 1 raw shape

Fetch and analyze are always run as separate CLIs. No compound.

## Structure
- `scripts/scraper/fetch.ts` — fetch CLI entry
- `scripts/scraper/analyze.ts` — analyze CLI entry
- `scripts/scraper/pipeline/fetch-stages.ts` — homepage, discovery, pages stages
- `scripts/scraper/pipeline/analyze-stages.ts` — classify, tech, lighthouse, content, extract, report stages
- `data/raw/<slug>/` — fetch artifacts (home.*, discovery.json, pages.json)
- `data/analysis/<slug>/` — analyze artifacts (classification, tech, lighthouse, content, extracted)
- `data/reports/<slug>.json` — final report per studio
- `data/index.json` — summary index across all studios
- `src/app/browse-data/` — dashboard to browse scraped data

## Key notes
- Scraper uses cheerio for simple sites, Playwright for JS-rendered sites
- Claude API: claude-sonnet-4-6 for content assessment and data extraction, claude-haiku-4-5 for link classification
- Read Next.js docs in `node_modules/next/dist/docs/` before changing app code
