"use client"

import { type ChangeEvent, useState } from "react"
import { Globe, Plus } from "lucide-react"
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

function SiteCard({
  url,
  site,
  onUpdateMeta,
  onRemove,
}: {
  url: string
  site: SelectedSite
  onUpdateMeta: (url: string, field: "name", value: string) => void
  onRemove: (url: string) => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-alt/50 p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent-fg">
        <Globe className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <Input
          value={site.meta.name}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onUpdateMeta(url, "name", e.target.value)}
          className="h-7 w-40 text-xs"
        />
        <div className="mt-1 truncate text-xs text-accent-fg">{url}</div>
        {site.title && (
          <div className="truncate text-xs text-foreground-faint">{site.title}</div>
        )}
      </div>
      <Button variant="ghost" onClick={() => onRemove(url)} className="text-foreground-faint hover:text-error">
        &times;
      </Button>
    </div>
  )
}

function AddSiteRow({
  manualUrl,
  setManualUrl,
  onAdd,
  disabled,
}: {
  manualUrl: string
  setManualUrl: (v: string) => void
  onAdd: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-border-subtle p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-alt text-foreground-faint">
        <Plus className="h-4 w-4" />
      </div>
      <Input
        value={manualUrl}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setManualUrl(e.target.value)}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Enter") { e.preventDefault(); onAdd() }
        }}
        placeholder="Enter a URL, e.g. example.com"
        className="flex-1"
      />
      <Button
        variant="ghost"
        onClick={onAdd}
        disabled={disabled}
        className="font-medium text-accent-fg hover:text-accent-fg"
      >
        Add +
      </Button>
    </div>
  )
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
      <h2 className="mb-3 text-base font-semibold">
        Selected Sites{entries.length > 0 ? ` (${entries.length})` : ""}
      </h2>

      <div className="space-y-2">
        {entries.map(([url, site]) => (
          <SiteCard
            key={url}
            url={url}
            site={site}
            onUpdateMeta={onUpdateMeta}
            onRemove={onRemove}
          />
        ))}

        <AddSiteRow
          manualUrl={manualUrl}
          setManualUrl={setManualUrl}
          onAdd={handleAddManual}
          disabled={!manualUrl.trim()}
        />
      </div>

      <p className="mt-1 text-xs text-foreground-faint">
        Or search above and select from results
      </p>
    </section>
  )
}
