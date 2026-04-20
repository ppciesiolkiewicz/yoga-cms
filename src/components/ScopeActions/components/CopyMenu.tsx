"use client"

import { useState } from "react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { Copy } from "lucide-react"
import { fetchAnalysisContextOnce, copyToClipboard } from "../lib/useAnalysisContext"
import { scopeDescription, scopeShortLabel } from "../lib/scopeLabel"
import { ComposeModal } from "./ComposeModal"
import type {
  AnalysisContextScope,
  AnalysisContextTiers,
} from "../../../../scripts/analysis-context/types"

export function CopyMenu({ scope, fullWidth = false }: { scope: AnalysisContextScope; fullWidth?: boolean }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function copyPreset(tiers: AnalysisContextTiers) {
    if (busy) return
    setBusy(true)
    try {
      const ctx = await fetchAnalysisContextOnce(scope, tiers)
      await copyToClipboard(JSON.stringify(ctx.json, null, 2))
    } finally {
      setBusy(false)
    }
  }

  const tooltipText = `Copy analysis data for ${scopeDescription(scope)} to your clipboard.`
  const label = `Copy ${scopeShortLabel(scope)}`

  return (
    <>
      <DropdownMenu>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  className={fullWidth ? "w-full justify-start" : undefined}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" />
                  {label}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => copyPreset({ report: true })}>
            Report
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyPreset({ extractedContent: true })}>
            Content
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModalOpen(true)}>
            Configure…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ComposeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        scope={scope}
        mode="copy"
      />
    </>
  )
}
