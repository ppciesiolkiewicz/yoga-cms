import { type ButtonHTMLAttributes } from "react"

type Variant = "primary" | "secondary" | "ghost"

const variantStyles: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50",
  ghost: "text-gray-600 hover:bg-gray-100",
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
