"use client"

import { useState, useRef } from "react"
import type { SerperResponse } from "@/lib/serp-types"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Card } from "@/components/ui/Card"
import { Carousel } from "@/components/ui/Carousel"
import { CountrySelect } from "@/components/ui/CountrySelect"
import { SerpCard } from "./SerpCard"

interface SearchEntry {
  query: string
  response: SerperResponse
}

export function SearchSection({
  searches,
  selectedUrls,
  onSearch,
  onToggleUrl,
}: {
  searches: SearchEntry[]
  selectedUrls: Set<string>
  onSearch: (query: string, gl?: string) => Promise<void>
  onToggleUrl: (url: string, title: string, snippet: string) => void
}) {
  const [query, setQuery] = useState("")
  const [country, setCountry] = useState("")
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(searchQuery: string) {
    const q = searchQuery.trim()
    if (!q) return
    setLoading(true)
    try {
      await onSearch(q, country || undefined)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section data-tour="create-search">
      <h2 className="mb-1 text-base font-semibold">Add new search</h2>
      <p className="mb-3 text-xs text-foreground-muted">Select web pages you want to analyze</p>
      <form
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          handleSubmit(query)
        }}
        className="flex items-center gap-3"
      >
        <Input
          ref={inputRef}
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Search Google..."
          className="flex-1 px-4 py-3 text-base"
        />
        <CountrySelect value={country} onChange={setCountry} className="w-48" />
        <Button type="submit" disabled={loading || !query.trim()} className="px-5 py-3 text-base">
          {loading ? "Searching..." : "Search"}
        </Button>
      </form>

      {searches.length > 0 && (
        <Carousel className="mt-4">
          {searches.map((s, i) => (
            <SerpCard
              key={`${s.query}-${i}`}
              query={s.query}
              response={s.response}
              selectedUrls={selectedUrls}
              onToggleUrl={onToggleUrl}
              onSearchRelated={(q) => handleSubmit(q)}
            />
          ))}
          <Card
            className="flex min-w-50 shrink-0 cursor-pointer items-center justify-center p-4 text-foreground-faint hover:bg-surface-alt hover:text-foreground-secondary"
            onClick={() => {
              inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
              setTimeout(() => inputRef.current?.focus(), 300)
            }}
          >
            <div className="text-center">
              <div className="text-4xl">+</div>
              <div className="mt-1 text-sm">New search</div>
            </div>
          </Card>
        </Carousel>
      )}
    </section>
  )
}
