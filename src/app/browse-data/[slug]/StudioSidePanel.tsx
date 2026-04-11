"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"
import type { StudioIndexEntry } from "../../../../scripts/scraper/types"

export function StudioSidePanel({
  studios,
  currentSlug,
}: {
  studios: StudioIndexEntry[]
  currentSlug: string
}) {
  const sorted = [...studios].sort((a, b) => a.city.localeCompare(b.city))
  const currentRef = useRef<HTMLAnchorElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const el = currentRef.current
      const container = scrollRef.current
      container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2
    }
  }, [currentSlug])

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-65 flex-col border-r border-gray-200 bg-white shadow-sm">
      <div className="sticky top-0 border-b border-gray-100 bg-white/90 px-3 py-2 backdrop-blur">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Results · {sorted.length}
        </span>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-gray-100">
          {sorted.map(s => {
            const isCurrent = s.slug === currentSlug
            return (
              <li key={s.slug}>
                <Link
                  ref={isCurrent ? currentRef : undefined}
                  href={`/browse-data/${s.slug}`}
                  className={`block px-3 py-2 text-sm transition-colors ${
                    isCurrent ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : "hover:bg-gray-50"
                  }`}
                >
                  <div className={`truncate font-medium ${isCurrent ? "text-blue-900" : "text-gray-900"}`}>
                    {s.studioName}
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span className="truncate">{s.city}</span>
                    <span className="shrink-0 tabular-nums text-gray-400">
                      ${s.estimatedMonthlyCost.min}–{s.estimatedMonthlyCost.max}/mo
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <ScorePill value={s.overallContentScore * 10} label={`${s.overallContentScore}`} />
                    <ScorePill value={s.lighthousePerformance} label={`${s.lighthousePerformance}`} />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}

function ScorePill({ value, label }: { value: number; label: string }) {
  const color =
    value >= 70
      ? "bg-green-100 text-green-800"
      : value >= 40
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800"
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${color}`}>
      {label}
    </span>
  )
}
