import Link from "next/link"
import { notFound } from "next/navigation"
import { getRepo } from "@/lib/repo-server"

export const dynamic = "force-dynamic"

interface Params {
  params: Promise<{ requestId: string }>
}

export default async function RequestDetailPage({ params }: Params) {
  const { requestId } = await params
  let request
  try {
    request = await getRepo().getRequest(requestId)
  } catch {
    notFound()
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Link href="/browse-data" className="text-sm text-blue-600 hover:underline">&larr; Requests</Link>
      <div className="mt-2 mb-6">
        <h1 className="text-3xl font-bold">{request.displayName ?? request.id}</h1>
        <p className="text-sm text-gray-500">{new Date(request.createdAt).toLocaleString()} • {request.sites.length} site(s) • {request.categories.length} categor{request.categories.length === 1 ? "y" : "ies"}</p>
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Categories</h2>
        <ul className="space-y-2">
          {request.categories.map(c => (
            <li key={c.id} className="rounded border border-gray-200 p-3">
              <div className="font-medium">{c.name}</div>
              <div className="text-sm text-gray-600">{c.extraInfo}</div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sites</h2>
        <ul className="divide-y divide-gray-200 rounded border border-gray-200">
          {request.sites.map(s => (
            <li key={s.id} className="px-4 py-3 hover:bg-gray-50">
              <Link href={`/browse-data/${request.id}/${s.id}`} className="font-medium text-blue-600 hover:underline">
                {String(s.meta?.name ?? s.url)}
              </Link>
              <div className="text-xs text-gray-500">{s.url}</div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
