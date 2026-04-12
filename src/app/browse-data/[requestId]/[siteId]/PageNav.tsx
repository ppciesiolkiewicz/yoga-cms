"use client"

import { useEffect, useState } from "react"

interface Section {
  id: string
  label: string
}

export function PageNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string | null>(null)

  useEffect(() => {
    const html = document.documentElement
    html.style.scrollBehavior = "auto"
    const hashId = window.location.hash.slice(1)
    if (hashId) {
      const target = document.getElementById(hashId)
      if (target) target.scrollIntoView({ block: "start" })
    }
    const raf = requestAnimationFrame(() => {
      html.style.scrollBehavior = "smooth"
    })

    const elements = sections
      .map(s => document.getElementById(s.id))
      .filter((el): el is HTMLElement => el !== null)

    if (elements.length === 0) {
      return () => { cancelAnimationFrame(raf); html.style.scrollBehavior = "" }
    }

    let ticking = false
    const update = () => {
      ticking = false
      const threshold = 120
      let active: string | null = null
      for (const el of elements) {
        const top = el.getBoundingClientRect().top
        if (top - threshold <= 0) active = el.id
        else break
      }
      setActiveId(active)
      const nextHash = active ? `#${active}` : ""
      if (nextHash !== window.location.hash) {
        const url = window.location.pathname + window.location.search + nextHash
        window.history.replaceState(null, "", url)
      }
    }

    update()
    const onScroll = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(update) }
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      html.style.scrollBehavior = ""
    }
  }, [sections])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ block: "start" })
  }

  return (
    <nav className="fixed top-1/2 right-3 z-50 -translate-y-1/2 flex flex-col items-end gap-2">
      {sections.map(s => {
        const isActive = activeId === s.id
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className="group flex items-center gap-2"
            aria-label={s.label}
          >
            <span
              className={`text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity ${
                isActive ? "text-blue-700 font-medium" : "text-gray-500"
              }`}
            >
              {s.label}
            </span>
            <span
              className={`block rounded-full transition-all ${
                isActive
                  ? "h-3 w-3 bg-blue-500"
                  : "h-2 w-2 bg-gray-300 group-hover:bg-gray-400"
              }`}
            />
          </button>
        )
      })}
    </nav>
  )
}
