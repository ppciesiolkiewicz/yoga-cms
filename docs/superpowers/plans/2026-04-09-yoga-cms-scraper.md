# YogaCMS Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js project with a unified scraper pipeline that fetches yoga studio websites, detects their tech stack, runs Lighthouse audits, uses Claude to assess content quality and extract data, and displays results on a `/browse-data` dashboard.

**Architecture:** A CLI scraper (`scripts/scraper/scrape.ts`) orchestrates a multi-stage pipeline (fetch → tech detect → lighthouse → content assess → data extract) per studio, writing JSON reports to `data/`. A Next.js app reads those JSON files server-side to render a browse UI.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, cheerio, playwright, simple-wappalyzer, lighthouse, @anthropic-ai/sdk, tsx, dotenv

---

## File Structure

### Existing files (already committed)
- `scripts/scraper/types.ts` — Input types (StudioEntry, ScrapableUrl, ScrapeMode)
- `scripts/scraper/websites-data.ts` — 35 studios across 8 cities
- `docs/superpowers/specs/2026-04-09-yoga-cms-scraper-design.md` — Design spec

### Files to create

**Project scaffold:**
- `package.json` — dependencies and scripts
- `tsconfig.json` — TypeScript config
- `next.config.ts` — Next.js config
- `postcss.config.mjs` — Tailwind CSS
- `eslint.config.mjs` — ESLint
- `.env.example` — env var template
- `.gitignore` — ignore node_modules, .next, .env
- `CLAUDE.md` — project instructions for Claude

**Scraper pipeline:**
- `scripts/scraper/types.ts` — **Modify**: add output types (StudioReport, StudioIndex, etc.)
- `scripts/scraper/pipeline/fetch.ts` — dual-mode page fetching + nav extraction
- `scripts/scraper/pipeline/tech-detect.ts` — Wappalyzer + cost estimation
- `scripts/scraper/pipeline/lighthouse.ts` — Lighthouse audit runner
- `scripts/scraper/pipeline/content-assess.ts` — Claude content quality assessment
- `scripts/scraper/pipeline/data-extract.ts` — Claude structured data extraction
- `scripts/scraper/scrape.ts` — main orchestrator

**Next.js app:**
- `src/app/layout.tsx` — root layout with Tailwind
- `src/app/globals.css` — Tailwind imports
- `src/app/page.tsx` — minimal landing page
- `src/lib/data.ts` — helpers to read JSON from data/
- `src/app/browse-data/page.tsx` — studio list with filters
- `src/app/browse-data/[slug]/page.tsx` — studio detail report

---

### Task 1: Scaffold Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `.env.example`, `.gitignore`, `CLAUDE.md`
- Create: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "yoga-cms",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "scrape": "tsx scripts/scraper/scrape.ts",
    "scrape:studio": "tsx scripts/scraper/scrape.ts --studio"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.81.0",
    "cheerio": "^1.2.0",
    "next": "16.2.2",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "simple-wappalyzer": "^1.1.95"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "dotenv": "^17.4.1",
    "eslint": "^9",
    "eslint-config-next": "16.2.2",
    "lighthouse": "^12.0.0",
    "playwright": "^1.59.1",
    "tailwindcss": "^4",
    "tsx": "^4.21.0",
    "typescript": "^5"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Create next.config.ts**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Create postcss.config.mjs**

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Create eslint.config.mjs**

```js
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [...compat.extends("next/core-web-vitals", "next/typescript")];

export default eslintConfig;
```

- [ ] **Step 6: Create .env.example**

```
ANTHROPIC_API_KEY=sk-ant-...
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
.next/
.env
*.tsbuildinfo
```

- [ ] **Step 8: Create CLAUDE.md**

```markdown
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
```

- [ ] **Step 9: Create src/app/globals.css**

```css
@import "tailwindcss";
```

- [ ] **Step 10: Create src/app/layout.tsx**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YogaCMS",
  description: "CMS for yoga studios",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
```

- [ ] **Step 11: Create src/app/page.tsx**

```tsx
import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-16">
      <h1 className="text-3xl font-bold">YogaCMS</h1>
      <p className="mt-2 text-gray-600">Website assessment tool for yoga studios.</p>
      <Link href="/browse-data" className="mt-4 inline-block text-blue-600 hover:underline">
        Browse scraped data &rarr;
      </Link>
    </main>
  );
}
```

- [ ] **Step 12: Install dependencies and verify**

Run: `cd /Users/pio/projects/yoga-cms && npm install`

- [ ] **Step 13: Verify Next.js starts**

Run: `npm run dev` — check it starts without errors, visit http://localhost:3000

- [ ] **Step 14: Commit**

```bash
git add package.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs .env.example .gitignore CLAUDE.md src/
git commit -m "feat: scaffold Next.js project with Tailwind CSS"
```

---

### Task 2: Add Output Types

**Files:**
- Modify: `scripts/scraper/types.ts`

- [ ] **Step 1: Add all output types to types.ts**

Append the following to the existing `scripts/scraper/types.ts`:

```ts
// ── Output types ────────────────────────────────────────────

export interface NavLink {
  label: string
  href: string
}

export interface DetectedTechnology {
  name: string
  category: string
  version?: string
}

export interface CostItem {
  item: string
  estimatedMonthlyCost: { min: number; max: number }
}

export interface LighthouseScores {
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

export interface TechAssessment {
  platform: string
  detectedTechnologies: DetectedTechnology[]
  lighthouse: LighthouseScores
  costBreakdown: CostItem[]
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
}

export interface Features {
  onlineBooking?: string
  onlineClasses: boolean
  chat?: string
  ecommerce: boolean
  newsletter: boolean
  blog: boolean
  multiLanguage: boolean
  addOnServices: string[]
}

export interface ProgressiveDisclosure {
  when: boolean
  where: boolean
  price: boolean
  what: boolean
  howLong: boolean
}

export interface TrainingPageAssessment {
  url: string
  pageName: string
  score: number
  progressiveDisclosure: ProgressiveDisclosure
  keyInfoScrollDepthEstimate: "top" | "middle" | "bottom"
  fillerContentWarning: boolean
  whyChooseUsWarning: boolean
  notes: string
}

export interface RetreatPageAssessment {
  url: string
  pageName: string
  score: number
  progressiveDisclosure: ProgressiveDisclosure
  notes: string
}

export interface ContentAssessment {
  overallScore: number
  summary: string
  dropInPresentation: { score: number; notes: string } | null
  trainingPages: TrainingPageAssessment[]
  retreatPages: RetreatPageAssessment[]
}

export interface ContactInfo {
  email?: string
  phone?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  address?: string
  contactPageUrl?: string
}

export interface DropInClass {
  className: string
  style: string
  schedule: string
  price?: string
}

export interface Training {
  name: string
  type: string
  price?: string
  dates?: string[]
  duration?: string
  certification?: string
}

export interface Retreat {
  name: string
  price?: string
  dates?: string[]
  duration?: string
  description?: string
}

export interface StudioReport {
  slug: string
  studioName: string
  city: string
  website: string
  scrapedAt: string
  navigation: NavLink[]
  tech: TechAssessment
  features: Features
  contentAssessment: ContentAssessment
  contact: ContactInfo
  dropInClasses: DropInClass[]
  trainings: Training[]
  retreats: Retreat[]
}

export interface StudioIndexEntry {
  slug: string
  studioName: string
  city: string
  platform: string
  overallContentScore: number
  estimatedMonthlyCost: { min: number; max: number }
  lighthousePerformance: number
  pageCount: number
}

export interface StudioIndex {
  generatedAt: string
  studios: StudioIndexEntry[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit scripts/scraper/types.ts`

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/types.ts
git commit -m "feat: add output types for studio reports and index"
```

---

### Task 3: Build Fetch Pipeline Stage

**Files:**
- Create: `scripts/scraper/pipeline/fetch.ts`

- [ ] **Step 1: Create fetch.ts**

```ts
import * as cheerio from "cheerio"
import type { ScrapableUrl, NavLink } from "../types"

export async function fetchPageHtml(url: string): Promise<string | null> {
  try {
    console.log(`  Fetching: ${url}`)
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    })
    if (!response.ok) {
      console.warn(`  ⚠ HTTP ${response.status} for ${url}`)
      return null
    }
    return await response.text()
  } catch (error) {
    console.warn(`  ⚠ Failed to fetch ${url}: ${error}`)
    return null
  }
}

export async function fetchPageHtmlBrowser(url: string): Promise<string | null> {
  try {
    console.log(`  Fetching (browser): ${url}`)
    const { chromium } = await import("playwright")
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 })
      return await page.content()
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.warn(`  ⚠ Failed to fetch (browser) ${url}: ${error}`)
    return null
  }
}

export function extractText(html: string): string {
  const $ = cheerio.load(html)
  $("script, style, nav, footer, iframe, noscript").remove()
  return $("body").text().replace(/\s+/g, " ").trim().slice(0, 8000)
}

export function extractNavLinks(html: string, baseUrl: string): NavLink[] {
  const $ = cheerio.load(html)
  const links: NavLink[] = []
  const seen = new Set<string>()

  $("nav a, header a").each((_, el) => {
    const href = $(el).attr("href")
    const label = $(el).text().trim()
    if (!href || !label || label.length > 100) return

    let fullUrl: string
    try {
      fullUrl = new URL(href, baseUrl).href
    } catch {
      return
    }

    if (seen.has(fullUrl)) return
    seen.add(fullUrl)

    // Only keep links on the same domain
    try {
      const base = new URL(baseUrl)
      const link = new URL(fullUrl)
      if (link.hostname !== base.hostname) return
    } catch {
      return
    }

    links.push({ label, href: fullUrl })
  })

  return links
}

export interface FetchedPage {
  url: string
  html: string
  text: string
}

export async function fetchStudioPages(
  homepageUrl: string,
  pages: ScrapableUrl[]
): Promise<{ navigation: NavLink[]; pages: FetchedPage[] }> {
  // Fetch homepage for navigation
  const homepageHtml = await fetchPageHtml(homepageUrl)
  const navigation = homepageHtml ? extractNavLinks(homepageHtml, homepageUrl) : []

  // Fetch each predefined page
  const fetched: FetchedPage[] = []
  for (const page of pages) {
    const html = page.scrapeMode === "browser"
      ? await fetchPageHtmlBrowser(page.url)
      : await fetchPageHtml(page.url)

    if (html) {
      fetched.push({
        url: page.url,
        html,
        text: extractText(html),
      })
    }
  }

  return { navigation, pages: fetched }
}
```

- [ ] **Step 2: Quick smoke test**

Run: `npx tsx -e "import { fetchPageHtml, extractText, extractNavLinks } from './scripts/scraper/pipeline/fetch'; fetchPageHtml('https://www.yinyogafoundation.com').then(html => { if(html) { console.log('Nav links:', extractNavLinks(html, 'https://www.yinyogafoundation.com').length); console.log('Text length:', extractText(html).length) } })"`

Expected: prints nav link count and text length without errors.

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/fetch.ts
git commit -m "feat: add fetch pipeline stage with dual-mode (cheerio/playwright)"
```

---

### Task 4: Build Tech Detection Pipeline Stage

**Files:**
- Create: `scripts/scraper/pipeline/tech-detect.ts`

- [ ] **Step 1: Create tech-detect.ts**

```ts
import type { TechAssessment, Features, CostItem, DetectedTechnology } from "../types"

// Cost database — estimated monthly cost per detected technology
const COST_MAP: Record<string, { item: string; min: number; max: number }> = {
  "WordPress": { item: "WordPress hosting", min: 5, max: 50 },
  "Wix": { item: "Wix subscription", min: 17, max: 45 },
  "Squarespace": { item: "Squarespace subscription", min: 16, max: 65 },
  "Shopify": { item: "Shopify subscription", min: 29, max: 299 },
  "Divi": { item: "Divi theme license", min: 7, max: 10 },
  "Elementor": { item: "Elementor Pro", min: 5, max: 10 },
  "WooCommerce": { item: "WooCommerce hosting/plugins", min: 10, max: 50 },
  "Mindbody": { item: "Mindbody subscription", min: 129, max: 449 },
  "Momoyoga": { item: "Momoyoga subscription", min: 20, max: 45 },
  "Fitogram": { item: "Fitogram subscription", min: 0, max: 59 },
  "Acuity Scheduling": { item: "Acuity Scheduling", min: 16, max: 49 },
  "Mailchimp": { item: "Mailchimp", min: 0, max: 30 },
  "Google Analytics": { item: "Google Analytics", min: 0, max: 0 },
  "Tawk.to": { item: "Tawk.to chat", min: 0, max: 0 },
  "Intercom": { item: "Intercom", min: 39, max: 99 },
  "Cloudflare": { item: "Cloudflare", min: 0, max: 20 },
}

function estimateCosts(technologies: DetectedTechnology[]): {
  costBreakdown: CostItem[]
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
} {
  const costBreakdown: CostItem[] = []
  let totalMin = 0
  let totalMax = 0

  for (const tech of technologies) {
    const cost = COST_MAP[tech.name]
    if (cost) {
      costBreakdown.push({ item: cost.item, estimatedMonthlyCost: { min: cost.min, max: cost.max } })
      totalMin += cost.min
      totalMax += cost.max
    }
  }

  // If no platform detected, assume basic hosting
  if (!costBreakdown.some(c => ["WordPress hosting", "Wix subscription", "Squarespace subscription", "Shopify subscription"].includes(c.item))) {
    costBreakdown.push({ item: "Web hosting (estimated)", estimatedMonthlyCost: { min: 5, max: 30 } })
    totalMin += 5
    totalMax += 30
  }

  // Domain cost
  costBreakdown.push({ item: "Domain registration", estimatedMonthlyCost: { min: 1, max: 2 } })
  totalMin += 1
  totalMax += 2

  return {
    costBreakdown,
    totalEstimatedMonthlyCost: { min: totalMin, max: totalMax, currency: "USD" },
  }
}

function detectPlatform(technologies: DetectedTechnology[]): string {
  const names = technologies.map(t => t.name)
  if (names.includes("WordPress")) return "WordPress"
  if (names.includes("Wix")) return "Wix"
  if (names.includes("Squarespace")) return "Squarespace"
  if (names.includes("Shopify")) return "Shopify"
  if (names.includes("Webflow")) return "Webflow"
  if (names.includes("Joomla")) return "Joomla"
  if (names.includes("Drupal")) return "Drupal"
  return "Custom / Unknown"
}

function detectFeatures(technologies: DetectedTechnology[], html: string): Features {
  const names = technologies.map(t => t.name)
  const categories = technologies.map(t => t.category)
  const htmlLower = html.toLowerCase()

  // Online booking detection
  let onlineBooking: string | undefined
  if (names.includes("Mindbody")) onlineBooking = "Mindbody"
  else if (names.includes("Momoyoga") || htmlLower.includes("momoyoga")) onlineBooking = "Momoyoga"
  else if (names.includes("Fitogram") || htmlLower.includes("fitogram")) onlineBooking = "Fitogram"
  else if (names.includes("Acuity Scheduling")) onlineBooking = "Acuity Scheduling"
  else if (htmlLower.includes("fitssey")) onlineBooking = "Fitssey"
  else if (names.includes("Stripe") || htmlLower.includes("stripe")) onlineBooking = "Stripe (custom)"

  // Chat detection
  let chat: string | undefined
  if (names.includes("Tawk.to")) chat = "Tawk.to"
  else if (names.includes("Intercom")) chat = "Intercom"
  else if (htmlLower.includes("wa.me") || htmlLower.includes("whatsapp")) chat = "WhatsApp"

  return {
    onlineBooking,
    onlineClasses: htmlLower.includes("livestream") || htmlLower.includes("online class") || htmlLower.includes("on-demand") || htmlLower.includes("zoom"),
    chat,
    ecommerce: categories.includes("Ecommerce") || htmlLower.includes("/shop") || htmlLower.includes("add to cart"),
    newsletter: htmlLower.includes("newsletter") || htmlLower.includes("mailchimp") || htmlLower.includes("subscribe"),
    blog: htmlLower.includes("/blog") || htmlLower.includes("blog-post"),
    multiLanguage: htmlLower.includes("hreflang") || htmlLower.includes("/en/") || htmlLower.includes("wpml") || htmlLower.includes("lang="),
    addOnServices: detectAddOnServices(htmlLower),
  }
}

function detectAddOnServices(htmlLower: string): string[] {
  const services: string[] = []
  if (htmlLower.includes("massage")) services.push("massage")
  if (htmlLower.includes("ayurveda")) services.push("ayurveda")
  if (htmlLower.includes("accommodation") || htmlLower.includes("room")) services.push("accommodation")
  if (htmlLower.includes("sound healing") || htmlLower.includes("sound bath")) services.push("sound healing")
  if (htmlLower.includes("reiki")) services.push("reiki")
  if (htmlLower.includes("acupuncture")) services.push("acupuncture")
  return services
}

export async function detectTech(
  url: string,
  html: string
): Promise<{ tech: Omit<TechAssessment, "lighthouse">; features: Features }> {
  let technologies: DetectedTechnology[] = []

  try {
    const Wappalyzer = (await import("simple-wappalyzer")).default
    const wappalyzer = new Wappalyzer()
    const result = await wappalyzer.analyze({ url, html })

    technologies = result.technologies.map((t: { name: string; categories: { name: string }[]; version?: string }) => ({
      name: t.name,
      category: t.categories?.[0]?.name ?? "Other",
      version: t.version || undefined,
    }))
  } catch (error) {
    console.warn(`  ⚠ Wappalyzer failed for ${url}: ${error}`)
  }

  const platform = detectPlatform(technologies)
  const { costBreakdown, totalEstimatedMonthlyCost } = estimateCosts(technologies)
  const features = detectFeatures(technologies, html)

  return {
    tech: { platform, detectedTechnologies: technologies, costBreakdown, totalEstimatedMonthlyCost },
    features,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/scraper/pipeline/tech-detect.ts
git commit -m "feat: add tech detection pipeline with Wappalyzer + cost estimation"
```

---

### Task 5: Build Lighthouse Pipeline Stage

**Files:**
- Create: `scripts/scraper/pipeline/lighthouse.ts`

- [ ] **Step 1: Create lighthouse.ts**

```ts
import type { LighthouseScores } from "../types"

export async function runLighthouse(url: string): Promise<LighthouseScores> {
  try {
    console.log(`  Running Lighthouse: ${url}`)
    const lighthouse = (await import("lighthouse")).default
    const { chromium } = await import("playwright")

    const browser = await chromium.launch({ headless: true })
    const browserWSEndpoint = browser.process()?.pid
      ? `http://127.0.0.1:${(browser as unknown as { _port?: number })._port}`
      : undefined

    // Use lighthouse with chrome-launcher approach
    const chromePath = chromium.executablePath()

    try {
      const result = await lighthouse(url, {
        output: "json",
        onlyCategories: ["performance", "accessibility", "seo", "best-practices"],
        chromePath,
        chromeFlags: ["--headless", "--no-sandbox", "--disable-gpu"],
      })

      if (!result?.lhr?.categories) {
        console.warn("  ⚠ Lighthouse returned no categories")
        return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
      }

      const cats = result.lhr.categories
      return {
        performance: Math.round((cats.performance?.score ?? 0) * 100),
        accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
        seo: Math.round((cats.seo?.score ?? 0) * 100),
        bestPractices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      }
    } finally {
      await browser.close()
    }
  } catch (error) {
    console.warn(`  ⚠ Lighthouse failed for ${url}: ${error}`)
    return { performance: 0, accessibility: 0, seo: 0, bestPractices: 0 }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/scraper/pipeline/lighthouse.ts
git commit -m "feat: add Lighthouse audit pipeline stage"
```

---

### Task 6: Build Content Assessment Pipeline Stage

**Files:**
- Create: `scripts/scraper/pipeline/content-assess.ts`

- [ ] **Step 1: Create content-assess.ts**

```ts
import Anthropic from "@anthropic-ai/sdk"
import type { ContentAssessment, TrainingPageAssessment, RetreatPageAssessment, FetchedPage } from "../types"

const anthropic = new Anthropic()

const SYSTEM_PROMPT = `You are an expert at evaluating yoga studio website content. You assess whether the content serves potential customers effectively.

Key principles:
- Pages with less text convert better (14.3% vs 11.1% for verbose pages)
- Multiple offers on one page reduce conversions by 266%
- Landing pages with minimal text have 34% higher conversions
- Addressing buyer fears/objections increases conversion by ~80%
- Average attention span is 47 seconds — key info must be immediate

For training/retreat pages, check "progressive disclosure" — the five questions must be answered upfront, before any philosophy or filler content:
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

Return ONLY valid JSON. No markdown, no code fences.`

export async function assessContent(
  studioName: string,
  dropInPages: FetchedPage[],
  trainingPages: FetchedPage[],
  retreatPages: FetchedPage[]
): Promise<ContentAssessment> {
  const allPages = [
    ...dropInPages.map(p => ({ ...p, type: "drop-in" as const })),
    ...trainingPages.map(p => ({ ...p, type: "training" as const })),
    ...retreatPages.map(p => ({ ...p, type: "retreat" as const })),
  ]

  if (allPages.length === 0) {
    return {
      overallScore: 0,
      summary: "No pages available for assessment.",
      dropInPresentation: null,
      trainingPages: [],
      retreatPages: [],
    }
  }

  const pagesDescription = allPages
    .map(p => `[${p.type.toUpperCase()}] ${p.url}\n${p.text.slice(0, 3000)}`)
    .join("\n\n---\n\n")

  const userPrompt = `Assess the content quality of "${studioName}" website pages.

${pagesDescription}

Return a JSON object with this exact structure:
{
  "overallScore": <number 1-10>,
  "summary": "<2-3 sentences>",
  "dropInPresentation": { "score": <number>, "notes": "<string>" } or null if no drop-in pages,
  "trainingPages": [
    {
      "url": "<url>",
      "pageName": "<descriptive name>",
      "score": <number 1-10>,
      "progressiveDisclosure": { "when": <bool>, "where": <bool>, "price": <bool>, "what": <bool>, "howLong": <bool> },
      "keyInfoScrollDepthEstimate": "top" | "middle" | "bottom",
      "fillerContentWarning": <bool>,
      "whyChooseUsWarning": <bool>,
      "notes": "<string>"
    }
  ],
  "retreatPages": [
    {
      "url": "<url>",
      "pageName": "<descriptive name>",
      "score": <number 1-10>,
      "progressiveDisclosure": { "when": <bool>, "where": <bool>, "price": <bool>, "what": <bool>, "howLong": <bool> },
      "notes": "<string>"
    }
  ]
}`

  console.log(`  Assessing content with Claude API...`)

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    })

    let text = response.content[0].type === "text" ? response.content[0].text : ""
    text = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()

    return JSON.parse(text) as ContentAssessment
  } catch (error) {
    console.warn(`  ⚠ Content assessment failed: ${error}`)
    return {
      overallScore: 0,
      summary: "Assessment failed.",
      dropInPresentation: null,
      trainingPages: [],
      retreatPages: [],
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/scraper/pipeline/content-assess.ts
git commit -m "feat: add Claude content assessment pipeline stage"
```

---

### Task 7: Build Data Extraction Pipeline Stage

**Files:**
- Create: `scripts/scraper/pipeline/data-extract.ts`

- [ ] **Step 1: Create data-extract.ts**

```ts
import Anthropic from "@anthropic-ai/sdk"
import type { DropInClass, Training, Retreat, ContactInfo, FetchedPage } from "../types"

const anthropic = new Anthropic()

async function callClaude(system: string, userMessage: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMessage }],
  })
  let text = response.content[0].type === "text" ? response.content[0].text : ""
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim()
}

export async function extractDropInClasses(pages: FetchedPage[], studioName: string): Promise<DropInClass[]> {
  if (pages.length === 0) return []
  console.log(`  Extracting drop-in classes...`)

  const text = pages.map(p => p.text).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract drop-in yoga class information. Return ONLY a JSON array. Each object: { "className": "string", "style": "string (e.g. Hatha, Vinyasa)", "schedule": "string (human-readable, e.g. Mon-Fri 7:00-8:30)", "price": "string or null (e.g. 500 INR)" }. If no classes found, return [].`,
      `Extract drop-in classes from "${studioName}":\n\n${text.slice(0, 6000)}`
    )
    return JSON.parse(result) as DropInClass[]
  } catch {
    console.warn(`  ⚠ Failed to extract drop-in classes`)
    return []
  }
}

export async function extractTrainings(pages: FetchedPage[], studioName: string): Promise<Training[]> {
  if (pages.length === 0) return []
  console.log(`  Extracting trainings...`)

  const text = pages.map(p => `URL: ${p.url}\n${p.text}`).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract yoga training/TTC information. Return ONLY a JSON array. Each object: { "name": "string", "type": "string (e.g. 200hr YTT, Yin TTC)", "price": "string or null", "dates": ["string"] or null, "duration": "string or null (e.g. 28 days)", "certification": "string or null (e.g. 200hr RYT)" }. If no trainings found, return [].`,
      `Extract training programs from "${studioName}":\n\n${text.slice(0, 6000)}`
    )
    return JSON.parse(result) as Training[]
  } catch {
    console.warn(`  ⚠ Failed to extract trainings`)
    return []
  }
}

export async function extractRetreats(pages: FetchedPage[], studioName: string): Promise<Retreat[]> {
  if (pages.length === 0) return []
  console.log(`  Extracting retreats...`)

  const text = pages.map(p => `URL: ${p.url}\n${p.text}`).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract yoga retreat information. Return ONLY a JSON array. Each object: { "name": "string", "price": "string or null", "dates": ["string"] or null, "duration": "string or null", "description": "string or null (1-2 sentences)" }. If no retreats found, return [].`,
      `Extract retreats from "${studioName}":\n\n${text.slice(0, 6000)}`
    )
    return JSON.parse(result) as Retreat[]
  } catch {
    console.warn(`  ⚠ Failed to extract retreats`)
    return []
  }
}

export async function extractContactInfo(pages: FetchedPage[], studioName: string): Promise<ContactInfo> {
  if (pages.length === 0) return {}
  console.log(`  Extracting contact info...`)

  const text = pages.map(p => p.text).join("\n\n---\n\n")
  try {
    const result = await callClaude(
      `Extract contact information. Return ONLY a JSON object: { "email": "string or null", "phone": "string or null", "whatsapp": "string or null", "instagram": "string or null", "facebook": "string or null", "address": "string or null" }. Only include fields you find.`,
      `Extract contact info from "${studioName}":\n\n${text.slice(0, 4000)}`
    )
    return JSON.parse(result) as ContactInfo
  } catch {
    console.warn(`  ⚠ Failed to extract contact info`)
    return {}
  }
}
```

- [ ] **Step 2: Re-export FetchedPage from types.ts**

The `FetchedPage` type is defined in `pipeline/fetch.ts` but needed in other pipeline stages. Add to `scripts/scraper/types.ts`:

```ts
export interface FetchedPage {
  url: string
  html: string
  text: string
}
```

And update `pipeline/fetch.ts` to import it from `../types` instead of defining it locally. Remove the `FetchedPage` interface from `fetch.ts` and add:

```ts
import type { ScrapableUrl, NavLink, FetchedPage } from "../types"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/scraper/pipeline/data-extract.ts scripts/scraper/types.ts scripts/scraper/pipeline/fetch.ts
git commit -m "feat: add data extraction pipeline stage (drop-ins, trainings, retreats, contact)"
```

---

### Task 8: Build Main Scraper Orchestrator

**Files:**
- Create: `scripts/scraper/scrape.ts`

- [ ] **Step 1: Create scrape.ts**

```ts
import { config } from "dotenv"
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { studios } from "./websites-data"
import { fetchStudioPages } from "./pipeline/fetch"
import { detectTech } from "./pipeline/tech-detect"
import { runLighthouse } from "./pipeline/lighthouse"
import { assessContent } from "./pipeline/content-assess"
import { extractDropInClasses, extractTrainings, extractRetreats, extractContactInfo } from "./pipeline/data-extract"
import type { StudioEntry, StudioReport, StudioIndex, ScrapableUrl } from "./types"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, "../../.env") })

const DATA_DIR = join(__dirname, "../../data")

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function parseArgs(): { studioFilter?: string; maxAgeDays?: number } {
  const args = process.argv.slice(2)
  let studioFilter: string | undefined
  let maxAgeDays: number | undefined

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--studio" && args[i + 1]) {
      studioFilter = args[i + 1]
      i++
    }
    if (args[i] === "--update-older-than-days" && args[i + 1]) {
      maxAgeDays = parseInt(args[i + 1], 10)
      i++
    }
  }

  return { studioFilter, maxAgeDays }
}

function isStale(slug: string, maxAgeDays: number | undefined): boolean {
  if (maxAgeDays === undefined) return true
  const filePath = join(DATA_DIR, `${slug}.json`)
  if (!existsSync(filePath)) return true
  try {
    const data = JSON.parse(readFileSync(filePath, "utf-8")) as StudioReport
    const age = Date.now() - new Date(data.scrapedAt).getTime()
    return age > maxAgeDays * 24 * 60 * 60 * 1000
  } catch {
    return true
  }
}

function getAllPages(entry: StudioEntry): ScrapableUrl[] {
  return [
    ...entry.dropIns,
    ...entry.trainings,
    ...entry.retreats,
    ...(entry.contact ? [entry.contact] : []),
  ]
}

async function scrapeStudio(entry: StudioEntry): Promise<StudioReport> {
  const slug = slugify(entry.studioName)
  console.log(`\n═══ ${entry.studioName} (${entry.city}) ═══`)

  // Stage 1: Fetch pages
  const allPages = getAllPages(entry)
  const { navigation, pages } = await fetchStudioPages(entry.website, allPages)

  // Categorize fetched pages
  const dropInUrls = new Set(entry.dropIns.map(u => u.url))
  const trainingUrls = new Set(entry.trainings.map(u => u.url))
  const retreatUrls = new Set(entry.retreats.map(u => u.url))
  const contactUrls = new Set(entry.contact ? [entry.contact.url] : [])

  const dropInPages = pages.filter(p => dropInUrls.has(p.url))
  const trainingPages = pages.filter(p => trainingUrls.has(p.url))
  const retreatPages = pages.filter(p => retreatUrls.has(p.url))
  const contactPages = pages.filter(p => contactUrls.has(p.url))

  // Stage 2: Tech detection (use homepage HTML if available, otherwise first page)
  const homepageHtml = pages[0]?.html ?? ""
  const { tech, features } = await detectTech(entry.website, homepageHtml)

  // Stage 3: Lighthouse
  const lighthouse = await runLighthouse(entry.website)

  // Stage 4: Content assessment
  const contentAssessment = await assessContent(
    entry.studioName,
    dropInPages,
    trainingPages,
    retreatPages
  )

  // Stage 5: Data extraction
  const [dropInClasses, trainings, retreats, contact] = await Promise.all([
    extractDropInClasses(dropInPages, entry.studioName),
    extractTrainings(trainingPages, entry.studioName),
    extractRetreats(retreatPages, entry.studioName),
    extractContactInfo([...contactPages, ...pages.slice(0, 1)], entry.studioName),
  ])

  // Add contact page URL if we have one
  if (entry.contact) {
    contact.contactPageUrl = entry.contact.url
  }

  return {
    slug,
    studioName: entry.studioName,
    city: entry.city,
    website: entry.website,
    scrapedAt: new Date().toISOString(),
    navigation,
    tech: { ...tech, lighthouse },
    features,
    contentAssessment,
    contact,
    dropInClasses,
    trainings,
    retreats,
  }
}

function writeReport(report: StudioReport) {
  mkdirSync(DATA_DIR, { recursive: true })
  const filePath = join(DATA_DIR, `${report.slug}.json`)
  writeFileSync(filePath, JSON.stringify(report, null, 2), "utf-8")
  console.log(`  ✓ Wrote ${filePath}`)
}

function writeIndex(reports: StudioReport[]) {
  const index: StudioIndex = {
    generatedAt: new Date().toISOString(),
    studios: reports.map(r => ({
      slug: r.slug,
      studioName: r.studioName,
      city: r.city,
      platform: r.tech.platform,
      overallContentScore: r.contentAssessment.overallScore,
      estimatedMonthlyCost: r.tech.totalEstimatedMonthlyCost,
      lighthousePerformance: r.tech.lighthouse.performance,
      pageCount: r.navigation.length,
    })),
  }
  const filePath = join(DATA_DIR, "index.json")
  writeFileSync(filePath, JSON.stringify(index, null, 2), "utf-8")
  console.log(`\n✓ Wrote index with ${reports.length} studios to ${filePath}`)
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required")
    process.exit(1)
  }

  const { studioFilter, maxAgeDays } = parseArgs()

  let toScrape = studios
  if (studioFilter) {
    toScrape = studios.filter(s =>
      s.studioName.toLowerCase().includes(studioFilter.toLowerCase())
    )
    if (toScrape.length === 0) {
      console.error(`No studios matching "${studioFilter}"`)
      process.exit(1)
    }
  }

  // Filter by staleness
  toScrape = toScrape.filter(s => isStale(slugify(s.studioName), maxAgeDays))

  if (toScrape.length === 0) {
    console.log("All studios are up to date.")
    return
  }

  console.log(`Scraping ${toScrape.length} studio(s)...\n`)

  const reports: StudioReport[] = []

  // Load existing reports that we're not re-scraping
  if (existsSync(DATA_DIR)) {
    const { readdirSync } = await import("fs")
    const scrapeSlugs = new Set(toScrape.map(s => slugify(s.studioName)))
    for (const file of readdirSync(DATA_DIR)) {
      if (file === "index.json" || !file.endsWith(".json")) continue
      const slug = file.replace(".json", "")
      if (!scrapeSlugs.has(slug)) {
        try {
          const data = JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8")) as StudioReport
          reports.push(data)
        } catch { /* skip corrupted files */ }
      }
    }
  }

  for (const entry of toScrape) {
    try {
      const report = await scrapeStudio(entry)
      reports.push(report)
      writeReport(report)
    } catch (error) {
      console.error(`  ✗ Failed to scrape ${entry.studioName}: ${error}`)
    }
  }

  writeIndex(reports)
}

main()
```

- [ ] **Step 2: Add data/ to .gitignore**

Append `data/` to `.gitignore` so generated JSON files aren't committed.

- [ ] **Step 3: Test with a single studio**

Run: `npm run scrape:studio "Yin Yoga Foundation"`

Expected: creates `data/yin-yoga-foundation.json` and `data/index.json`

- [ ] **Step 4: Commit**

```bash
git add scripts/scraper/scrape.ts .gitignore
git commit -m "feat: add main scraper orchestrator with CLI interface"
```

---

### Task 9: Build Data Loading Helpers

**Files:**
- Create: `src/lib/data.ts`

- [ ] **Step 1: Create data.ts**

```ts
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import type { StudioReport, StudioIndex } from "../../scripts/scraper/types"

const DATA_DIR = join(process.cwd(), "data")

export function getStudioIndex(): StudioIndex | null {
  const filePath = join(DATA_DIR, "index.json")
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, "utf-8")) as StudioIndex
}

export function getStudioReport(slug: string): StudioReport | null {
  const filePath = join(DATA_DIR, `${slug}.json`)
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, "utf-8")) as StudioReport
}

export function getAllSlugs(): string[] {
  const index = getStudioIndex()
  if (!index) return []
  return index.studios.map(s => s.slug)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data.ts
git commit -m "feat: add server-side data loading helpers"
```

---

### Task 10: Build Browse Data List Page

**Files:**
- Create: `src/app/browse-data/page.tsx`

- [ ] **Step 1: Create the list page**

```tsx
import Link from "next/link"
import { getStudioIndex } from "@/lib/data"

export default function BrowseDataPage() {
  const index = getStudioIndex()

  if (!index || index.studios.length === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-16">
        <h1 className="text-3xl font-bold">Browse Studio Data</h1>
        <p className="mt-4 text-gray-600">
          No data yet. Run <code className="rounded bg-gray-100 px-2 py-1">npm run scrape</code> to scrape studios.
        </p>
      </main>
    )
  }

  const cities = [...new Set(index.studios.map(s => s.city))].sort()
  const platforms = [...new Set(index.studios.map(s => s.platform))].sort()

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Browse Studio Data</h1>
        <p className="text-sm text-gray-500">
          {index.studios.length} studios &middot; Generated {new Date(index.generatedAt).toLocaleDateString()}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Studio</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Platform</th>
              <th className="px-4 py-3 text-center">Content Score</th>
              <th className="px-4 py-3 text-center">Lighthouse</th>
              <th className="px-4 py-3 text-right">Est. Cost/mo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {index.studios.map(studio => (
              <tr key={studio.slug} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/browse-data/${studio.slug}`} className="font-medium text-blue-600 hover:underline">
                    {studio.studioName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{studio.city}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs">{studio.platform}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreBadge score={studio.overallContentScore} />
                </td>
                <td className="px-4 py-3 text-center">
                  <ScoreBadge score={studio.lighthousePerformance} max={100} />
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  ${studio.estimatedMonthlyCost.min}-{studio.estimatedMonthlyCost.max}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

function ScoreBadge({ score, max = 10 }: { score: number; max?: number }) {
  const pct = max === 100 ? score : score * 10
  const color = pct >= 70 ? "bg-green-100 text-green-800" : pct >= 40 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {score}{max === 100 ? "" : "/10"}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/browse-data/page.tsx
git commit -m "feat: add browse-data list page with studio table"
```

---

### Task 11: Build Studio Detail Page

**Files:**
- Create: `src/app/browse-data/[slug]/page.tsx`

- [ ] **Step 1: Create the detail page**

```tsx
import { notFound } from "next/navigation"
import Link from "next/link"
import { getStudioReport, getAllSlugs } from "@/lib/data"
import type { StudioReport, ProgressiveDisclosure } from "../../../../scripts/scraper/types"

export function generateStaticParams() {
  return getAllSlugs().map(slug => ({ slug }))
}

export default async function StudioDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const report = getStudioReport(slug)
  if (!report) notFound()

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/browse-data" className="text-sm text-blue-600 hover:underline">&larr; Back to list</Link>

      <div className="mt-4 mb-8">
        <h1 className="text-3xl font-bold">{report.studioName}</h1>
        <p className="mt-1 text-gray-500">
          {report.city} &middot;{" "}
          <a href={report.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {report.website}
          </a>
          &middot; Scraped {new Date(report.scrapedAt).toLocaleDateString()}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <TechCard report={report} />
        <FeaturesCard report={report} />
      </div>

      <NavigationCard report={report} />
      <ContentAssessmentCard report={report} />
      <ContactCard report={report} />
      <ExtractedDataCard report={report} />
    </main>
  )
}

function TechCard({ report }: { report: StudioReport }) {
  const lh = report.tech.lighthouse
  return (
    <section className="rounded-lg border border-gray-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Tech Stack</h2>
      <p className="mb-2 text-sm">
        Platform: <span className="font-medium">{report.tech.platform}</span>
      </p>
      <div className="mb-3 flex flex-wrap gap-1">
        {report.tech.detectedTechnologies.map(t => (
          <span key={t.name} className="rounded bg-gray-100 px-2 py-0.5 text-xs">{t.name}</span>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-4 gap-2 text-center text-xs">
        <LighthouseScore label="Perf" score={lh.performance} />
        <LighthouseScore label="A11y" score={lh.accessibility} />
        <LighthouseScore label="SEO" score={lh.seo} />
        <LighthouseScore label="Best" score={lh.bestPractices} />
      </div>
      <div className="border-t pt-3 text-sm">
        <p className="font-medium">
          Est. ${report.tech.totalEstimatedMonthlyCost.min}-{report.tech.totalEstimatedMonthlyCost.max}/mo
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-gray-600">
          {report.tech.costBreakdown.map(c => (
            <li key={c.item}>{c.item}: ${c.estimatedMonthlyCost.min}-{c.estimatedMonthlyCost.max}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function LighthouseScore({ label, score }: { label: string; score: number }) {
  const color = score >= 90 ? "text-green-700" : score >= 50 ? "text-yellow-700" : "text-red-700"
  return (
    <div>
      <div className={`text-lg font-bold ${color}`}>{score}</div>
      <div className="text-gray-500">{label}</div>
    </div>
  )
}

function FeaturesCard({ report }: { report: StudioReport }) {
  const f = report.features
  const items = [
    { label: "Online Booking", value: f.onlineBooking ?? "None" },
    { label: "Online Classes", value: f.onlineClasses ? "Yes" : "No" },
    { label: "Chat", value: f.chat ?? "None" },
    { label: "E-commerce", value: f.ecommerce ? "Yes" : "No" },
    { label: "Newsletter", value: f.newsletter ? "Yes" : "No" },
    { label: "Blog", value: f.blog ? "Yes" : "No" },
    { label: "Multi-language", value: f.multiLanguage ? "Yes" : "No" },
  ]

  return (
    <section className="rounded-lg border border-gray-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Features</h2>
      <dl className="space-y-1 text-sm">
        {items.map(i => (
          <div key={i.label} className="flex justify-between">
            <dt className="text-gray-500">{i.label}</dt>
            <dd className="font-medium">{i.value}</dd>
          </div>
        ))}
      </dl>
      {f.addOnServices.length > 0 && (
        <div className="mt-3 border-t pt-3">
          <p className="text-xs text-gray-500">Add-on services:</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {f.addOnServices.map(s => (
              <span key={s} className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">{s}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function NavigationCard({ report }: { report: StudioReport }) {
  if (report.navigation.length === 0) return null
  return (
    <section className="mt-6 rounded-lg border border-gray-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Site Navigation ({report.navigation.length} links)</h2>
      <ul className="columns-2 gap-4 text-sm">
        {report.navigation.map(link => (
          <li key={link.href} className="truncate">
            <a href={link.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function DisclosureChecklist({ pd }: { pd: ProgressiveDisclosure }) {
  const items = [
    { label: "When", ok: pd.when },
    { label: "Where", ok: pd.where },
    { label: "Price", ok: pd.price },
    { label: "What", ok: pd.what },
    { label: "How long", ok: pd.howLong },
  ]
  return (
    <div className="flex gap-2">
      {items.map(i => (
        <span key={i.label} className={`rounded px-1.5 py-0.5 text-xs ${i.ok ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {i.ok ? "✓" : "✗"} {i.label}
        </span>
      ))}
    </div>
  )
}

function ContentAssessmentCard({ report }: { report: StudioReport }) {
  const ca = report.contentAssessment
  return (
    <section className="mt-6 rounded-lg border border-gray-200 p-6">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-lg font-semibold">Content Assessment</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ca.overallScore >= 7 ? "bg-green-100 text-green-800" : ca.overallScore >= 4 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}>
          {ca.overallScore}/10
        </span>
      </div>
      <p className="mb-4 text-sm text-gray-600">{ca.summary}</p>

      {ca.dropInPresentation && (
        <div className="mb-4 rounded bg-gray-50 p-3">
          <h3 className="text-sm font-medium">Drop-in Pages — {ca.dropInPresentation.score}/10</h3>
          <p className="mt-1 text-xs text-gray-600">{ca.dropInPresentation.notes}</p>
        </div>
      )}

      {ca.trainingPages.map(tp => (
        <div key={tp.url} className="mb-3 rounded bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">{tp.pageName} — {tp.score}/10</h3>
            <div className="flex gap-1">
              {tp.fillerContentWarning && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-800">Filler</span>}
              {tp.whyChooseUsWarning && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-800">&quot;Why us?&quot;</span>}
            </div>
          </div>
          <div className="mt-2"><DisclosureChecklist pd={tp.progressiveDisclosure} /></div>
          <p className="mt-2 text-xs text-gray-600">{tp.notes}</p>
        </div>
      ))}

      {ca.retreatPages.map(rp => (
        <div key={rp.url} className="mb-3 rounded bg-gray-50 p-3">
          <h3 className="text-sm font-medium">{rp.pageName} — {rp.score}/10</h3>
          <div className="mt-2"><DisclosureChecklist pd={rp.progressiveDisclosure} /></div>
          <p className="mt-2 text-xs text-gray-600">{rp.notes}</p>
        </div>
      ))}
    </section>
  )
}

function ContactCard({ report }: { report: StudioReport }) {
  const c = report.contact
  const hasData = c.email || c.phone || c.address || c.instagram || c.facebook
  if (!hasData) return null

  return (
    <section className="mt-6 rounded-lg border border-gray-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Contact Info</h2>
      <dl className="space-y-1 text-sm">
        {c.email && <div className="flex gap-2"><dt className="text-gray-500">Email:</dt><dd>{c.email}</dd></div>}
        {c.phone && <div className="flex gap-2"><dt className="text-gray-500">Phone:</dt><dd>{c.phone}</dd></div>}
        {c.whatsapp && <div className="flex gap-2"><dt className="text-gray-500">WhatsApp:</dt><dd>{c.whatsapp}</dd></div>}
        {c.address && <div className="flex gap-2"><dt className="text-gray-500">Address:</dt><dd>{c.address}</dd></div>}
        {c.instagram && <div className="flex gap-2"><dt className="text-gray-500">Instagram:</dt><dd>{c.instagram}</dd></div>}
        {c.facebook && <div className="flex gap-2"><dt className="text-gray-500">Facebook:</dt><dd>{c.facebook}</dd></div>}
      </dl>
    </section>
  )
}

function ExtractedDataCard({ report }: { report: StudioReport }) {
  const hasData = report.dropInClasses.length > 0 || report.trainings.length > 0 || report.retreats.length > 0
  if (!hasData) return null

  return (
    <section className="mt-6 rounded-lg border border-gray-200 p-6">
      <h2 className="mb-4 text-lg font-semibold">Extracted Data</h2>

      {report.dropInClasses.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-medium">Drop-in Classes ({report.dropInClasses.length})</h3>
          <div className="space-y-1 text-xs">
            {report.dropInClasses.map((c, i) => (
              <div key={i} className="flex justify-between rounded bg-gray-50 px-3 py-2">
                <span><strong>{c.className}</strong> ({c.style}) — {c.schedule}</span>
                {c.price && <span className="text-gray-600">{c.price}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.trainings.length > 0 && (
        <div className="mb-4">
          <h3 className="mb-2 text-sm font-medium">Trainings ({report.trainings.length})</h3>
          <div className="space-y-1 text-xs">
            {report.trainings.map((t, i) => (
              <div key={i} className="rounded bg-gray-50 px-3 py-2">
                <strong>{t.name}</strong> — {t.type}
                {t.certification && <span className="ml-2 rounded bg-blue-50 px-1.5 text-blue-700">{t.certification}</span>}
                {t.price && <span className="ml-2 text-gray-600">{t.price}</span>}
                {t.duration && <span className="ml-2 text-gray-500">{t.duration}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {report.retreats.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Retreats ({report.retreats.length})</h3>
          <div className="space-y-1 text-xs">
            {report.retreats.map((r, i) => (
              <div key={i} className="rounded bg-gray-50 px-3 py-2">
                <strong>{r.name}</strong>
                {r.price && <span className="ml-2 text-gray-600">{r.price}</span>}
                {r.duration && <span className="ml-2 text-gray-500">{r.duration}</span>}
                {r.description && <p className="mt-1 text-gray-500">{r.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/browse-data/
git commit -m "feat: add browse-data list and detail pages"
```

---

### Task 12: End-to-End Test

- [ ] **Step 1: Scrape one studio**

Run: `npm run scrape:studio "Yin Yoga Foundation"`

Expected: `data/yin-yoga-foundation.json` created with all sections populated.

- [ ] **Step 2: Scrape a second studio (browser mode)**

Run: `npm run scrape:studio "Himalayan Yoga Association"`

Expected: `data/himalayan-yoga-association.json` created. Playwright used for fetching.

- [ ] **Step 3: Verify the UI**

Run: `npm run dev`

Visit http://localhost:3000/browse-data — should show 2 studios in the table.

Click a studio — should show full detail report with tech stack, Lighthouse scores, content assessment, extracted data.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: verify end-to-end scraper pipeline and browse-data UI"
```
