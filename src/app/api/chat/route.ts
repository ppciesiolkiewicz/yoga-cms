import { NextResponse } from "next/server"
import { buildAnalysisContext } from "../../../../scripts/analysis-context"
import type { AnalysisContextScope, AnalysisContextTiers } from "../../../../scripts/analysis-context/types"
import { isSupportedModel } from "../../../../scripts/chat/models"
import { streamScopedChat } from "../../../../scripts/chat/stream"
import { getRepo, resetRepoForTests } from "../../../lib/repo-server"

type Body = {
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
  model: string
  chatId?: string
  userMessage: string
}

export async function POST(req: Request) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 })
  }
  if (!isSupportedModel(body.model)) {
    return NextResponse.json({ error: `unsupported model: ${body.model}` }, { status: 400 })
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 })
  }

  if (process.env.NODE_ENV === "test") resetRepoForTests()
  const repo = getRepo()

  let chatId = body.chatId
  let history: Awaited<ReturnType<typeof repo.getScopedChat>>["messages"] = []
  if (chatId) {
    const existing = await repo.getScopedChat(body.scope, chatId)
    history = existing.messages
  } else {
    const created = await repo.createScopedChat(body.scope, {
      model: body.model,
      tiers: body.tiers,
      title: body.userMessage.slice(0, 60),
    })
    chatId = created.id
  }

  await repo.appendScopedChatMessage(body.scope, chatId, {
    role: "user",
    content: body.userMessage,
    createdAt: new Date().toISOString(),
  })

  const ctx = await buildAnalysisContext(repo, body.scope, body.tiers)

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
        await repo.appendScopedChatMessage(body.scope, chatId!, {
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
