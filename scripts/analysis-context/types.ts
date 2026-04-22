export type AnalysisContextScope = {
  requestId: string
  contextElements: { siteId: string; categoryId: string }[]
}

export type AnalysisContextTiers = {
  report?: boolean
  extractedContent?: boolean
  tech?: boolean
  lighthouse?: boolean
  rawPages?: boolean
  input?: boolean
  progress?: boolean
}

export type AnalysisContext = {
  scope: AnalysisContextScope
  tiers: AnalysisContextTiers
  json: Record<string, unknown>
  bytes: number
  missing: string[]
}

export type ChatMessage = {
  role: "user" | "assistant"
  content: string
  createdAt: string
  truncated?: boolean
}

export type ChatMeta = {
  id: string
  createdAt: string
  title: string
  model: string
  tiers: AnalysisContextTiers
  scope: AnalysisContextScope
}

export type ChatRecord = ChatMeta & { messages: ChatMessage[] }
