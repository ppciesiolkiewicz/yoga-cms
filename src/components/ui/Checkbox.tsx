"use client"

import { Checkbox as ShadcnCheckbox } from "./shadcn/checkbox"

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
      <ShadcnCheckbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      {label}
    </label>
  )
}
