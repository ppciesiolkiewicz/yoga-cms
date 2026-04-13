"use client"

import Link from "next/link"
import { useRef, useEffect } from "react"
import { Settings } from "lucide-react"

interface SiteEntry {
  id: string
  url: string
  name: string
  platform?: string
  lighthouse?: { performance: number; accessibility: number; seo: number }
  overallStatus: "pending" | "running" | "completed" | "failed"
  recordCount: number
  meta: Record<string, unknown>
}

function ScoreDot({ score }: { score: number }) {
  const color =
    score >= 90 ? "bg-success" : score >= 50 ? "bg-warning" : "bg-error"
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      title={String(score)}
    />
  )
}

function StatusDot({ status }: { status: SiteEntry["overallStatus"] }) {
  const styles = {
    completed: "bg-success",
    running: "bg-accent animate-pulse",
    failed: "bg-error",
    pending: "bg-foreground-faint",
  }
  return <span className={`inline-block h-2 w-2 rounded-full ${styles[status]}`} />
}

export function SitesSidebar({
  requestId,
  displayName,
  sites,
  currentSiteId,
}: {
  requestId: string
  displayName: string
  sites: SiteEntry[]
  currentSiteId: string
}) {
  const currentRef = useRef<HTMLElement | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isInfoPage = currentSiteId === "__information__"

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const el = currentRef.current
      const container = scrollRef.current
      container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
    }
  }, [currentSiteId])

  const setCurrentRef = (el: HTMLElement | null) => { currentRef.current = el }

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-65 flex-col border-r border-border-default bg-surface shadow-sm">
      <div className="sticky top-0 border-b border-border-default bg-surface px-3 py-3">
        <Link
          href="/analyses"
          className="flex items-center gap-2 rounded-md bg-surface-raised px-3 py-2 text-sm font-medium text-foreground-secondary hover:bg-surface-sunken transition-colors"
        >
          <span className="text-lg leading-none">&larr;</span>
          <span className="truncate">{displayName}</span>
        </Link>
        <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-foreground-muted">
          Sites · {sites.length}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-divide-default">
          {sites.map(s => {
            const isCurrent = s.id === currentSiteId
            return (
              <li key={s.id}>
                {s.overallStatus === "completed" ? (
                <Link
                  ref={isCurrent ? setCurrentRef : undefined}
                  href={`/analyses/${requestId}/${s.id}`}
                  className={`block px-3 py-2.5 text-sm transition-colors ${
                    isCurrent ? "bg-accent-subtle ring-1 ring-inset ring-accent" : "hover:bg-surface-alt"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate font-medium ${isCurrent ? "text-accent-muted" : "text-foreground"}`}>
                      {s.name}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-foreground-muted truncate">{s.url}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-foreground-muted">
                    {s.platform && (
                      <span className="truncate rounded bg-surface-raised px-1.5 py-0.5 text-foreground-secondary">
                        {s.platform}
                      </span>
                    )}
                    {s.lighthouse && (
                      <span className="flex items-center gap-1" title={`Perf ${s.lighthouse.performance} · A11y ${s.lighthouse.accessibility} · SEO ${s.lighthouse.seo}`}>
                        <ScoreDot score={s.lighthouse.performance} />
                        <ScoreDot score={s.lighthouse.accessibility} />
                        <ScoreDot score={s.lighthouse.seo} />
                      </span>
                    )}
                    {s.recordCount > 0 && (
                      <span className="text-foreground-faint">{s.recordCount} records</span>
                    )}
                  </div>
                  {Object.keys(s.meta).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(s.meta).map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-faint"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
                ) : (
                <div
                  ref={isCurrent ? setCurrentRef : undefined}
                  className="block px-3 py-2.5 text-sm opacity-60 cursor-not-allowed"
                >
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={s.overallStatus} />
                    <span className="truncate font-medium text-foreground">
                      {s.name}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-foreground-muted truncate">{s.url}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-foreground-muted">
                    {s.platform && (
                      <span className="truncate rounded bg-surface-raised px-1.5 py-0.5 text-foreground-secondary">
                        {s.platform}
                      </span>
                    )}
                  </div>
                  {Object.keys(s.meta).length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(s.meta).map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground-faint"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      <div className="border-t border-border-default px-3 py-3">
        <Link
          href={`/analyses/${requestId}/information`}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            isInfoPage
              ? "bg-accent-subtle text-accent-fg"
              : "text-foreground-secondary hover:bg-surface-alt"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  )
}
