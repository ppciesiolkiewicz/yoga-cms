import type { AnalyzeInput, RunOptions, StageName, Request, Site, Category, CategoryProgress, CategoryTaskName } from "./types"
import { Repo } from "../db/repo"
import { fetchHome } from "../pipeline/fetch-home"
import { parseLinks } from "../pipeline/parse-links"
import { classifyNav } from "../pipeline/classify-nav"
import { fetchPages } from "../pipeline/fetch-pages"
import { detectTechForCategory } from "../pipeline/detect-tech"
import { runLighthouseForCategory } from "../pipeline/run-lighthouse"
import { assessPagesForCategory } from "../pipeline/assess-pages"
import { extractPagesContentForCategory } from "../pipeline/extract-pages-content"
import { buildReportStage } from "../pipeline/build-report"

// ── progress helpers ──

async function saveProgress(repo: Repo, requestId: string, siteId: string, progress: Record<string, CategoryProgress>): Promise<void> {
  await repo.putJson({ requestId, siteId, stage: "", name: "progress.json" }, progress)
}

function initCategoryProgress(category: Category): CategoryProgress {
  return {
    "detect-tech": category.wappalyzer ? "pending" : "not-requested",
    "run-lighthouse": category.lighthouse ? "pending" : "not-requested",
    "assess-pages": "pending",
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
    await fn()
    progress[categoryId][taskName] = "completed"
    await saveProgress(repo, requestId, siteId, progress)
    console.log(`    ✓ ${taskName}`)
    return true
  } catch (err) {
    progress[categoryId][taskName] = "failed"
    await saveProgress(repo, requestId, siteId, progress)
    console.warn(`    ✗ ${taskName}: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

// ── site runner ──

function shouldRun(stage: StageName, opts: RunOptions): boolean {
  return !opts.stages || opts.stages.includes(stage)
}

async function runSite(repo: Repo, request: Request, site: Site, opts: RunOptions): Promise<void> {
  console.log(`\n═══ ${site.url} ═══`)

  // Infrastructure stages (sequential, bail on critical failures)
  const infra: Array<{ name: StageName; fn: () => Promise<void>; bail: boolean }> = [
    { name: "fetch-home", fn: () => fetchHome(repo, request, site), bail: true },
    { name: "parse-links", fn: () => parseLinks(repo, request, site), bail: false },
    { name: "classify-nav", fn: () => classifyNav(repo, request, site), bail: true },
    { name: "fetch-pages", fn: () => fetchPages(repo, request, site), bail: true },
  ]

  for (const { name, fn, bail } of infra) {
    if (!shouldRun(name, opts)) continue
    try {
      console.log(`  ▶ ${name}`)
      await fn()
      console.log(`  ✓ ${name}`)
    } catch (err) {
      console.warn(`  ✗ ${name} failed: ${err instanceof Error ? err.message : err}`)
      if (bail) return
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
        "assess-pages",
        () => assessPagesForCategory(repo, request, site, cat),
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
      console.log(`  ▶ build-report`)
      await buildReportStage(repo, request, site)
      console.log(`  ✓ build-report`)
    } catch (err) {
      console.warn(`  ✗ build-report: ${err instanceof Error ? err.message : err}`)
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
