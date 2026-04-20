export const SUPPORTED_CHAT_MODELS = [
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
] as const

export type ChatModelId = (typeof SUPPORTED_CHAT_MODELS)[number]["id"]

export function isSupportedModel(id: string): id is ChatModelId {
  return SUPPORTED_CHAT_MODELS.some(m => m.id === id)
}
