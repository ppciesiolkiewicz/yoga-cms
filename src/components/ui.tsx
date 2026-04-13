"use client"

import { type ReactNode } from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

// --- ScoreBadge ---

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-success-subtle text-success"
      : score >= 5
        ? "bg-warning-subtle text-warning"
        : "bg-error-subtle text-error"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}/10
    </span>
  )
}

// --- StatusBadge ---

const statusStyles: Record<string, string> = {
  completed: "bg-success-subtle text-success",
  running: "bg-accent-subtle text-accent-fg animate-pulse",
  pending: "bg-surface-raised text-foreground-secondary",
  failed: "bg-error-subtle text-error",
  "not-requested": "bg-surface-alt text-foreground-faint",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? statusStyles.pending}`}>
      {status}
    </span>
  )
}

// --- Tooltip (Radix) ---

export function Tooltip({ content, side = "top", children }: { content: ReactNode; side?: "top" | "bottom" | "left" | "right"; children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            className="z-50 max-w-xs rounded-md border border-border-default bg-surface px-3 py-2 text-xs text-foreground shadow-lg animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
          >
            {content}
            <TooltipPrimitive.Arrow className="fill-surface stroke-border-default" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}

// --- Accordion (Radix) ---

export function Accordion({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <AccordionPrimitive.Root type="single" collapsible className={className}>
      {children}
    </AccordionPrimitive.Root>
  )
}

export function AccordionItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <AccordionPrimitive.Item value={value}>
      {children}
    </AccordionPrimitive.Item>
  )
}

export function AccordionTrigger({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <AccordionPrimitive.Header asChild>
      <AccordionPrimitive.Trigger
        className={`group flex w-full items-center justify-between ${className}`}
      >
        {children}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-2 shrink-0 text-foreground-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <AccordionPrimitive.Content
      className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up"
    >
      <div className={className}>{children}</div>
    </AccordionPrimitive.Content>
  )
}
