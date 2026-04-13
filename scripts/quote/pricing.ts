import { readFileSync } from "fs"
import { join } from "path"

export interface AIStageConfig {
  model: string
  inputPer1kTokens: number
  outputPer1kTokens: number
  estimatedOutputTokens: number
}

export interface PricingConfig {
  version: number
  currency: string
  serviceFee: { perPage: number }
  firecrawl: { perScrape: number }
  ai: {
    classifyNav: AIStageConfig
    extractPagesContent: AIStageConfig
  }
  lighthouse: { perRun: number }
  wappalyzer: { perRun: number }
  contentEstimator: { perPage: number }
}

const DEFAULT_PATH = join(__dirname, "pricing.json")

export function loadPricingConfig(path: string = DEFAULT_PATH): PricingConfig {
  const raw = readFileSync(path, "utf8")
  const config = JSON.parse(raw) as PricingConfig
  if (config.version !== 1) {
    throw new Error(`Unsupported pricing config version: ${config.version}`)
  }
  return config
}
