import { type ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "ghost"

const variantStyles: Record<Variant, string> = {
  primary: "bg-accent text-foreground-on-accent hover:bg-accent-hover",
  secondary: "border border-border-strong bg-surface text-foreground-secondary hover:bg-surface-alt",
  ghost: "text-foreground-secondary hover:bg-surface-raised",
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${variantStyles[variant]} ${className}`}
      {...props}
    />
  )
}
