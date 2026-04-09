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
