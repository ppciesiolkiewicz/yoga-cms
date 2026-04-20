"use client"

import { useEffect, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/shadcn/sheet"
import { Button } from "@/components/ui/shadcn/button"
import { Input } from "@/components/ui/shadcn/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/shadcn/select"
import { ChatHistoryMenu } from "./ChatHistoryMenu"
import { SUPPORTED_CHAT_MODELS } from "../../../../scripts/chat/models"
import type {
  AnalysisContextScope,
  AnalysisContextTiers,
  ChatMessage,
  ChatMeta,
} from "../../../../scripts/analysis-context/types"
import { encodeScope } from "../../../../scripts/analysis-context/scope-codec"

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  scope: AnalysisContextScope
  initialTiers: AnalysisContextTiers
}

export function ChatDrawer({ open, onOpenChange, scope, initialTiers }: Props) {
  const [model, setModel] = useState<string>(SUPPORTED_CHAT_MODELS[1].id)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [chatId, setChatId] = useState<string | null>(null)
  const [chats, setChats] = useState<ChatMeta[]>([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const scopeKey = JSON.stringify(scope)

  useEffect(() => {
    if (!open) return
    const qs = `scope=${encodeURIComponent(encodeScope(scope))}`
    fetch(`/api/chat/list?${qs}`)
      .then(r => (r.ok ? r.json() : []))
      .then((list: ChatMeta[]) => setChats(Array.isArray(list) ? list : []))
      .catch(() => setChats([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scopeKey])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    function onClose() {
      onOpenChange(false);
    }
    window.addEventListener("walkthrough:close-chat", onClose);
    return () => window.removeEventListener("walkthrough:close-chat", onClose);
  }, [onOpenChange]);

  async function resumeChat(id: string) {
    const qs = `scope=${encodeURIComponent(encodeScope(scope))}&chatId=${id}`
    const r = await fetch(`/api/chat/get?${qs}`)
    if (!r.ok) return
    const body = await r.json()
    setChatId(id)
    setMessages(body.messages ?? [])
    if (body.model) setModel(body.model)
  }

  async function send() {
    const userMessage = input.trim()
    if (!userMessage || sending) return
    setError(null)
    setInput("")
    setMessages(m => [
      ...m,
      { role: "user", content: userMessage, createdAt: new Date().toISOString() },
      { role: "assistant", content: "", createdAt: new Date().toISOString() },
    ])
    setSending(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scope,
          tiers: initialTiers,
          model,
          chatId: chatId ?? undefined,
          userMessage,
        }),
      })
      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({ error: `request failed (${res.status})` }))
        setError(payload.error ?? `request failed (${res.status})`)
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
          try {
            ev = JSON.parse(json)
          } catch {
            continue
          }
          if (ev.type === "chatId" && ev.chatId) {
            setChatId(ev.chatId)
          } else if (ev.type === "token" && typeof ev.text === "string") {
            const text = ev.text
            setMessages(m => {
              const copy = [...m]
              const last = copy[copy.length - 1]
              if (last?.role === "assistant") {
                copy[copy.length - 1] = { ...last, content: last.content + text }
              }
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

  function startNewChat() {
    setChatId(null)
    setMessages([])
    setError(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent data-tour="site-chat-drawer" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Chat about this analysis</SheetTitle>
        </SheetHeader>
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_CHAT_MODELS.map(m => (
                <SelectItem key={m.id} value={m.id}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ChatHistoryMenu chats={chats} activeChatId={chatId} onResume={resumeChat} />
          <Button variant="outline" size="sm" onClick={startNewChat}>
            New chat
          </Button>
        </div>
        <div className="flex-1 space-y-3 overflow-auto px-4 py-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Ask a question grounded in this analysis.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.role === "user"
                  ? "rounded-md bg-muted px-3 py-2 text-sm"
                  : "rounded-md border px-3 py-2 text-sm"
              }
            >
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
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder="Ask a question…"
            disabled={sending}
          />
          <Button onClick={send} disabled={sending || !input.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
