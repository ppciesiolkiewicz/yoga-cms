import Link from "next/link"
import { notFound } from "next/navigation"
import { getRepo } from "@/lib/repo-server"
import CategoryBlock from "./CategoryBlock"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ requestId: string; siteId: string }>
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

  const classify = (site.artifacts["classify"] as { byCategory: Record<string, string[]> } | undefined)?.byCategory ?? {}
  const content = (site.artifacts["content"] as { categories: Array<{ categoryId: string; pages: unknown[] }> } | undefined)?.categories ?? []
  const extract = (site.artifacts["extract"] as { byCategory: Record<string, unknown[]> } | undefined)?.byCategory ?? {}

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`/browse-data/${requestId}`} className="text-sm text-blue-600 hover:underline">&larr; {result.request.displayName ?? requestId}</Link>
      <div className="mt-2 mb-6">
        <h1 className="text-3xl font-bold">{String(siteMeta.meta?.name ?? siteMeta.url)}</h1>
        <p className="text-sm text-gray-500"><a href={siteMeta.url} className="underline">{siteMeta.url}</a></p>
      </div>

      {result.request.categories.map(cat => {
        const classifiedUrls = classify[cat.id] ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const contentPages = ((content.find(c => c.categoryId === cat.id)?.pages ?? []) as any[])
        const extractedRecords = (extract[cat.id] ?? []) as unknown[]
        if (classifiedUrls.length === 0 && contentPages.length === 0 && extractedRecords.length === 0) return null
        return (
          <CategoryBlock
            key={cat.id}
            categoryName={cat.name}
            extraInfo={cat.extraInfo}
            classifiedUrls={classifiedUrls}
            contentPages={contentPages}
            extractedRecords={extractedRecords}
          />
        )
      })}
    </main>
  )
}
