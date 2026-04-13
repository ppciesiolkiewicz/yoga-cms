"use client"

import { useState, useRef, useEffect } from "react"
import * as Popover from "@radix-ui/react-popover"
import { getData } from "country-list"

const countries = getData()
  .map((c) => ({ code: c.code.toLowerCase(), name: c.name }))
  .sort((a, b) => a.name.localeCompare(b.name))

export function CountrySelect({
  value,
  onChange,
  className = "",
}: {
  value: string
  onChange: (code: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = countries.find((c) => c.code === value)
  const filtered = search
    ? countries.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.includes(search.toLowerCase())
      )
    : countries

  useEffect(() => {
    if (open) {
      setSearch("")
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-between rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm shadow-sm hover:bg-surface-alt ${className}`}
        >
          <span className={selected ? "text-foreground" : "text-foreground-muted"}>
            {selected ? selected.name : "Search from country"}
          </span>
          <span className="ml-2 text-foreground-faint">&#9662;</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-64 rounded-lg border border-border-default bg-surface shadow-lg"
          sideOffset={4}
          align="start"
        >
          <div className="border-b border-border-subtle p-2">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to filter..."
              className="w-full rounded-md border border-border-default bg-surface px-2 py-1.5 text-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false) }}
              className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-raised ${!value ? "bg-accent-subtle text-accent-fg" : "text-foreground-muted"}`}
            >
              Any country
            </button>
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false) }}
                className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-surface-raised ${c.code === value ? "bg-accent-subtle text-accent-fg" : "text-foreground-secondary"}`}
              >
                {c.name}
                <span className="ml-1 text-xs text-foreground-faint">{c.code.toUpperCase()}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-foreground-faint">No countries found</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
