import type { AnalysisContext, ChatMessage } from "../analysis-context/types"
import { chunkAnalysisContext } from "../analysis-context/chunk"
import { getClient } from "../../core/ai-client"
import { getChatModel } from "./models"

export type BuiltMessages = {
  system: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
}

export function buildChatMessages(params: {
  context: AnalysisContext
  history: ChatMessage[]
  userMessage: string
  maxBytes?: number
}): BuiltMessages {
  const chunks = chunkAnalysisContext(params.context, params.maxBytes)
  const scopeDesc = describeScope(params.context.scope)

  if (chunks.length === 1) {
    const system = `You are helping the user understand analysis output for ${scopeDesc}. Analysis context (JSON):\n\n${chunks[0]}`
    return {
      system,
      messages: [
        ...params.history.map(m => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: params.userMessage },
      ],
    }
  }

  const system = `You are helping the user understand analysis output for ${scopeDesc}. Analysis context is delivered across ${chunks.length} consecutive messages. Reply with exactly "ok" after each, until you receive "END-OF-CONTEXT", then answer the user's question using the combined context.`
  const messages: Array<{ role: "user" | "assistant"; content: string }> = []
  chunks.forEach((chunk, i) => {
    messages.push({ role: "user", content: `Context part ${i + 1}/${chunks.length}:\n\n${chunk}` })
    messages.push({ role: "assistant", content: "ok" })
  })
  messages.push({ role: "user", content: "END-OF-CONTEXT" })
  messages.push({ role: "assistant", content: "ok" })
  for (const m of params.history) messages.push({ role: m.role, content: m.content })
  messages.push({ role: "user", content: params.userMessage })
  return { system, messages }
}

function describeScope(s: AnalysisContext["scope"]): string {
  const n = s.contextElements.length
  return `${n} site/category pair${n === 1 ? "" : "s"} in request ${s.requestId}`
}

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "done" }
  | { type: "error"; message: string }

export async function* streamScopedChat(params: {
  model: string
  context: AnalysisContext
  history: ChatMessage[]
  userMessage: string
  maxBytes?: number
}): AsyncIterable<StreamEvent> {
  const chatModel = getChatModel(params.model)
  if (!chatModel) {
    yield { type: "error", message: `Unsupported model: ${params.model}` }
    return
  }
  const client = getClient(chatModel.provider)
  const { system, messages } = buildChatMessages(params)

  try {
    for await (const ev of client.stream({
      model: chatModel.id,
      maxTokens: 4096,
      system,
      messages,
    })) {
      if (ev.type === "text") yield { type: "token", text: ev.delta }
    }
    yield { type: "done" }
  } catch (err) {
    yield { type: "error", message: err instanceof Error ? err.message : String(err) }
  }
}
