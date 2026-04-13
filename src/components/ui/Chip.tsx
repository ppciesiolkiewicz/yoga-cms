import { type ButtonHTMLAttributes } from "react"

export function Chip({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center rounded-full border border-border-default bg-surface-alt px-3 py-1 text-xs text-foreground-secondary hover:bg-surface-raised ${className}`}
      {...props}
    />
  )
}
