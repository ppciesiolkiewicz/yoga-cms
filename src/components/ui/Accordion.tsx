"use client"

import { type ReactNode } from "react"
import {
  Accordion as ShadcnAccordion,
  AccordionItem as ShadcnAccordionItem,
  AccordionTrigger as ShadcnAccordionTrigger,
  AccordionContent as ShadcnAccordionContent,
} from "@/components/ui/shadcn/accordion"

export function Accordion({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ShadcnAccordion type="single" collapsible className={className}>
      {children}
    </ShadcnAccordion>
  )
}

export function AccordionItem({ value, children }: { value: string; children: ReactNode }) {
  return (
    <ShadcnAccordionItem value={value}>
      {children}
    </ShadcnAccordionItem>
  )
}

export function AccordionTrigger({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ShadcnAccordionTrigger className={className}>
      {children}
    </ShadcnAccordionTrigger>
  )
}

export function AccordionContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <ShadcnAccordionContent className={className}>
      {children}
    </ShadcnAccordionContent>
  )
}
