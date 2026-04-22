"use client"

import { useState } from "react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { Copy } from "lucide-react"
import { fetchAnalysisContextOnce, copyToClipboard } from "../lib/useAnalysisContext"
import { ComposeModal } from "./ComposeModal"
import type { Preset } from "../lib/presets"
import type { AnalysisContextTiers } from "../../../../scripts/analysis-context/types"

type Props = {
  label: string
  tooltip: string
  preset: Preset
  requestId: string
  fullWidth?: boolean
}

export function CopyMenu({ label, tooltip, preset, requestId, fullWidth = false }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function copyPreset(tiers: AnalysisContextTiers) {
    if (busy) return
    setBusy(true)
    try {
      const ctx = await fetchAnalysisContextOnce(preset.scope, tiers)
      await copyToClipboard(JSON.stringify(ctx.json, null, 2))
    } finally { setBusy(false) }
  }

  return (
    <>
      <DropdownMenu>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={busy} className={fullWidth ? "w-full justify-start" : undefined}>
                  <Copy className="mr-1 h-3.5 w-3.5" />{label}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => copyPreset({ report: true })}>Report</DropdownMenuItem>
          <DropdownMenuItem onClick={() => copyPreset({ extractedContent: true })}>Content</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setModalOpen(true)}>Configure…</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ComposeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        requestId={requestId}
        scope={preset.scope}
        tiers={preset.tiers}
        mode="copy"
      />
    </>
  )
}
