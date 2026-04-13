import { notFound } from "next/navigation"
import { getRepo } from "@/lib/repo-server"
import CategoryBlock from "./CategoryBlock"
import { NavigationCard } from "./NavigationCard"
import { SitesSidebar } from "./SitesSidebar"
import { PageNav } from "./PageNav"
import { SectionDivider } from "./SectionDivider"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ requestId: string; siteId: string }>
}

interface AIQueryInfo {
  id: string
  stage: string
  categoryId?: string
  prompt: string
  dataRefs: string[]
  model: string
}

type TaskStatus = "pending" | "running" | "completed" | "failed" | "not-requested"

type CategoryProgress = Record<string, TaskStatus>

interface ResultFile {
  request: {
    id: string
    displayName?: string
    categories: Array<{ id: string; name: string; extraInfo: string }>
    sites: Array<{ id: string; url: string; meta?: Record<string, unknown> }>
  }
  sites: Array<{
    siteId: string
    url: string
    artifacts: Record<string, unknown>
    queries?: AIQueryInfo[]
  }>
}

interface TechArtifact {
  platform: string
  detectedTechnologies: Array<{ name: string; categories: string[]; version?: string; confidence?: number }>
  costBreakdown: Array<{ item: string; min: number; max: number }>
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
}

interface LighthouseArtifact {
  url?: string
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

interface ExtractArtifact {
  categoryId: string
  records: unknown[]
}

export default async function SiteDetailPage({ params }: Params) {
  const { requestId, siteId } = await params
  const repo = getRepo()

  let result: ResultFile
  try {
    result = await repo.getJson<ResultFile>({ requestId, stage: "", name: "result.json" })
  } catch {
    return notFound()
  }

  const site = result.sites.find(s => s.siteId === siteId)
  const siteMeta = result.request.sites.find(s => s.id === siteId)
  if (!site || !siteMeta) return notFound()
  const siteData = site

  // Per-category artifact maps
  const techMap = (siteData.artifacts["detect-tech"] ?? {}) as Record<string, TechArtifact>
  const lighthouseMap = (siteData.artifacts["run-lighthouse"] ?? {}) as Record<string, LighthouseArtifact>
  const extractMap = (siteData.artifacts["extract-pages-content"] ?? {}) as Record<string, ExtractArtifact>
  const progressMap = (siteData.artifacts["progress"] ?? {}) as Record<string, CategoryProgress>

  const nav = siteData.artifacts["parse-links"] as
    | { links: Array<{ label: string; href: string }> }
    | undefined

  const classify = (
    siteData.artifacts["classify-nav"] as { byCategory: Record<string, string[]> } | undefined
  )?.byCategory ?? {}

  const report = siteData.artifacts["build-report"] as { scrapedAt?: string } | undefined
  const displayName = result.request.displayName ?? requestId
  const siteName = String(siteMeta.meta?.name ?? siteMeta.url)

  const siteQueries: AIQueryInfo[] = siteData.queries ?? []

  const sidebarSites = result.request.sites.map(s => {
    const siteData = result.sites.find(rs => rs.siteId === s.id)
    const siteTechMap = (siteData?.artifacts["detect-tech"] ?? {}) as Record<string, TechArtifact>
    const siteLhMap = (siteData?.artifacts["run-lighthouse"] ?? {}) as Record<string, LighthouseArtifact>
    const siteProgressMap = (siteData?.artifacts["progress"] ?? {}) as Record<string, CategoryProgress>

    const firstTech = Object.values(siteTechMap)[0]
    const platform = firstTech?.platform

    const firstLh = Object.values(siteLhMap)[0]

    const allStatuses = Object.values(siteProgressMap).flatMap(cp => Object.values(cp))
    const hasFailed = allStatuses.some(st => st === "failed")
    const hasRunning = allStatuses.some(st => st === "running")
    const allDone = allStatuses.length > 0 && allStatuses.every(st => st === "completed" || st === "not-requested")
    const overallStatus = hasFailed ? "failed" as const
      : hasRunning ? "running" as const
      : allDone ? "completed" as const
      : "pending" as const

    const siteExtractMap = (siteData?.artifacts["extract-pages-content"] ?? {}) as Record<string, ExtractArtifact>
    const recordCount = Object.values(siteExtractMap).reduce((sum, e) => sum + (e.records?.length ?? 0), 0)

    const meta = s.meta ?? {}

    return {
      id: s.id,
      url: s.url,
      name: String(s.meta?.name ?? s.url),
      platform,
      lighthouse: firstLh ? {
        performance: firstLh.performance,
        accessibility: firstLh.accessibility,
        seo: firstLh.seo,
      } : undefined,
      overallStatus,
      recordCount,
      meta: Object.fromEntries(Object.entries(meta).filter(([k]) => k !== "name")),
    }
  })

  // Order: home → navigation → other categories → contact
  const homeCategory = result.request.categories.find(c => c.name.toLowerCase() === "home")
  const contactCategory = result.request.categories.find(c => c.name.toLowerCase() === "contact")
  const otherCategories = result.request.categories.filter(
    c => c.name.toLowerCase() !== "home" && c.name.toLowerCase() !== "contact"
  )
  const orderedCategories = [
    ...(homeCategory ? [homeCategory] : []),
    ...otherCategories,
    ...(contactCategory ? [contactCategory] : []),
  ]

  const sections = [
    { id: "navigation", label: "Page Navigation" },
    ...(homeCategory ? [{ id: `category-${homeCategory.id}`, label: homeCategory.name }] : []),
    ...otherCategories.map(c => ({ id: `category-${c.id}`, label: c.name })),
    ...(contactCategory ? [{ id: `category-${contactCategory.id}`, label: contactCategory.name }] : []),
  ]

  function renderCategory(cat: typeof result.request.categories[number]) {
    const classifiedUrls = classify[cat.id] ?? []
    const extractedRecords = extractMap[cat.id]?.records ?? []
    const tech = techMap[cat.id] ?? undefined
    const lighthouse = lighthouseMap[cat.id] ?? undefined
    const progress = progressMap[cat.id] ?? undefined
    if (
      classifiedUrls.length === 0 &&
      extractedRecords.length === 0 &&
      !tech &&
      !lighthouse
    ) {
      return null
    }
    const categoryQueries = siteQueries.filter(q => q.categoryId === cat.id)
    const assessMap = (siteData.artifacts["assess-pages"] ?? {}) as Record<string, { pages?: unknown[] }>
    const contentPages = (assessMap[cat.id]?.pages ?? []) as Array<{ url: string; pageName: string; conversionScore: number; seoScore: number; notes: string }>
    return (
      <CategoryBlock
        key={cat.id}
        categoryId={cat.id}
        categoryName={cat.name}
        extraInfo={cat.extraInfo}
        classifiedUrls={classifiedUrls}
        contentPages={contentPages}
        extractedRecords={extractedRecords}
        queries={categoryQueries}
        tech={tech}
        lighthouse={lighthouse}
        progress={progress}
      />
    )
  }

  return (
    <>
      <SitesSidebar
        requestId={requestId}
        displayName={displayName}
        sites={sidebarSites}
        currentSiteId={siteId}
      />

      <main className="ml-65 min-h-screen bg-surface-alt px-8 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">{siteName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
              <a href={siteMeta.url} target="_blank" rel="noopener noreferrer" className="text-accent-fg hover:underline">
                {siteMeta.url}
              </a>
              {report?.scrapedAt && (
                <span>Scraped {new Date(report.scrapedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <NavigationCard
            nav={nav}
            classify={classify ? { byCategory: classify } : undefined}
            categories={result.request.categories.map(c => ({ id: c.id, name: c.name }))}
          />

          {homeCategory && (
            <>
              <SectionDivider />
              {renderCategory(homeCategory)}
            </>
          )}

          {otherCategories.map(cat => (
            <div key={cat.id}>
              <SectionDivider />
              {renderCategory(cat)}
            </div>
          ))}

          {contactCategory && (
            <>
              <SectionDivider />
              {renderCategory(contactCategory)}
            </>
          )}
        </div>
      </main>

      <PageNav sections={sections} />
    </>
  )
}
