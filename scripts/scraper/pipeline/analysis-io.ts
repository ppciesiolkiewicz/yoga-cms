// scripts/scraper/pipeline/analysis-io.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type {
  ClassificationJson,
  TechFeaturesJson,
  LighthouseJson,
  ContentJson,
  ExtractedJson,
} from "../types"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, "../../../data")
const ANALYSIS_DIR = join(DATA_DIR, "analysis")

export function analysisDir(slug: string): string {
  return join(ANALYSIS_DIR, slug)
}

function ensureDir(slug: string): string {
  const dir = analysisDir(slug)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeJson<T>(dir: string, name: string, data: T): void {
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2), "utf-8")
}

function readJson<T>(dir: string, name: string): T | null {
  const path = join(dir, name)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T
  } catch {
    return null
  }
}

// ── Classification ──

export function writeClassification(slug: string, data: ClassificationJson): void {
  writeJson(ensureDir(slug), "classification.json", data)
}

export function readClassification(slug: string): ClassificationJson | null {
  return readJson<ClassificationJson>(analysisDir(slug), "classification.json")
}

// ── Tech + Features ──

export function writeTechFeatures(slug: string, data: TechFeaturesJson): void {
  writeJson(ensureDir(slug), "tech.json", data)
}

export function readTechFeatures(slug: string): TechFeaturesJson | null {
  return readJson<TechFeaturesJson>(analysisDir(slug), "tech.json")
}

// ── Lighthouse ──

export function writeLighthouse(slug: string, data: LighthouseJson): void {
  writeJson(ensureDir(slug), "lighthouse.json", data)
}

export function readLighthouse(slug: string): LighthouseJson | null {
  return readJson<LighthouseJson>(analysisDir(slug), "lighthouse.json")
}

// ── Content ──

export function writeContent(slug: string, data: ContentJson): void {
  writeJson(ensureDir(slug), "content.json", data)
}

export function readContent(slug: string): ContentJson | null {
  return readJson<ContentJson>(analysisDir(slug), "content.json")
}

// ── Extracted ──

export function writeExtracted(slug: string, data: ExtractedJson): void {
  writeJson(ensureDir(slug), "extracted.json", data)
}

export function readExtracted(slug: string): ExtractedJson | null {
  return readJson<ExtractedJson>(analysisDir(slug), "extracted.json")
}

// ── Generic artifact existence ──

export function analysisArtifactExists(slug: string, name: string): boolean {
  return existsSync(join(analysisDir(slug), name))
}
