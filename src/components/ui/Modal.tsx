"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import type { ReactNode } from "react"

export function Modal({
  open,
  onOpenChange,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-default bg-surface shadow-lg focus:outline-none">
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function ModalTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Title className={`text-lg font-semibold ${className}`}>
      {children}
    </DialogPrimitive.Title>
  )
}

export function ModalDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Description className={`text-sm text-foreground-muted ${className}`}>
      {children}
    </DialogPrimitive.Description>
  )
}

export function ModalClose({ children }: { children: ReactNode }) {
  return (
    <DialogPrimitive.Close asChild>
      {children}
    </DialogPrimitive.Close>
  )
}
