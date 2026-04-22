import type { Provider } from "../../core/ai-client"

export interface ChatModel {
  id: string
  label: string
  provider: Provider
}

export const SUPPORTED_CHAT_MODELS: ChatModel[] = [
  { id: "claude-opus-4-6",               label: "Claude Opus 4.6",   provider: "anthropic" },
  { id: "claude-sonnet-4-6",             label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-haiku-4-5-20251001",     label: "Claude Haiku 4.5",  provider: "anthropic" },
  { id: "llama-3.1-8b-instant",          label: "Llama 3.1 8B",      provider: "groq"      },
  { id: "llama-3.3-70b-versatile",       label: "Llama 3.3 70B",     provider: "groq"      },
  { id: "moonshotai/kimi-k2-instruct",   label: "Kimi K2",           provider: "groq"      },
]

export function getChatModel(id: string): ChatModel | undefined {
  return SUPPORTED_CHAT_MODELS.find(m => m.id === id)
}

export function isSupportedModel(id: string): boolean {
  return SUPPORTED_CHAT_MODELS.some(m => m.id === id)
}
