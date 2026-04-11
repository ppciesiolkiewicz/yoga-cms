// scripts/scraper/pipeline/analyze.ts
import type { StudioReport, StudioEntry, FetchedPage, NavLink, ContentAssessment } from "../types"
import { loadRawStudio } from "./raw-io"
import { detectTech } from "./tech-detect"
import { assessContent } from "./content-assess"
import {
  extractDropInClasses,
  extractTrainings,
  extractRetreats,
  extractContactInfo,
} from "./data-extract"

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

function annotateNavigationWithScores(
  navigation: NavLink[],
  assessment: ContentAssessment,
  dropInPageUrls: string[],
): NavLink[] {
  const trainingByUrl = new Map(
    assessment.trainingPages.map(p => [normalizeUrl(p.url), p.score]),
  )
  const retreatByUrl = new Map(
    assessment.retreatPages.map(p => [normalizeUrl(p.url), p.score]),
  )
  const dropInUrls = new Set(dropInPageUrls.map(normalizeUrl))
  const dropInScore = assessment.dropInPresentation?.score

  return navigation.map(link => {
    const key = normalizeUrl(link.href)
    if (trainingByUrl.has(key)) {
      return { ...link, score: trainingByUrl.get(key), pageType: "training" as const }
    }
    if (retreatByUrl.has(key)) {
      return { ...link, score: retreatByUrl.get(key), pageType: "retreat" as const }
    }
    if (dropInUrls.has(key) && dropInScore !== undefined) {
      return { ...link, score: dropInScore, pageType: "dropIn" as const }
    }
    return link
  })
}

function extractNavFromHtml(html: string, baseUrl: string): NavLink[] {
  // Minimal re-implementation to avoid a cheerio dependency in analyze.
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

export async function analyzeStudio(entry: StudioEntry): Promise<StudioReport> {
  const slug = slugify(entry.studioName)
  console.log(`\n─── analyze: ${entry.studioName} ───`)
  const raw = loadRawStudio(slug)

  const dropInPages: FetchedPage[] = raw.pages.filter(p => p.category === "dropIn")
  const trainingPages: FetchedPage[] = raw.pages.filter(p => p.category === "training")
  const retreatPages: FetchedPage[] = raw.pages.filter(p => p.category === "retreat")
  const contactPages: FetchedPage[] = raw.pages.filter(p => p.category === "contact")

  const rawNavigation = extractNavFromHtml(raw.homepage.html, raw.website)

  const { tech, features } = await detectTech(raw.website, raw.homepage.html)
  const lighthouse = raw.lighthouse

  const contentAssessment = await assessContent(
    entry.studioName,
    dropInPages,
    trainingPages,
    retreatPages,
  )

  const homepageAsContact: FetchedPage = {
    url: raw.homepage.url,
    markdown: raw.homepage.markdown,
    category: "home",
  }

  const [dropInClasses, trainings, retreats, contact] = await Promise.all([
    extractDropInClasses(dropInPages, entry.studioName),
    extractTrainings(trainingPages, entry.studioName),
    extractRetreats(retreatPages, entry.studioName),
    extractContactInfo([...contactPages, homepageAsContact], entry.studioName),
  ])

  const contactPageUrl = contactPages[0]?.url
  if (contactPageUrl) contact.contactPageUrl = contactPageUrl

  const navigation = annotateNavigationWithScores(
    rawNavigation,
    contentAssessment,
    dropInPages.map(p => p.url),
  )

  return {
    slug,
    studioName: entry.studioName,
    city: entry.city,
    website: entry.website,
    searchRanking: entry.searchRanking,
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
