export interface CategoryInput {
  name: string
  extraInfo: string
  prompt: string
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

export interface RequestIndexEntry {
  id: string
  displayName?: string
  createdAt: string
  siteCount: number
  categoryCount: number
}

export type StageName =
  | "fetch-home"
  | "extract-nav"
  | "classify"
  | "fetch-pages"
  | "tech"
  | "lighthouse"
  | "content"
  | "extract"
  | "report"

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
