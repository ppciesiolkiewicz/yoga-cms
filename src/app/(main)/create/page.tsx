"use client"

import { useState, useCallback } from "react"
import type { SerperResponse } from "@/lib/serp-types"
import type { AnalyzeInput } from "../../../../scripts/core/types"
import { Input } from "@/components/ui/Input"
import { SearchSection } from "./SearchSection"
import { SitesSection, type SelectedSite } from "./SitesSection"
import { CategoriesSection, type CategoryDraft } from "./CategoriesSection"
import { ReviewSection } from "./ReviewSection"

interface SearchEntry {
  query: string
  response: SerperResponse
}

const defaultCategories: CategoryDraft[] = [
  { id: crypto.randomUUID(), name: "home", extraInfo: "", prompt: "", wappalyzer: false, lighthouse: false, removable: false },
  { id: crypto.randomUUID(), name: "contact", extraInfo: "", prompt: "", wappalyzer: false, lighthouse: false, removable: false },
]

export default function CreatePage() {
  const [displayName, setDisplayName] = useState("")
  const [searches, setSearches] = useState<SearchEntry[]>([])
  const [selectedSites, setSelectedSites] = useState<Map<string, SelectedSite>>(new Map())
  const [categories, setCategories] = useState<CategoryDraft[]>(defaultCategories)

  const selectedUrls = new Set(selectedSites.keys())

  const handleSearch = useCallback(async (query: string) => {
    const res = await fetch("/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    })
    const response: SerperResponse = await res.json()
    setSearches((prev) => [...prev, { query, response }])
  }, [])

  const handleToggleUrl = useCallback((url: string, title: string, snippet: string) => {
    setSelectedSites((prev) => {
      const next = new Map(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        const domain = new URL(url).hostname.replace("www.", "")
        next.set(url, { url, title, snippet, meta: { name: domain, city: "" } })
      }
      return next
    })
  }, [])

  const handleUpdateMeta = useCallback((url: string, field: "name" | "city", value: string) => {
    setSelectedSites((prev) => {
      const next = new Map(prev)
      const site = next.get(url)
      if (site) {
        next.set(url, { ...site, meta: { ...site.meta, [field]: value } })
      }
      return next
    })
  }, [])

  const handleRemoveSite = useCallback((url: string) => {
    setSelectedSites((prev) => {
      const next = new Map(prev)
      next.delete(url)
      return next
    })
  }, [])

  const handleAddCategory = useCallback(() => {
    setCategories((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", extraInfo: "", prompt: "", wappalyzer: false, lighthouse: false, removable: true },
    ])
  }, [])

  const handleRemoveCategory = useCallback((id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const handleUpdateCategory = useCallback((id: string, patch: Partial<CategoryDraft>) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    )
  }, [])

  const input: AnalyzeInput = {
    displayName: displayName || undefined,
    categories: categories.map((c) => ({
      name: c.name,
      extraInfo: c.extraInfo,
      prompt: c.prompt,
      ...(c.lighthouse && { lighthouse: true }),
      ...(c.wappalyzer && { wappalyzer: true }),
    })),
    sites: [...selectedSites.values()].map((s) => ({
      url: s.url,
      meta: { name: s.meta.name, city: s.meta.city },
    })),
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Analysis</h1>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name (e.g. Yoga studios)"
          className="mt-2 w-80"
        />
      </div>

      <div className="space-y-8">
        <SearchSection
          searches={searches}
          selectedUrls={selectedUrls}
          onSearch={handleSearch}
          onToggleUrl={handleToggleUrl}
        />

        <SitesSection
          sites={selectedSites}
          onUpdateMeta={handleUpdateMeta}
          onRemove={handleRemoveSite}
        />

        <CategoriesSection
          categories={categories}
          onAdd={handleAddCategory}
          onRemove={handleRemoveCategory}
          onUpdate={handleUpdateCategory}
        />

        <ReviewSection input={input} />
      </div>
    </main>
  )
}
