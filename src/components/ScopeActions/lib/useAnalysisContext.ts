"use client"

import { useEffect, useRef, useState } from "react"
import type {
  AnalysisContext,
  AnalysisContextScope,
  AnalysisContextTiers,
} from "../../../../scripts/analysis-context/types"

export function useAnalysisContext(
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers,
  debounceMs = 250,
) {
  const [data, setData] = useState<AnalysisContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ctrlRef = useRef<AbortController | null>(null)

  const scopeKey = JSON.stringify(scope)
  const tiersKey = JSON.stringify(tiers)

  useEffect(() => {
    const hasAny = Object.values(tiers).some(Boolean)
    const hasPairs = scope.contextElements.length > 0
    if (!hasAny || !hasPairs) {
      setData(null)
      setError(null)
      return
    }
    const timer = setTimeout(async () => {
      ctrlRef.current?.abort()
      const ctrl = new AbortController()
      ctrlRef.current = ctrl
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/compose", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scope, tiers }),
          signal: ctrl.signal,
        })
        if (!res.ok) throw new Error(`compose failed: ${res.status}`)
        setData(await res.json() as AnalysisContext)
      } catch (e) {
        if ((e as Error).name === "AbortError") return
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    }, debounceMs)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, tiersKey, debounceMs])

  return { data, loading, error }
}

export async function fetchAnalysisContextOnce(
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers,
): Promise<AnalysisContext> {
  const res = await fetch("/api/compose", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope, tiers }),
  })
  if (!res.ok) throw new Error(`compose failed: ${res.status}`)
  return await res.json() as AnalysisContext
}

export async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement("textarea")
  ta.value = text
  ta.style.position = "fixed"
  ta.style.left = "-9999px"
  document.body.appendChild(ta)
  ta.select()
  document.execCommand("copy")
  document.body.removeChild(ta)
}
