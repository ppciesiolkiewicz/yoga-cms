"use client"

import { useState } from "react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/shadcn/tooltip"
import { Button } from "@/components/ui/shadcn/button"
import { MessageSquare } from "lucide-react"
import { useChatDrawer } from "./ChatDrawerProvider"
import { ComposeModal } from "./ComposeModal"
import type { Preset } from "../lib/presets"

type Props = {
  label: string
  tooltip: string
  preset: Preset
  fullWidth?: boolean
}

export function ChatMenu({ label, tooltip, preset, fullWidth = false }: Props) {
  const { requestId, openWithPreset } = useChatDrawer()
  const [configureOpen, setConfigureOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className={fullWidth ? "w-full justify-start" : undefined}>
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />{label}
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Select data shared with AI model</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openWithPreset({ scope: preset.scope, tiers: { report: true } })}>
            Report context
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openWithPreset({ scope: preset.scope, tiers: { extractedContent: true } })}>
            Content context
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setConfigureOpen(true)}>
            Configure context
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {configureOpen && (
        <ComposeModal
          open={configureOpen}
          onOpenChange={setConfigureOpen}
          requestId={requestId}
          scope={preset.scope}
          tiers={{}}
          mode="chat"
          onSave={(scope, tiers) => {
            setConfigureOpen(false)
            openWithPreset({ scope, tiers })
          }}
        />
      )}
    </>
  )
}
