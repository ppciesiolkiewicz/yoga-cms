"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"
import { ChatDrawer } from "./ChatDrawer"

type Draft = { scope: AnalysisContextScope; tiers: AnalysisContextTiers }

type Ctx = {
  requestId: string
  openWithPreset(draft: Draft): void
}

const DrawerCtx = createContext<Ctx | null>(null)

export function useChatDrawer(): Ctx {
  const ctx = useContext(DrawerCtx)
  if (!ctx) throw new Error("useChatDrawer must be inside <ChatDrawerProvider>")
  return ctx
}

export function ChatDrawerProvider({ requestId, children }: { requestId: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [activeChatId, setActiveChatId] = useState<string | null>(null)

  const openWithPreset = useCallback((d: Draft) => {
    setActiveChatId(null)
    setDraft(d)
    setOpen(true)
  }, [])

  useEffect(() => {
    function onOpen() {
      setOpen(true)
    }
    function onClose() {
      setOpen(false)
    }
    window.addEventListener("walkthrough:open-chat", onOpen)
    window.addEventListener("walkthrough:close-chat", onClose)
    return () => {
      window.removeEventListener("walkthrough:open-chat", onOpen)
      window.removeEventListener("walkthrough:close-chat", onClose)
    }
  }, [])

  const value = useMemo<Ctx>(() => ({ requestId, openWithPreset }), [requestId, openWithPreset])

  return (
    <DrawerCtx.Provider value={value}>
      {children}
      <ChatDrawer
        requestId={requestId}
        open={open}
        onOpenChange={setOpen}
        draft={draft}
        setDraft={setDraft}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
      />
    </DrawerCtx.Provider>
  )
}
