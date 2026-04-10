export type ScrapeMode = "fetch" | "browser"

export interface ScrapableUrl {
  url: string
  scrapeMode?: ScrapeMode // default: "fetch"
}

export interface SearchRanking {
  query: string              // e.g. "yoga studio Melbourne"
  position: number           // 1-based rank in search results
  isTopResult: boolean       // position <= 5
}

export interface StudioEntry {
  studioName: string
  city: string
  website: string
  searchRanking?: SearchRanking
  dropIns: ScrapableUrl[]
  trainings: ScrapableUrl[]
  retreats: ScrapableUrl[]
  contact?: ScrapableUrl
}

// ── Output types ────────────────────────────────────────────

export interface FetchedPage {
  url: string
  html: string
  text: string
}

export interface NavLink {
  label: string
  href: string
}

export interface DetectedTechnology {
  name: string
  category: string
  version?: string
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
