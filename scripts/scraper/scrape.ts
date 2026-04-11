import { config } from "dotenv"
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { studios } from "./websites-data"
import { fetchStudio } from "./pipeline/fetch"
import { analyzeStudio } from "./pipeline/analyze"
import { rawExists, rawFetchedAt } from "./pipeline/raw-io"
import type { StudioEntry, StudioReport, StudioIndex } from "./types"

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, "../../.env") })

const DATA_DIR = join(__dirname, "../../data")
const REPORTS_DIR = join(DATA_DIR, "reports")

type Stage = "all" | "fetch" | "analyze"

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

interface Args {
  stage: Stage
  studioFilter?: string
  cityFilter?: string
  maxAgeDays: number
  limit?: number
  force: boolean
  skipMapFallback: boolean
}

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const out: Args = {
    stage: "all",
    maxAgeDays: 999,
    force: false,
    skipMapFallback: false,
  }
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === "--stage" && args[i + 1]) { out.stage = args[++i] as Stage }
    else if (a === "--studio" && args[i + 1]) { out.studioFilter = args[++i] }
    else if (a === "--city" && args[i + 1]) { out.cityFilter = args[++i] }
    else if (a === "--update-older-than-days" && args[i + 1]) { out.maxAgeDays = parseInt(args[++i], 10) }
    else if (a === "--limit" && args[i + 1]) { out.limit = parseInt(args[++i], 10) }
    else if (a === "--force") { out.force = true }
    else if (a === "--skip-map-fallback") { out.skipMapFallback = true }
  }
  return out
}

function reportPath(slug: string): string {
  return join(REPORTS_DIR, `${slug}.json`)
}

function readReport(slug: string): StudioReport | null {
  try { return JSON.parse(readFileSync(reportPath(slug), "utf-8")) as StudioReport } catch { return null }
}

function isReportFresh(slug: string, maxAgeDays: number): boolean {
  const report = readReport(slug)
  if (!report) return false
  const ageMs = Date.now() - new Date(report.scrapedAt).getTime()
  if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) return false
  const rawAt = rawFetchedAt(slug)
  if (rawAt && rawAt.getTime() > new Date(report.scrapedAt).getTime()) return false
  return true
}

function writeReport(report: StudioReport) {
  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(reportPath(report.slug), JSON.stringify(report, null, 2), "utf-8")
  console.log(`  ✓ Wrote data/reports/${report.slug}.json`)
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
  writeFileSync(join(DATA_DIR, "index.json"), JSON.stringify(index, null, 2), "utf-8")
  console.log(`\n✓ Wrote index with ${reports.length} studios`)
}

function filterStudios(args: Args): StudioEntry[] {
  let list = studios
  if (args.studioFilter) {
    list = list.filter(s => s.studioName.toLowerCase().includes(args.studioFilter!.toLowerCase()))
    if (list.length === 0) { console.error(`No studios matching "${args.studioFilter}"`); process.exit(1) }
  }
  if (args.cityFilter) {
    list = list.filter(s => s.city.toLowerCase().includes(args.cityFilter!.toLowerCase()))
    if (list.length === 0) { console.error(`No studios in city "${args.cityFilter}"`); process.exit(1) }
  }
  if (args.limit) list = list.slice(0, args.limit)
  return list
}

async function doFetch(list: StudioEntry[], args: Args): Promise<void> {
  for (const entry of list) {
    try {
      await fetchStudio(entry, { force: args.force, maxAgeDays: args.maxAgeDays, skipMapFallback: args.skipMapFallback })
    } catch (error) {
      console.error(`  ✗ Fetch failed for ${entry.studioName}: ${error instanceof Error ? error.message : error}`)
    }
  }
}

async function doAnalyze(list: StudioEntry[], args: Args): Promise<StudioReport[]> {
  const reports: StudioReport[] = []
  for (const entry of list) {
    const slug = slugify(entry.studioName)

    if (!rawExists(slug)) {
      console.warn(`  ⚠ No raw for ${entry.studioName} — run fetch first`)
      continue
    }

    if (!args.force && isReportFresh(slug, args.maxAgeDays)) {
      console.log(`─── analyze: ${entry.studioName} — fresh, skipping ───`)
      const existing = readReport(slug)
      if (existing) reports.push(existing)
      continue
    }

    try {
      const report = await analyzeStudio(entry)
      writeReport(report)
      reports.push(report)
    } catch (error) {
      console.error(`  ✗ Analyze failed for ${entry.studioName}: ${error instanceof Error ? error.message : error}`)
    }
  }
  return reports
}

function loadAllReports(): StudioReport[] {
  if (!existsSync(REPORTS_DIR)) return []
  const reports: StudioReport[] = []
  for (const file of readdirSync(REPORTS_DIR)) {
    if (!file.endsWith(".json")) continue
    try { reports.push(JSON.parse(readFileSync(join(REPORTS_DIR, file), "utf-8"))) } catch {}
  }
  return reports
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required")
    process.exit(1)
  }
  const args = parseArgs()
  const list = filterStudios(args)
  console.log(`Stage: ${args.stage} — ${list.length} studio(s) in scope`)

  if (args.stage === "fetch" || args.stage === "all") {
    await doFetch(list, args)
  }

  if (args.stage === "analyze" || args.stage === "all") {
    const produced = await doAnalyze(list, args)
    // Rebuild index from all reports (produced + untouched), deduped by slug
    const all = new Map<string, StudioReport>()
    for (const r of loadAllReports()) all.set(r.slug, r)
    for (const r of produced) all.set(r.slug, r)
    writeIndex(Array.from(all.values()))
  }
}

main()
