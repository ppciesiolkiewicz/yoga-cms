"use client"

import { Badge } from "@/components/ui/shadcn/badge"
import { ProviderBadge } from "@/components/ui"
import { relativeDate } from "../lib/relativeDate"
import { getChatModel } from "../../../../scripts/chat/models"
import type {
  AnalysisContextTiers,
  ChatMeta,
} from "../../../../scripts/analysis-context/types"

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

export function ChatHistoryList({
  chats,
  activeChatId,
  onPick,
}: {
  chats: ChatMeta[]
  activeChatId: string | null
  onPick: (id: string) => void
}) {
  if (chats.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground">
        No previous chats for this analysis yet.
      </p>
    )
  }
  return (
    <ul className="flex flex-col divide-y">
      {chats.map(c => {
        const labels = activeTiers(c.tiers)
        const selected = c.id === activeChatId
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onPick(c.id)}
              className={
                "w-full px-3 py-2 text-left text-sm hover:bg-muted/40 " +
                (selected ? "bg-muted/60" : "")
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{c.title?.trim() || c.id}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeDate(c.createdAt)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {(() => {
                  const cm = getChatModel(c.model)
                  return cm ? (
                    <>
                      <ProviderBadge provider={cm.provider} className="text-[10px]" />
                      <Badge variant="outline" className="text-[10px]">{cm.label}</Badge>
                    </>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">{c.model}</Badge>
                  )
                })()}
                {labels.map(l => (
                  <Badge key={l} variant="outline" className="text-[10px]">
                    {l}
                  </Badge>
                ))}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
