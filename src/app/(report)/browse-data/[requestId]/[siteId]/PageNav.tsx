"use client"

import { useEffect, useState } from "react"

interface Section {
  id: string
  label: string
}

export function PageNav({ sections }: { sections: Section[] }) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

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
      let active: string | null = elements[0]?.id ?? null
      for (const el of elements) {
        const top = el.getBoundingClientRect().top
        if (top - threshold <= 0) active = el.id
        else break
      }
      setActiveId(active)
      const idx = elements.findIndex(el => el.id === active)
      setActiveIndex(idx === -1 ? 0 : idx)
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
    <nav className="fixed top-0 right-0 z-30 w-40 rounded-bl-lg border-b border-l border-gray-200 bg-white/95 py-1.5 shadow-sm backdrop-blur-sm">
      {sections.map(s => {
        const isActive = activeId === s.id
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            className={`block w-full truncate px-3 py-1 text-left text-xs transition-colors ${
              isActive
                ? "border-l-2 border-blue-500 bg-blue-50 font-medium text-blue-700"
                : "border-l-2 border-transparent text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            }`}
          >
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}
