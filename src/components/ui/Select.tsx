"use client"

import {
  Select as ShadcnSelect,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./shadcn/select"

interface SelectOption {
  value: string
  label: string
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  className = "",
}: {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <ShadcnSelect value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </ShadcnSelect>
  )
}
