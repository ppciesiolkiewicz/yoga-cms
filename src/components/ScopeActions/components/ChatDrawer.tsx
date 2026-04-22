"use client"

import { useEffect, useRef, useState } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/shadcn/sheet"
import { Button } from "@/components/ui/shadcn/button"
import { Input } from "@/components/ui/shadcn/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select"
import { SUPPORTED_CHAT_MODELS } from "../../../../scripts/chat/models"
import type {
  AnalysisContextScope,
  AnalysisContextTiers,
  ChatMessage,
  ChatMeta,
  ChatRecord,
} from "../../../../scripts/analysis-context/types"
import { ChatHistoryList } from "./ChatHistoryList"
import { ComposeModal } from "./ComposeModal"

type Draft = { scope: AnalysisContextScope; tiers: AnalysisContextTiers }

type Props = {
  requestId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  draft: Draft | null
  setDraft: (d: Draft | null) => void
  activeChatId: string | null
  setActiveChatId: (id: string | null) => void
}

export function ChatDrawer({
  requestId, open, onOpenChange, draft, setDraft, activeChatId, setActiveChatId,
}: Props) {
  const [model, setModel] = useState<string>(SUPPORTED_CHAT_MODELS[1].id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configureOpen, setConfigureOpen] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  const hasMessages = messages.length > 0
  const active = chats.find(c => c.id === activeChatId) ?? null

  useEffect(() => {
    if (!open) return
    fetch(`/api/chat/list?requestId=${encodeURIComponent(requestId)}`)
      .then(r => (r.ok ? r.json() : []))
      .then((list: ChatMeta[]) => setChats(Array.isArray(list) ? list : []))
      .catch(() => setChats([]))
  }, [open, requestId])

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  useEffect(() => {
    function onClose() {
      onOpenChange(false);
    }
    window.addEventListener("walkthrough:close-chat", onClose);
    return () => window.removeEventListener("walkthrough:close-chat", onClose);
  }, [onOpenChange]);

  async function resumeChat(id: string) {
    const qs = `requestId=${encodeURIComponent(requestId)}&chatId=${id}`
    const r = await fetch(`/api/chat/get?${qs}`)
    if (!r.ok) return
    const body = (await r.json()) as ChatRecord
    setActiveChatId(id)
    setMessages(body.messages ?? [])
    setDraft(null)
    if (body.model) setModel(body.model)
  }

  function startNewChat() {
    // If switching away from an active chat, re-seed the draft from its scope/tiers
    // so the user can keep chatting with the same context. Otherwise leave the
    // existing draft (if any) untouched.
    if (active) {
      setDraft({ scope: active.scope, tiers: active.tiers })
    }
    setActiveChatId(null)
    setMessages([])
    setError(null)
  }

  async function send() {
    const userMessage = input.trim()
    if (!userMessage || sending) return
    if (!activeChatId && !draft) { setError("Pick a context via a preset button or Configure first."); return }
    setError(null)
    setInput("")
    setMessages(m => [
      ...m,
      { role: "user", content: userMessage, createdAt: new Date().toISOString() },
      { role: "assistant", content: "", createdAt: new Date().toISOString() },
    ])
    setSending(true)
    try {
      const payload: Record<string, unknown> = { requestId, model, userMessage }
      if (activeChatId) payload.chatId = activeChatId
      else { payload.scope = draft!.scope; payload.tiers = draft!.tiers }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok || !res.body) {
        const p = await res.json().catch(() => ({ error: `request failed (${res.status})` }))
        setError(p.error ?? `request failed (${res.status})`)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split("\n\n")
        buf = parts.pop() ?? ""
        for (const p of parts) {
          const line = p.trim()
          if (!line.startsWith("data:")) continue
          const json = line.slice(5).trim()
          if (!json) continue
          let ev: { type: string; text?: string; chatId?: string; message?: string }
          try { ev = JSON.parse(json) } catch { continue }
          if (ev.type === "chatId" && ev.chatId) {
            setActiveChatId(ev.chatId)
            // once the backend assigns an id, the scope is locked; drop the draft.
            setDraft(null)
            // refresh the history list so the new chat appears in the left pane.
            fetch(`/api/chat/list?requestId=${encodeURIComponent(requestId)}`)
              .then(r => (r.ok ? r.json() : []))
              .then((list: ChatMeta[]) => setChats(Array.isArray(list) ? list : []))
          } else if (ev.type === "token" && typeof ev.text === "string") {
            const text = ev.text
            setMessages(m => {
              const copy = [...m]
              const last = copy[copy.length - 1]
              if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: last.content + text }
              return copy
            })
          } else if (ev.type === "error") {
            setError(ev.message ?? "stream error")
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSending(false)
    }
  }

  // ComposeModal inputs: whichever is currently in scope — the active chat's locked context (read-only),
  // else the draft, else an empty seed so the user can build context from scratch.
  const modalScope: AnalysisContextScope = active
    ? active.scope
    : draft?.scope ?? { requestId, contextElements: [] }
  const modalTiers: AnalysisContextTiers = active
    ? active.tiers
    : draft?.tiers ?? {}

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-tour="site-chat-drawer" className="flex w-full flex-col gap-0 p-0 sm:max-w-[min(90vw,1400px)]!">
        <SheetHeader className="border-b">
          <SheetTitle>Chat about this analysis</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Select value={model} onValueChange={setModel} disabled={!!activeChatId || hasMessages}>
            <SelectTrigger className="w-50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Anthropic</SelectLabel>
                {SUPPORTED_CHAT_MODELS.filter(m => m.provider === "anthropic").map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Groq</SelectLabel>
                {SUPPORTED_CHAT_MODELS.filter(m => m.provider === "groq").map(m => (
                  <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => setConfigureOpen(true)}>
            Configure
          </Button>
          <Button variant="outline" size="sm" onClick={startNewChat}>
            New chat
          </Button>
        </div>
        <div className="flex min-h-0 flex-1">
          <aside className="w-64 shrink-0 overflow-auto border-r">
            <ChatHistoryList chats={chats} activeChatId={activeChatId} onPick={resumeChat} />
          </aside>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
              {messages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ask a question grounded in this analysis.
                </p>
              )}
              {messages.map((m, i) => (
                <div key={i} className={m.role === "user" ? "rounded-md bg-muted px-3 py-2 text-sm" : "rounded-md border px-3 py-2 text-sm"}>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {m.role === "user" ? "You" : "Assistant"}
                  </div>
                  <div className="whitespace-pre-wrap">
                    {m.content || (sending && i === messages.length - 1 ? "…" : "")}
                  </div>
                </div>
              ))}
              {error && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div ref={endRef} />
            </div>
            <div className="flex gap-2 border-t px-4 py-3">
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Ask a question…"
                disabled={sending}
              />
              <Button onClick={send} disabled={sending || !input.trim()}>
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
      {configureOpen && (
        <ComposeModal
          open={configureOpen}
          onOpenChange={setConfigureOpen}
          requestId={requestId}
          scope={modalScope}
          tiers={modalTiers}
          mode="chat"
          readOnly={hasMessages}
          onSave={(scope, tiers) => { setDraft({ scope, tiers }); setConfigureOpen(false) }}
        />
      )}
    </Sheet>
  )
}
