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
    <aside className="fixed left-0 top-12.25 z-30 flex h-[calc(100vh-49px)] w-65 flex-col border-r border-gray-200 bg-white shadow-sm">
      <div className="sticky top-0 border-b border-gray-100 bg-white/90 px-3 py-2 backdrop-blur">
        <Link href={`/browse-data/${requestId}`} className="block text-xs text-blue-600 hover:underline">
          &larr; Back to {displayName}
        </Link>
        <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Sites · {sites.length}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-100">
          {sites.map(s => {
            const isCurrent = s.id === currentSiteId
            return (
              <li key={s.id}>
                <Link
                  ref={isCurrent ? currentRef : undefined}
                  href={`/browse-data/${requestId}/${s.id}`}
                  className={`block px-3 py-2 text-sm transition-colors ${
                    isCurrent ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-gray-50"
                  }`}
                >
                  <div className={`truncate font-medium ${isCurrent ? "text-blue-900" : "text-gray-900"}`}>
                    {s.name}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-500 truncate">{s.url}</div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
