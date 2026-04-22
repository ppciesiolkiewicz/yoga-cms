"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/shadcn/dialog"
import { Checkbox } from "@/components/ui/shadcn/checkbox"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { Copy, Check } from "lucide-react"
import { useAnalysisContext, copyToClipboard } from "../lib/useAnalysisContext"
import type {
  AnalysisContextScope, AnalysisContextTiers,
} from "../../../../scripts/analysis-context/types"
import type { Request } from "../../../../scripts/core/types"

type TierKey = keyof AnalysisContextTiers

const ALL_TOGGLES: Array<{ key: TierKey; label: string; help: string }> = [
  { key: "report", label: "Report", help: "Final summary and recommendations." },
  { key: "extractedContent", label: "Extracted content", help: "Structured data pulled from pages." },
  { key: "tech", label: "Tech stack", help: "Detected technologies and estimated monthly cost." },
  { key: "lighthouse", label: "Lighthouse", help: "Performance, accessibility, SEO scores." },
  { key: "rawPages", label: "Raw pages", help: "Full page markdown. Large." },
  { key: "input", label: "Input", help: "Original request config: sites and categories." },
  { key: "progress", label: "Progress", help: "Pipeline progress.json for each site." },
]

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  requestId: string
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
  mode: "copy" | "chat"
  readOnly?: boolean
  onSave?: (scope: AnalysisContextScope, tiers: AnalysisContextTiers) => void
}

export function ComposeModal({
  open, onOpenChange, requestId, scope, tiers, mode, readOnly = false, onSave,
}: Props) {
  const [localScope, setLocalScope] = useState<AnalysisContextScope>(scope)
  const [localTiers, setLocalTiers] = useState<AnalysisContextTiers>(tiers)
  const [request, setRequest] = useState<Request | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { if (open) { setLocalScope(scope); setLocalTiers(tiers) } }, [open, scope, tiers])

  useEffect(() => {
    fetch(`/api/request/${requestId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(r => setRequest(r))
      .catch(() => setRequest(null))
  }, [requestId])

  const { data, loading } = useAnalysisContext(localScope, localTiers)
  const pretty = data ? JSON.stringify(data.json, null, 2) : ""

  const selectedSet = useMemo(
    () => new Set(localScope.contextElements.map(e => `${e.siteId}\u0000${e.categoryId}`)),
    [localScope.contextElements],
  )

  function pairKey(siteId: string, categoryId: string) {
    return `${siteId}\u0000${categoryId}`
  }

  function togglePair(siteId: string, categoryId: string) {
    if (readOnly) return
    const has = selectedSet.has(pairKey(siteId, categoryId))
    setLocalScope(s => ({
      ...s,
      contextElements: has
        ? s.contextElements.filter(e => !(e.siteId === siteId && e.categoryId === categoryId))
        : [...s.contextElements, { siteId, categoryId }],
    }))
  }

  function setAllPairs(pairs: Array<{ siteId: string; categoryId: string }>, checked: boolean) {
    if (readOnly) return
    const keys = new Set(pairs.map(p => pairKey(p.siteId, p.categoryId)))
    setLocalScope(s => {
      if (checked) {
        const merged = [...s.contextElements]
        for (const p of pairs) {
          if (!s.contextElements.some(e => e.siteId === p.siteId && e.categoryId === p.categoryId)) {
            merged.push(p)
          }
        }
        return { ...s, contextElements: merged }
      }
      return {
        ...s,
        contextElements: s.contextElements.filter(e => !keys.has(pairKey(e.siteId, e.categoryId))),
      }
    })
  }

  function toggleTier(k: TierKey) {
    if (readOnly) return
    setLocalTiers(t => ({ ...t, [k]: !t[k] }))
  }

  async function handleCopy() {
    if (!data) return
    await copyToClipboard(pretty)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  async function handleCopyAndClose() {
    await handleCopy()
    onOpenChange(false)
  }

  const canSubmit = localScope.contextElements.length > 0 && Object.values(localTiers).some(Boolean)

  // Helpers for the "select all" header/row/corner checkboxes.
  const allPairs = useMemo(() => {
    if (!request) return [] as Array<{ siteId: string; categoryId: string }>
    const out: Array<{ siteId: string; categoryId: string }> = []
    for (const s of request.sites) {
      for (const c of request.categories) out.push({ siteId: s.id, categoryId: c.id })
    }
    return out
  }, [request])

  const allChecked = allPairs.length > 0 && allPairs.every(p => selectedSet.has(pairKey(p.siteId, p.categoryId)))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-4 sm:w-5xl lg:w-6xl">
        <DialogHeader>
          <DialogTitle>{readOnly ? "Context (read-only)" : `Configure ${mode === "copy" ? "copy" : "chat context"}`}</DialogTitle>
        </DialogHeader>

        {/* Scope matrix */}
        <div className="overflow-auto rounded-md border">
          {!request && <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>}
          {request && (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        aria-label="Select all"
                        checked={allChecked}
                        onCheckedChange={v => setAllPairs(allPairs, !!v)}
                        disabled={readOnly}
                      />
                      <span className="text-xs font-medium text-muted-foreground">Site \ Category</span>
                    </div>
                  </th>
                  {request.categories.map(c => {
                    const colPairs = request.sites.map(s => ({ siteId: s.id, categoryId: c.id }))
                    const colChecked = colPairs.length > 0 && colPairs.every(p => selectedSet.has(pairKey(p.siteId, p.categoryId)))
                    return (
                      <th key={c.id} className="px-3 py-2 text-left font-medium">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            aria-label={`Select all for category ${c.name}`}
                            checked={colChecked}
                            onCheckedChange={v => setAllPairs(colPairs, !!v)}
                            disabled={readOnly}
                          />
                          <span>{c.name}</span>
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {request.sites.map(s => {
                  const rowPairs = request.categories.map(c => ({ siteId: s.id, categoryId: c.id }))
                  const rowChecked = rowPairs.length > 0 && rowPairs.every(p => selectedSet.has(pairKey(p.siteId, p.categoryId)))
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2 text-foreground-muted">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            aria-label={`Select all for site ${s.url}`}
                            checked={rowChecked}
                            onCheckedChange={v => setAllPairs(rowPairs, !!v)}
                            disabled={readOnly}
                          />
                          <span>{s.url}</span>
                        </div>
                      </td>
                      {request.categories.map(c => {
                        const checked = selectedSet.has(pairKey(s.id, c.id))
                        return (
                          <td key={c.id} className="px-3 py-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePair(s.id, c.id)}
                              disabled={readOnly}
                            />
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Tier toggles */}
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {ALL_TOGGLES.map(t => {
              const missing = data?.missing?.includes(t.key)
              const checked = !!localTiers[t.key]
              return (
                <Tooltip key={t.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => toggleTier(t.key)}
                      aria-pressed={checked}
                      disabled={readOnly}
                      className="flex items-center gap-2 text-sm disabled:opacity-60"
                    >
                      <Checkbox checked={checked} tabIndex={-1} className="pointer-events-none" />
                      <span className={"select-none " + (missing ? "text-muted-foreground line-through" : "")}>
                        {t.label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    {missing ? `${t.help} (Not available for this scope.)` : t.help}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </TooltipProvider>

        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {loading ? "Loading…" : data ? `${data.bytes.toLocaleString()} bytes` : "Select context to include."}
          </div>
          <Button type="button" variant="outline" size="sm" disabled={!data} onClick={handleCopy}>
            {copied ? <><Check className="mr-1 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy JSON</>}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
          <pre className="px-3 py-2 font-mono text-xs whitespace-pre-wrap wrap-break-word text-foreground">
            {pretty || (loading ? "Loading…" : "Select context to include.")}
          </pre>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!readOnly && mode === "chat" && (
            <Button disabled={!canSubmit} onClick={() => { onSave?.(localScope, localTiers); onOpenChange(false) }}>
              Start chat
            </Button>
          )}
          {!readOnly && mode === "copy" && (
            <Button disabled={!data || !canSubmit} onClick={handleCopyAndClose}>
              Copy JSON
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
