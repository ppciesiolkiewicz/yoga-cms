"use client"

import Link from "next/link"
import { useRef, useEffect } from "react"

interface SiteEntry {
  id: string
  url: string
  name: string
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
  const currentRef = useRef<HTMLAnchorElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const el = currentRef.current
      const container = scrollRef.current
      container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
    }
  }, [currentSiteId])

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-65 flex-col border-r border-border-default bg-surface shadow-sm">
      <div className="sticky top-0 border-b border-border-default bg-surface px-3 py-3">
        <Link
          href={`/browse-data/${requestId}`}
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
                <Link
                  ref={isCurrent ? currentRef : undefined}
                  href={`/browse-data/${requestId}/${s.id}`}
                  className={`block px-3 py-2 text-sm transition-colors ${
                    isCurrent ? "bg-accent-subtle ring-1 ring-inset ring-accent-muted" : "hover:bg-surface-alt"
                  }`}
                >
                  <div className={`truncate font-medium ${isCurrent ? "text-foreground" : "text-foreground"}`}>
                    {s.name}
                  </div>
                  <div className="mt-0.5 text-xs text-foreground-muted truncate">{s.url}</div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
