"use client"

import { useRef, type ReactNode } from "react"

export function Carousel({
  children,
  className = "",
}: {
  children: ReactNode
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  function scroll(direction: "left" | "right") {
    if (!scrollRef.current) return
    const amount = scrollRef.current.clientWidth * 0.8
    scrollRef.current.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    })
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => scroll("left")}
        className="absolute -left-5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border-default bg-surface p-2 shadow-md hover:bg-surface-alt"
        aria-label="Scroll left"
      >
        &#8249;
      </button>
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth py-2 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scroll("right")}
        className="absolute -right-5 top-1/2 z-10 -translate-y-1/2 rounded-full border border-border-default bg-surface p-2 shadow-md hover:bg-surface-alt"
        aria-label="Scroll right"
      >
        &#8250;
      </button>
    </div>
  )
}
