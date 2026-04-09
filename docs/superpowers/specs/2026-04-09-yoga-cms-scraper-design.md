# YogaCMS Website Scraper & Assessor — Design Spec

## Overview

A Next.js project (`yoga-cms`) with a unified scraper pipeline that assesses yoga studio websites across multiple cities. The scraper evaluates technology stack, estimates costs, runs Lighthouse audits, and uses Claude to assess content quality and extract structured data. Results are browsable via a `/browse-data` dashboard.

Starting scope: 1-2 studios to validate the pipeline, then scale to studios across Rishikesh, Wroclaw, Warszawa, Berlin, Melbourne, Sydney, Barcelona, and Paris.

## Project Structure

```
yoga-cms/
├── scripts/
│   └── scraper/
│       ├── scrape.ts              # Main entry point — orchestrates pipeline
│       ├── websites-data.ts       # Predefined studio URLs
│       ├── pipeline/
│       │   ├── fetch.ts           # Fetch HTML (cheerio or Playwright) + extract nav links
│       │   ├── tech-detect.ts     # Wappalyzer + cost estimation
│       │   ├── lighthouse.ts      # Lighthouse performance audit
│       │   ├── content-assess.ts  # Claude evaluates content quality
│       │   └── data-extract.ts    # Claude extracts structured data
│       └── types.ts               # Scraper-specific types
├── data/                          # Output: one JSON per studio + index.json
├── src/
│   ├── app/
│   │   ├── page.tsx               # Minimal landing page
│   │   └── browse-data/
│   │       ├── page.tsx           # Studio list — table with filters
│   │       └── [slug]/
│   │           └── page.tsx       # Single studio detail report
│   └── lib/
│       └── data.ts                # Helpers to read from data/ directory
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── eslint.config.mjs
├── .env.example                   # ANTHROPIC_API_KEY
└── CLAUDE.md
```

## Data Model

### Input: `scripts/scraper/websites-data.ts`

```ts
type ScrapeMode = "fetch" | "browser"

interface ScrapableUrl {
  url: string
  scrapeMode?: ScrapeMode  // default: "fetch"
}

interface StudioEntry {
  studioName: string
  city: string
  website: string              // main homepage URL
  dropIns: ScrapableUrl[]      // drop-in class pages
  trainings: ScrapableUrl[]    // TTC and other training pages
  retreats: ScrapableUrl[]     // retreat pages
  contact?: ScrapableUrl       // contact page (single)
}
```

Studios are grouped per entry with URLs organized by content type. This makes it clear at a glance what each studio offers and where to find it.

Initial data: import relevant studios from `rishikesh-yoga/src/data/websites-data.ts` (Rishikesh studios), then add studios found via web search for the other cities.

### Output: `data/<studio-slug>.json`

Each studio produces one JSON file. All files are also indexed in `data/index.json`.

```ts
interface StudioReport {
  slug: string                // URL-safe studio identifier
  studioName: string
  city: City
  website: string
  scrapedAt: string           // ISO timestamp

  // Stage 1: Site structure — nav links from homepage
  navigation: {
    label: string
    href: string
  }[]

  // Stage 2: Technology & cost assessment
  tech: {
    platform: string                          // "WordPress", "Wix", "Squarespace", "custom", etc.
    detectedTechnologies: {
      name: string
      category: string                        // "CMS", "JavaScript frameworks", "Analytics", "Hosting", etc.
      version?: string
    }[]
    lighthouse: {
      performance: number                     // 0-100
      accessibility: number
      seo: number
      bestPractices: number
    }
    costBreakdown: {
      item: string                            // "WordPress hosting", "Divi theme", "Booking plugin", etc.
      estimatedMonthlyCost: {
        min: number
        max: number
      }
    }[]
    totalEstimatedMonthlyCost: {
      min: number
      max: number
      currency: string                        // "USD"
    }
  }

  // Stage 2b: Feature detection (from Wappalyzer + HTML/nav analysis)
  features: {
    onlineBooking?: string              // online payment/booking system: "Mindbody", "Momoyoga", "Fitogram", "Acuity", "Stripe", "custom", etc.
    onlineClasses: boolean              // offers livestream/on-demand classes
    chat?: string                       // "Tawk.to", "Intercom", "WhatsApp widget", etc.
    ecommerce: boolean                  // shop/merchandise
    newsletter: boolean                 // email signup detected
    blog: boolean                       // blog section detected
    multiLanguage: boolean              // multiple language options
    addOnServices: string[]             // e.g. ["massage", "ayurveda", "accommodation", "sound healing"]
  }

  // Stage 3: Content quality assessment (Claude)
  contentAssessment: {
    overallScore: number                      // 1-10
    summary: string                           // 2-3 sentence summary of content quality

    dropInPresentation: {
      score: number                           // 1-10
      notes: string
    } | null

    trainingPages: {
      url: string
      pageName: string
      score: number                           // 1-10
      progressiveDisclosure: {
        when: boolean                         // dates visible early?
        where: boolean                        // location clear?
        price: boolean                        // price visible early?
        what: boolean                         // what the training is clear?
        howLong: boolean                      // duration stated early?
      }
      keyInfoScrollDepthEstimate: string      // "top", "middle", "bottom"
      fillerContentWarning: boolean           // "What is yoga?" syndrome detected
      whyChooseUsWarning: boolean             // self-defeating "Why choose us?" detected
      notes: string
    }[]

    retreatPages: {
      url: string
      pageName: string
      score: number
      progressiveDisclosure: {
        when: boolean
        where: boolean
        price: boolean
        what: boolean
        howLong: boolean
      }
      notes: string
    }[]
  }

  // Contact info (extracted from any page)
  contact: {
    email?: string
    phone?: string
    whatsapp?: string
    instagram?: string
    facebook?: string
    address?: string
    contactPageUrl?: string
  }

  // Stage 4: Extracted data
  dropInClasses: {
    className: string
    style: string
    schedule: string                          // human-readable, e.g. "Mon-Fri 7:00-8:30"
    price?: string                            // e.g. "500 INR" or "15 EUR"
  }[]

  trainings: {
    name: string
    type: string                              // e.g. "200hr YTT", "Yin TTC"
    price?: string
    dates?: string[]                          // upcoming dates
    duration?: string                         // e.g. "28 days"
    certification?: string                    // e.g. "200hr RYT"
  }[]

  retreats: {
    name: string
    price?: string
    dates?: string[]
    duration?: string
    description?: string
  }[]
}
```

### Index: `data/index.json`

```ts
interface StudioIndex {
  generatedAt: string
  studios: {
    slug: string
    studioName: string
    city: City
    platform: string
    overallContentScore: number
    estimatedMonthlyCost: { min: number; max: number }
    lighthousePerformance: number
    pageCount: number
  }[]
}
```

## Pipeline Stages

### Stage 1: Fetch & Navigation (`pipeline/fetch.ts`)

For each studio:
1. Fetch the homepage (using cheerio or Playwright based on `scrapeMode`)
2. Extract navigation/menu links from `<nav>`, `<header>`, or common menu patterns
3. For each predefined URL in `urls[]`, fetch the page and extract text content
4. Return: navigation links + page texts keyed by URL

Follows the same pattern as `rishikesh-yoga/scripts/scrape-utils.ts`:
- `fetchPageText()` for `scrapeMode: "fetch"` — uses `fetch` + cheerio
- `fetchPageTextBrowser()` for `scrapeMode: "browser"` — uses Playwright with headless Chromium
- Strips `<script>`, `<style>`, `<nav>`, `<footer>`, `<iframe>`, `<noscript>` from body text
- Truncates text to 8000 chars per page

### Stage 2: Tech Detection (`pipeline/tech-detect.ts`)

1. Run **Wappalyzer** (`simple-wappalyzer` npm package) against the homepage URL
   - Returns categorized technologies: CMS, frameworks, analytics, hosting, CDN, etc.
2. **Cost estimation** — map detected technologies to estimated monthly costs:
   - Platform costs: WordPress hosting ($5-50), Wix ($17-45), Squarespace ($16-65), Shopify ($29-299)
   - Theme/builder costs: Divi ($8/mo amortized), Elementor Pro ($8/mo), etc.
   - Plugin costs: booking systems ($0-50), email marketing ($0-30), SEO tools ($0-30)
   - Hosting indicators: detected CDN, hosting provider
   - SSL: free (Let's Encrypt) vs paid
3. Output: itemized breakdown + total estimated range in USD

### Stage 3: Lighthouse Audit (`pipeline/lighthouse.ts`)

1. Run **Lighthouse** (`lighthouse` npm package) against the homepage URL
   - Uses Playwright's Chromium instance (already available for browser-mode scraping)
   - Categories: performance, accessibility, SEO, best-practices
2. Extract the four category scores (0-100)
3. No need for full HTML report — just the numeric scores

### Stage 4: Content Assessment (`pipeline/content-assess.ts`)

Uses Claude API (`claude-sonnet-4-6`) to evaluate content quality.

**System prompt context** (provided to Claude for assessment):

```
You are an expert at evaluating yoga studio website content. You assess whether
the content serves potential customers effectively.

Key principles:
- Pages with less text convert better (14.3% vs 11.1% for verbose pages)
- Multiple offers on one page reduce conversions by 266%
- Landing pages with minimal text have 34% higher conversions
- Addressing buyer fears/objections increases conversion by ~80%
- Average attention span is 47 seconds — key info must be immediate

For training/retreat pages, check "progressive disclosure" — the five questions
must be answered upfront, before any philosophy or filler content:
1. WHEN — dates clearly visible near the top
2. WHERE — location stated early
3. PRICE — price visible without scrolling past filler
4. WHAT — what the training actually covers
5. HOW LONG — duration stated early

Red flags:
- "What is yoga?" content on a page targeting people who already practice yoga
- "Why choose us?" sections (signals insecurity, delays useful information)
- Key information (price, dates) buried below the 40% scroll depth mark
- Philosophy essays before practical details
- Multiple unrelated offers on one page

For drop-in class pages:
- Schedule should be immediately visible and well-organized
- Prices should be clear
- Class descriptions should be concise

Score each page 1-10 where:
- 9-10: Key info immediate, clean layout, no filler
- 7-8: Key info findable but could be better positioned
- 5-6: Some filler content, key info requires scrolling
- 3-4: Significant filler, key info buried
- 1-2: Key info nearly impossible to find, excessive philosophy/filler
```

For each page, Claude returns structured assessment matching the `contentAssessment` schema.

### Stage 5: Data Extraction (`pipeline/data-extract.ts`)

Uses Claude API (`claude-sonnet-4-6`) to extract structured data from page text. Three separate extraction prompts based on `pageType`:

- **drop-in**: Extract class names, styles, schedules, prices (similar to `rishikesh-yoga/scripts/scrape-drop-in.ts`)
- **training**: Extract training name, type, certification, price, dates, duration (similar to `rishikesh-yoga/scripts/scrape-trainings.ts`)
- **retreat**: Extract retreat name, price, dates, duration, description

Returns human-readable strings (not complex objects) since this data is for assessment display, not for a booking engine.

### Orchestration: `scripts/scraper/scrape.ts`

```
for each studio in websites-data:
  1. fetch all pages + extract nav
  2. run Wappalyzer on homepage
  3. run Lighthouse on homepage
  4. send page texts to Claude for content assessment
  5. send page texts to Claude for data extraction
  6. assemble StudioReport
  7. write to data/<slug>.json

regenerate data/index.json from all studio reports
```

**CLI interface:**
```bash
# Scrape all studios
npm run scrape

# Scrape a specific studio by name
npm run scrape -- --studio "Yin Yoga Foundation"

# Re-scrape studios older than N days
npm run scrape -- --update-older-than-days 7
```

## `/browse-data` UI

### List Page (`/browse-data/page.tsx`)

A server-rendered table showing all studios from `data/index.json`:

| Studio | City | Platform | Content Score | Lighthouse Perf | Est. Cost/mo | Pages |
|--------|------|----------|--------------|-----------------|--------------|-------|

- Filterable by city (dropdown)
- Filterable by platform (dropdown)
- Sortable by any column
- Click studio name to go to detail page

### Detail Page (`/browse-data/[slug]/page.tsx`)

Reads `data/<slug>.json` and displays:

1. **Header** — studio name, city, homepage link, scraped date
2. **Tech Stack card** — platform, detected technologies as tags, Lighthouse scores (4 gauge/badge indicators), cost breakdown table with total
3. **Site Navigation** — list of all detected nav links (what subpages exist)
4. **Content Assessment** — overall score badge, summary text, then per-page cards:
   - Training pages: score, progressive disclosure checklist (5 green/red indicators for when/where/price/what/how-long), filler warning badge, notes
   - Drop-in pages: score, notes
   - Retreat pages: score, progressive disclosure checklist, notes
5. **Extracted Data** — collapsible sections for drop-in classes, trainings, retreats

Styling: Tailwind CSS, clean and functional. No design system needed — just readable cards and tables.

Data loading: server components reading JSON files from `data/` directory via `fs.readFileSync`. No API routes, no database.

## Tech Stack

- **Next.js 16** (latest, matching rishikesh-yoga)
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **cheerio** — HTML parsing for fetch-mode scraping
- **playwright** — browser-mode scraping + Chromium for Lighthouse
- **simple-wappalyzer** — technology detection (actively maintained Wappalyzer wrapper)
- **lighthouse** — performance auditing
- **@anthropic-ai/sdk** — Claude API for content assessment + data extraction
- **tsx** — script runner
- **dotenv** — env variable loading

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...   # Required for content assessment + data extraction
```

## Starting Small

Phase 1 (this implementation):
- Scaffold the Next.js project
- Build the full pipeline with 1-2 studios from rishikesh-yoga's website list
- Build the `/browse-data` UI
- Validate everything works end-to-end

Phase 2 (future):
- Web search for studios in Wroclaw, Warszawa, Berlin, Melbourne, Sydney, Barcelona, Paris
- Add those studios to `websites-data.ts`
- Scale the pipeline
