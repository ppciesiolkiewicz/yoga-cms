export interface OrganicResult {
  title: string
  link: string
  snippet: string
  position: number
  date?: string
  sitelinks?: Array<{ title: string; link: string }>
}

export interface KnowledgeGraph {
  title?: string
  type?: string
  description?: string
  imageUrl?: string
  url?: string
  attributes?: Record<string, string>
}

export interface PeopleAlsoAsk {
  question: string
  snippet?: string
  title?: string
  link?: string
}

export interface RelatedSearch {
  query: string
}

export interface TopStory {
  title: string
  link: string
  source?: string
  date?: string
  imageUrl?: string
}

export interface ImageResult {
  title: string
  imageUrl: string
  link: string
}

export interface SerperResponse {
  searchParameters?: { q: string; type?: string; [key: string]: unknown }
  organic?: OrganicResult[]
  knowledgeGraph?: KnowledgeGraph
  peopleAlsoAsk?: PeopleAlsoAsk[]
  relatedSearches?: RelatedSearch[]
  topStories?: TopStory[]
  images?: ImageResult[]
  [key: string]: unknown
}
