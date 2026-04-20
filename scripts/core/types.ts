import type { ModelTier } from "./models"

export interface CategoryInput {
  name: string
  extraInfo: string
  prompt: string
  model: ModelTier
  lighthouse?: boolean
  wappalyzer?: boolean
}

export interface SiteInput {
  url: string
  meta?: Record<string, unknown>
}

export interface AnalyzeInput {
  displayName?: string
  categories: CategoryInput[]
  sites: SiteInput[]
}

export interface Category extends CategoryInput {
  id: string
}

export interface Site extends SiteInput {
  id: string
}

export interface Request {
  id: string
  createdAt: string
  displayName?: string
  categories: Category[]
  sites: Site[]
}

export type RequestStatus = "pending" | "processing" | "complete" | "rejected"

export interface RequestIndexEntry {
  id: string
  displayName?: string
  createdAt: string
  siteCount: number
  categoryCount: number
  status: RequestStatus
  chatCount: number
}

/** Shape stored on disk — status and chatCount are derived at read time */
export type StoredRequestIndexEntry = Omit<RequestIndexEntry, "status" | "chatCount">

export type StageName =
  | "fetch-home"
  | "parse-links"
  | "classify-nav"
  | "estimate-content"
  | "generate-quote"
  | "fetch-pages"
  | "run-categories"
  | "build-report"

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "not-requested"

export type CategoryTaskName = "detect-tech" | "run-lighthouse" | "extract-pages-content"

export type CategoryProgress = Record<CategoryTaskName, TaskStatus>

export interface RunOptions {
  concurrency?: number
  stages?: StageName[]
  force?: boolean
}

export interface ArtifactRef {
  requestId: string
  siteId?: string
  stage: string
  name: string
}

export interface AIQuery {
  id: string
  requestId: string
  siteId: string
  categoryId?: string
  stage: string
  model: string
  prompt: string          // full system message (category.prompt + stage framing)
  dataRefs: string[]      // page URLs fed as context
  response: string
  usage?: { inputTokens: number; outputTokens: number }
  createdAt: string
}

export interface PageEstimate {
  url: string
  charCount: number
  estimatedTokens: number
}

export interface SiteEstimate {
  siteId: string
  pages: PageEstimate[]
  totalChars: number
  totalEstimatedTokens: number
}

export type OrderStatus = "quoted" | "approved" | "completed" | "rejected"

export interface OrderLineItem {
  stage: string
  description: string
  unit: string
  quantity: number
  unitCost: number
  estimatedCost: number
  actualCost?: number
  actualQuantity?: number
}

export interface OrderSite {
  siteId: string
  url: string
  pageCount: number
  estimatedTokens: number
  lineItems: OrderLineItem[]
  subtotal: number
}

export interface Order {
  id: string
  requestId: string
  createdAt: string
  status: OrderStatus
  sites: OrderSite[]
  totalEstimatedCost: number
  totalActualCost?: number
  approvedAt?: string
  completedAt?: string
}
