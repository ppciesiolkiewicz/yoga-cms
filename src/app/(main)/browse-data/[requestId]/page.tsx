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
      <Link href="/browse-data" className="text-sm text-accent-fg hover:underline">&larr; All Analyses</Link>
      <div className="mt-2 mb-6">
        <h1 className="text-3xl font-bold">{request.displayName ?? request.id}</h1>
        <p className="text-sm text-foreground-muted">
          {new Date(request.createdAt).toLocaleString()} · {request.sites.length} site(s) · {request.categories.length} categor{request.categories.length === 1 ? "y" : "ies"}
        </p>
      </div>

      <section className="mb-8 rounded-lg border border-border-default bg-surface">
        <Accordion>
          <AccordionItem value="configuration">
            <AccordionTrigger className="px-4 py-3 text-lg font-semibold text-foreground">
              <span>Configuration</span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="divide-y divide-divide-default px-4 pb-4">
                {request.categories.map(c => (
                  <div key={c.id} className="py-3 first:pt-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{c.name}</span>
                      {c.wappalyzer && (
                        <span className="rounded-full bg-badge-purple px-2 py-0.5 text-xs text-badge-purple-fg">wappalyzer</span>
                      )}
                      {c.lighthouse && (
                        <span className="rounded-full bg-badge-orange px-2 py-0.5 text-xs text-badge-orange-fg">lighthouse</span>
                      )}
                    </div>
                    {c.extraInfo && (
                      <p className="mt-1 text-sm text-foreground-secondary">{c.extraInfo}</p>
                    )}
                    <Accordion className="mt-2">
                      <AccordionItem value={`prompt-${c.id}`}>
                        <AccordionTrigger className="text-xs text-accent-fg hover:underline py-1">
                          <span>View prompt</span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <pre className="mt-1 whitespace-pre-wrap rounded border border-border-default bg-surface-alt p-3 text-xs text-foreground-secondary">
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
        <ul className="divide-y divide-border-default rounded-lg border border-border-default bg-surface">
          {request.sites.map(s => (
            <li key={s.id} className="px-4 py-3 hover:bg-surface-alt">
              <Link href={`/browse-data/${request.id}/${s.id}`} className="font-medium text-accent-fg hover:underline">
                {String(s.meta?.name ?? s.url)}
              </Link>
              <div className="text-xs text-foreground-muted">{s.url}</div>
              {s.meta && Object.keys(s.meta).filter(k => k !== "name").length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {Object.entries(s.meta).filter(([k]) => k !== "name").map(([k, v]) => (
                    <span key={k} className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-foreground-secondary">
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
