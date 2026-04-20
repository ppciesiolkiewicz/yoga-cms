"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/shadcn/dialog"
import { Checkbox } from "@/components/ui/shadcn/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { Copy, Check } from "lucide-react"
import { useAnalysisContext, copyToClipboard } from "../lib/useAnalysisContext"
import type {
  AnalysisContextScope,
  AnalysisContextTiers,
} from "../../../../scripts/analysis-context/types"

type TierKey = keyof AnalysisContextTiers

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  scope: AnalysisContextScope
  mode: "copy" | "chat"
  onStartChat?: (tiers: AnalysisContextTiers) => void
  allowedTiers?: ReadonlyArray<TierKey>
}

const ALL_TOGGLES: Array<{ key: TierKey; label: string; help: string }> = [
  { key: "report", label: "Report", help: "Final summary and recommendations." },
  {
    key: "extractedContent",
    label: "Extracted content",
    help: "Structured data pulled from pages (e.g. classes, prices). Pick this instead of Raw pages.",
  },
  { key: "tech", label: "Tech stack", help: "Detected technologies and estimated monthly cost." },
  { key: "lighthouse", label: "Lighthouse", help: "Performance, accessibility and SEO scores." },
  {
    key: "rawPages",
    label: "Raw pages",
    help: "Full page markdown. Large. Skip if Extracted content covers what you need.",
  },
  { key: "input", label: "Input", help: "Original request config: sites and categories." },
]

export function ComposeModal({
  open,
  onOpenChange,
  scope,
  mode,
  onStartChat,
  allowedTiers,
}: Props) {
  const [tiers, setTiers] = useState<AnalysisContextTiers>({})
  const { data, loading, error } = useAnalysisContext(scope, tiers)
  const [copied, setCopied] = useState(false)
  const pretty = data ? JSON.stringify(data.json, null, 2) : ""

  const toggles = allowedTiers
    ? ALL_TOGGLES.filter(t => allowedTiers.includes(t.key))
    : ALL_TOGGLES

  function setTier(k: TierKey, value: boolean) {
    setTiers(t => ({ ...t, [k]: value }))
  }

  async function handleCopy() {
    if (!data) return
    await copyToClipboard(pretty)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-[calc(100vw-2rem)] max-w-6xl flex-col gap-4 sm:w-5xl lg:w-6xl">
        <DialogHeader>
          <DialogTitle>
            Configure {mode === "copy" ? "copy" : "chat context"}
          </DialogTitle>
        </DialogHeader>

        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {toggles.map(t => {
              const missing = data?.missing?.includes(t.key)
              const checked = !!tiers[t.key]
              return (
                <Tooltip key={t.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setTier(t.key, !checked)}
                      aria-pressed={checked}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        tabIndex={-1}
                        className="pointer-events-none"
                      />
                      <span
                        className={`select-none ${
                          missing ? "text-muted-foreground line-through" : ""
                        }`}
                      >
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
            {loading
              ? "Loading…"
              : error
                ? error
                : data
                  ? `${data.bytes.toLocaleString()} bytes`
                  : "Select data to include."}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!data}
            onClick={handleCopy}
          >
            {copied ? (
              <>
                <Check className="mr-1 h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="mr-1 h-3.5 w-3.5" />
                Copy JSON
              </>
            )}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30">
          <pre className="px-3 py-2 font-mono text-xs whitespace-pre-wrap wrap-break-word text-foreground">
            {pretty || (loading ? "Loading…" : "Select data to include.")}
          </pre>
        </div>

        {mode === "chat" && (
          <DialogFooter>
            <Button
              disabled={!data}
              onClick={() => {
                if (!data) return
                onStartChat?.(tiers)
                onOpenChange(false)
              }}
            >
              Start chat
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
