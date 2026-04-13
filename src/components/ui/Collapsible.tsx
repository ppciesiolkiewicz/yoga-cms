"use client"

import { type ReactNode } from "react"
import {
  Collapsible as ShadcnCollapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "./shadcn/collapsible"
import { ChevronDownIcon } from "lucide-react"

export function Collapsible({
  trigger,
  children,
  className = "",
}: {
  trigger: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <ShadcnCollapsible className={className}>
      <CollapsibleTrigger asChild>
        <button type="button" className="group flex w-full items-center justify-between text-left text-sm">
          {trigger}
          <ChevronDownIcon className="ml-2 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {children}
      </CollapsibleContent>
    </ShadcnCollapsible>
  )
}
