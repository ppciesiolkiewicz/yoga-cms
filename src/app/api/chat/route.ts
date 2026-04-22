import { NextResponse } from "next/server"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import type { AnalysisContextScope, AnalysisContextTiers, ChatMessage } from "../../../../scripts/analysis-context/types"
import { getChatModel } from "../../../../scripts/chat/models"
import { streamScopedChat } from "../../../../scripts/chat/stream"
import { getRepo, resetRepoForTests } from "../../../lib/repo-server"
import { requireApiKeysFor } from "../../../../core/validate-env"

type Body = {
  requestId: string
  chatId?: string
  model: string
  userMessage: string
  scope?: AnalysisContextScope
  tiers?: AnalysisContextTiers
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
  if (!body.requestId) return NextResponse.json({ error: "missing requestId" }, { status: 400 })
  const chatModel = getChatModel(body.model)
  if (!chatModel) {
    return NextResponse.json({ error: `unsupported model: ${body.model}` }, { status: 400 })
  }
  try {
    requireApiKeysFor([chatModel.provider])
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }

  if (process.env.NODE_ENV === "test") resetRepoForTests()
  const repo = getRepo()

  let chatId = body.chatId
  let scope: AnalysisContextScope
  let tiers: AnalysisContextTiers
  let history: ChatMessage[] = []

  if (chatId) {
    const existing = await repo.getChat(body.requestId, chatId)
    scope = existing.scope
    tiers = existing.tiers
    history = existing.messages
  } else {
    if (!body.scope || !body.tiers) {
      return NextResponse.json({ error: "scope and tiers required for new chat" }, { status: 400 })
    }
    if (body.scope.contextElements.length === 0) {
      return NextResponse.json({ error: "contextElements cannot be empty" }, { status: 400 })
    }
    scope = body.scope
    tiers = body.tiers
    const created = await repo.createChat(body.requestId, {
      scope,
      model: body.model,
      tiers,
      title: body.userMessage.slice(0, 60),
    })
    chatId = created.id
  }

  await repo.appendChatMessage(body.requestId, chatId, {
    role: "user",
    content: body.userMessage,
    createdAt: new Date().toISOString(),
  })

  const ctx = await buildAnalysisContext(repo, scope, tiers)

  const encoder = new TextEncoder()
  let assistantText = ""
  let truncated = false

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "chatId", chatId })}\n\n`))
      try {
        for await (const ev of streamScopedChat({
          model: body.model,
          context: ctx,
          history,
          userMessage: body.userMessage,
        })) {
          if (ev.type === "token") {
            assistantText += ev.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
          } else if (ev.type === "error") {
            truncated = true
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
          } else {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(ev)}\n\n`))
          }
        }
      } finally {
        await repo.appendChatMessage(body.requestId, chatId!, {
          role: "assistant",
          content: assistantText,
          createdAt: new Date().toISOString(),
          ...(truncated ? { truncated: true } : {}),
        })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  })
}
