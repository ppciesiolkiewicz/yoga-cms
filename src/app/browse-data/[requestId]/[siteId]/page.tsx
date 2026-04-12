import { notFound } from "next/navigation"
import { getRepo } from "@/lib/repo-server"
import CategoryBlock from "./CategoryBlock"
import { TechCard } from "./TechCard"
import { NavigationCard } from "./NavigationCard"
import { SitesSidebar } from "./SitesSidebar"
import { ScrollSpy } from "./ScrollSpy"

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

export default async function SiteDetailPage({ params }: Params) {
  const { requestId, siteId } = await params
  const repo = getRepo()

  let result: ResultFile
  try {
    result = await repo.getJson<ResultFile>({ requestId, stage: "", name: "result.json" })
  } catch {
    notFound()
  }

  const site = result.sites.find(s => s.siteId === siteId)
  const siteMeta = result.request.sites.find(s => s.id === siteId)
  if (!site || !siteMeta) notFound()

  const tech = site.artifacts["tech"] as
    | {
        platform: string
        detectedTechnologies: Array<{ name: string; categories: string[]; version?: string; confidence?: number }>
        costBreakdown: Array<{ item: string; min: number; max: number }>
        totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
      }
    | undefined

  const lighthouse = site.artifacts["lighthouse"] as
    | { performance: number; accessibility: number; seo: number; bestPractices: number }
    | undefined

  const nav = site.artifacts["extract-nav"] as
    | { links: Array<{ label: string; href: string }> }
    | undefined

  const classify = (
    site.artifacts["classify"] as { byCategory: Record<string, string[]> } | undefined
  )?.byCategory ?? {}

  const content = (
    site.artifacts["content"] as {
      categories: Array<{ categoryId: string; categoryName: string; pages: Array<{ url: string; pageName: string; conversionScore: number; seoScore: number; notes: string }> }>
    } | undefined
  )?.categories ?? []

  const extract = (
    site.artifacts["extract"] as { byCategory: Record<string, unknown[]> } | undefined
  )?.byCategory ?? {}

  const report = site.artifacts["report"] as { scrapedAt?: string } | undefined
  const displayName = result.request.displayName ?? requestId
  const siteName = String(siteMeta.meta?.name ?? siteMeta.url)

  const siteQueries: AIQueryInfo[] = site.queries ?? []

  const sidebarSites = result.request.sites.map(s => ({
    id: s.id,
    url: s.url,
    name: String(s.meta?.name ?? s.url),
  }))

  const sectionIds = [
    "tech",
    "navigation",
    ...result.request.categories.map(c => `category-${c.id}`),
  ]

  return (
    <>
      <SitesSidebar
        requestId={requestId}
        displayName={displayName}
        sites={sidebarSites}
        currentSiteId={siteId}
      />

      <main className="ml-65 min-h-screen bg-gray-50 px-8 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{siteName}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
              <a href={siteMeta.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                {siteMeta.url}
              </a>
              {report?.scrapedAt && (
                <span>Scraped {new Date(report.scrapedAt).toLocaleDateString()}</span>
              )}
            </div>
          </div>

          <TechCard tech={tech} lighthouse={lighthouse} />
          <NavigationCard
            nav={nav}
            classify={classify ? { byCategory: classify } : undefined}
            categories={result.request.categories.map(c => ({ id: c.id, name: c.name }))}
          />

          {result.request.categories.map(cat => {
            const classifiedUrls = classify[cat.id] ?? []
            const contentPages = content.find(c => c.categoryId === cat.id)?.pages ?? []
            const extractedRecords = (extract[cat.id] ?? []) as unknown[]
            if (
              classifiedUrls.length === 0 &&
              contentPages.length === 0 &&
              extractedRecords.length === 0
            ) {
              return null
            }
            const categoryQueries = siteQueries.filter(q => q.categoryId === cat.id)
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
              />
            )
          })}
        </div>
      </main>

      <ScrollSpy sectionIds={sectionIds} />
    </>
  )
}
