import type { Provider } from "./ai-client"

export interface ModelRef {
  provider: Provider
  model: string
}

export const SETTINGS = {
  models: {
    classifyNav:   { provider: "groq",      model: "llama-3.1-8b-instant" },
    extractPages:  { provider: "anthropic", model: "claude-sonnet-4-6" },
    basePromptGen: { provider: "anthropic", model: "claude-sonnet-4-6" },
    chatDefault:   { provider: "anthropic", model: "claude-sonnet-4-6" },
  },
  stageEstimates: {
    classifyNavOutputTokens:  500,
    extractPagesOutputTokens: 1500,
  },
  providers: {
    anthropic: { apiKeyEnv: "ANTHROPIC_API_KEY" },
    groq:      { apiKeyEnv: "GROQ_API_KEY" },
  },
} as const satisfies {
  models: Record<string, ModelRef>
  stageEstimates: Record<string, number>
  providers: Record<Provider, { apiKeyEnv: string }>
}
