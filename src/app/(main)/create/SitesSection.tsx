"use client"

import { type ChangeEvent } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

export interface SelectedSite {
  url: string
  title: string
  snippet: string
  meta: { name: string; city: string }
}

export function SitesSection({
  sites,
  onUpdateMeta,
  onRemove,
}: {
  sites: Map<string, SelectedSite>
  onUpdateMeta: (url: string, field: "name" | "city", value: string) => void
  onRemove: (url: string) => void
}) {
  const entries = [...sites.entries()]

  if (entries.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold">Selected Sites</h2>
        <p className="text-sm text-gray-500">No sites selected yet. Search and check sites above.</p>
      </section>
    )
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Selected Sites ({entries.length})</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">City</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {entries.map(([url, site]) => (
              <tr key={url}>
                <td className="px-3 py-2">
                  <div className="max-w-xs truncate text-blue-700">{url}</div>
                  <div className="truncate text-xs text-gray-400">{site.title}</div>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={site.meta.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateMeta(url, "name", e.target.value)}
                    className="w-40"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={site.meta.city}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateMeta(url, "city", e.target.value)}
                    className="w-32"
                  />
                </td>
                <td className="px-3 py-2">
                  <Button variant="ghost" onClick={() => onRemove(url)} className="text-red-500 hover:text-red-700">
                    &times;
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
