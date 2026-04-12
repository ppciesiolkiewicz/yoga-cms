import type { AnalyzeInput, RunOptions, StageName, Request, Site, Category, CategoryProgress, CategoryTaskName } from "./types"
import { Repo } from "../db/repo"
import { fetchHome } from "../pipeline/fetch-home"
import { parseLinks } from "../pipeline/parse-links"
import { classifyNav } from "../pipeline/classify-nav"
import { fetchPages } from "../pipeline/fetch-pages"
import { detectTechForCategory } from "../pipeline/detect-tech"
import { runLighthouseForCategory } from "../pipeline/run-lighthouse"
import { extractPagesContentForCategory } from "../pipeline/extract-pages-content"
import { buildReportStage } from "../pipeline/build-report"
import { estimateContent } from "../pipeline/estimate-content"
import { generateQuote, formatQuoteSummary } from "../pipeline/generate-quote"
import { finalizeOrder } from "../pipeline/finalize-order"
import { loadPricingConfig } from "../quote/pricing"
import { createInterface } from "readline"

// ── progress helpers ──

async function saveProgress(repo: Repo, requestId: string, siteId: string, progress: Record<string, CategoryProgress>): Promise<void> {
  await repo.putJson({ requestId, siteId, stage: "", name: "progress.json" }, progress)
}

function initCategoryProgress(category: Category): CategoryProgress {
  return {
    "detect-tech": category.wappalyzer ? "pending" : "not-requested",
    "run-lighthouse": category.lighthouse ? "pending" : "not-requested",
    "extract-pages-content": "pending",
  }
}

async function runCategoryTask(
  taskName: CategoryTaskName,
  fn: () => Promise<void>,
  progress: Record<string, CategoryProgress>,
  categoryId: string,
  repo: Repo,
  requestId: string,
  siteId: string,
): Promise<boolean> {
  if (progress[categoryId][taskName] === "not-requested") return true

  progress[categoryId][taskName] = "running"
  await saveProgress(repo, requestId, siteId, progress)

  try {
    process.stdout.write(`    ▶ ${taskName}`)
    await withRetry(fn)
    progress[categoryId][taskName] = "completed"
    await saveProgress(repo, requestId, siteId, progress)
    process.stdout.write(`\r    ✓ ${taskName}\n`)
    return true
  } catch (err) {
    progress[categoryId][taskName] = "failed"
    await saveProgress(repo, requestId, siteId, progress)
    process.stdout.write(`\n    ✗ ${taskName}: ${err instanceof Error ? err.message : err}\n`)
    return false
  }
}

// ── helpers ──

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 2000

async function withRetry(fn: () => Promise<void>, retries = MAX_RETRIES): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await fn()
      return
    } catch (err) {
      if (attempt >= retries) throw err
      const delay = RETRY_DELAY_MS * (attempt + 1)
      process.stdout.write(`  ⟳ retrying in ${delay / 1000}s...\n`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
}

function shouldRun(stage: StageName, opts: RunOptions): boolean {
  return !opts.stages || opts.stages.includes(stage)
}

async function promptApproval(message: string): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise(resolve => {
    rl.question(message, answer => {
      rl.close()
      resolve(answer.trim().toLowerCase() === "y")
    })
  })
}

async function runSitePhase1(repo: Repo, request: Request, site: Site, opts: RunOptions): Promise<boolean> {
  console.log(`\n═══ ${site.url} (Phase 1: estimate) ═══`)

  const stages: Array<{ name: StageName; fn: () => Promise<void>; bail: boolean }> = [
    { name: "fetch-home", fn: () => fetchHome(repo, request, site), bail: true },
    { name: "parse-links", fn: () => parseLinks(repo, request, site), bail: false },
    { name: "classify-nav", fn: () => classifyNav(repo, request, site), bail: true },
    { name: "estimate-content", fn: () => estimateContent(repo, request, site), bail: true },
  ]

  for (const { name, fn, bail } of stages) {
    if (!shouldRun(name, opts)) continue
    try {
      process.stdout.write(`  ▶ ${name}`)
      await withRetry(fn)
      process.stdout.write(`\r  ✓ ${name}\n`)
    } catch (err) {
      process.stdout.write(`\n  ✗ ${name} failed: ${err instanceof Error ? err.message : err}\n`)
      if (bail) return false
    }
  }
  return true
}

async function runSitePhase2(repo: Repo, request: Request, site: Site, opts: RunOptions): Promise<void> {
  console.log(`\n═══ ${site.url} (Phase 2: analyze) ═══`)

  // fetch-pages
  if (shouldRun("fetch-pages", opts)) {
    try {
      process.stdout.write(`  ▶ fetch-pages`)
      await withRetry(() => fetchPages(repo, request, site))
      process.stdout.write(`\r  ✓ fetch-pages\n`)
    } catch (err) {
      process.stdout.write(`\n  ✗ fetch-pages failed: ${err instanceof Error ? err.message : err}\n`)
      return
    }
  }

  // Per-category processing
  if (shouldRun("run-categories", opts)) {
    const progress: Record<string, CategoryProgress> = {}
    for (const cat of request.categories) {
      progress[cat.id] = initCategoryProgress(cat)
    }
    await saveProgress(repo, request.id, site.id, progress)

    for (const cat of request.categories) {
      console.log(`  ▷ category: ${cat.name}`)

      await runCategoryTask(
        "detect-tech",
        () => detectTechForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
      await runCategoryTask(
        "run-lighthouse",
        () => runLighthouseForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
      await runCategoryTask(
        "extract-pages-content",
        () => extractPagesContentForCategory(repo, request, site, cat),
        progress, cat.id, repo, request.id, site.id,
      )
    }
  }

  // Build report
  if (shouldRun("build-report", opts)) {
    try {
      process.stdout.write(`  ▶ build-report`)
      await withRetry(() => buildReportStage(repo, request, site))
      process.stdout.write(`\r  ✓ build-report\n`)
    } catch (err) {
      process.stdout.write(`\n  ✗ build-report: ${err instanceof Error ? err.message : err}\n`)
    }
  }
}

// ── public entry ──

export async function runAnalysis(
  input: AnalyzeInput,
  opts: RunOptions = {},
  repo: Repo = new Repo(process.cwd() + "/data"),
): Promise<string> {
  const request = await repo.createRequest(input)
  console.log(`\n==> Request ${request.id} (${request.sites.length} sites, ${request.categories.length} categories)`)

  const concurrency = Math.max(1, opts.concurrency ?? 1)

  // ── Phase 1: estimate ──
  const phase1Sites: Site[] = []
  const queue1 = [...request.sites]
  async function worker1(): Promise<void> {
    while (queue1.length > 0) {
      const site = queue1.shift()
      if (!site) return
      try {
        const ok = await runSitePhase1(repo, request, site, opts)
        if (ok) phase1Sites.push(site)
      } catch (err) {
        console.warn(`  ✗ site ${site.url} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker1))

  if (phase1Sites.length === 0) {
    console.warn("\n==> No sites completed Phase 1. Aborting.")
    return request.id
  }

  // ── Generate quote ──
  if (shouldRun("generate-quote" as StageName, opts)) {
    const pricing = loadPricingConfig()
    const order = await generateQuote(repo, request, pricing)
    console.log(formatQuoteSummary(order))

    const approved = await promptApproval("  Proceed with analysis? (y/n): ")
    if (!approved) {
      console.log("\n==> Quote rejected. Exiting.")
      return request.id
    }

    order.status = "approved"
    order.approvedAt = new Date().toISOString()
    await repo.putJson(
      { requestId: request.id, stage: "order", name: "order.json" },
      order,
    )
    console.log("\n==> Quote approved. Starting analysis...")
  }

  // ── Phase 2: analyze (only sites that passed Phase 1) ──
  const queue2 = [...phase1Sites]
  async function worker2(): Promise<void> {
    while (queue2.length > 0) {
      const site = queue2.shift()
      if (!site) return
      try {
        await runSitePhase2(repo, request, site, opts)
      } catch (err) {
        console.warn(`  ✗ site ${site.url} failed: ${err instanceof Error ? err.message : err}`)
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker2))

  // ── Finalize order ──
  if (shouldRun("generate-quote" as StageName, opts)) {
    try {
      const pricing = loadPricingConfig()
      await finalizeOrder(repo, request, pricing)
      console.log(`\n==> Order finalized`)
    } catch (err) {
      console.warn(`  ✗ finalize-order: ${err instanceof Error ? err.message : err}`)
    }
  }

  await repo.consolidateRequest(request.id)
  console.log(`\n==> consolidated → requests/${request.id}/result.json`)
  return request.id
}
