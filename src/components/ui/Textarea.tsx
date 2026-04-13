import { type TextareaHTMLAttributes } from "react"

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm shadow-sm focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus ${className}`}
      {...props}
    />
  )
}
