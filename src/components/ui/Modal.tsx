"use client"

import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "./shadcn/dialog"

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function ModalTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <DialogTitle className={className}>{children}</DialogTitle>
}

export function ModalDescription({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <DialogDescription className={className}>{children}</DialogDescription>
}

export function ModalClose({ children }: { children: ReactNode }) {
  return <DialogClose asChild>{children}</DialogClose>
}
