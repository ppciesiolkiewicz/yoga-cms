"use client"

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible"
import { useState, type ReactNode } from "react"

export function Collapsible({
  trigger,
  children,
  className = "",
}: {
  trigger: ReactNode
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <CollapsiblePrimitive.Root open={open} onOpenChange={setOpen} className={className}>
      <CollapsiblePrimitive.Trigger asChild>
        <button type="button" className="flex w-full items-center justify-between text-left text-sm">
          {trigger}
          <span className={`ml-2 transition-transform ${open ? "rotate-180" : ""}`}>&#9662;</span>
        </button>
      </CollapsiblePrimitive.Trigger>
      <CollapsiblePrimitive.Content>
        {children}
      </CollapsiblePrimitive.Content>
    </CollapsiblePrimitive.Root>
  )
}
