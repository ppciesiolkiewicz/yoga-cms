import { readFileSync, existsSync, readdirSync } from "fs"
import { join } from "path"
import type { StudioReport, StudioIndex, StudioIndexEntry } from "../../scripts/scraper/types"

const DATA_DIR = join(process.cwd(), "data")
const REPORTS_DIR = join(DATA_DIR, "reports")

export function getStudioIndex(): StudioIndex | null {
  const filePath = join(DATA_DIR, "index.json")
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, "utf-8")) as StudioIndex
}

export function getStudioReport(slug: string): StudioReport | null {
  const filePath = join(REPORTS_DIR, `${slug}.json`)
  if (!existsSync(filePath)) return null
  return JSON.parse(readFileSync(filePath, "utf-8")) as StudioReport
}

/** Scan data/reports/ for individual JSON files — works even before index.json is written. */
export function getAllSlugs(): string[] {
  if (!existsSync(REPORTS_DIR)) return []
  return readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => f.replace(/\.json$/, ""))
}

/** Build studio summaries by reading individual report files, so results appear incrementally. */
export function getAllStudioSummaries(): StudioIndexEntry[] {
  return getAllSlugs()
    .map(slug => {
      const report = getStudioReport(slug)
      if (!report) return null
      return {
        slug,
        studioName: report.studioName,
        city: report.city,
        platform: report.tech.platform,
        overallContentScore: report.contentAssessment.overallScore,
        estimatedMonthlyCost: { min: report.tech.totalEstimatedMonthlyCost.min, max: report.tech.totalEstimatedMonthlyCost.max },
        lighthousePerformance: report.tech.lighthouse.performance,
        pageCount: report.navigation.length,
      } satisfies StudioIndexEntry
    })
    .filter(s => s !== null)
}
