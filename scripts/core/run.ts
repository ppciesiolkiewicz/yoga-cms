import type { AnalyzeInput, RunOptions, StageName, Request, Site } from "./types"
import { Repo } from "../db/repo"
import { fetchHome } from "../pipeline/fetch-home"
import { parseLinks } from "../pipeline/parse-links"
import { classifyNav } from "../pipeline/classify-nav"
import { fetchPages } from "../pipeline/fetch-pages"
import { detectTechStage } from "../pipeline/detect-tech"
import { lighthouseStage } from "../pipeline/lighthouse"
import { assessStage } from "../pipeline/assess"
import { extractStage } from "../pipeline/extract"
import { reportStage } from "../pipeline/report"

type Stage = (repo: Repo, request: Request, site: Site) => Promise<void>

const STAGES: Array<{ name: StageName; fn: Stage }> = [
  { name: "fetch-home", fn: fetchHome },
  { name: "parse-links", fn: parseLinks },
  { name: "classify-nav", fn: classifyNav },
  { name: "fetch-pages", fn: fetchPages },
  { name: "detect-tech", fn: detectTechStage },
  { name: "lighthouse", fn: lighthouseStage },
  { name: "assess", fn: assessStage },
  { name: "extract", fn: extractStage },
  { name: "report", fn: reportStage },
]

function shouldRun(stage: StageName, opts: RunOptions): boolean {
  return !opts.stages || opts.stages.includes(stage)
}

async function runSite(repo: Repo, request: Request, site: Site, opts: RunOptions): Promise<void> {
  console.log(`\n═══ ${site.url} ═══`)
  for (const { name, fn } of STAGES) {
    if (!shouldRun(name, opts)) continue
    try {
      console.log(`  ▶ ${name}`)
      await fn(repo, request, site)
      console.log(`  ✓ ${name}`)
    } catch (err) {
      console.warn(`  ✗ ${name} failed: ${err instanceof Error ? err.message : err}`)
      if (name === "fetch-home" || name === "classify-nav") return
    }
  }
}

export async function runAnalysis(
  input: AnalyzeInput,
  opts: RunOptions = {},
  repo: Repo = new Repo(process.cwd() + "/data"),
): Promise<string> {
  const request = await repo.createRequest(input)
  console.log(`\n==> Request ${request.id} (${request.sites.length} sites, ${request.categories.length} categories)`)

  const concurrency = Math.max(1, opts.concurrency ?? 1)
  const queue = [...request.sites]
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const site = queue.shift()
      if (!site) return
      try {
        await runSite(repo, request, site, opts)
      } catch (err) {
        console.warn(`  ✗ site ${site.url} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  await repo.consolidateRequest(request.id)
  console.log(`\n==> consolidated → requests/${request.id}/result.json`)
  return request.id
}
