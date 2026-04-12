"use client"

import { useEffect } from "react"

export function ScrollSpy({ sectionIds }: { sectionIds: string[] }) {
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

    const sections = sectionIds
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) {
      return () => { cancelAnimationFrame(raf); html.style.scrollBehavior = "" }
    }

    let ticking = false
    const update = () => {
      ticking = false
      const threshold = 120
      let active: string | null = null
      for (const el of sections) {
        const top = el.getBoundingClientRect().top
        if (top - threshold <= 0) active = el.id
        else break
      }
      const nextHash = active ? `#${active}` : ""
      if (nextHash !== window.location.hash) {
        const url = window.location.pathname + window.location.search + nextHash
        window.history.replaceState(null, "", url)
      }
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
    return () => { cancelAnimationFrame(raf); window.removeEventListener("scroll", onScroll); html.style.scrollBehavior = "" }
  }, [sectionIds])

  return null
}
