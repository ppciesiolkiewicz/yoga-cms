"use client"

import { CopyMenu } from "./components/CopyMenu"
import { ChatMenu } from "./components/ChatMenu"
import type { AnalysisContextScope } from "../../../scripts/analysis-context/types"

type Props = {
  scope: AnalysisContextScope
  orientation?: "horizontal" | "vertical"
}

export function ScopeActions({ scope, orientation = "horizontal" }: Props) {
  const vertical = orientation === "vertical"
  return (
    <div className={vertical ? "flex flex-col items-stretch gap-1.5" : "flex items-center gap-2"}>
      <CopyMenu scope={scope} fullWidth={vertical} />
      <ChatMenu scope={scope} fullWidth={vertical} />
    </div>
  )
}
