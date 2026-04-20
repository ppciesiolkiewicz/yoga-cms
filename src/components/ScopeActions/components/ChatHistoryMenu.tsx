"use client"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/shadcn/dropdown-menu"
import { Badge } from "@/components/ui/shadcn/badge"
import { Button } from "@/components/ui/shadcn/button"
import { ChevronDown } from "lucide-react"
import { relativeDate } from "../lib/relativeDate"
import type {
  AnalysisContextTiers,
  ChatMeta,
} from "../../../../scripts/analysis-context/types"

type Props = {
  chats: ChatMeta[]
  activeChatId: string | null
  onResume: (id: string) => void
}

const TIER_LABELS: Array<[keyof AnalysisContextTiers, string]> = [
  ["report", "Report"],
  ["extractedContent", "Content"],
  ["tech", "Tech"],
  ["lighthouse", "Lighthouse"],
  ["rawPages", "Raw"],
  ["input", "Input"],
  ["progress", "Progress"],
]

function activeTiers(tiers: AnalysisContextTiers): string[] {
  return TIER_LABELS.filter(([k]) => tiers[k]).map(([, label]) => label)
}

export function ChatHistoryMenu({ chats, activeChatId, onResume }: Props) {
  if (chats.length === 0) return null
  const active = chats.find(c => c.id === activeChatId)
  const triggerLabel = active?.title?.trim() || "Resume chat"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-55 justify-between">
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {chats.map(c => {
          const labels = activeTiers(c.tiers)
          const title = c.title?.trim() || c.id
          const when = relativeDate(c.createdAt)
          const aria =
            labels.length > 0
              ? `${title}, created ${when}, data: ${labels.join(", ")}`
              : `${title}, created ${when}`
          return (
            <DropdownMenuItem
              key={c.id}
              onSelect={() => onResume(c.id)}
              aria-label={aria}
              className="flex-col items-start gap-1 py-2"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
              </div>
              {labels.length > 0 && (
                <div className="flex flex-wrap gap-1" aria-hidden="true">
                  {labels.map(label => (
                    <Badge key={label} variant="outline" className="text-[10px]">
                      {label}
                    </Badge>
                  ))}
                </div>
              )}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
