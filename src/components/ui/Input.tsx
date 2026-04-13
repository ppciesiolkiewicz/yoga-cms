import { forwardRef, type InputHTMLAttributes } from "react"

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className = "", ...props }, ref) => (
    <input
      ref={ref}
      className={`rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:cursor-not-allowed disabled:border-border-default disabled:bg-surface-alt disabled:text-foreground-muted ${className}`}
      {...props}
    />
  )
)
