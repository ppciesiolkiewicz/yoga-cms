export type ScrapeMode = "fetch" | "browser"

export interface ScrapableUrl {
  url: string
  scrapeMode?: ScrapeMode // default: "fetch"
}

export interface StudioEntry {
  studioName: string
  city: string
  website: string
  dropIns: ScrapableUrl[]
  trainings: ScrapableUrl[]
  retreats: ScrapableUrl[]
  contact?: ScrapableUrl
}
