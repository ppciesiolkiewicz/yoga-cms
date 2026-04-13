"use client"

import { useState, useCallback } from "react"
import type { SerperResponse } from "@/lib/serp-types"
import type { AnalyzeInput } from "../../../../scripts/core/types"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { SearchSection } from "./SearchSection"
import { SitesSection, type SelectedSite } from "./SitesSection"
import { CategoriesSection, type CategoryDraft, type CategoryTemplate } from "./CategoriesSection"
import { ReviewSection } from "./ReviewSection"

interface SearchEntry {
  query: string
  response: SerperResponse
}

const defaultCategories: CategoryDraft[] = [
  { id: crypto.randomUUID(), name: "Home", extraInfo: "", prompt: "Summarize the homepage: what the business does, main value proposition, key offerings or services listed, calls to action, and overall first impression. Note any trust signals (testimonials, certifications, partner logos) and whether the page clearly communicates who the business serves.", wappalyzer: true, lighthouse: true, removable: false, enabled: true },
  { id: crypto.randomUUID(), name: "Contact", extraInfo: "contact page, about-with-contact, location page", prompt: "Extract all contact methods: phone numbers, email addresses, physical addresses, and contact form details. Note business hours, social media links, and any maps or directions provided. Summarize how easy it is for a visitor to get in touch and whether multiple contact channels are offered.", wappalyzer: false, lighthouse: false, removable: false, enabled: true },
]

type Step = "search" | "categories" | "review"

export default function CreatePage() {
  const [step, setStep] = useState<Step>("search")
  const [displayName, setDisplayName] = useState("")
  const [searches, setSearches] = useState<SearchEntry[]>([])
  const [selectedSites, setSelectedSites] = useState<Map<string, SelectedSite>>(new Map())
  const [categories, setCategories] = useState<CategoryDraft[]>(defaultCategories)

  const selectedUrls = new Set(selectedSites.keys())

  const handleSearch = useCallback(async (query: string, gl?: string) => {
    const res = await fetch("/api/serp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, ...(gl && { gl }) }),
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
        next.set(url, { url, title, snippet, meta: { name: domain } })
      }
      return next
    })
  }, [])

  const handleUpdateMeta = useCallback((url: string, field: "name", value: string) => {
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

  const handleAddCategory = useCallback((template?: CategoryTemplate) => {
    setCategories((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: template?.name ?? "",
        extraInfo: template?.extraInfo ?? "",
        prompt: template?.prompt ?? "",
        wappalyzer: template?.wappalyzer ?? false,
        lighthouse: template?.lighthouse ?? false,
        removable: true,
        enabled: true,
      },
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
    categories: categories.filter((c) => c.enabled).map((c) => ({
      name: c.name,
      extraInfo: c.extraInfo,
      prompt: c.prompt,
      ...(c.lighthouse && { lighthouse: true }),
      ...(c.wappalyzer && { wappalyzer: true }),
    })),
    sites: [...selectedSites.values()].map((s) => ({
      url: s.url,
      meta: { name: s.meta.name },
    })),
  }

  const canProceed = selectedSites.size > 0

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Create Analysis</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Find sites, pick the ones to analyze, then choose what to look for.
        </p>
        <Input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Name (e.g. Coffee shops in Berlin)"
          className="mt-3 w-80"
        />
      </div>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setStep("search")}
          className={`rounded-full px-3 py-1 font-medium ${step === "search" ? "bg-accent text-foreground-on-accent" : "bg-surface-sunken text-foreground-secondary hover:bg-surface-sunken"}`}
        >
          1. Search &amp; Select Sites
        </button>
        <span className="text-foreground-faint">&rarr;</span>
        <button
          type="button"
          onClick={() => setStep("categories")}
          className={`rounded-full px-3 py-1 font-medium ${step === "categories" ? "bg-accent text-foreground-on-accent" : "bg-surface-sunken text-foreground-secondary hover:bg-surface-sunken"}`}
        >
          2. Categories
        </button>
        <span className="text-foreground-faint">&rarr;</span>
        <button
          type="button"
          onClick={() => setStep("review")}
          className={`rounded-full px-3 py-1 font-medium ${step === "review" ? "bg-accent text-foreground-on-accent" : "bg-surface-sunken text-foreground-secondary hover:bg-surface-sunken"}`}
        >
          3. Review
        </button>
      </div>

      {step === "search" && (
        <div className="space-y-8">
          <SearchSection
            searches={searches}
            selectedUrls={selectedUrls}
            onSearch={handleSearch}
            onToggleUrl={handleToggleUrl}
          />

          <SitesSection
            sites={selectedSites}
            onAdd={handleToggleUrl}
            onUpdateMeta={handleUpdateMeta}
            onRemove={handleRemoveSite}
          />

          <div className="flex justify-end">
            <Button
              onClick={() => setStep("categories")}
              disabled={!canProceed}
            >
              Continue to Categories &rarr;
            </Button>
          </div>
        </div>
      )}

      {step === "categories" && (
        <div className="space-y-8">
          <CategoriesSection
            categories={categories}
            onAdd={handleAddCategory}
            onRemove={handleRemoveCategory}
            onUpdate={handleUpdateCategory}
          />

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep("search")}>
              &larr; Back to Sites
            </Button>
            <Button onClick={() => setStep("review")}>
              Continue to Review &rarr;
            </Button>
          </div>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-8">
          <ReviewSection input={input} />

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep("categories")}>
              &larr; Back to Categories
            </Button>
          </div>
        </div>
      )}
    </main>
  )
}
