"use client"

import { useState, createContext, useContext, type ReactNode } from "react"

// --- ScoreBadge ---

export function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "bg-green-100 text-green-800"
      : score >= 5
        ? "bg-yellow-100 text-yellow-800"
        : "bg-red-100 text-red-800"
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}/10
    </span>
  )
}

// --- StatusBadge ---

const statusStyles: Record<string, string> = {
  completed: "bg-green-100 text-green-800",
  running: "bg-blue-100 text-blue-800 animate-pulse",
  pending: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-800",
  "not-requested": "bg-gray-50 text-gray-400",
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[status] ?? statusStyles.pending}`}>
      {status}
    </span>
  )
}

// --- Tooltip ---

export function Tooltip({ content, side = "top", children }: { content: ReactNode; side?: "top" | "bottom" | "left" | "right"; children: ReactNode }) {
  const [open, setOpen] = useState(false)

  const positionClass: Record<string, string> = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  }

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <span className={`absolute z-50 w-max max-w-xs rounded-md border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg ${positionClass[side]}`}>
          {content}
        </span>
      )}
    </span>
  )
}

// --- Accordion ---

const AccordionItemContext = createContext<{ value: string }>({ value: "" })
const AccordionContext = createContext<{ openValue: string | null; toggle: (v: string) => void }>({
  openValue: null,
  toggle: () => {},
})

export function Accordion({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [openValue, setOpenValue] = useState<string | null>(null)
  const toggle = (v: string) => setOpenValue(prev => (prev === v ? null : v))
  return (
    <AccordionContext.Provider value={{ openValue, toggle }}>
      <div className={className}>{children}</div>
    </AccordionContext.Provider>
  )
}

export function AccordionItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <AccordionItemContext.Provider value={{ value }}>
      <div data-value={value}>{children}</div>
    </AccordionItemContext.Provider>
  )
}

export function AccordionTrigger({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { value } = useContext(AccordionItemContext)
  const { openValue, toggle } = useContext(AccordionContext)
  const isOpen = openValue === value
  return (
    <button
      type="button"
      onClick={() => toggle(value)}
      className={`flex w-full items-center justify-between ${className}`}
      aria-expanded={isOpen}
    >
      {children}
      <span className={`ml-2 transition-transform ${isOpen ? "rotate-180" : ""}`}>&#9662;</span>
    </button>
  )
}

export function AccordionContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { value } = useContext(AccordionItemContext)
  const { openValue } = useContext(AccordionContext)
  if (openValue !== value) return null
  return <div className={className}>{children}</div>
}
