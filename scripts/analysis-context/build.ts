import type { Repo } from "../db/repo"
import type { AnalysisContext, AnalysisContextScope, AnalysisContextTiers } from "./types"

type TierKey = keyof AnalysisContextTiers

export async function buildAnalysisContext(
  repo: Repo,
  scope: AnalysisContextScope,
  tiers: AnalysisContextTiers
): Promise<AnalysisContext> {
  const missing: string[] = []
  let json: Record<string, unknown> = {}

  if (scope.kind === "category") {
    const req = await repo.getRequest(scope.requestId)
    const siteIds = scope.siteIds ?? req.sites.map(s => s.id)
    const bySite: Record<string, unknown> = {}
    for (const siteId of siteIds) {
      bySite[siteId] = await forCategory(
        repo, scope.requestId, siteId, scope.categoryId, tiers, missing,
      )
    }
    json = { sites: bySite }
    if (tiers.input) json.input = req
  } else if (scope.kind === "site") {
    json = await forSite(repo, scope.requestId, scope.siteId, tiers, missing)
  } else {
    const req = await repo.getRequest(scope.requestId)
    const sites: Record<string, unknown> = {}
    for (const s of req.sites) {
      sites[s.id] = await forSite(repo, scope.requestId, s.id, tiers, missing)
    }
    json = { sites }
    if (tiers.input) json.input = req
  }

  const bytes = Buffer.byteLength(JSON.stringify(json))
  return { scope, tiers, json, bytes, missing: Array.from(new Set(missing)) }
}

async function forCategory(
  repo: Repo,
  requestId: string,
  siteId: string,
  categoryId: string,
  tiers: AnalysisContextTiers,
  missing: string[]
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const tryPut = async (key: TierKey, stage: string, name: string) => {
    if (!tiers[key]) return
    const ref = { requestId, siteId, stage, name }
    if (await repo.artifactExists(ref)) out[key] = await repo.getJson(ref)
    else missing.push(key)
  }
  await tryPut("extractedContent", "extract-pages-content", `${categoryId}.json`)
  await tryPut("tech", "detect-tech", `${categoryId}.json`)
  await tryPut("lighthouse", "run-lighthouse", `${categoryId}.json`)
  if (tiers.report) {
    const ref = { requestId, siteId, stage: "build-report", name: "build-report.json" }
    if (await repo.artifactExists(ref)) out.report = await repo.getJson(ref)
    else missing.push("report")
  }
  if (tiers.rawPages) await addRawPages(repo, requestId, siteId, out, missing, categoryId)
  if (tiers.progress) {
    const ref = { requestId, siteId, stage: "", name: "progress.json" }
    if (await repo.artifactExists(ref)) out.progress = await repo.getJson(ref)
    else missing.push("progress")
  }
  return out
}

async function forSite(
  repo: Repo,
  requestId: string,
  siteId: string,
  tiers: AnalysisContextTiers,
  missing: string[]
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const req = await repo.getRequest(requestId)
  if (tiers.report) {
    const ref = { requestId, siteId, stage: "build-report", name: "build-report.json" }
    if (await repo.artifactExists(ref)) out.report = await repo.getJson(ref)
    else missing.push("report")
  }
  for (const stageKey of [["extractedContent", "extract-pages-content"], ["tech", "detect-tech"], ["lighthouse", "run-lighthouse"]] as const) {
    const [tierKey, stage] = stageKey
    if (!tiers[tierKey]) continue
    const byCategory: Record<string, unknown> = {}
    for (const cat of req.categories) {
      const ref = { requestId, siteId, stage, name: `${cat.id}.json` }
      if (await repo.artifactExists(ref)) byCategory[cat.id] = await repo.getJson(ref)
    }
    if (Object.keys(byCategory).length > 0) out[tierKey] = byCategory
    else missing.push(tierKey)
  }
  if (tiers.rawPages) await addRawPages(repo, requestId, siteId, out, missing)
  if (tiers.progress) {
    const ref = { requestId, siteId, stage: "", name: "progress.json" }
    if (await repo.artifactExists(ref)) out.progress = await repo.getJson(ref)
    else missing.push("progress")
  }
  return out
}

async function addRawPages(
  repo: Repo,
  requestId: string,
  siteId: string,
  out: Record<string, unknown>,
  missing: string[],
  categoryId?: string
) {
  const homeRef = { requestId, siteId, stage: "fetch-home", name: "home.html" }
  const pagesIndexRef = { requestId, siteId, stage: "fetch-pages", name: "index.json" }
  const pages: Record<string, string> = {}
  let any = false

  if (!categoryId && (await repo.artifactExists(homeRef))) {
    pages["home.html"] = (await repo.getArtifact(homeRef)).toString("utf8")
    any = true
  }

  let allowedUrls: Set<string> | null = null
  if (categoryId) {
    const classifyRef = { requestId, siteId, stage: "classify-nav", name: "classify-nav.json" }
    if (await repo.artifactExists(classifyRef)) {
      const classify = await repo.getJson<{ byCategory?: Record<string, string[]> }>(classifyRef)
      allowedUrls = new Set(classify.byCategory?.[categoryId] ?? [])
    } else {
      allowedUrls = new Set()
    }
  }

  if (await repo.artifactExists(pagesIndexRef)) {
    const index = await repo.getJson<{ pages?: Array<{ id: string; url: string; status: string }> }>(pagesIndexRef)
    const records = index.pages ?? []
    for (const rec of records) {
      if (!rec || typeof rec.id !== "string" || rec.status !== "ok") continue
      if (allowedUrls && !allowedUrls.has(rec.url)) continue
      const fileName = `${rec.id}.md`
      const mdRef = { requestId, siteId, stage: "fetch-pages", name: fileName }
      if (await repo.artifactExists(mdRef)) {
        pages[fileName] = (await repo.getArtifact(mdRef)).toString("utf8")
        any = true
      }
    }
  }
  if (any) out.rawPages = pages
  else missing.push("rawPages")
}
