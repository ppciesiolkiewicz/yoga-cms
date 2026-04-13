"use client"

import { type ReactNode } from "react"
import {
  Tooltip as ShadcnTooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/shadcn/tooltip"

export function Tooltip({ content, side = "top", children }: { content: ReactNode; side?: "top" | "bottom" | "left" | "right"; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <ShadcnTooltip>
        <TooltipTrigger asChild>
          {children}
        </TooltipTrigger>
        <TooltipContent side={side} sideOffset={6}>
          {content}
        </TooltipContent>
      </ShadcnTooltip>
    </TooltipProvider>
  )
}
