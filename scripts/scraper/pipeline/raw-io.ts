// scripts/scraper/pipeline/raw-io.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type {
  PagesJson,
  RawPage,
  RawStudio,
  FetchedPage,
  LighthouseScores,
  HomeJson,
  HomeLink,
  DiscoveryJson,
  DiscoveryCandidate,
} from "../types"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "../../../data")
const RAW_DIR = join(DATA_DIR, "raw")

export function rawDir(slug: string): string {
  return join(RAW_DIR, slug)
}

function ensureDir(slug: string): string {
  const dir = rawDir(slug)
  mkdirSync(dir, { recursive: true })
  return dir
}

export function slugFromPath(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.replace(/\/$/, "").split("/").pop() ?? ""
    if (!last || last === "") return "home"
    return last.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page"
  } catch {
    return "page"
  }
}

export function resolveUniqueFile(existing: Set<string>, base: string, ext: string): string {
  let candidate = `${base}.${ext}`
  let i = 2
  while (existing.has(candidate)) {
    candidate = `${base}-${i}.${ext}`
    i++
  }
  existing.add(candidate)
  return candidate
}

// ── Homepage artifacts ──

export interface HomepageArtifacts {
  url: string
  markdown: string
  html: string
  links: HomeLink[]
  headers?: Record<string, string>
}

export function writeHomepage(slug: string, data: HomepageArtifacts): void {
  const dir = ensureDir(slug)
  writeFileSync(join(dir, "home.md"), data.markdown, "utf-8")
  writeFileSync(join(dir, "home.html"), data.html, "utf-8")
  if (data.headers) {
    writeFileSync(join(dir, "home.headers.json"), JSON.stringify(data.headers, null, 2), "utf-8")
  }
  const homeJson: HomeJson = { url: data.url, links: data.links }
  writeFileSync(join(dir, "home.json"), JSON.stringify(homeJson, null, 2), "utf-8")
}

export function readHomepage(slug: string): HomepageArtifacts | null {
  const dir = rawDir(slug)
  const homeJsonPath = join(dir, "home.json")
  if (!existsSync(homeJsonPath)) return null
  const homeJson = JSON.parse(readFileSync(homeJsonPath, "utf-8")) as HomeJson
  const markdown = readFileSync(join(dir, "home.md"), "utf-8")
  const html = readFileSync(join(dir, "home.html"), "utf-8")
  const headersPath = join(dir, "home.headers.json")
  const headers = existsSync(headersPath)
    ? (JSON.parse(readFileSync(headersPath, "utf-8")) as Record<string, string>)
    : undefined
  return { url: homeJson.url, markdown, html, links: homeJson.links, headers }
}

export function homepageExists(slug: string): boolean {
  return existsSync(join(rawDir(slug), "home.json"))
}

// ── Discovery artifact ──

export function writeDiscovery(slug: string, data: DiscoveryJson): void {
  writeFileSync(join(ensureDir(slug), "discovery.json"), JSON.stringify(data, null, 2), "utf-8")
}

export function readDiscovery(slug: string): DiscoveryJson | null {
  const path = join(rawDir(slug), "discovery.json")
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf-8")) as DiscoveryJson
}

export function discoveryExists(slug: string): boolean {
  return existsSync(join(rawDir(slug), "discovery.json"))
}

// ── Fetched pages artifact ──

export interface WritePagesInput {
  slug: string
  studioName: string
  website: string
  pages: Array<{
    url: string
    markdown: string
    source: RawPage["source"]
    status: "ok" | "failed"
    error?: string
  }>
}

export function writePages(input: WritePagesInput): void {
  const dir = ensureDir(input.slug)
  const usedFiles = new Set<string>(["home.md", "home.html", "home.json", "home.headers.json", "lighthouse.json", "pages.json", "discovery.json"])
  const rawPages: RawPage[] = []
  const now = new Date().toISOString()

  for (const page of input.pages) {
    const file = resolveUniqueFile(usedFiles, slugFromPath(page.url), "md")
    if (page.status === "ok") {
      writeFileSync(join(dir, file), page.markdown, "utf-8")
      rawPages.push({
        status: "ok",
        url: page.url,
        file,
        source: page.source,
        fetchedAt: now,
        bytes: Buffer.byteLength(page.markdown, "utf-8"),
      })
    } else {
      rawPages.push({
        status: "failed",
        url: page.url,
        file,
        source: page.source,
        fetchedAt: now,
        error: page.error ?? "unknown error",
      })
    }
  }

  const pagesJson: PagesJson = {
    studioName: input.studioName,
    website: input.website,
    fetchedAt: now,
    pages: rawPages,
  }
  writeFileSync(join(dir, "pages.json"), JSON.stringify(pagesJson, null, 2), "utf-8")
}

export function readPages(slug: string): PagesJson | null {
  const path = join(rawDir(slug), "pages.json")
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, "utf-8")) as PagesJson
}

export function readFetchedPages(slug: string): FetchedPage[] {
  const pagesJson = readPages(slug)
  if (!pagesJson) return []
  const dir = rawDir(slug)
  const out: FetchedPage[] = []
  for (const record of pagesJson.pages) {
    if (record.status !== "ok") continue
    const markdown = readFileSync(join(dir, record.file), "utf-8")
    out.push({ url: record.url, markdown })
  }
  return out
}

export function pagesExists(slug: string): boolean {
  return existsSync(join(rawDir(slug), "pages.json"))
}

export function rawExists(slug: string): boolean {
  return pagesExists(slug)
}

export function rawFetchedAt(slug: string): Date | null {
  try {
    const raw = JSON.parse(readFileSync(join(rawDir(slug), "pages.json"), "utf-8")) as PagesJson
    return new Date(raw.fetchedAt)
  } catch {
    return null
  }
}

// ── Full raw loader (used by report stage) ──

export function loadRawStudio(slug: string): RawStudio {
  const home = readHomepage(slug)
  if (!home) throw new Error(`No home.json for ${slug}`)
  const pagesJson = readPages(slug)
  if (!pagesJson) throw new Error(`No pages.json for ${slug}`)

  const pages = readFetchedPages(slug)

  // Lighthouse has moved to data/analysis/<slug>/lighthouse.json in phase 2.
  // loadRawStudio no longer loads it; the report stage reads it directly.
  const emptyLighthouse: LighthouseScores = {
    performance: 0,
    accessibility: 0,
    seo: 0,
    bestPractices: 0,
  }

  return {
    slug,
    studioName: pagesJson.studioName,
    website: pagesJson.website,
    fetchedAt: pagesJson.fetchedAt,
    pages,
    homepage: {
      url: home.url,
      markdown: home.markdown,
      html: home.html,
      links: home.links,
      headers: home.headers,
    },
    lighthouse: emptyLighthouse,
  }
}

// ── Legacy lighthouse (data/raw/<slug>/lighthouse.json) ──
// Kept for the migration path; new fetch no longer writes here.

export function readLegacyLighthouse(slug: string): LighthouseScores | null {
  const path = join(rawDir(slug), "lighthouse.json")
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as LighthouseScores
  } catch {
    return null
  }
}

export function listRawSlugs(): string[] {
  if (!existsSync(RAW_DIR)) return []
  return readdirSync(RAW_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}

// ── Discovery candidate helper ──

export function candidatesFromLinks(
  links: HomeLink[],
  source: RawPage["source"] = "homepage-links",
): DiscoveryCandidate[] {
  return links.map(l => ({ url: l.href, label: l.label, source }))
}
