export const MODEL_MAP = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-6",
} as const

export type ModelTier = keyof typeof MODEL_MAP
