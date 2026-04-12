"use client"

import { useState } from "react"
import type { SerperResponse } from "@/lib/serp-types"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Carousel } from "@/components/ui/Carousel"
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
  onSearch: (query: string) => Promise<void>
  onToggleUrl: (url: string, title: string, snippet: string) => void
}) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(searchQuery: string) {
    const q = searchQuery.trim()
    if (!q) return
    setLoading(true)
    try {
      await onSearch(q)
      setQuery("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Search</h2>
      <form
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault()
          handleSubmit(query)
        }}
        className="flex gap-2"
      >
        <Input
          value={query}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          placeholder="Search Google..."
          className="flex-1"
        />
        <Button type="submit" disabled={loading || !query.trim()}>
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
        </Carousel>
      )}
    </section>
  )
}
