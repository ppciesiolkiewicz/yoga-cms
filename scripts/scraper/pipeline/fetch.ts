import type { StudioEntry } from "../types"
import { fetchStudioFirecrawl, type FetchOpts } from "./fetch-firecrawl"
import { fetchStudioLegacy } from "./fetch-legacy"
import { rawExists, rawFetchedAt } from "./raw-io"

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export interface FetchStudioOpts {
  force: boolean
  maxAgeDays: number
  skipMapFallback: boolean
}

export function isRawFresh(slug: string, maxAgeDays: number): boolean {
  if (!rawExists(slug)) return false
  const at = rawFetchedAt(slug)
  if (!at) return false
  const ageMs = Date.now() - at.getTime()
  return ageMs < maxAgeDays * 24 * 60 * 60 * 1000
}

export async function fetchStudio(entry: StudioEntry, opts: FetchStudioOpts): Promise<void> {
  const slug = slugify(entry.studioName)

  if (!opts.force && isRawFresh(slug, opts.maxAgeDays)) {
    console.log(`\n═══ fetch: ${entry.studioName} — cached, skipping ═══`)
    return
  }

  const fetcher = process.env.SCRAPER_FETCHER === "legacy" ? "legacy" : "firecrawl"
  if (fetcher === "legacy") {
    await fetchStudioLegacy(entry)
    return
  }

  const fcOpts: FetchOpts = { force: opts.force, skipMapFallback: opts.skipMapFallback }
  await fetchStudioFirecrawl(entry, fcOpts)
}

export { loadRawStudio, listRawSlugs } from "./raw-io"
