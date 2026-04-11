export interface StudioOverrides {
  dropIns?: string[]
  trainings?: string[]
  retreats?: string[]
  contact?: string
}

export interface SearchRanking {
  query: string
  position: number
  isTopResult: boolean
}

export interface StudioEntry {
  studioName: string
  city: string
  website: string
  searchRanking?: SearchRanking
  overrides?: StudioOverrides
}

// ── Raw fetch output ────────────────────────────────────────

export type PageCategory = "home" | "dropIn" | "training" | "retreat" | "contact"
export type DiscoverySource = "override" | "homepage-links" | `map:${string}`

export type RawPage =
  | {
      status: "ok"
      url: string
      file: string
      category: PageCategory
      source: DiscoverySource
      fetchedAt: string
      bytes: number
    }
  | {
      status: "failed"
      url: string
      file: string
      category: PageCategory
      source: DiscoverySource
      fetchedAt: string
      error: string
    }

export interface PagesJson {
  studioName: string
  website: string
  fetchedAt: string
  pages: RawPage[]
}

export interface FetchedPage {
  url: string
  markdown: string
  category: PageCategory
}

export interface RawStudio {
  slug: string
  studioName: string
  website: string
  fetchedAt: string
  pages: FetchedPage[]
  homepage: {
    url: string
    markdown: string
    html: string
    links: string[]
  }
  lighthouse: LighthouseScores
}

export interface NavLink {
  label: string
  href: string
  /** Score 1-10 if this nav link matches an assessed page (drop-in, training, or retreat). */
  score?: number
  /** Category of the assessed page this link points to, if any. */
  pageType?: "dropIn" | "training" | "retreat"
}

export interface DetectedTechnology {
  name: string
  category: string
  categories: string[]
  version?: string
  confidence?: number
  website?: string
  icon?: string
  description?: string
  slug?: string
  cpe?: string | null
}

export interface CostItem {
  item: string
  estimatedMonthlyCost: { min: number; max: number }
}

export interface LighthouseScores {
  performance: number
  accessibility: number
  seo: number
  bestPractices: number
}

export interface TechAssessment {
  platform: string
  detectedTechnologies: DetectedTechnology[]
  lighthouse: LighthouseScores
  costBreakdown: CostItem[]
  totalEstimatedMonthlyCost: { min: number; max: number; currency: string }
}

export interface Features {
  onlineBooking?: string
  onlineClasses: boolean
  chat?: string
  ecommerce: boolean
  newsletter: boolean
  blog: boolean
  multiLanguage: boolean
  addOnServices: string[]
}

export interface ProgressiveDisclosure {
  when: boolean
  where: boolean
  price: boolean
  what: boolean
  howLong: boolean
}

export interface TrainingPageAssessment {
  url: string
  pageName: string
  score: number
  progressiveDisclosure: ProgressiveDisclosure
  keyInfoScrollDepthEstimate: "top" | "middle" | "bottom"
  fillerContentWarning: boolean
  whyChooseUsWarning: boolean
  notes: string
}

export interface RetreatPageAssessment {
  url: string
  pageName: string
  score: number
  progressiveDisclosure: ProgressiveDisclosure
  notes: string
}

export interface ContentAssessment {
  overallScore: number
  summary: string
  dropInPresentation: { score: number; notes: string } | null
  trainingPages: TrainingPageAssessment[]
  retreatPages: RetreatPageAssessment[]
}

export interface ContactInfo {
  email?: string
  phone?: string
  whatsapp?: string
  instagram?: string
  facebook?: string
  address?: string
  contactPageUrl?: string
}

export interface DropInClass {
  className: string
  style: string
  schedule: string
  price?: string
}

export interface Training {
  name: string
  type: string
  price?: string
  dates?: string[]
  duration?: string
  certification?: string
}

export interface Retreat {
  name: string
  price?: string
  dates?: string[]
  duration?: string
  description?: string
}

export interface StudioReport {
  slug: string
  studioName: string
  city: string
  website: string
  searchRanking?: SearchRanking
  scrapedAt: string
  navigation: NavLink[]
  tech: TechAssessment
  features: Features
  contentAssessment: ContentAssessment
  contact: ContactInfo
  dropInClasses: DropInClass[]
  trainings: Training[]
  retreats: Retreat[]
}

export interface StudioIndexEntry {
  slug: string
  studioName: string
  city: string
  platform: string
  overallContentScore: number
  estimatedMonthlyCost: { min: number; max: number }
  lighthousePerformance: number
  pageCount: number
}

export interface StudioIndex {
  generatedAt: string
  studios: StudioIndexEntry[]
}
