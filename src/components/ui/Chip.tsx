import { type ButtonHTMLAttributes } from "react"

export function Chip({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 ${className}`}
      {...props}
    />
  )
}
