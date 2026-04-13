"use client"

import * as SelectPrimitive from "@radix-ui/react-select"

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
    <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        className={`inline-flex items-center justify-between rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm shadow-sm hover:bg-surface-alt focus:border-focus focus:outline-none focus:ring-1 focus:ring-focus disabled:cursor-not-allowed disabled:border-border-default disabled:bg-surface-alt disabled:text-foreground-muted data-placeholder:text-foreground-muted ${className}`}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon className="ml-2 text-foreground-faint">
          &#9662;
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="z-50 overflow-hidden rounded-lg border border-border-default bg-surface shadow-lg"
          position="popper"
          sideOffset={4}
        >
          <SelectPrimitive.Viewport className="max-h-60 p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="relative flex cursor-pointer items-center rounded px-2 py-1.5 text-sm text-foreground-secondary outline-none hover:bg-surface-raised focus:bg-surface-raised data-[state=checked]:bg-accent-subtle data-[state=checked]:text-accent-fg"
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
