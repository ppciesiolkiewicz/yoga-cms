# YogaCMS

Next.js 16 project — a CMS for yoga studios.

## Scripts
- `npm run dev` — start dev server
- `npm run scrape` — run full scraper pipeline
- `npm run scrape:studio "Studio Name"` — scrape a single studio

## Structure
- `scripts/scraper/` — CLI scraper pipeline
- `data/` — generated JSON reports (one per studio + index.json)
- `src/app/browse-data/` — dashboard to browse scraped data

## Key notes
- Scraper uses cheerio for simple sites, Playwright for JS-rendered sites
- Claude API (claude-sonnet-4-6) for content assessment and data extraction
- Read Next.js docs in `node_modules/next/dist/docs/` before changing app code
