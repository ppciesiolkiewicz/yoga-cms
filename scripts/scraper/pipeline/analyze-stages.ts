// scripts/scraper/pipeline/analyze-stages.ts
// Analyze pipeline stages: tech, lighthouse, content, extract, report.
// Each stage depends ONLY on fetch artifacts (data/raw/<slug>/).
// Report additionally reads the other analyze artifacts to assemble the final report.
// Classification is an internal helper (lazy cache), not a CLI stage.

import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type {
  StudioEntry,
  StudioReport,
  StudioIndex,
  NavLink,
  FetchedPage,
  PageCategory,
  ClassificationJson,
  TechFeaturesJson,
  LighthouseJson,
  ContentJson,
  ExtractedJson,
  HomeLink,
} from "../types"
import {
  readHomepage,
  readDiscovery,
  readFetchedPages,
  readPages,
} from "./raw-io"
import {
  writeClassification,
  readClassification,
  writeTechFeatures,
  readTechFeatures,
  writeLighthouse,
  readLighthouse,
  writeContent,
  readContent,
  writeExtracted,
  readExtracted,
} from "./analysis-io"
import { classifyLinks, fromOverrides } from "./classify-links"
import { detectTech } from "./tech-detect"
import { runLighthouse } from "./lighthouse"
import { assessContent } from "./content-assess"
import {
  extractDropInClasses,
  extractTrainings,
  extractRetreats,
  extractContactInfo,
} from "./data-extract"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "../../../data")
const REPORTS_DIR = join(DATA_DIR, "reports")

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`.replace(/\/$/, "").toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

// ── Classification helper (lazy cache, not a CLI stage) ──

async function computeClassification(
  entry: StudioEntry,
  slug: string,
): Promise<ClassificationJson> {
  const discovery = readDiscovery(slug)
  if (!discovery) throw new Error(`No discovery.json for ${entry.studioName} — run npm run fetch first`)

  const overrideSet = new Set<string>()
  if (entry.overrides) {
    for (const url of [
      ...(entry.overrides.dropIns ?? []),
      ...(entry.overrides.trainings ?? []),
      ...(entry.overrides.retreats ?? []),
      ...(entry.overrides.contact ? [entry.overrides.contact] : []),
    ]) overrideSet.add(normalizeUrl(url))
  }

  const toClassify: HomeLink[] = []
  const seen = new Set<string>()
  for (const c of discovery.candidates) {
    if (overrideSet.has(normalizeUrl(c.url))) continue
    const key = normalizeUrl(c.url)
    if (seen.has(key)) continue
    seen.add(key)
    toClassify.push({ label: c.label, href: c.url })
  }

  const result: ClassificationJson = {
    generatedAt: new Date().toISOString(),
    dropIn: [],
    training: [],
    retreat: [],
    contact: null,
  }

  if (entry.overrides) {
    const fromOver = fromOverrides(entry.overrides)
    result.dropIn.push(...fromOver.dropIns)
    result.training.push(...fromOver.trainings)
    result.retreat.push(...fromOver.retreats)
    if (fromOver.contact) result.contact = fromOver.contact
    console.log(`  Classify: overrides dropIn=${fromOver.dropIns.length} training=${fromOver.trainings.length} retreat=${fromOver.retreats.length}`)
  }

  if (toClassify.length > 0) {
    console.log(`  Classify: LLM on ${toClassify.length} links...`)
    const classified = await classifyLinks(entry.studioName, entry.website, toClassify)
    for (const url of classified.dropIns) if (!result.dropIn.includes(url)) result.dropIn.push(url)
    for (const url of classified.trainings) if (!result.training.includes(url)) result.training.push(url)
    for (const url of classified.retreats) if (!result.retreat.includes(url)) result.retreat.push(url)
    if (!result.contact && classified.contact) result.contact = classified.contact
  }

  return result
}

// In-flight cache so concurrent content+extract stages don't double-compute.
const classificationInFlight = new Map<string, Promise<ClassificationJson>>()

/**
 * Returns the studio's classification. Uses the disk cache at
 * `data/analysis/<slug>/classification.json` if present; otherwise runs the
 * classifier and writes the cache. Delete the file to force re-classification.
 */
async function getOrComputeClassification(
  entry: StudioEntry,
  slug: string,
): Promise<ClassificationJson> {
  const cached = readClassification(slug)
  if (cached) {
    console.log(`  Classify: using cached classification.json`)
    return cached
  }
  const existing = classificationInFlight.get(slug)
  if (existing) return existing
  const p = (async () => {
    const result = await computeClassification(entry, slug)
    writeClassification(slug, result)
    console.log(`  Classify: wrote classification.json`)
    return result
  })()
  classificationInFlight.set(slug, p)
  try {
    return await p
  } finally {
    classificationInFlight.delete(slug)
  }
}

function pagesByCategory(
  pages: FetchedPage[],
  classification: ClassificationJson,
  category: PageCategory,
): FetchedPage[] {
  const urlSet = new Set<string>()
  if (category === "dropIn") classification.dropIn.forEach(u => urlSet.add(normalizeUrl(u)))
  if (category === "training") classification.training.forEach(u => urlSet.add(normalizeUrl(u)))
  if (category === "retreat") classification.retreat.forEach(u => urlSet.add(normalizeUrl(u)))
  if (category === "contact" && classification.contact) urlSet.add(normalizeUrl(classification.contact))
  return pages.filter(p => urlSet.has(normalizeUrl(p.url)))
}

// ── Stage: tech ──

export async function analyzeTechStage(entry: StudioEntry): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n─── analyze:tech — ${entry.studioName} ───`)
  const home = readHomepage(slug)
  if (!home) throw new Error(`No homepage artifacts for ${entry.studioName} — run npm run fetch first`)

  const { tech, features } = await detectTech(home.url, home.html, home.headers)
  const payload: TechFeaturesJson = {
    generatedAt: new Date().toISOString(),
    tech,
    features,
  }
  writeTechFeatures(slug, payload)
  console.log(`  ✓ Wrote tech.json (platform: ${tech.platform}, ${tech.detectedTechnologies.length} technologies)`)
}

// ── Stage: lighthouse ──

export async function analyzeLighthouseStage(entry: StudioEntry): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n─── analyze:lighthouse — ${entry.studioName} ───`)
  const scores = await runLighthouse(entry.website)
  const payload: LighthouseJson = { generatedAt: new Date().toISOString(), scores }
  writeLighthouse(slug, payload)
  console.log(`  ✓ Wrote lighthouse.json (perf=${scores.performance}, seo=${scores.seo})`)
}

// ── Stage: content ──

export async function analyzeContentStage(entry: StudioEntry): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n─── analyze:content — ${entry.studioName} ───`)

  const classification = await getOrComputeClassification(entry, slug)
  const pages = readFetchedPages(slug)
  const dropInPages = pagesByCategory(pages, classification, "dropIn")
  const trainingPages = pagesByCategory(pages, classification, "training")
  const retreatPages = pagesByCategory(pages, classification, "retreat")

  const retryHint = `npm run analyze -- --stage content --studio "${entry.studioName}" --force`
  const assessment = await assessContent(
    entry.studioName,
    dropInPages,
    trainingPages,
    retreatPages,
    retryHint,
  )

  const payload: ContentJson = { generatedAt: new Date().toISOString(), assessment }
  writeContent(slug, payload)
  console.log(`  ✓ Wrote content.json (overallScore=${assessment.overallScore})`)
}

// ── Stage: extract ──

export async function analyzeExtractStage(entry: StudioEntry): Promise<void> {
  const slug = slugify(entry.studioName)
  console.log(`\n─── analyze:extract — ${entry.studioName} ───`)

  const classification = await getOrComputeClassification(entry, slug)
  const home = readHomepage(slug)
  if (!home) throw new Error(`No homepage artifacts for ${entry.studioName} — run npm run fetch first`)

  const pages = readFetchedPages(slug)
  const dropInPages = pagesByCategory(pages, classification, "dropIn")
  const trainingPages = pagesByCategory(pages, classification, "training")
  const retreatPages = pagesByCategory(pages, classification, "retreat")
  const contactPages = pagesByCategory(pages, classification, "contact")

  const homepageAsContact: FetchedPage = { url: home.url, markdown: home.markdown }

  const [dropInClasses, trainings, retreats, contact] = await Promise.all([
    extractDropInClasses(dropInPages, entry.studioName),
    extractTrainings(trainingPages, entry.studioName),
    extractRetreats(retreatPages, entry.studioName),
    extractContactInfo([...contactPages, homepageAsContact], entry.studioName),
  ])

  const contactPageUrl = contactPages[0]?.url
  if (contactPageUrl) contact.contactPageUrl = contactPageUrl

  const payload: ExtractedJson = {
    generatedAt: new Date().toISOString(),
    dropInClasses,
    trainings,
    retreats,
    contact,
  }
  writeExtracted(slug, payload)
  console.log(`  ✓ Wrote extracted.json (${dropInClasses.length} dropIns, ${trainings.length} trainings, ${retreats.length} retreats)`)
}

// ── Stage: report ──

function pageAvgScore(p: { conversionScore: number; seoScore: number }): number {
  return Math.round(((p.conversionScore + p.seoScore) / 2) * 10) / 10
}

function annotateNavigation(navigation: NavLink[], content: ContentJson): NavLink[] {
  const training = new Map(content.assessment.trainingPages.map(p => [normalizeUrl(p.url), pageAvgScore(p)]))
  const retreat = new Map(content.assessment.retreatPages.map(p => [normalizeUrl(p.url), pageAvgScore(p)]))
  const dropIn = new Map(content.assessment.dropInPages.map(p => [normalizeUrl(p.url), pageAvgScore(p)]))
  return navigation.map(link => {
    const key = normalizeUrl(link.href)
    if (training.has(key)) return { ...link, score: training.get(key), pageType: "training" as const }
    if (retreat.has(key)) return { ...link, score: retreat.get(key), pageType: "retreat" as const }
    if (dropIn.has(key)) return { ...link, score: dropIn.get(key), pageType: "dropIn" as const }
    return link
  })
}

function extractNavFromHtml(html: string, baseUrl: string): NavLink[] {
  const navRegex = /<(nav|header)[^>]*>([\s\S]*?)<\/\1>/gi
  const linkRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const base = (() => { try { return new URL(baseUrl) } catch { return null } })()
  const seen = new Set<string>()
  const out: NavLink[] = []
  let navMatch: RegExpExecArray | null
  while ((navMatch = navRegex.exec(html))) {
    const block = navMatch[2]
    let linkMatch: RegExpExecArray | null
    while ((linkMatch = linkRegex.exec(block))) {
      const href = linkMatch[1]
      const label = linkMatch[2].replace(/<[^>]+>/g, "").trim()
      if (!label || label.length > 100) continue
      let full: URL
      try { full = new URL(href, baseUrl) } catch { continue }
      if (base && full.hostname !== base.hostname) continue
      if (seen.has(full.href)) continue
      seen.add(full.href)
      out.push({ label, href: full.href })
    }
  }
  return out
}

export async function analyzeReportStage(entry: StudioEntry): Promise<StudioReport> {
  const slug = slugify(entry.studioName)
  console.log(`\n─── analyze:report — ${entry.studioName} ───`)

  const home = readHomepage(slug)
  if (!home) throw new Error(`No homepage artifacts for ${entry.studioName}`)
  const pagesJson = readPages(slug)
  if (!pagesJson) throw new Error(`No pages.json for ${entry.studioName}`)
  const techJson = readTechFeatures(slug)
  if (!techJson) throw new Error(`No tech.json for ${entry.studioName} — run analyze --stage tech first`)
  const lighthouseJson = readLighthouse(slug)
  if (!lighthouseJson) throw new Error(`No lighthouse.json for ${entry.studioName} — run analyze --stage lighthouse first`)
  const contentJson = readContent(slug)
  if (!contentJson) throw new Error(`No content.json for ${entry.studioName} — run analyze --stage content first`)
  const extracted = readExtracted(slug)
  if (!extracted) throw new Error(`No extracted.json for ${entry.studioName} — run analyze --stage extract first`)

  const rawNavigation = extractNavFromHtml(home.html, home.url)
  const navigation = annotateNavigation(rawNavigation, contentJson)

  const report: StudioReport = {
    slug,
    studioName: entry.studioName,
    city: entry.city,
    website: entry.website,
    searchRanking: entry.searchRanking,
    scrapedAt: new Date().toISOString(),
    navigation,
    tech: { ...techJson.tech, lighthouse: lighthouseJson.scores },
    features: techJson.features,
    contentAssessment: contentJson.assessment,
    contact: extracted.contact,
    dropInClasses: extracted.dropInClasses,
    trainings: extracted.trainings,
    retreats: extracted.retreats,
  }

  mkdirSync(REPORTS_DIR, { recursive: true })
  writeFileSync(join(REPORTS_DIR, `${slug}.json`), JSON.stringify(report, null, 2), "utf-8")
  console.log(`  ✓ Wrote data/reports/${slug}.json`)
  return report
}

// ── Index rebuild ──

export function rebuildIndex(): void {
  if (!existsSync(REPORTS_DIR)) {
    console.warn(`  ⚠ No reports dir at ${REPORTS_DIR}`)
    return
  }
  const all: StudioReport[] = []
  for (const file of readdirSync(REPORTS_DIR)) {
    if (!file.endsWith(".json") || file === "index.json") continue
    try {
      all.push(JSON.parse(readFileSync(join(REPORTS_DIR, file), "utf-8")) as StudioReport)
    } catch {
      // ignore malformed
    }
  }
  const index: StudioIndex = {
    generatedAt: new Date().toISOString(),
    studios: all.map(r => ({
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
  console.log(`\n✓ Rebuilt data/index.json with ${all.length} studios`)
}
