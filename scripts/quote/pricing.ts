import { readFileSync } from "fs"
import { join } from "path"
import type { Provider } from "../../core/ai-client"

export interface ModelPricing {
  inputPer1kTokens: number
  outputPer1kTokens: number
}

export interface PricingConfig {
  version: number
  currency: string
  serviceFee: { perPage: number }
  firecrawl: { perScrape: number }
  models: Record<Provider, Record<string, ModelPricing>>
  lighthouse: { perRun: number }
  wappalyzer: { perRun: number }
  contentEstimator: { perPage: number }
}

const DEFAULT_PATH = join(__dirname, "pricing.json")

export function loadPricingConfig(path: string = DEFAULT_PATH): PricingConfig {
  const raw = readFileSync(path, "utf8")
  const config = JSON.parse(raw) as PricingConfig
  if (config.version !== 2) {
    throw new Error(`Unsupported pricing config version: ${config.version}`)
  }
  return config
}

export function lookupModelPricing(
  config: PricingConfig,
  provider: Provider,
  model: string,
): ModelPricing {
  const byProvider = config.models[provider]
  if (!byProvider) throw new Error(`No pricing for provider: ${provider}`)
  const pricing = byProvider[model]
  if (!pricing) throw new Error(`No pricing for ${provider}/${model}`)
  return pricing
}
