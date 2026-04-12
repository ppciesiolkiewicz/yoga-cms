import Link from "next/link"
import { notFound } from "next/navigation"
import { getRepo } from "@/lib/repo-server"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui"

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
      <Link href="/browse-data" className="text-sm text-blue-600 hover:underline">&larr; All Analyses</Link>
      <div className="mt-2 mb-6">
        <h1 className="text-3xl font-bold">{request.displayName ?? request.id}</h1>
        <p className="text-sm text-gray-500">
          {new Date(request.createdAt).toLocaleString()} · {request.sites.length} site(s) · {request.categories.length} categor{request.categories.length === 1 ? "y" : "ies"}
        </p>
      </div>

      <section className="mb-8 rounded-lg border border-gray-200 bg-white">
        <Accordion>
          <AccordionItem value="configuration">
            <AccordionTrigger className="px-4 py-3 text-lg font-semibold text-gray-900">
              <span>Configuration</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y divide-gray-100 px-4 pb-4">
                {request.categories.map(c => (
                  <div key={c.id} className="py-3 first:pt-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.wappalyzer && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs text-purple-700">wappalyzer</span>
                      )}
                      {c.lighthouse && (
                        <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs text-orange-700">lighthouse</span>
                      )}
                    </div>
                    {c.extraInfo && (
                      <p className="mt-1 text-sm text-gray-600">{c.extraInfo}</p>
                    )}
                    <Accordion className="mt-2">
                      <AccordionItem value={`prompt-${c.id}`}>
                        <AccordionTrigger className="text-xs text-blue-600 hover:underline py-1">
                          <span>View prompt</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="mt-1 whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                            {c.prompt}
                          </pre>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Sites</h2>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {request.sites.map(s => (
            <li key={s.id} className="px-4 py-3 hover:bg-gray-50">
              <Link href={`/browse-data/${request.id}/${s.id}`} className="font-medium text-blue-600 hover:underline">
                {String(s.meta?.name ?? s.url)}
              </Link>
              <div className="text-xs text-gray-500">{s.url}</div>
              {s.meta && Object.keys(s.meta).filter(k => k !== "name").length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(s.meta).filter(([k]) => k !== "name").map(([k, v]) => (
                    <span key={k} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                      {k}: {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
