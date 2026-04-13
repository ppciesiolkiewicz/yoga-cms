import { randomBytes } from "crypto"
import { join } from "path"
import type {
  AnalyzeInput,
  AIQuery,
  ArtifactRef,
  Request,
  RequestIndexEntry,
  StoredRequestIndexEntry,
  RequestStatus,
  Order,
  Category,
  Site,
} from "../core/types"
import { Store } from "./store"
import { dbRoot, requestDir, refToPath } from "./paths"

export class Repo {
  readonly root: string
  private store: Store

  constructor(dataDir: string, store: Store = new Store()) {
    this.root = dbRoot(dataDir)
    this.store = store
  }

  // ── requests ──

  async createRequest(input: AnalyzeInput): Promise<Request> {
    const id = newId()
    const createdAt = new Date().toISOString()
    const usedSlugs = new Set<string>()
    const categories: Category[] = input.categories.map(c => {
      let slug = slugify(c.name)
      while (usedSlugs.has(slug)) slug += "-2"
      usedSlugs.add(slug)
      return { ...c, id: slug }
    })
    const sites: Site[] = input.sites.map(s => ({ ...s, id: newId("site") }))
    const request: Request = { id, createdAt, displayName: input.displayName, categories, sites }

    await this.store.writeFile(
      join(requestDir(this.root, id), "request.json"),
      JSON.stringify(request, null, 2),
    )
    await this.appendIndex({
      id,
      displayName: input.displayName,
      createdAt,
      siteCount: sites.length,
      categoryCount: categories.length,
    })
    return request
  }

  async getRequest(id: string): Promise<Request & { status: RequestStatus }> {
    const path = join(requestDir(this.root, id), "request.json")
    const buf = await this.store.readFile(path)
    const request = JSON.parse(buf.toString("utf8")) as Request
    const status = await this.deriveStatus(id)
    return { ...request, status }
  }

  private async deriveStatus(id: string): Promise<RequestStatus> {
    const orderRef = { requestId: id, stage: "order", name: "order.json" }
    if (!(await this.artifactExists(orderRef))) return "pending"

    const order = await this.getJson<Order>(orderRef)
    if (order.status === "quoted") return "pending"
    if (order.status === "rejected") return "rejected"
    if (order.status === "approved") return "processing"
    if (order.status === "completed") return "complete"
    return "pending"
  }

  async listRequests(): Promise<RequestIndexEntry[]> {
    const path = join(this.root, "index.json")
    if (!(await this.store.exists(path))) return []
    const buf = await this.store.readFile(path)
    const entries = JSON.parse(buf.toString("utf8")) as StoredRequestIndexEntry[]
    return Promise.all(
      entries.map(async e => ({ ...e, status: await this.deriveStatus(e.id) }))
    )
  }

  private async appendIndex(entry: StoredRequestIndexEntry): Promise<void> {
    const path = join(this.root, "index.json")
    let list: StoredRequestIndexEntry[] = []
    if (await this.store.exists(path)) {
      const buf = await this.store.readFile(path)
      list = JSON.parse(buf.toString("utf8")) as StoredRequestIndexEntry[]
    }
    const next = [...list.filter(e => e.id !== entry.id), entry]
    await this.store.writeFile(
      join(this.root, "index.json"),
      JSON.stringify(next, null, 2),
    )
  }

  async getOrder(requestId: string): Promise<Order | null> {
    const ref = { requestId, stage: "order", name: "order.json" }
    if (!(await this.artifactExists(ref))) return null
    return this.getJson<Order>(ref)
  }

  // ── artifacts ──

  async putArtifact(ref: ArtifactRef, content: string | Buffer): Promise<void> {
    await this.store.writeFile(refToPath(this.root, ref), content)
  }

  async getArtifact(ref: ArtifactRef): Promise<Buffer> {
    return await this.store.readFile(refToPath(this.root, ref))
  }

  async putJson<T>(ref: ArtifactRef, obj: T): Promise<void> {
    await this.putArtifact(ref, JSON.stringify(obj, null, 2))
  }

  async getJson<T>(ref: ArtifactRef): Promise<T> {
    const buf = await this.getArtifact(ref)
    return JSON.parse(buf.toString("utf8")) as T
  }

  async artifactExists(ref: ArtifactRef): Promise<boolean> {
    return await this.store.exists(refToPath(this.root, ref))
  }

  async putQuery(query: AIQuery): Promise<void> {
    const dir = query.siteId
      ? join(requestDir(this.root, query.requestId), "sites", query.siteId, "queries")
      : join(requestDir(this.root, query.requestId), "queries")
    await this.store.writeFile(
      join(dir, `${query.id}.json`),
      JSON.stringify(query, null, 2),
    )
  }

  async getQueries(requestId: string, siteId: string): Promise<AIQuery[]> {
    const dir = join(requestDir(this.root, requestId), "sites", siteId, "queries")
    const files = await this.store.listFiles(dir)
    const queries: AIQuery[] = []
    for (const f of files) {
      if (!f.endsWith(".json")) continue
      const buf = await this.store.readFile(f)
      queries.push(JSON.parse(buf.toString("utf8")) as AIQuery)
    }
    return queries
  }

  async consolidateRequest(id: string): Promise<void> {
    const request = await this.getRequest(id)
    const sites: Array<{ siteId: string; url: string; artifacts: Record<string, unknown>; queries: AIQuery[] }> = []

    // Stages that store per-category artifacts as <categoryId>.json
    const perCategoryStages = new Set(["detect-tech", "run-lighthouse", "extract-pages-content"])

    for (const site of request.sites) {
      const stages = await this.store.listDirs(
        join(requestDir(this.root, id), "sites", site.id),
      )
      const artifacts: Record<string, unknown> = {}
      for (const stage of stages) {
        if (perCategoryStages.has(stage)) {
          // Collect per-category JSONs into a map keyed by categoryId
          const byCategory: Record<string, unknown> = {}
          for (const cat of request.categories) {
            const ref = { requestId: id, siteId: site.id, stage, name: `${cat.id}.json` }
            if (await this.artifactExists(ref)) {
              try {
                byCategory[cat.id] = await this.getJson(ref)
              } catch {
                // skip non-parseable
              }
            }
          }
          if (Object.keys(byCategory).length > 0) {
            artifacts[stage] = byCategory
          }
        } else {
          // Single-file stages — try common names
          const candidates = [
            `${stage}.json`,
            "classify-nav.json", "build-report.json", "nav-links.json",
          ]
          for (const name of candidates) {
            const ref = { requestId: id, siteId: site.id, stage, name }
            if (await this.artifactExists(ref)) {
              try {
                artifacts[stage] = await this.getJson(ref)
              } catch {
                // not json, skip in result.json (raw files still on disk)
              }
              break
            }
          }
        }
      }

      // Also pick up progress.json from site root
      const progressRef = { requestId: id, siteId: site.id, stage: "", name: "progress.json" }
      if (await this.artifactExists(progressRef)) {
        try {
          artifacts["progress"] = await this.getJson(progressRef)
        } catch {
          // skip
        }
      }

      const queries = await this.getQueries(id, site.id)
      sites.push({ siteId: site.id, url: site.url, artifacts, queries })
    }

    const result = { request, sites }
    await this.putJson(
      { requestId: id, stage: "", name: "result.json" },
      result,
    )
  }
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "category"
}

export function newId(prefix = "r"): string {
  const stamp = Date.now().toString(36)
  const rand = randomBytes(4).toString("hex")
  return `${prefix}_${stamp}_${rand}`
}
