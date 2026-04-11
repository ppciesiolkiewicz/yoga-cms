import { randomBytes } from "crypto"
import { join } from "path"
import type {
  AnalyzeInput,
  ArtifactRef,
  Request,
  RequestIndexEntry,
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
    const categories: Category[] = input.categories.map(c => ({ ...c, id: newId("cat") }))
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

  async getRequest(id: string): Promise<Request> {
    const path = join(requestDir(this.root, id), "request.json")
    const buf = await this.store.readFile(path)
    return JSON.parse(buf.toString("utf8")) as Request
  }

  async listRequests(): Promise<RequestIndexEntry[]> {
    const path = join(this.root, "index.json")
    if (!(await this.store.exists(path))) return []
    const buf = await this.store.readFile(path)
    return JSON.parse(buf.toString("utf8")) as RequestIndexEntry[]
  }

  private async appendIndex(entry: RequestIndexEntry): Promise<void> {
    const list = await this.listRequests()
    const next = [...list.filter(e => e.id !== entry.id), entry]
    await this.store.writeFile(
      join(this.root, "index.json"),
      JSON.stringify(next, null, 2),
    )
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
}

function newId(prefix = "r"): string {
  const stamp = Date.now().toString(36)
  const rand = randomBytes(4).toString("hex")
  return `${prefix}_${stamp}_${rand}`
}
