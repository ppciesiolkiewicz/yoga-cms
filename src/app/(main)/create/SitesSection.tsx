"use client"

import { type ChangeEvent, useState } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"

export interface SelectedSite {
  url: string
  title: string
  snippet: string
  meta: { name: string }
}

function normalizeUrl(raw: string): string | null {
  let value = raw.trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) value = "https://" + value
  try {
    return new URL(value).href
  } catch {
    return null
  }
}

export function SitesSection({
  sites,
  onAdd,
  onUpdateMeta,
  onRemove,
}: {
  sites: Map<string, SelectedSite>
  onAdd: (url: string, title: string, snippet: string) => void
  onUpdateMeta: (url: string, field: "name", value: string) => void
  onRemove: (url: string) => void
}) {
  const entries = [...sites.entries()]
  const [manualUrl, setManualUrl] = useState("")

  function handleAddManual() {
    const url = normalizeUrl(manualUrl)
    if (!url || sites.has(url)) return
    onAdd(url, "", "")
    setManualUrl("")
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Selected Sites{entries.length > 0 ? ` (${entries.length})` : ""}</h2>

      <div className="overflow-x-auto rounded-lg border border-border-default">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-alt text-xs uppercase text-foreground-muted">
            <tr>
              <th className="px-3 py-2">URL</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-divide-default">
            {entries.map(([url, site]) => (
              <tr key={url}>
                <td className="px-3 py-2">
                  <div className="max-w-xs truncate text-accent-fg">{url}</div>
                  <div className="truncate text-xs text-foreground-faint">{site.title}</div>
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={site.meta.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateMeta(url, "name", e.target.value)}
                    className="w-40"
                  />
                </td>
                <td className="px-3 py-2">
                  <Button variant="ghost" onClick={() => onRemove(url)} className="text-error hover:text-error">
                    &times;
                  </Button>
                </td>
              </tr>
            ))}
            <tr className="bg-surface-alt/50">
              <td className="px-3 py-2" colSpan={2}>
                <Input
                  value={manualUrl}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setManualUrl(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent) => { if (e.key === "Enter") { e.preventDefault(); handleAddManual() } }}
                  placeholder="Enter a URL, e.g. example.com"
                  className="w-full"
                />
              </td>
              <td className="px-3 py-2">
                <Button
                  variant="ghost"
                  onClick={handleAddManual}
                  disabled={!manualUrl.trim()}
                  className="text-accent-fg hover:text-accent-fg font-medium"
                >
                  Add +
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  )
}
