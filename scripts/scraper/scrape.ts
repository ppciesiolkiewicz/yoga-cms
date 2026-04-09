import { config } from "dotenv"
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs"
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
    if (args[i] === "--studio" && args[i + 1]) { studioFilter = args[i + 1]; i++ }
    if (args[i] === "--update-older-than-days" && args[i + 1]) { maxAgeDays = parseInt(args[i + 1], 10); i++ }
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
  } catch { return true }
}

function getAllPages(entry: StudioEntry): ScrapableUrl[] {
  return [...entry.dropIns, ...entry.trainings, ...entry.retreats, ...(entry.contact ? [entry.contact] : [])]
}

async function scrapeStudio(entry: StudioEntry): Promise<StudioReport> {
  const slug = slugify(entry.studioName)
  console.log(`\n═══ ${entry.studioName} (${entry.city}) ═══`)

  // Stage 1: Fetch pages
  const allPages = getAllPages(entry)
  const { navigation, pages } = await fetchStudioPages(entry.website, allPages)

  // Categorize fetched pages by type
  const dropInUrls = new Set(entry.dropIns.map(u => u.url))
  const trainingUrls = new Set(entry.trainings.map(u => u.url))
  const retreatUrls = new Set(entry.retreats.map(u => u.url))
  const contactUrls = new Set(entry.contact ? [entry.contact.url] : [])

  const dropInPages = pages.filter(p => dropInUrls.has(p.url))
  const trainingPages = pages.filter(p => trainingUrls.has(p.url))
  const retreatPages = pages.filter(p => retreatUrls.has(p.url))
  const contactPages = pages.filter(p => contactUrls.has(p.url))

  // Stage 2: Tech detection (use first page HTML or empty)
  const homepageHtml = pages[0]?.html ?? ""
  const { tech, features } = await detectTech(entry.website, homepageHtml)

  // Stage 3: Lighthouse
  const lighthouse = await runLighthouse(entry.website)

  // Stage 4: Content assessment
  const contentAssessment = await assessContent(entry.studioName, dropInPages, trainingPages, retreatPages)

  // Stage 5: Data extraction (parallel)
  const [dropInClasses, trainings, retreats, contact] = await Promise.all([
    extractDropInClasses(dropInPages, entry.studioName),
    extractTrainings(trainingPages, entry.studioName),
    extractRetreats(retreatPages, entry.studioName),
    extractContactInfo([...contactPages, ...pages.slice(0, 1)], entry.studioName),
  ])

  if (entry.contact) contact.contactPageUrl = entry.contact.url

  return {
    slug, studioName: entry.studioName, city: entry.city, website: entry.website,
    scrapedAt: new Date().toISOString(), navigation,
    tech: { ...tech, lighthouse }, features, contentAssessment, contact,
    dropInClasses, trainings, retreats,
  }
}

function writeReport(report: StudioReport) {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(join(DATA_DIR, `${report.slug}.json`), JSON.stringify(report, null, 2), "utf-8")
  console.log(`  ✓ Wrote data/${report.slug}.json`)
}

function writeIndex(reports: StudioReport[]) {
  const index: StudioIndex = {
    generatedAt: new Date().toISOString(),
    studios: reports.map(r => ({
      slug: r.slug, studioName: r.studioName, city: r.city,
      platform: r.tech.platform, overallContentScore: r.contentAssessment.overallScore,
      estimatedMonthlyCost: r.tech.totalEstimatedMonthlyCost,
      lighthousePerformance: r.tech.lighthouse.performance,
      pageCount: r.navigation.length,
    })),
  }
  writeFileSync(join(DATA_DIR, "index.json"), JSON.stringify(index, null, 2), "utf-8")
  console.log(`\n✓ Wrote index with ${reports.length} studios`)
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required")
    process.exit(1)
  }
  const { studioFilter, maxAgeDays } = parseArgs()
  let toScrape = studios
  if (studioFilter) {
    toScrape = studios.filter(s => s.studioName.toLowerCase().includes(studioFilter.toLowerCase()))
    if (toScrape.length === 0) { console.error(`No studios matching "${studioFilter}"`); process.exit(1) }
  }
  toScrape = toScrape.filter(s => isStale(slugify(s.studioName), maxAgeDays))
  if (toScrape.length === 0) { console.log("All studios are up to date."); return }

  console.log(`Scraping ${toScrape.length} studio(s)...\n`)
  const reports: StudioReport[] = []

  // Load existing reports we're not re-scraping
  if (existsSync(DATA_DIR)) {
    const scrapeSlugs = new Set(toScrape.map(s => slugify(s.studioName)))
    for (const file of readdirSync(DATA_DIR)) {
      if (file === "index.json" || !file.endsWith(".json")) continue
      const slug = file.replace(".json", "")
      if (!scrapeSlugs.has(slug)) {
        try { reports.push(JSON.parse(readFileSync(join(DATA_DIR, file), "utf-8"))) } catch {}
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
