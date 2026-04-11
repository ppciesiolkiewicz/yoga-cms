// scripts/scraper/pipeline/raw-io.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { PagesJson, RawPage, RawStudio, FetchedPage, LighthouseScores, PageCategory } from "../types"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "../../../data")
const RAW_DIR = join(DATA_DIR, "raw")

export function rawDir(slug: string): string {
  return join(RAW_DIR, slug)
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

export interface WriteRawInput {
  slug: string
  studioName: string
  website: string
  homepage: { url: string; markdown: string; html: string; links: string[] }
  pages: Array<{
    url: string
    markdown: string
    category: PageCategory
    source: RawPage["source"]
    status: "ok" | "failed"
    error?: string
  }>
  lighthouse: LighthouseScores
}

export function writeRawStudio(input: WriteRawInput): void {
  const dir = rawDir(input.slug)
  mkdirSync(dir, { recursive: true })

  writeFileSync(join(dir, "home.md"), input.homepage.markdown, "utf-8")
  writeFileSync(join(dir, "home.html"), input.homepage.html, "utf-8")
  writeFileSync(join(dir, "lighthouse.json"), JSON.stringify(input.lighthouse, null, 2), "utf-8")

  const usedFiles = new Set<string>(["home.md", "home.html", "lighthouse.json", "pages.json"])
  const rawPages: RawPage[] = []
  const now = new Date().toISOString()

  // Homepage always an ok record (if we got this far, we have it).
  rawPages.push({
    status: "ok",
    url: input.homepage.url,
    file: "home.md",
    category: "home",
    source: "homepage-links",
    fetchedAt: now,
    bytes: Buffer.byteLength(input.homepage.markdown, "utf-8"),
  })

  for (const page of input.pages) {
    const file = resolveUniqueFile(usedFiles, slugFromPath(page.url), "md")
    if (page.status === "ok") {
      writeFileSync(join(dir, file), page.markdown, "utf-8")
      rawPages.push({
        status: "ok",
        url: page.url,
        file,
        category: page.category,
        source: page.source,
        fetchedAt: now,
        bytes: Buffer.byteLength(page.markdown, "utf-8"),
      })
    } else {
      rawPages.push({
        status: "failed",
        url: page.url,
        file,
        category: page.category,
        source: page.source,
        fetchedAt: now,
        error: page.error ?? "unknown error",
      })
    }
  }

  const pagesJson: PagesJson = {
    studioName: input.studioName,
    website: input.website,
    fetchedAt: new Date().toISOString(),
    pages: rawPages,
  }
  writeFileSync(join(dir, "pages.json"), JSON.stringify(pagesJson, null, 2), "utf-8")
}

export function rawExists(slug: string): boolean {
  return existsSync(join(rawDir(slug), "pages.json"))
}

export function rawFetchedAt(slug: string): Date | null {
  try {
    const raw = JSON.parse(readFileSync(join(rawDir(slug), "pages.json"), "utf-8")) as PagesJson
    return new Date(raw.fetchedAt)
  } catch {
    return null
  }
}

export function loadRawStudio(slug: string): RawStudio {
  const dir = rawDir(slug)
  const pagesJson = JSON.parse(readFileSync(join(dir, "pages.json"), "utf-8")) as PagesJson
  const lighthouse = JSON.parse(readFileSync(join(dir, "lighthouse.json"), "utf-8")) as LighthouseScores

  const homepageRecord = pagesJson.pages.find(p => p.category === "home")
  if (!homepageRecord) throw new Error(`No home page in raw for ${slug}`)
  if (homepageRecord.status !== "ok") throw new Error(`Home page record is failed for ${slug}`)

  const homepageMarkdown = readFileSync(join(dir, homepageRecord.file), "utf-8")
  const homepageHtml = readFileSync(join(dir, "home.html"), "utf-8")

  const pages: FetchedPage[] = []
  for (const record of pagesJson.pages) {
    if (record.status !== "ok") continue
    if (record.category === "home") continue
    // status is narrowed to "ok" here, so record.file is readable and record.bytes exists.
    const markdown = readFileSync(join(dir, record.file), "utf-8")
    pages.push({ url: record.url, markdown, category: record.category })
  }

  return {
    slug,
    studioName: pagesJson.studioName,
    website: pagesJson.website,
    fetchedAt: pagesJson.fetchedAt,
    pages,
    homepage: {
      url: homepageRecord.url,
      markdown: homepageMarkdown,
      html: homepageHtml,
      links: [], // not needed by analyze; only fetch classifier uses this
    },
    lighthouse,
  }
}

export function listRawSlugs(): string[] {
  if (!existsSync(RAW_DIR)) return []
  return readdirSync(RAW_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
}
