"use client"

import { useEffect } from "react"

const SECTION_IDS = ["tech", "features", "navigation", "content-assessment", "contact", "extracted-data"]

export function ScrollSpy() {
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

    const sections = SECTION_IDS
      .map(id => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    if (sections.length === 0) {
      return () => {
        cancelAnimationFrame(raf)
        html.style.scrollBehavior = ""
      }
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

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(update)
    }

    update()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("scroll", onScroll)
      html.style.scrollBehavior = ""
    }
  }, [])

  return null
}
