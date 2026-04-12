"use client"

import * as CheckboxPrimitive from "@radix-ui/react-checkbox"

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  className = "",
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  className?: string
}) {
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-white data-[state=checked]:border-blue-600 data-[state=checked]:bg-blue-600"
      >
        <CheckboxPrimitive.Indicator>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2.5 6L5 8.5L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label}
    </label>
  )
}
