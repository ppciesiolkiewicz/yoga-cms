"use client"

import { CopyMenu } from "./components/CopyMenu"
import { ChatMenu } from "./components/ChatMenu"
import type { Preset } from "./lib/presets"

type Props = {
  preset: Preset
  label: string
  tooltip: string
  orientation?: "horizontal" | "vertical"
}

export function ScopeActions({ preset, label, tooltip, orientation = "horizontal" }: Props) {
  const vertical = orientation === "vertical"
  return (
    <div className={vertical ? "flex flex-col items-stretch gap-1.5" : "flex items-center gap-2"}>
      <CopyMenu label={`Copy ${label}`} tooltip={`Copy ${tooltip} to your clipboard.`} preset={preset} requestId={preset.scope.requestId} fullWidth={vertical} />
      <ChatMenu label={`Chat about ${label}`} tooltip={`Ask Claude about ${tooltip}.`} preset={preset} fullWidth={vertical} />
    </div>
  )
}
