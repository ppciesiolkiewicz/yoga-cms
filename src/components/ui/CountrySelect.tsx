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
          className={`inline-flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm hover:bg-gray-50 ${className}`}
        >
          <span className={selected ? "text-gray-900" : "text-gray-500"}>
            {selected ? selected.name : "Search from country"}
          </span>
          <span className="ml-2 text-gray-400">&#9662;</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="z-50 w-64 rounded-lg border border-gray-200 bg-white shadow-lg"
          sideOffset={4}
          align="start"
        >
          <div className="border-b border-gray-100 p-2">
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type to filter..."
              className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            <button
              type="button"
              onClick={() => { onChange(""); setOpen(false) }}
              className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 ${!value ? "bg-blue-50 text-blue-700" : "text-gray-500"}`}
            >
              Any country
            </button>
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => { onChange(c.code); setOpen(false) }}
                className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-gray-100 ${c.code === value ? "bg-blue-50 text-blue-700" : "text-gray-700"}`}
              >
                {c.name}
                <span className="ml-1 text-xs text-gray-400">{c.code.toUpperCase()}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-3 text-center text-xs text-gray-400">No countries found</div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
