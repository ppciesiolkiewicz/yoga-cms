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
import { MessageSquare } from "lucide-react"
import { ChatDrawer } from "./ChatDrawer"
import { ComposeModal } from "./ComposeModal"
import { scopeDescription, scopeShortLabel } from "../lib/scopeLabel"
import type {
  AnalysisContextScope,
  AnalysisContextTiers,
} from "../../../../scripts/analysis-context/types"

const CHAT_ALLOWED_TIERS: ReadonlyArray<keyof AnalysisContextTiers> = [
  "report",
  "extractedContent",
  "tech",
  "lighthouse",
  "input",
  "progress",
]

export function ChatMenu({ scope, fullWidth = false }: { scope: AnalysisContextScope; fullWidth?: boolean }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [tiers, setTiers] = useState<AnalysisContextTiers>({})

  function openWith(t: AnalysisContextTiers) {
    setTiers(t)
    setDrawerOpen(true)
  }

  const tooltipText = `Ask Claude about ${scopeDescription(scope)}.`
  const label = `Chat about ${scopeShortLabel(scope)}`

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
                  className={fullWidth ? "w-full justify-start" : undefined}
                >
                  <MessageSquare className="mr-1 h-3.5 w-3.5" />
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
          <DropdownMenuItem onClick={() => openWith({ report: true })}>
            About the report
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openWith({ extractedContent: true })}>
            About the content
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
        mode="chat"
        onStartChat={openWith}
        allowedTiers={CHAT_ALLOWED_TIERS}
      />
      <ChatDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        scope={scope}
        initialTiers={tiers}
      />
    </>
  )
}
